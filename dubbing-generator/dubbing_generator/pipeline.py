"""Dubbing pipeline orchestrator."""

from __future__ import annotations

import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Callable, Optional

from pydub import AudioSegment

from .config import DubbingConfig
from .audio.mixer import AudioMixer, TtsSegment
from .audio.separator import AudioSeparator
from .audio.stretcher import stretch_audio
from .sync.aligner import SrtBlock, SyncAligner
from .sync.drift_corrector import DriftCorrector
from .tts.synthesizer import Synthesizer
from .tts.voice_cloner import VoiceCloner

logger = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[int, int, str], None]]


# ======================================================================
# SRT parsing helpers
# ======================================================================

def _parse_time(time_str: str) -> int:
    """Parse ``HH:MM:SS,mmm`` to milliseconds."""
    h, m, s_ms = time_str.split(":")
    s, ms = s_ms.split(",")
    return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)


def parse_srt(srt_path: Path) -> list[SrtBlock]:
    """Parse an SRT file into a list of :class:`SrtBlock`."""
    content = srt_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"(\d+)\n"
        r"(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n"
        r"(.*?)(?=\n\n|\n$|\Z)",
        re.DOTALL,
    )
    blocks: list[SrtBlock] = []
    for m in pattern.finditer(content):
        text = m.group(4).replace("\n", " ").strip()
        text = re.sub(r"\((.*?)\)", r"\1", text)  # remove parenthetical wrappers
        blocks.append(SrtBlock(
            index=int(m.group(1)),
            start_ms=_parse_time(m.group(2)),
            end_ms=_parse_time(m.group(3)),
            text=text,
        ))
    return blocks


# ======================================================================
# Pipeline
# ======================================================================

class DubbingPipeline:
    """Orchestrate the full dubbing workflow for a single video."""

    def __init__(
        self,
        config: DubbingConfig,
        progress_cb: ProgressCallback = None,
    ) -> None:
        self.cfg = config
        self._progress_cb = progress_cb

        self.separator = AudioSeparator(config)
        self.voice_cloner = VoiceCloner(config)
        self.synthesizer = Synthesizer(config)
        self.aligner = SyncAligner(config)
        self.drift = DriftCorrector(config)
        self.mixer = AudioMixer(config)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_file(
        self,
        video_path: Path,
        srt_path: Path,
        voice_ref: Optional[Path] = None,
    ) -> Path:
        """Run the full dubbing pipeline on one video.

        Returns the path to the dubbed output video.
        """
        base_name = video_path.with_suffix("")
        output_video = base_name.parent / f"{base_name.name}_DOBLADO.mkv"
        output_audio = base_name.parent / f"{base_name.name}_AUDIO_ESP.wav"

        if output_video.exists():
            logger.info("Output already exists, skipping: %s", output_video)
            return output_video

        # 1. Separate background audio
        self._report(0, 6, "Separating background audio...")
        background_path = self.separator.separate(video_path)

        # 2. Get voice reference
        self._report(1, 6, "Extracting voice reference...")
        ref_wav = self.voice_cloner.get_reference(video_path, voice_ref)

        # 3. Parse SRT and plan alignment
        self._report(2, 6, "Planning phrase alignment...")
        blocks = parse_srt(srt_path)
        planned = self.aligner.plan(blocks)

        # 4. Synthesize all phrases
        self._report(3, 6, "Synthesizing speech...")
        tts_segments = self._synthesize_all(planned, ref_wav)

        # 5. Mix background + TTS with ducking
        self._report(4, 6, "Mixing audio with ducking...")
        background = AudioSegment.from_wav(str(background_path))
        mixed = self.mixer.mix(background, tts_segments)
        mixed.export(str(output_audio), format="wav")

        # 6. Mux into video
        self._report(5, 6, "Muxing final video...")
        self._mux_video(video_path, output_audio, output_video)

        # Cleanup temp files
        self._cleanup(output_audio, ref_wav, background_path)

        self._report(6, 6, f"Done: {output_video.name}")
        logger.info("Dubbed video saved: %s", output_video)
        return output_video

    def process_directory(self, root_dir: Path) -> list[Path]:
        """Process all videos in *root_dir* that have matching SRT files."""
        results: list[Path] = []

        for dirpath, _dirs, files in os.walk(root_dir):
            videos = sorted(
                f for f in files
                if f.lower().endswith(self.cfg.extensions)
                and "_DOBLADO" not in f
            )
            for video_name in videos:
                video_path = Path(dirpath) / video_name
                base = video_path.with_suffix("")

                # Look for Spanish SRT: dubbed variants first, then standard .es.srt
                srt_path = None
                for _sfx in ("_ESP_DUB.srt", "_ESP.srt", "_ES.srt", ".es.srt", ".ES.srt"):
                    _candidate = base.parent / f"{base.name}{_sfx}"
                    if _candidate.exists():
                        srt_path = _candidate
                        break
                if srt_path is None:
                    logger.warning("No SRT found for %s, skipping", video_name)
                    continue

                try:
                    out = self.process_file(video_path, srt_path)
                    results.append(out)
                except Exception:
                    logger.exception("Error processing %s", video_name)

        return results

    # ------------------------------------------------------------------
    # Synthesis loop with drift correction
    # ------------------------------------------------------------------

    def _synthesize_all(
        self,
        planned: list,
        ref_wav: Path,
    ) -> list[TtsSegment]:
        """Synthesize TTS for each planned block, applying drift correction."""
        self.drift.reset()
        segments: list[TtsSegment] = []
        current_pos_ms = 0

        total = len(planned)
        for i, block in enumerate(planned):
            if not block.text or len(block.text) < 2:
                continue

            # Drift correction: check every N phrases
            speed = self.drift.check(i, current_pos_ms, block.target_start_ms)

            try:
                raw_audio = self.synthesizer.generate(
                    block.text, ref_wav, speed=speed,
                )

                # Fit audio to the allocated time slot
                fitted = stretch_audio(
                    raw_audio,
                    target_duration_ms=block.allocated_ms,
                    max_ratio=self.cfg.max_compression_ratio,
                )

                segments.append(TtsSegment(
                    audio=fitted,
                    start_ms=block.target_start_ms,
                    end_ms=block.target_start_ms + len(fitted),
                ))

                current_pos_ms = block.target_start_ms + len(fitted)

            except Exception:
                logger.exception("Error synthesizing phrase %d", i)

            if i % 10 == 0:
                logger.info("Progress: %d / %d phrases", i, total)
                self._report(3, 6, f"Synthesizing: {i}/{total}")

        return segments

    # ------------------------------------------------------------------
    # FFmpeg muxing
    # ------------------------------------------------------------------

    @staticmethod
    def _mux_video(
        video_path: Path,
        audio_path: Path,
        output_path: Path,
    ) -> None:
        """Combine original video stream with new audio."""
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            str(output_path),
        ]
        subprocess.run(cmd, check=True)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _report(self, step: int, total: int, message: str) -> None:
        """Send progress update if callback is registered."""
        logger.info("[%d/%d] %s", step, total, message)
        if self._progress_cb:
            self._progress_cb(step, total, message)

    @staticmethod
    def _cleanup(*paths: Path) -> None:
        """Remove temporary files, ignoring errors."""
        for p in paths:
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass
