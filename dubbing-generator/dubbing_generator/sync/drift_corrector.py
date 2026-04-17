"""Global drift correction across the dubbing timeline."""

from __future__ import annotations

import logging

from ..config import DubbingConfig

logger = logging.getLogger(__name__)


class DriftCorrector:
    """Monitor accumulated timing drift and adjust TTS speed.

    Every ``drift_check_interval`` phrases (default 10), the corrector
    compares the current timeline position to the expected position.
    If the absolute drift exceeds ``drift_threshold_ms`` (default 200 ms),
    the TTS speed for the next block is adjusted within
    ``[speed_min, speed_max]`` (default [1.05, 1.25]).
    """

    def __init__(self, config: DubbingConfig) -> None:
        self.cfg = config
        self._current_speed: float = config.speed_base

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def current_speed(self) -> float:
        return self._current_speed

    def check(
        self,
        phrase_index: int,
        current_position_ms: int,
        expected_position_ms: int,
    ) -> float:
        """Evaluate drift and return the (possibly adjusted) speed.

        Only re-evaluates every ``drift_check_interval`` phrases.
        Between checks the previously computed speed is returned.
        """
        if phrase_index % self.cfg.drift_check_interval != 0:
            return self._current_speed

        drift_ms = current_position_ms - expected_position_ms

        if abs(drift_ms) <= self.cfg.drift_threshold_ms:
            # Within tolerance -- gently return toward base speed
            self._current_speed = self._move_toward(
                self._current_speed, self.cfg.speed_base, step=0.02,
            )
            logger.debug(
                "Drift check @%d: drift=%+d ms (OK), speed=%.2f",
                phrase_index, drift_ms, self._current_speed,
            )
            return self._current_speed

        if drift_ms > 0:
            # We are BEHIND (current > expected) -> speed up
            adjustment = min(0.05, drift_ms / 2000.0)
            new_speed = self._current_speed + adjustment
        else:
            # We are AHEAD (current < expected) -> slow down
            adjustment = min(0.05, abs(drift_ms) / 2000.0)
            new_speed = self._current_speed - adjustment

        self._current_speed = max(
            self.cfg.speed_min, min(self.cfg.speed_max, new_speed),
        )

        logger.info(
            "Drift check @%d: drift=%+d ms -> speed adjusted to %.2f",
            phrase_index, drift_ms, self._current_speed,
        )
        return self._current_speed

    def reset(self) -> None:
        """Reset the corrector to the base speed."""
        self._current_speed = self.cfg.speed_base

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _move_toward(current: float, target: float, step: float) -> float:
        """Move *current* one *step* closer to *target*."""
        if abs(current - target) <= step:
            return target
        if current > target:
            return current - step
        return current + step
