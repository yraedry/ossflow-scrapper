"""Tests for DubbingConfig defaults and constraints."""

from dubbing_generator.config import DubbingConfig


def test_default_values():
    cfg = DubbingConfig()
    assert cfg.tts_speed == 1.15
    assert cfg.tts_temperature == 0.70
    assert cfg.target_language == "es"


def test_max_compression_is_1_5():
    """The firm limit must be 1.5x, never 2.0x."""
    cfg = DubbingConfig()
    assert cfg.max_compression_ratio == 1.5


def test_voice_sample_duration_is_30():
    cfg = DubbingConfig()
    assert cfg.voice_sample_duration == 30.0


def test_ducking_defaults():
    cfg = DubbingConfig()
    assert cfg.ducking_bg_volume == 0.3
    assert cfg.ducking_fg_volume == 1.0
    assert cfg.ducking_fade_ms == 200


def test_drift_defaults():
    cfg = DubbingConfig()
    assert cfg.drift_check_interval == 10
    assert cfg.drift_threshold_ms == 200.0
    assert cfg.speed_min == 1.05
    assert cfg.speed_max == 1.25


def test_use_original_voice_by_default():
    """Voice cloned from the original video should be the default."""
    cfg = DubbingConfig()
    assert cfg.use_model_voice is False


def test_custom_overrides():
    cfg = DubbingConfig(tts_speed=1.0, max_compression_ratio=1.3)
    assert cfg.tts_speed == 1.0
    assert cfg.max_compression_ratio == 1.3
