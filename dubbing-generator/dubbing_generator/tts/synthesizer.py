"""Coqui XTTS v2 wrapper for TTS generation."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from pydub import AudioSegment

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


class Synthesizer:
    """Generate speech from text using Coqui XTTS v2.

    Handles long text by splitting at sentence boundaries and
    cross-fading the resulting chunks.
    """

    def __init__(self, config: DubbingConfig) -> None:
        self.cfg = config
        self._model = None

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Lazy-load the TTS model onto the best available device."""
        if self._model is not None:
            return

        import torch
        from TTS.api import TTS

        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading TTS model %s on %s", self.cfg.tts_model_name, device)
        self._model = TTS(self.cfg.tts_model_name).to(device)

    @property
    def model(self):
        if self._model is None:
            self.load_model()
        return self._model

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        text: str,
        reference_wav: Path,
        speed: float | None = None,
    ) -> AudioSegment:
        """Synthesize *text* and return an AudioSegment.

        If *text* exceeds ``tts_char_limit`` it is split and the parts
        are cross-faded with ``tts_crossfade_ms``.
        """
        if speed is None:
            speed = self.cfg.tts_speed

        parts = self._split_long_text(text, self.cfg.tts_char_limit)

        segments: list[AudioSegment] = []
        for part in parts:
            seg = self._synthesize_chunk(part, reference_wav, speed)
            segments.append(seg)

        if not segments:
            return AudioSegment.silent(duration=100)

        # Cross-fade consecutive parts
        result = segments[0]
        for seg in segments[1:]:
            xfade = min(self.cfg.tts_crossfade_ms, len(result), len(seg))
            if xfade > 0:
                result = result.append(seg, crossfade=xfade)
            else:
                result += seg

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _synthesize_chunk(
        self,
        text: str,
        reference_wav: Path,
        speed: float,
    ) -> AudioSegment:
        """Synthesize a single short chunk of text."""
        tmp = tempfile.NamedTemporaryFile(
            suffix=".wav", prefix="tts_", delete=False,
        )
        tmp.close()
        try:
            self.model.tts_to_file(
                text=text,
                speaker_wav=str(reference_wav),
                language=self.cfg.target_language,
                file_path=tmp.name,
                speed=speed,
                split_sentences=False,
                temperature=self.cfg.tts_temperature,
            )
            return AudioSegment.from_wav(tmp.name)
        finally:
            if os.path.exists(tmp.name):
                try:
                    os.remove(tmp.name)
                except OSError:
                    pass

    def _split_long_text(self, text: str, limit: int) -> list[str]:
        """Split *text* into chunks of at most *limit* characters.

        Tries to split at punctuation or spaces to keep natural phrasing.
        """
        if len(text) <= limit:
            return [text]

        parts: list[str] = []
        remaining = text
        while len(remaining) > limit:
            # Find a good split point near the middle-ish of the limit
            best = -1
            for char in [". ", ", ", "; ", " "]:
                idx = remaining.rfind(char, 0, limit)
                if idx != -1:
                    best = idx + len(char)
                    break
            if best == -1:
                best = limit  # hard cut as last resort

            parts.append(remaining[:best].strip())
            remaining = remaining[best:].strip()

        if remaining:
            parts.append(remaining)

        return parts
