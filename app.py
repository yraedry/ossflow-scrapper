"""Lean FastAPI entrypoint: scrapper + ffmpeg splitting only.

Used by the default ``chapter-splitter`` service (lightweight image).
The heavy detector-by-signals pipeline lives in ``app.py`` and runs
inside the optional ``chapter-splitter-signal`` service.

Run:
    uvicorn app_scrapper:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import logging
import sys
import threading
import uuid
from pathlib import Path

# Make ossflow_service_kit importable when running from /app.
_KIT_PARENT = Path(__file__).resolve().parent.parent
if str(_KIT_PARENT) not in sys.path:
    sys.path.insert(0, str(_KIT_PARENT))

from ossflow_service_kit import JobEvent, RunRequest, create_app, emit_logs  # noqa: E402

SERVICE_NAME = "chapter-splitter"

log = logging.getLogger(__name__)


def _unsupported_task(req: RunRequest, emit) -> None:
    """Reject signal-mode invocations on the lean image."""
    emit(JobEvent(
        type="error",
        data={
            "message": (
                "Signal-mode chapter detection is not available in this lean "
                "image. Bring up the 'chapter-splitter-signal' service "
                "(profile: signal) or use the scrapper workflow."
            ),
        },
    ))
    raise RuntimeError("signal mode unavailable in lean chapter-splitter")


app = create_app(service_name=SERVICE_NAME, task_fn=_unsupported_task)


# ---------------------------------------------------------------------------
# Scrapper HTTP endpoints
# ---------------------------------------------------------------------------

from typing import Any  # noqa: E402

from fastapi import HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from scrapper import (  # noqa: E402
    ScraperError,
    ScrapeResult,
    ProviderNotFoundError,
    ProviderScrapeError,
    ProviderSearchError,
    ProviderTimeoutError,
    discover as _scrapper_discover,
    registry as _scrapper_registry,
)
from splitting.chapter_splitter import ChapterSplitter  # noqa: E402

_scrapper_discover()


class _SearchReq(BaseModel):
    title: str
    author: str | None = None
    provider_id: str | None = None


class _ScrapeReq(BaseModel):
    url: str
    provider_id: str | None = None


class _RunScrapeRequest(BaseModel):
    path: str
    scrape_data: dict[str, Any]
    output_dir: str | None = None


@app.get("/scrapper/providers")
def list_scrapper_providers() -> list[dict]:
    return [
        {"id": p.id, "display_name": p.display_name, "domains": list(p.domains)}
        for p in _scrapper_registry.all()
    ]


@app.post("/scrapper/search")
def scrapper_search(req: _SearchReq) -> list[dict]:
    try:
        if req.provider_id:
            providers = [_scrapper_registry.get(req.provider_id)]
        else:
            providers = _scrapper_registry.all()
        if not providers:
            raise HTTPException(status_code=503, detail="no scrapper providers registered")
        all_candidates: list = []
        for p in providers:
            try:
                all_candidates.extend(p.search(req.title, req.author))
            except ScraperError as exc:
                log.warning("provider %s search failed: %s", p.id, exc)
        all_candidates.sort(key=lambda c: c.score, reverse=True)
        return [c.model_dump() for c in all_candidates]
    except ProviderNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except ProviderSearchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/scrapper/scrape")
def scrapper_scrape(req: _ScrapeReq) -> dict:
    try:
        provider = (
            _scrapper_registry.get(req.provider_id)
            if req.provider_id
            else _scrapper_registry.resolve_by_url(req.url)
        )
        result = provider.scrape(req.url)
        return result.model_dump()
    except ProviderNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))
    except ProviderScrapeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# ---------------------------------------------------------------------------
# /run-scrape: reuse the same SSE infra as the heavy app
# ---------------------------------------------------------------------------

@app.post("/run-scrape")
def run_scrape(req: _RunScrapeRequest) -> dict[str, str]:
    instructional = Path(req.path)
    if not instructional.is_absolute() or ".." in instructional.parts:
        raise HTTPException(status_code=422, detail="path must be absolute and free of '..'")
    if instructional.is_file():
        instructional = instructional.parent
    if not instructional.exists() or not instructional.is_dir():
        raise HTTPException(status_code=404, detail=f"directory not found: {instructional}")

    try:
        scrape_obj = ScrapeResult.model_validate(req.scrape_data)
    except Exception as exc:  # pydantic.ValidationError
        raise HTTPException(status_code=422, detail=f"invalid scrape_data: {exc}")

    output_dir = Path(req.output_dir) if req.output_dir else None
    registry = app.state.runner.registry
    job_id, q = registry.create()

    def emit(evt: JobEvent) -> None:
        q.put(evt)

    def _task() -> None:
        try:
            with emit_logs(emit, level=logging.INFO):
                splitter = ChapterSplitter(
                    instructional_dir=instructional,
                    scrape_result=scrape_obj,
                    output_dir=output_dir,
                )

                def _cb(pct: float, message: str) -> None:
                    emit(JobEvent(type="progress", data={"pct": pct, "message": message}))

                report = splitter.split(progress_cb=_cb)
                emit(JobEvent(type="done", data={"report": report.__dict__}))
        except Exception as exc:  # noqa: BLE001
            log.exception("scrape job %s failed", job_id)
            emit(JobEvent(type="error", data={"message": str(exc)}))
        finally:
            q.close()

    threading.Thread(target=_task, daemon=True).start()
    return {"job_id": job_id}
