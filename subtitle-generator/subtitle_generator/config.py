"""Configuration dataclasses and default constants for the subtitle generator."""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_ROOT_DIR = r"Z:\instruccionales\Arm Drags - John Danaher\Season 01"

EXTENSIONES = (".mp4", ".mkv", ".avi", ".mov")

DEFAULT_INITIAL_PROMPT_TEMPLATE = (
    "The following is a technical Brazilian Jiu-Jitsu instructional"
    " by {instructor} on {topic}."
)

DEFAULT_INITIAL_PROMPT_GENERIC = (
    "A Brazilian Jiu-Jitsu coach explains techniques step by step."
    " He uses English terms like guard, half-guard, mount, side control,"
    " armbar, kimura, triangle, sweep, underhook, overhook, tripod."
)

# Keep the old name as an alias pointing to the generic prompt for backward compat
DEFAULT_INITIAL_PROMPT = DEFAULT_INITIAL_PROMPT_GENERIC

DEFAULT_HOTWORDS = "\n".join([
    # Positions
    "guard", "half guard", "half-guard", "closed guard", "open guard",
    "butterfly guard", "de la Riva", "reverse de la Riva", "x-guard",
    "single leg x", "50/50", "mount", "side control", "back mount",
    "north-south", "turtle", "quarter guard", "knee shield",
    # Passes
    "toreando", "toreando pass", "tripod", "tripod pass", "tripod passing",
    "knee cut", "knee slice", "leg drag", "smash pass", "over-under",
    "stack pass", "long step", "backstep", "body lock pass",
    # Submissions
    "armbar", "kimura", "americana", "triangle", "rear naked choke",
    "guillotine", "darce", "anaconda", "heel hook", "toe hold",
    "kneebar", "omoplata", "gogoplata", "ezekiel", "cross collar choke",
    "bow and arrow", "loop choke", "arm triangle", "Von Flue choke",
    # Sweeps / Movements
    "sweep", "bridge", "shrimp", "hip escape", "granby roll",
    "berimbolo", "kiss of the dragon", "technical stand-up",
    # Grips / Concepts
    "underhook", "overhook", "whizzer", "collar tie", "pummeling",
    "pummel", "cross face", "crossface", "frame", "framing",
    "post", "base", "hook", "gi", "no-gi", "lapel", "sleeve",
    "collar", "gable grip", "s-grip", "butterfly hooks",
    "knee line", "hip line", "inside position",
    # People commonly referenced
    "Danaher", "John Danaher", "Gordon Ryan", "Craig Jones",
    "Marcelo Garcia", "Lachlan Giles", "Mikey Musumeci",
    # Common BJJ English
    "drilling", "rolling", "sparring", "positional sparring",
    "passing", "retention", "escape", "submission",
])


def generate_prompt(
    instructor: str | None = None,
    topic: str | None = None,
    template: str | None = None,
) -> str:
    """Build a WhisperX initial prompt from instructor/topic metadata.

    If neither *instructor* nor *topic* are provided, returns a generic BJJ
    prompt.  A custom *template* may be supplied (must contain ``{instructor}``
    and/or ``{topic}`` placeholders).
    """
    if not instructor and not topic:
        return DEFAULT_INITIAL_PROMPT_GENERIC

    tpl = template or DEFAULT_INITIAL_PROMPT_TEMPLATE
    return tpl.format(
        instructor=instructor or "the instructor",
        topic=topic or "Brazilian Jiu-Jitsu techniques",
    )


@dataclass
class TranscriptionConfig:
    """Parameters controlling WhisperX transcription and alignment."""

    model_name: str = "large-v3"
    compute_type: str = "float16"
    device: str = "cuda"
    language: str = "en"
    batch_size: int = 2
    beam_size: int = 5
    initial_prompt: str = DEFAULT_INITIAL_PROMPT

    # VAD parameters — slightly more sensitive to catch speech in noisy audio
    # (audio is denoised before VAD, so lower thresholds are safe)
    vad_onset: float = 0.300
    vad_offset: float = 0.200

    # Gap-fill: re-transcribe gaps larger than this (seconds) with boosted audio
    gap_fill_min_gap: float = 3.0
    gap_fill_audio_boost_db: float = 10.0
    gap_fill_vad_onset: float = 0.200
    gap_fill_vad_offset: float = 0.150

    # Transcription quality
    condition_on_previous_text: bool = False
    log_prob_threshold: float = -1.0
    no_speech_threshold: float = 0.7

    # BJJ-specific hotwords for WhisperX — improves recognition of domain terms
    # WhisperX expects a single string (newline-separated)
    hotwords: str | None = None

    # Prompt template for dynamic generation
    initial_prompt_template: str = DEFAULT_INITIAL_PROMPT_TEMPLATE


@dataclass
class SubtitleConfig:
    """Parameters controlling subtitle formatting and validation."""

    max_chars_per_line: int = 42
    max_lines: int = 2
    min_duration: float = 0.5
    max_duration: float = 7.0
    gap_fill_threshold: float = 0.100   # Fill gaps smaller than 100ms
    gap_warn_threshold: float = 5.0     # Warn about gaps larger than 5s

    # Hallucination filter thresholds
    similarity_threshold: float = 0.80
    similarity_lookback: int = 15
    repeated_ngram_size: int = 3
    repeated_ngram_max: int = 5       # BJJ instructors repeat phrases a lot ("from here", "what we need to")
    low_confidence_word_threshold: float = 0.25  # only flag very low confidence
    low_confidence_segment_ratio: float = 0.90   # only drop if almost all words are very low-conf
    max_chars_per_second: float = 60.0  # very relaxed — alignment jitter can produce high CPS on short segs

    # Silence filter threshold (RMS in dBFS below which a segment is silence)
    silence_threshold_db: float = -40.0  # title cards / silence typically above -40 dBFS

    # Synthetic score filter: ratio of words with exact 0.5 score to trigger stricter filtering
    synthetic_score_ratio: float = 0.80  # only flag near-fully-synthetic segments
    synthetic_score_strict_ratio: float = 0.60  # relaxed strict pass
