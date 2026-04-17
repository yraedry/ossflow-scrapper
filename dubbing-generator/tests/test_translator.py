"""Tests for Translator (MarianMT wrapper)."""

from dubbing_generator.translation.translator import Translator


class TestAdjustLength:
    def test_no_truncation_within_ratio(self):
        result = Translator._adjust_length("hello world", "hola mundo", max_ratio=1.2)
        assert result == "hola mundo"

    def test_truncation_when_exceeds_ratio(self):
        original = "short"  # 5 chars -> max 6 chars at 1.2x
        translated = "esto es muy largo"  # 17 chars, way over
        result = Translator._adjust_length(original, translated, max_ratio=1.2)
        assert len(result) <= int(len(original) * 1.2) + 5  # allow for "..."
        assert result.endswith("...")

    def test_empty_strings(self):
        result = Translator._adjust_length("", "", max_ratio=1.2)
        assert result == ""

    def test_exact_boundary(self):
        original = "hello"  # 5 chars
        translated = "hola!"  # 5 chars -- within 1.2x of 5 = 6
        result = Translator._adjust_length(original, translated, max_ratio=1.2)
        assert result == "hola!"


class TestParseSrt:
    def test_parse_simple_srt(self):
        content = (
            "1\n"
            "00:00:01,000 --> 00:00:03,000\n"
            "Hello world\n\n"
            "2\n"
            "00:00:04,000 --> 00:00:06,500\n"
            "This is a test\n\n"
        )
        blocks = Translator._parse_srt(content)
        assert len(blocks) == 2
        assert blocks[0] == ("1", "00:00:01,000 --> 00:00:03,000", "Hello world")
        assert blocks[1] == ("2", "00:00:04,000 --> 00:00:06,500", "This is a test")

    def test_multiline_text(self):
        content = (
            "1\n"
            "00:00:01,000 --> 00:00:03,000\n"
            "Line one\nLine two\n\n"
        )
        blocks = Translator._parse_srt(content)
        assert len(blocks) == 1
        assert blocks[0][2] == "Line one Line two"
