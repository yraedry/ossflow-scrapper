"""FastAPI entrypoint for dubbing-generator backend.

Run:
    uvicorn app:app --host 0.0.0.0 --port 8003
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

_KIT_PARENT = Path(__file__).resolve().parent.parent
if str(_KIT_PARENT) not in sys.path:
    sys.path.insert(0, str(_KIT_PARENT))

from bjj_service_kit import JobEvent, RunRequest, create_app, emit_logs  # noqa: E402


SERVICE_NAME = "dubbing-generator"


def _resolve_input(path: Path) -> Path:
    """Validate input path exists. Returns the path as-is (file or directory)."""
    if not path.exists():
        raise FileNotFoundError(f"Path does not exist: {path}")
    return path


def _resolve_srt_for(video_path: Path) -> Optional[Path]:
    """Locate the Spanish SRT next to a video (prefers _ESP_DUB, then _ESP)."""
    base = video_path.with_suffix("")
    for suffix in ("_ESP_DUB.srt", "_ESP.srt", "_ES.srt"):
        candidate = base.parent / f"{base.name}{suffix}"
        if candidate.exists():
            return candidate
    return None


def _run_dubbing_generator(req: RunRequest, emit) -> None:
    """Bridge RunRequest -> dubbing_generator.pipeline.DubbingPipeline."""
    input_path = _resolve_input(Path(req.input_path))

    opts = req.options or {}
    level = logging.DEBUG if opts.get("verbose") else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%H:%M:%S")

    with emit_logs(emit, level=level):
        from dubbing_generator.config import DubbingConfig  # type: ignore
        from dubbing_generator.pipeline import DubbingPipeline  # type: ignore

        config = DubbingConfig(use_model_voice=bool(opts.get("use_model_voice", False)))

        emit(JobEvent(type="log", data={"message": f"starting dubbing-generator on {input_path}"}))
        pipeline = DubbingPipeline(config)
        if input_path.is_file():
            srt = _resolve_srt_for(input_path)
            if srt is None:
                raise FileNotFoundError(f"No Spanish SRT found for {input_path.name}")
            out = pipeline.process_file(input_path, srt)
            emit(JobEvent(type="progress", data={"pct": 100, "videos": 1}))
            emit(JobEvent(type="log", data={"message": f"dubbed: {out.name}"}))
        else:
            results = pipeline.process_directory(input_path)
            emit(JobEvent(type="progress", data={"pct": 100, "videos": len(results)}))


app = create_app(service_name=SERVICE_NAME, task_fn=_run_dubbing_generator)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
