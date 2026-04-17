"""Mix background audio with TTS segments using professional ducking."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from pydub import AudioSegment

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


@dataclass
class TtsSegment:
    """A single TTS audio chunk placed on the timeline."""
    audio: AudioSegment
    start_ms: int
    end_ms: int


class AudioMixer:
    """Mix background + TTS voice with ducking.

    During TTS voice playback the background is reduced to
    ``ducking_bg_volume`` (default 0.3x) with fade transitions of
    ``ducking_fade_ms`` (default 200 ms).
    """

    def __init__(self, config: DubbingConfig) -> None:
        self.cfg = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def mix(
        self,
        background: AudioSegment,
        tts_segments: list[TtsSegment],
    ) -> AudioSegment:
        """Return the final mixed AudioSegment (background + ducked TTS)."""

        if not tts_segments:
            return background

        bg = background
        ducking_db = self._volume_to_db(self.cfg.ducking_bg_volume)
        fade_ms = self.cfg.ducking_fade_ms

        # Build a volume automation envelope on the background
        # by applying gain reduction in regions where TTS is active.
        ducked_bg = self._apply_ducking(bg, tts_segments, ducking_db, fade_ms)

        # Overlay TTS segments at their respective start positions
        result = ducked_bg
        for seg in tts_segments:
            if len(seg.audio) == 0:
                continue
            # Ensure TTS volume is at the configured level
            fg_db = self._volume_to_db(self.cfg.ducking_fg_volume)
            tts_audio = seg.audio.apply_gain(fg_db)
            result = result.overlay(tts_audio, position=seg.start_ms)

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _volume_to_db(ratio: float) -> float:
        """Convert a linear volume ratio to dB gain adjustment.

        ratio=1.0 -> 0 dB, ratio=0.3 -> ~-10.5 dB.
        """
        if ratio <= 0:
            return -120.0
        import math
        return 20.0 * math.log10(ratio)

    def _apply_ducking(
        self,
        bg: AudioSegment,
        segments: list[TtsSegment],
        ducking_db: float,
        fade_ms: int,
    ) -> AudioSegment:
        """Reduce background volume during TTS segments with fade transitions."""

        # Sort segments by start time
        sorted_segs = sorted(segments, key=lambda s: s.start_ms)

        # Merge overlapping/adjacent regions
        regions: list[tuple[int, int]] = []
        for seg in sorted_segs:
            start = max(0, seg.start_ms - fade_ms)
            end = min(len(bg), seg.start_ms + len(seg.audio) + fade_ms)
            if regions and start <= regions[-1][1]:
                regions[-1] = (regions[-1][0], max(regions[-1][1], end))
            else:
                regions.append((start, end))

        if not regions:
            return bg

        # Build the ducked background by assembling pieces
        result = AudioSegment.empty()
        prev_end = 0

        for region_start, region_end in regions:
            # Unchanged part before this region
            if region_start > prev_end:
                result += bg[prev_end:region_start]

            # Ducked region with fade in/out
            region = bg[region_start:region_end]
            ducked = region.apply_gain(ducking_db)

            # Apply fade-in (at the start of ducking = volume goes DOWN)
            if fade_ms > 0 and len(ducked) > fade_ms:
                ducked = ducked.fade(
                    from_gain=0.0, to_gain=ducking_db,
                    start=0, duration=fade_ms,
                )
            # Apply fade-out (at the end of ducking = volume goes back UP)
            if fade_ms > 0 and len(ducked) > 2 * fade_ms:
                ducked = ducked.fade(
                    from_gain=ducking_db, to_gain=0.0,
                    start=len(ducked) - fade_ms, duration=fade_ms,
                )

            result += ducked
            prev_end = region_end

        # Append remaining background after the last region
        if prev_end < len(bg):
            result += bg[prev_end:]

        return result
