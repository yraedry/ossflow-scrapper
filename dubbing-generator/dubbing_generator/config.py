"""Centralized configuration for the dubbing generator."""

from dataclasses import dataclass


@dataclass
class DubbingConfig:
    """All dubbing pipeline parameters in one place."""

    # TTS
    tts_speed: float = 1.15
    tts_temperature: float = 0.70
    tts_model_name: str = "tts_models/multilingual/multi-dataset/xtts_v2"
    target_language: str = "es"
    tts_char_limit: int = 230
    tts_crossfade_ms: int = 50

    # Voice cloning
    voice_sample_duration: float = 30.0  # seconds (was 10)
    use_model_voice: bool = False  # False = clone from video (default)
    model_voice_path: str = ""  # path to a pre-recorded model voice

    # Audio stretching
    max_compression_ratio: float = 1.5  # FIRM limit (was 2.0)
    min_compression_ratio: float = 0.5
    silence_threshold_db: float = -40.0
    silence_chunk_ms: int = 10

    # Drift correction
    drift_check_interval: int = 10  # every N phrases
    drift_threshold_ms: float = 200.0
    speed_base: float = 1.15
    speed_min: float = 1.05
    speed_max: float = 1.25

    # Audio ducking
    ducking_bg_volume: float = 0.3  # background during TTS voice
    ducking_fg_volume: float = 1.0  # TTS voice (was 1.3; ducking handles it)
    ducking_fade_ms: int = 200

    # Sync / alignment
    lookahead_phrases: int = 5
    min_phrase_duration_ms: int = 500
    avg_ms_per_char: float = 60.0  # for duration estimation

    # Paths / file discovery
    extensions: tuple[str, ...] = (".mp4", ".mkv", ".avi", ".mov")
