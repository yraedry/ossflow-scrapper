"""Time-stretch audio with quality limits (max 1.5x compression)."""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from pathlib import Path

from pydub import AudioSegment

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


def trim_silence(
    audio: AudioSegment,
    threshold_db: float = -40.0,
    chunk_ms: int = 10,
) -> AudioSegment:
    """Remove leading and trailing silence from *audio*."""

    def _leading_silence(sound: AudioSegment) -> int:
        ms = 0
        while ms < len(sound) and sound[ms : ms + chunk_ms].dBFS < threshold_db:
            ms += chunk_ms
        return ms

    start = _leading_silence(audio)
    end = _leading_silence(audio.reverse())
    duration = len(audio)

    if start + end >= duration:
        return audio  # nothing left -- return original

    return audio[start : duration - end]


def _atempo_ffmpeg(input_wav: str, output_wav: str, ratio: float) -> None:
    """Apply atempo filter via ffmpeg.  *ratio* is already clamped."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", input_wav,
            "-filter:a", f"atempo={ratio}",
            "-vn", output_wav,
        ],
        check=True,
    )


def stretch_audio(
    audio: AudioSegment,
    target_duration_ms: int,
    max_ratio: float = 1.5,
) -> AudioSegment:
    """Adjust *audio* to fit *target_duration_ms*.

    Strategy:
      1. Trim leading/trailing silence first (free time gain).
      2. If trimmed audio fits -> return it.
      3. If compression needed and ratio <= *max_ratio* -> atempo.
      4. If ratio > *max_ratio* -> compress at max_ratio (accept slight overflow).

    Returns the processed AudioSegment.
    """
    trimmed = trim_silence(audio)
    current_ms = len(trimmed)

    if current_ms == 0:
        return trimmed

    # Already fits
    if current_ms <= target_duration_ms:
        return trimmed

    ratio = current_ms / target_duration_ms

    # Clamp to the FIRM 1.5x limit
    effective_ratio = min(ratio, max_ratio)
    effective_ratio = max(effective_ratio, 0.5)

    if effective_ratio <= 1.0:
        return trimmed

    # Need to run atempo through ffmpeg
    tmp_dir = tempfile.mkdtemp(prefix="dubstretch_")
    tmp_in = os.path.join(tmp_dir, "in.wav")
    tmp_out = os.path.join(tmp_dir, "out.wav")

    try:
        trimmed.export(tmp_in, format="wav")
        _atempo_ffmpeg(tmp_in, tmp_out, effective_ratio)

        if os.path.exists(tmp_out):
            return AudioSegment.from_wav(tmp_out)
        return trimmed
    finally:
        for f in (tmp_in, tmp_out):
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass
        try:
            os.rmdir(tmp_dir)
        except OSError:
            pass
