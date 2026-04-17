"""Phrase synchronization with lookahead-based time allocation."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


@dataclass
class SrtBlock:
    """Parsed SRT subtitle block."""
    index: int
    start_ms: int
    end_ms: int
    text: str

    @property
    def duration_ms(self) -> int:
        return self.end_ms - self.start_ms


@dataclass
class PlannedBlock:
    """A block with its allocated time budget."""
    text: str
    target_start_ms: int
    target_end_ms: int
    allocated_ms: int


class SyncAligner:
    """Plan timing for TTS phrases using lookahead groups.

    The aligner groups phrases into windows of ``lookahead_phrases``
    (default 5), estimates relative TTS duration for each phrase,
    and distributes the available time proportionally.  Short phrases
    donate surplus time to longer neighbours.
    """

    def __init__(self, config: DubbingConfig) -> None:
        self.cfg = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def plan(self, blocks: list[SrtBlock]) -> list[PlannedBlock]:
        """Return a list of :class:`PlannedBlock` with allocated durations."""
        if not blocks:
            return []

        planned: list[PlannedBlock] = []
        window = self.cfg.lookahead_phrases

        for group_start in range(0, len(blocks), window):
            group = blocks[group_start : group_start + window]
            group_planned = self._plan_group(group)
            planned.extend(group_planned)

        return planned

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _plan_group(self, group: list[SrtBlock]) -> list[PlannedBlock]:
        """Distribute time within one lookahead group."""
        if not group:
            return []

        # Total available time for the group:
        # from the start of the first block to the end of the last block
        total_available_ms = group[-1].end_ms - group[0].start_ms

        # Estimate relative duration for each phrase
        estimates = [self._estimate_duration_ms(b.text) for b in group]
        total_estimated = sum(estimates)

        # Distribute proportionally
        allocations: list[int] = []
        if total_estimated > 0:
            for est in estimates:
                share = int(total_available_ms * est / total_estimated)
                share = max(share, self.cfg.min_phrase_duration_ms)
                allocations.append(share)
        else:
            equal = max(
                total_available_ms // len(group),
                self.cfg.min_phrase_duration_ms,
            )
            allocations = [equal] * len(group)

        # Build PlannedBlocks with correct start/end positions
        planned: list[PlannedBlock] = []
        cursor = group[0].start_ms
        for i, block in enumerate(group):
            alloc = allocations[i]
            planned.append(PlannedBlock(
                text=block.text,
                target_start_ms=cursor,
                target_end_ms=cursor + alloc,
                allocated_ms=alloc,
            ))
            cursor += alloc

        return planned

    def _estimate_duration_ms(self, text: str) -> float:
        """Rough estimate of TTS output duration for *text*.

        Uses ``avg_ms_per_char`` from config (default ~60 ms/char).
        """
        if not text:
            return float(self.cfg.min_phrase_duration_ms)
        return max(
            len(text) * self.cfg.avg_ms_per_char,
            float(self.cfg.min_phrase_duration_ms),
        )
