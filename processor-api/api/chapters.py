"""Chapter (per-video) operations: currently supports renaming a chapter file
while preserving the SNNeMM prefix and keeping sibling files (subs, dubs) in sync.

Single responsibility: expose one HTTP surface to rename the main video plus
all its sidecar files (same stem) atomically enough for our use case.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from api.settings import get_library_path

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chapters", tags=["chapters"])

# Regex to split `{prefix} - SNNeMM - {title}{ext}` on the filename (not path).
# Example: "John Danaher - S01E03 - Armbar Fundamentals.mkv"
#          prefix = "John Danaher", season=01, ep=03, ext=".mkv"
_SNNEMM_RE = re.compile(
    r"^(?P<prefix>.*?)\s*-\s*S(?P<season>\d{2})E(?P<ep>\d{2,3})\s*-\s*.*(?P<ext>\.[^.]+)$"
)

# Characters illegal on Windows filenames (and that we never want anywhere).
_ILLEGAL_RE = re.compile(r'[\/\\:*?"<>|]')
_WS_RE = re.compile(r"\s+")

# Sidecar suffixes we may need to rename alongside the main video.
# Each entry is the suffix that replaces the video extension entirely
# (so "Name.mkv" → "Name.srt" / "Name.en.srt" / ...).
_SIDECAR_SUFFIXES = (
    ".srt",
    ".en.srt",
    ".ES.srt",
    "_ESP_DUB.srt",
    "_DOBLADO.mkv",
    "_DOBLADO.mp4",
)


def _sanitize_title(raw: str) -> str:
    """Strip, replace illegal chars with `_`, collapse whitespace, cap at 120.

    Returns empty string if the result is empty / only whitespace; callers
    must treat that as a validation failure.
    """
    if not isinstance(raw, str):
        return ""
    s = raw.strip()
    s = _ILLEGAL_RE.sub("_", s)
    s = _WS_RE.sub(" ", s).strip()
    if not s:
        return ""
    if len(s) > 120:
        s = s[:120].rstrip()
    return s


def _resolve_within_library(candidate: Path, library_root: Path) -> Path:
    """Return the resolved absolute path, or raise 403 if it escapes root."""
    try:
        resolved = candidate.resolve(strict=False)
        root_resolved = library_root.resolve(strict=False)
    except (OSError, RuntimeError) as e:
        raise HTTPException(status_code=403, detail=f"Path traversal: {e}")

    try:
        resolved.relative_to(root_resolved)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Path traversal: target escapes library_path",
        )
    return resolved


def _find_sibling(stem_path: Path, suffix: str) -> Path | None:
    """Return existing sibling path with ``suffix`` replacing the full ext, else None."""
    candidate = stem_path.with_name(stem_path.stem + suffix)
    return candidate if candidate.exists() else None


@router.patch("/rename")
async def rename_chapter(request: Request) -> Any:
    """Rename a chapter file (and its sidecars) preserving the SNNeMM prefix.

    Body: {"old_path": "...", "new_title": "..."}.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid JSON body")

    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="Body must be an object")

    old_path = body.get("old_path")
    new_title_raw = body.get("new_title")

    if not isinstance(old_path, str) or not old_path:
        raise HTTPException(status_code=422, detail="old_path is required")
    if not isinstance(new_title_raw, str):
        raise HTTPException(status_code=422, detail="new_title is required")

    sanitized = _sanitize_title(new_title_raw)
    if not sanitized:
        raise HTTPException(
            status_code=422,
            detail="new_title is empty after sanitization",
        )

    library_root_str = get_library_path()
    if not library_root_str:
        raise HTTPException(status_code=400, detail="library_path not configured")
    library_root = Path(library_root_str)

    old = Path(old_path)
    resolved_old = _resolve_within_library(old, library_root)

    if not resolved_old.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {old_path}")
    if not resolved_old.is_file():
        raise HTTPException(status_code=404, detail="old_path is not a file")

    # Parse SNNeMM from the filename (not from full path).
    m = _SNNEMM_RE.match(resolved_old.name)
    if not m:
        raise HTTPException(
            status_code=422,
            detail="Filename does not match `{prefix} - SNNeMM - {title}{ext}` pattern",
        )

    prefix = m.group("prefix").strip()
    season = m.group("season")
    ep = m.group("ep")
    ext = m.group("ext")

    new_filename = f"{prefix} - S{season}E{ep} - {sanitized}{ext}"
    new_path = resolved_old.with_name(new_filename)
    # Ensure resulting path still lives inside the library (redundant but cheap).
    _resolve_within_library(new_path, library_root)

    renamed: list[dict[str, str]] = []

    # Rename main file first (idempotent if name unchanged).
    if new_path != resolved_old:
        if new_path.exists():
            raise HTTPException(
                status_code=409,
                detail=f"Target already exists: {new_path.name}",
            )
        os.rename(resolved_old, new_path)
    renamed.append({"from": str(resolved_old), "to": str(new_path)})

    # Rename sidecars (based on original stem → new stem).
    old_stem = resolved_old.stem  # e.g. "Author - S01E01 - Old Title"
    new_stem = new_path.stem
    for suffix in _SIDECAR_SUFFIXES:
        # Siblings were found via the OLD stem in the OLD location.
        sib_old = resolved_old.with_name(old_stem + suffix)
        if not sib_old.exists():
            continue
        sib_new = resolved_old.with_name(new_stem + suffix)
        if sib_new == sib_old:
            continue
        if sib_new.exists():
            log.warning("Sidecar target already exists, skipping: %s", sib_new)
            continue
        os.rename(sib_old, sib_new)
        renamed.append({"from": str(sib_old), "to": str(sib_new)})

    return JSONResponse({"renamed": renamed})


# WIRE_ROUTER: from api.chapters import router as chapters_router; app.include_router(chapters_router)
