"""SRT translation with pluggable providers (OpenAI, DeepL).

Preserves timestamps and subtitle structure. Writes ``{base}_ES.srt`` next
to the source file.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Iterable, Protocol

import httpx

from .srt_io import parse_srt, serialize_srt

log = logging.getLogger("subtitler")

DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate"
DEEPL_PRO_URL = "https://api.deepl.com/v2/translate"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

_TIMEOUT = 120.0


# ---------------------------------------------------------------------------
# Language code helpers
# ---------------------------------------------------------------------------

_LANG_NAMES = {
    "EN": "English",
    "ES": "Spanish",
    "PT": "Portuguese",
    "FR": "French",
    "IT": "Italian",
    "DE": "German",
}


def _lang_name(code: str) -> str:
    return _LANG_NAMES.get(code.upper(), code)


# ---------------------------------------------------------------------------
# Protocol + base
# ---------------------------------------------------------------------------

class Translator(Protocol):
    """Minimum contract a translation provider must fulfil."""

    def translate_texts(self, texts: list[str]) -> list[str]: ...

    def translate_srt(self, src_path: Path, dst_path: Path | None = None) -> Path: ...


class _BaseTranslator:
    """Shared SRT read/write logic. Subclasses implement ``translate_texts``."""

    def __init__(self, source_lang: str = "EN", target_lang: str = "ES") -> None:
        self.source_lang = source_lang.upper()
        self.target_lang = target_lang.upper()

    def translate_texts(self, texts: list[str]) -> list[str]:  # pragma: no cover
        raise NotImplementedError

    def translate_srt(
        self,
        src_path: Path,
        dst_path: Path | None = None,
    ) -> Path:
        """Translate ``src_path`` SRT, writing ``dst_path`` (default ``*_ES.srt``)."""
        src_path = Path(src_path)
        if dst_path is None:
            dst_path = src_path.with_name(f"{src_path.stem}.es.srt")
        else:
            dst_path = Path(dst_path)

        subs = parse_srt(src_path)
        if not subs:
            log.warning("No subtitles found in %s", src_path)
            dst_path.write_text("", encoding="utf-8")
            return dst_path

        texts = [s["text"] for s in subs]
        translated = self.translate_texts(texts)
        if len(translated) != len(texts):
            raise RuntimeError(
                f"Provider returned {len(translated)} items, expected {len(texts)}"
            )

        for sub, new_text in zip(subs, translated):
            sub["text"] = new_text

        dst_path.write_text(serialize_srt(subs), encoding="utf-8")
        log.info("Wrote %d translated subtitles to %s", len(subs), dst_path.name)
        return dst_path


# ---------------------------------------------------------------------------
# DeepL provider
# ---------------------------------------------------------------------------

class DeepLTranslator(_BaseTranslator):
    """Translate SRT files using the DeepL REST API."""

    _BATCH_SIZE = 40

    def __init__(
        self,
        api_key: str | None = None,
        source_lang: str = "EN",
        target_lang: str = "ES",
        formality: str | None = None,
        pro: bool | None = None,
    ) -> None:
        super().__init__(source_lang, target_lang)
        key = api_key or os.environ.get("DEEPL_API_KEY")
        if not key:
            raise ValueError("DEEPL_API_KEY not provided (env or constructor)")
        self.api_key = key
        self.formality = formality
        if pro is None:
            pro = not key.endswith(":fx")
        self.url = DEEPL_PRO_URL if pro else DEEPL_FREE_URL

    def translate_texts(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        out: list[str] = []
        for chunk in _chunks(texts, self._BATCH_SIZE):
            out.extend(self._post(chunk))
        return out

    def _post(self, texts: list[str]) -> list[str]:
        payload: dict[str, str | list[str]] = {
            "source_lang": self.source_lang,
            "target_lang": self.target_lang,
            "preserve_formatting": "1",
            "split_sentences": "0",
            "text": texts,
        }
        if self.formality:
            payload["formality"] = self.formality

        headers = {
            "Authorization": f"DeepL-Auth-Key {self.api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(self.url, headers=headers, json=payload)
        if r.status_code >= 400:
            raise RuntimeError(f"DeepL error {r.status_code}: {r.text[:300]}")
        return [t["text"] for t in r.json().get("translations", [])]


# ---------------------------------------------------------------------------
# OpenAI provider (BJJ-aware, keeps technique names in English)
# ---------------------------------------------------------------------------

_BJJ_SYSTEM_PROMPT = """You translate Brazilian Jiu-Jitsu instructional subtitles from {src_name} to {tgt_name}.

Rules, non-negotiable:
1. Keep BJJ technique names and positions in English (examples: guard, half-guard, mount, side control, armbar, kimura, triangle, heel hook, sweep, pass, tripod pass, underhook, overhook, kimura grip, gable grip, knee cut, smash pass, leg drag, berimbolo, de la riva, x-guard, butterfly guard, closed guard, open guard, etc.). Do not translate them.
2. Keep common grappling English terms and actions as-is too (grip, frame, framing, post, base, hook, lapel, sleeve, collar, gi, no-gi, tap, pin, pinning, pummel, pummeling, sprawl, turtle, turtling, scramble, roll, rolling, drill, drilling, crossface, whizzer, backstep, reset, setup, entry, transition, top, bottom, pressure, stack, stacking).
3. Translate ordinary narration, explanations, transitions and body descriptions naturally into neutral, informal {tgt_name} as spoken by a coach.
4. Preserve meaning; do NOT add, shorten or merge content. One input item = one output item, same order.
5. Preserve line breaks inside a subtitle block exactly.
6. Output MUST be a JSON object of the exact shape: {{"t": ["translated item 1", "translated item 2", ...]}} with the same number of items as the input, in the same order.
"""


class OpenAITranslator(_BaseTranslator):
    """Translate SRT files via OpenAI Chat Completions (gpt-4o-mini default).

    Batches subtitle items into a single JSON request for coherence and cost.
    Uses ``response_format=json_object`` for reliable parsing.
    """

    # Number of subtitle items per request. 40 is a sweet spot:
    # - keeps latency low
    # - keeps context coherent
    # - well under any token limit even for long lines
    _BATCH_SIZE = 40

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
        source_lang: str = "EN",
        target_lang: str = "ES",
        temperature: float = 0.2,
        base_url: str | None = None,
    ) -> None:
        super().__init__(source_lang, target_lang)
        key = api_key or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY not provided (env or constructor)")
        self.api_key = key
        self.model = model
        self.temperature = temperature
        self.url = (base_url or OPENAI_URL).rstrip("/")
        # If base_url was passed without the /chat/completions suffix, fix it.
        if not self.url.endswith("/chat/completions"):
            if self.url.endswith("/v1"):
                self.url = f"{self.url}/chat/completions"

    def translate_texts(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        out: list[str] = []
        for chunk in _chunks(texts, self._BATCH_SIZE):
            try:
                out.extend(self._translate_batch(chunk))
            except RuntimeError:
                # Batch failed after retries — fall back to one-by-one
                log.warning("Batch of %d failed, translating one-by-one", len(chunk))
                for item in chunk:
                    out.extend(self._translate_batch([item]))
        return out

    _MAX_RETRIES = 2

    def _translate_batch(self, texts: list[str]) -> list[str]:
        system = _BJJ_SYSTEM_PROMPT.format(
            src_name=_lang_name(self.source_lang),
            tgt_name=_lang_name(self.target_lang),
        )
        user_payload = {"items": texts}
        body = {
            "model": self.model,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": (
                        "Translate each item in `items`. Return JSON "
                        '{"t": [...]} with the same number of items in the same order.\n'
                        + json.dumps(user_payload, ensure_ascii=False)
                    ),
                },
            ],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_err: Exception | None = None
        for attempt in range(1 + self._MAX_RETRIES):
            with httpx.Client(timeout=_TIMEOUT) as client:
                r = client.post(self.url, headers=headers, json=body)
            if r.status_code >= 400:
                raise RuntimeError(f"OpenAI error {r.status_code}: {r.text[:300]}")

            data = r.json()
            try:
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
            except (KeyError, IndexError, json.JSONDecodeError) as exc:
                raise RuntimeError(f"OpenAI response parse failed: {exc}") from exc

            items = parsed.get("t")
            if not isinstance(items, list):
                items = parsed.get("items")
            if isinstance(items, list) and len(items) == len(texts):
                return [str(x) for x in items]

            last_err = RuntimeError(
                f"OpenAI returned {len(items) if isinstance(items, list) else 'non-list'} items, "
                f"expected {len(texts)}"
            )
            log.warning("OpenAI count mismatch (attempt %d/%d), retrying…",
                        attempt + 1, 1 + self._MAX_RETRIES)

        raise last_err  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def make_translator(
    provider: str,
    *,
    api_key: str | None = None,
    source_lang: str = "EN",
    target_lang: str = "ES",
    model: str | None = None,
    formality: str | None = None,
) -> _BaseTranslator:
    """Build a translator for the requested provider name."""
    p = (provider or "").lower().strip()
    if p in ("openai", "gpt", "chatgpt"):
        return OpenAITranslator(
            api_key=api_key,
            model=model or "gpt-4o-mini",
            source_lang=source_lang,
            target_lang=target_lang,
        )
    if p in ("deepl",):
        return DeepLTranslator(
            api_key=api_key,
            source_lang=source_lang,
            target_lang=target_lang,
            formality=formality,
        )
    raise ValueError(f"Unknown translation provider: {provider!r}")


def _chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]
