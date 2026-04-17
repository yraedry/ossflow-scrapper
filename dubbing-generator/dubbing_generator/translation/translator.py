"""English-to-Spanish translation using Helsinki-NLP MarianMT."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


class Translator:
    """Translate English SRT files to Spanish using MarianMT.

    Model: Helsinki-NLP/opus-mt-en-es (local, no API dependency).
    """

    MODEL_NAME = "Helsinki-NLP/opus-mt-en-es"

    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Load the MarianMT model and tokenizer."""
        if self._model is not None:
            return

        from transformers import MarianMTModel, MarianTokenizer

        logger.info("Loading translation model %s ...", self.MODEL_NAME)
        self._tokenizer = MarianTokenizer.from_pretrained(self.MODEL_NAME)
        self._model = MarianMTModel.from_pretrained(self.MODEL_NAME)
        logger.info("Translation model loaded.")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def translate_srt(self, input_srt: Path, output_srt: Path) -> Path:
        """Translate an English SRT to Spanish, preserving timestamps.

        Returns the path to the output file.
        """
        self.load_model()

        content = input_srt.read_text(encoding="utf-8")
        blocks = self._parse_srt(content)

        translated_lines: list[str] = []
        for block in blocks:
            index, timestamp, text = block
            translated = self.translate_text(text)
            translated = self._adjust_length(text, translated, max_ratio=1.2)
            translated_lines.append(f"{index}\n{timestamp}\n{translated}\n")

        output_srt.write_text("\n".join(translated_lines), encoding="utf-8")
        logger.info("Translated SRT saved to %s", output_srt)
        return output_srt

    def translate_text(self, text: str) -> str:
        """Translate a single English text to Spanish."""
        self.load_model()

        tokens = self._tokenizer(text, return_tensors="pt", padding=True)
        translated = self._model.generate(**tokens)
        result = self._tokenizer.decode(translated[0], skip_special_tokens=True)
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_srt(content: str) -> list[tuple[str, str, str]]:
        """Parse SRT into list of (index, timestamp_line, text)."""
        pattern = re.compile(
            r"(\d+)\n"
            r"(\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3})\n"
            r"(.*?)(?=\n\n|\n$|\Z)",
            re.DOTALL,
        )
        return [
            (m.group(1), m.group(2), m.group(3).replace("\n", " ").strip())
            for m in pattern.finditer(content)
        ]

    @staticmethod
    def _adjust_length(
        original: str,
        translated: str,
        max_ratio: float = 1.2,
    ) -> str:
        """Trim *translated* if it exceeds *max_ratio* of *original* length.

        Simple approach: truncate at the last word boundary within the
        allowed length and add an ellipsis.
        """
        max_len = int(len(original) * max_ratio)
        if len(translated) <= max_len or max_len <= 0:
            return translated

        # Truncate at last space within limit
        truncated = translated[:max_len]
        last_space = truncated.rfind(" ")
        if last_space > 0:
            truncated = truncated[:last_space]

        return truncated.rstrip(".,;:") + "..."
