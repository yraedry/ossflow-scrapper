"""Tests for DriftCorrector."""

from dubbing_generator.config import DubbingConfig
from dubbing_generator.sync.drift_corrector import DriftCorrector


def _make_corrector(**kwargs) -> DriftCorrector:
    cfg = DubbingConfig(**kwargs)
    return DriftCorrector(cfg)


class TestDriftCorrector:
    def test_no_drift_returns_base_speed(self):
        dc = _make_corrector()
        speed = dc.check(0, current_position_ms=1000, expected_position_ms=1000)
        assert speed == dc.cfg.speed_base

    def test_behind_schedule_speeds_up(self):
        dc = _make_corrector()
        # Current position is 500ms BEHIND expected (positive drift)
        speed = dc.check(0, current_position_ms=10500, expected_position_ms=10000)
        assert speed > dc.cfg.speed_base

    def test_ahead_of_schedule_slows_down(self):
        dc = _make_corrector()
        # Current position is 500ms AHEAD of expected (negative drift)
        speed = dc.check(0, current_position_ms=9500, expected_position_ms=10000)
        assert speed < dc.cfg.speed_base

    def test_speed_clamped_to_max(self):
        dc = _make_corrector(speed_max=1.25)
        # Simulate massive drift
        speed = dc.check(0, current_position_ms=100000, expected_position_ms=10000)
        assert speed <= 1.25

    def test_speed_clamped_to_min(self):
        dc = _make_corrector(speed_min=1.05)
        # Simulate being way ahead
        speed = dc.check(0, current_position_ms=1000, expected_position_ms=100000)
        assert speed >= 1.05

    def test_only_checks_at_interval(self):
        dc = _make_corrector(drift_check_interval=10)
        # Phrase 5 is NOT at an interval boundary -- returns current speed
        speed5 = dc.check(5, current_position_ms=50000, expected_position_ms=10000)
        # Should still be base speed since no check at index 5
        assert speed5 == dc.cfg.speed_base

    def test_drift_within_threshold_returns_toward_base(self):
        dc = _make_corrector(drift_threshold_ms=200.0)
        # Drift of only 100ms -- within threshold
        speed = dc.check(0, current_position_ms=10100, expected_position_ms=10000)
        # Should be at or near base speed
        assert abs(speed - dc.cfg.speed_base) < 0.05

    def test_reset(self):
        dc = _make_corrector()
        # Force a drift adjustment
        dc.check(0, current_position_ms=50000, expected_position_ms=10000)
        assert dc.current_speed != dc.cfg.speed_base
        dc.reset()
        assert dc.current_speed == dc.cfg.speed_base

    def test_successive_checks_accumulate(self):
        dc = _make_corrector(drift_check_interval=10)
        # First check at phrase 0: behind
        s1 = dc.check(0, current_position_ms=11000, expected_position_ms=10000)
        # Second check at phrase 10: still behind
        s2 = dc.check(10, current_position_ms=22000, expected_position_ms=20000)
        # Both should be above base
        assert s1 > dc.cfg.speed_base
        assert s2 >= s1 or s2 > dc.cfg.speed_base
