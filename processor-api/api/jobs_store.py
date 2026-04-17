"""Persistent JSON store for jobs.

Single responsibility: serialize/deserialize jobs to/from disk.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


class JobsStore:
    """Load/save a dict of jobs keyed by job_id as JSON on disk."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def _ensure_dir(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, dict[str, Any]]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
            log.warning("jobs file %s not a dict, ignoring", self.path)
            return {}
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Failed to load jobs from %s: %s", self.path, exc)
            return {}

    def save(self, jobs: dict[str, dict[str, Any]]) -> None:
        self._ensure_dir()
        self.path.write_text(
            json.dumps(jobs, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    def upsert(self, job_id: str, job_data: dict[str, Any]) -> None:
        jobs = self.load()
        jobs[job_id] = job_data
        self.save(jobs)
