"""Cache for library scan results.

Single responsibility: persist the last scan output in library.json.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger(__name__)

POSTER_NAMES = (
    "poster.jpg", "poster.png", "poster.webp",
    "cover.jpg", "cover.png", "cover.webp",
    "folder.jpg",
)


class ScanCache:
    """Persist the most recent scan_library() result as JSON."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def _ensure_dir(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def exists(self) -> bool:
        return self.path.exists()

    def load(self) -> Optional[dict[str, Any]]:
        if not self.path.exists():
            return None
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Failed to load scan cache %s: %s", self.path, exc)
            return None

    def save(self, instructionals: list[dict[str, Any]]) -> None:
        self._ensure_dir()
        payload = {"instructionals": instructionals}
        self.path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def find_poster(folder: Path) -> Optional[Path]:
    """Find a poster file in ``folder`` (case-insensitive). Return None if missing.

    Strategy: prefer canonical names (poster/cover/folder), else fall back to
    any image file in the folder root (sorted for determinism).
    """
    if not folder.exists() or not folder.is_dir():
        return None
    lowered = {n.lower(): n for n in POSTER_NAMES}
    try:
        entries = list(folder.iterdir())
    except (PermissionError, OSError):
        return None
    fallback: list[Path] = []
    for entry in entries:
        if not entry.is_file():
            continue
        name_lower = entry.name.lower()
        if name_lower in lowered:
            return entry
        if name_lower.endswith(_IMAGE_EXTS):
            fallback.append(entry)
    if fallback:
        return sorted(fallback, key=lambda p: p.name.lower())[0]
    return None


def find_poster_cached(folder: Path, poster_filename: Optional[str]) -> Optional[Path]:
    """Resolve poster path preferring a cached filename to avoid iterdir on NAS.

    If ``poster_filename`` is provided and ``folder / poster_filename`` exists,
    return it directly. Otherwise fall back to :func:`find_poster` (iterdir).
    """
    if poster_filename:
        try:
            candidate = folder / poster_filename
            if candidate.is_file():
                return candidate
        except OSError:
            pass
    return find_poster(folder)


def enrich_with_poster(instructionals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add has_poster + poster_filename fields to each item (in place-friendly)."""
    for item in instructionals:
        folder = item.get("path")
        poster = find_poster(Path(folder)) if folder else None
        item["has_poster"] = poster is not None
        item["poster_filename"] = poster.name if poster else None
    return instructionals


def patch_poster_in_cache(
    cache: ScanCache,
    instructional_name: str,
    poster_filename: Optional[str],
) -> bool:
    """Update has_poster/poster_filename for a single instructional in the scan cache.

    Returns True if the cache was updated. Used after ad-hoc poster writes
    (oracle auto-download, manual upload) so the /library endpoint reflects
    the new poster without a full rescan.
    """
    data = cache.load()
    if not data or not isinstance(data, dict):
        return False
    items = data.get("instructionals")
    if not isinstance(items, list):
        return False
    changed = False
    for item in items:
        if item.get("name") == instructional_name:
            item["has_poster"] = bool(poster_filename)
            item["poster_filename"] = poster_filename
            changed = True
            break
    if changed:
        cache.save(items)
    return changed
