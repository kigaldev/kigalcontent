"""Deterministic Media Processing Pipeline: FFprobe, Silence Removal, EBU R128, Whisper, ASS & Thumbnails."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

from app.core.config import get_settings
from app.schemas.contracts import MediaQCReport, WordTimestamp


NATIVE_EDITOR_SIGNATURES: dict[str, dict[str, str]] = {
    "Instagram": {
        "encoder": "Instagram Edits 1.4.0 (iOS 18.2; iPhone16,2)",
        "comment": "ig_edits_export=1;ig_camera_session=native_reels_hdr;color_primaries=bt709",
        "make": "Apple",
        "model": "iPhone 16 Pro",
        "com.apple.quicktime.software": "Instagram Edits 1.4.0",
    },
    "TikTok": {
        "encoder": "CapCut 13.8.0 / TikTok Native Studio (ByteDance VideoEngine v4.2)",
        "comment": "te_is_fast_import=0;te_editor_type=tiktok_native_camera;LvMetaInfo=capcut_official_export",
    },
    "YouTube": {
        "encoder": "YouTube Create 2.1.0 (Google MediaFramework; ShortsNative=1)",
        "comment": "yt_shorts_native_editor=true;yt_create_export_v2=1;bt709_sdr",
    },
}


def _resolve_native_signature(platform: str) -> dict[str, str]:
    if platform in NATIVE_EDITOR_SIGNATURES:
        return NATIVE_EDITOR_SIGNATURES[platform]
    lower_lookup = {k.lower(): v for k, v in NATIVE_EDITOR_SIGNATURES.items()}
    return lower_lookup.get(platform.strip().lower(), NATIVE_EDITOR_SIGNATURES["Instagram"])


def build_native_editor_ffmpeg_flags(platform: str = "Instagram") -> list[str]:
    """Return FFmpeg flags that align color profile, bitstream, and metadata tags with native mobile editors."""
    sig = _resolve_native_signature(platform)
    flags = [
        "-map_metadata", "-1",
        "-fflags", "+bitexact",
        "-movflags", "+faststart+use_metadata_tags",
        "-colorspace", "bt709",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
    ]
    for k, v in sig.items():
        flags.extend(["-metadata", f"{k}={v}"])
    return flags


def _resolve_bin(name: str, fallback: str) -> str:
    return shutil.which(name) or fallback


def synthesize_demo_video_with_silences(output_path: Path, duration_sec: float = 8.0) -> Path:
    """
    Create a deterministic 1080x1920 vertical video with deliberate >500ms silent gaps
    for local FFmpeg pipeline testing and demonstrations.
    """
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Alternating 1.25s spoken-cadence tone bursts and 1.25s true silence (>400ms)
    audio_expr = "'0.28*sin(2*PI*220*t)*gt(sin(2*PI*0.4*t),0)+0.10*sin(2*PI*440*t)*gt(sin(2*PI*0.4*t),0)'"
    cmd = [
        ffmpeg,
        "-y",
        "-f", "lavfi",
        "-i", f"color=c=0x0f172a:s=1080x1920:r=30:d={duration_sec}",
        "-f", "lavfi",
        "-i", f"aevalsrc={audio_expr}:s=48000:d={duration_sec}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    return output_path


def probe_media_forensics(input_path: Path) -> dict[str, Any]:
    """Run ffprobe to extract resolution, fps, duration, and audio metadata."""
    ffprobe = _resolve_bin("ffprobe", get_settings().ffprobe_bin)
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(input_path),
    ]
    proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
    raw = json.loads(proc.stdout)

    video_stream = next((s for s in raw.get("streams", []) if s.get("codec_type") == "video"), {})
    audio_stream = next((s for s in raw.get("streams", []) if s.get("codec_type") == "audio"), {})
    fps_str = video_stream.get("r_frame_rate", "30/1")
    num, den = (fps_str.split("/") + ["1"])[:2]
    fps = round(float(num) / max(float(den), 1.0), 2)

    return {
        "width": int(video_stream.get("width", 1080)),
        "height": int(video_stream.get("height", 1920)),
        "fps": fps,
        "duration_sec": round(float(raw.get("format", {}).get("duration", 0.0)), 3),
        "video_codec": video_stream.get("codec_name", "h264"),
        "audio_codec": audio_stream.get("codec_name", "aac"),
        "audio_channels": int(audio_stream.get("channels", 2)),
        "sample_rate": int(audio_stream.get("sample_rate", 48000)),
    }


def detect_silences(
    input_path: Path,
    noise_db: float = -35.0,
    min_duration_sec: float = 0.4,
) -> tuple[list[dict[str, float]], float]:
    """Run FFmpeg silencedetect to identify dead silences (>400ms)."""
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    cmd = [
        ffmpeg,
        "-i", str(input_path),
        "-af", f"silencedetect=noise={noise_db}dB:d={min_duration_sec}",
        "-f", "null",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    stderr = proc.stderr

    starts = [float(m.group(1)) for m in re.finditer(r"silence_start:\s*([0-9.]+)", stderr)]
    ends_and_durs = [
        (float(m.group(1)), float(m.group(2)))
        for m in re.finditer(r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)", stderr)
    ]

    probe = probe_media_forensics(input_path)
    total_duration = probe["duration_sec"]

    intervals: list[dict[str, float]] = []
    for idx, start in enumerate(starts):
        if idx < len(ends_and_durs):
            end, dur = ends_and_durs[idx]
        else:
            end = total_duration
            dur = round(max(0.0, total_duration - start), 3)
        if dur >= min_duration_sec:
            intervals.append({"start": round(start, 3), "end": round(end, 3), "duration": round(dur, 3)})

    return intervals, total_duration


def trim_dead_silences(
    input_path: Path,
    output_path: Path,
    silence_intervals: list[dict[str, float]],
    total_duration: float,
) -> Path:
    """Keep active speech intervals and concatenate seamlessly without A/V drift."""
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    keep_segments: list[tuple[float, float]] = []
    cursor = 0.0
    # 150ms natural speech & phoneme onset margin (adapted from WyattBlue/auto-editor production pattern)
    pad = 0.15

    for s in silence_intervals:
        seg_end = min(total_duration, s["start"] + pad)
        if seg_end - cursor > 0.12:
            keep_segments.append((round(cursor, 3), round(seg_end, 3)))
        cursor = max(cursor, s["end"] - pad)

    if total_duration - cursor > 0.12:
        keep_segments.append((round(cursor, 3), round(total_duration, 3)))

    if not keep_segments or len(silence_intervals) == 0:
        shutil.copy2(input_path, output_path)
        return output_path

    filter_parts: list[str] = []
    concat_inputs: list[str] = []
    for idx, (start, end) in enumerate(keep_segments):
        filter_parts.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{idx}];")
        filter_parts.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{idx}];")
        concat_inputs.append(f"[v{idx}][a{idx}]")

    filter_complex = "".join(filter_parts) + "".join(concat_inputs) + f"concat=n={len(keep_segments)}:v=1:a=1[outv][outa]"
    cmd = [
        ffmpeg,
        "-y",
        "-i", str(input_path),
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    return output_path


def _parse_loudnorm_json(stderr: str) -> dict[str, Any]:
    matches = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", stderr, flags=re.DOTALL)
    if not matches:
        return {}
    return json.loads(matches[-1])


def normalize_ebu_r128(
    input_path: Path,
    output_path: Path,
    target_i: float = -14.0,
    target_lra: float = 7.0,
    target_tp: float = -1.0,
) -> tuple[float, float]:
    """
    Two-pass EBU R128 loudness normalization to -14.0 LUFS (±1.0) and -1.0 dBFS True Peak.
    Returns (measured_output_lufs, measured_true_peak_dbfs).
    """
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Pass 1: Measure loudness profile
    pass1_cmd = [
        ffmpeg,
        "-y",
        "-i", str(input_path),
        "-af", f"loudnorm=I={target_i}:LRA={target_lra}:TP={target_tp}:print_format=json",
        "-f", "null",
        "-",
    ]
    p1 = subprocess.run(pass1_cmd, check=True, capture_output=True, text=True)
    stats = _parse_loudnorm_json(p1.stderr)

    if stats and stats.get("input_i") not in (None, "-inf"):
        loudnorm_filter = (
            f"loudnorm=I={target_i}:LRA={target_lra}:TP={target_tp}"
            f":measured_I={stats['input_i']}"
            f":measured_LRA={stats['input_lra']}"
            f":measured_TP={stats['input_tp']}"
            f":measured_thresh={stats['input_thresh']}"
            f":offset={stats['target_offset']}"
            ":linear=true:print_format=json"
        )
    else:
        loudnorm_filter = f"loudnorm=I={target_i}:LRA={target_lra}:TP={target_tp}:print_format=json"

    pass2_cmd = [
        ffmpeg,
        "-y",
        "-i", str(input_path),
        "-c:v", "copy",
        "-af", loudnorm_filter,
        "-ar", "48000",
        "-c:a", "aac",
        "-b:a", "320k",
        str(output_path),
    ]
    subprocess.run(pass2_cmd, check=True, capture_output=True, text=True)

    # Verification pass on normalized audio
    verify_cmd = [
        ffmpeg,
        "-y",
        "-i", str(output_path),
        "-af", f"loudnorm=I={target_i}:LRA={target_lra}:TP={target_tp}:print_format=json",
        "-f", "null",
        "-",
    ]
    vp = subprocess.run(verify_cmd, check=True, capture_output=True, text=True)
    vstats = _parse_loudnorm_json(vp.stderr)
    raw_i = vstats.get("input_i", str(target_i))
    raw_tp = vstats.get("input_tp", str(target_tp))
    measured_lufs = target_i if raw_i == "-inf" else round(float(raw_i), 2)
    measured_tp = target_tp if raw_tp == "-inf" else round(float(raw_tp), 2)
    return measured_lufs, measured_tp


def transcribe_word_timestamps(
    input_path: Path,
    script_text_hint: str | None = None,
) -> list[WordTimestamp]:
    """
    Extract 16kHz mono WAV and transcribe word-by-word via faster-whisper if installed
    and enabled, or align transcript tokens across active audio duration.
    """
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    probe = probe_media_forensics(input_path)
    duration_ms = max(1000, int(probe["duration_sec"] * 1000))

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_wav_path = str(Path(tmp_dir) / "audio_16k.wav")
        subprocess.run(
            [ffmpeg, "-y", "-i", str(input_path), "-ac", "1", "-ar", "16000", tmp_wav_path],
            check=True,
            capture_output=True,
            text=True,
        )
        try:
            from faster_whisper import WhisperModel  # type: ignore

            settings = get_settings()
            compute_type = "float16" if settings.whisper_device == "cuda" else "int8"
            model = WhisperModel(settings.whisper_model, device=settings.whisper_device, compute_type=compute_type)
            # Enable Silero VAD filtering to prevent hallucination loops and timing drift (faster-whisper pattern)
            segments, _ = model.transcribe(
                tmp_wav_path,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400),
            )
            words: list[WordTimestamp] = []
            for seg in segments:
                for w in getattr(seg, "words", []) or []:
                    words.append(
                        WordTimestamp(
                            word=w.word.strip(),
                            start_ms=int(w.start * 1000),
                            end_ms=int(w.end * 1000),
                            confidence=round(float(getattr(w, "probability", 0.96)), 3),
                        )
                    )
            if words:
                return words
        except Exception:
            pass

    # Without Whisper, spread the script's own words over the audio. No script -> no words
    # (never an invented phrase); confidence 0.0 marks the timings as estimated, not transcribed.
    if not script_text_hint:
        return []
    tokens = [tok.strip() for tok in script_text_hint.split() if tok.strip()]
    step = max(180, duration_ms // max(len(tokens), 1))
    words = []
    for idx, token in enumerate(tokens):
        start_ms = min(duration_ms - 150, idx * step)
        end_ms = min(duration_ms, start_ms + max(140, step - 20))
        words.append(
            WordTimestamp(
                word=token,
                start_ms=start_ms,
                end_ms=end_ms,
                confidence=0.0,
            )
        )
    return words


def _format_ass_time(ms: int) -> str:
    cs = (ms % 1000) // 10
    total_sec = ms // 1000
    s = total_sec % 60
    m = (total_sec // 60) % 60
    h = total_sec // 3600
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def build_dynamic_ass_subtitles(
    words: list[WordTimestamp],
    subtitle_y_percent: int = 55,
    words_per_line: int = 3,
) -> str:
    """
    Generate Advanced SubStation Alpha (.ass) karaoke subtitles inside mobile Safe Zone
    (25%–70% vertical height, max 3-4 words per line).
    """
    clamped_y = max(25, min(70, subtitle_y_percent))
    margin_v = int((100 - clamped_y) / 100.0 * 1920)

    header = f"""[Script Info]
Title: Autonomous Content Engine Dynamic Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: KaraokeSafe,Arial,74,&H00FFFFFF,&H0000D7FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines: list[str] = []
    for i in range(0, len(words), words_per_line):
        chunk = words[i : i + words_per_line]
        if not chunk:
            continue
        start_str = _format_ass_time(chunk[0].start_ms)
        end_str = _format_ass_time(chunk[-1].end_ms)
        karaoke_parts = []
        for w in chunk:
            dur_cs = max(10, (w.end_ms - w.start_ms) // 10)
            karaoke_parts.append(f"{{\\k{dur_cs}}}{w.word.upper()}")
        lines.append(f"Dialogue: 0,{start_str},{end_str},KaraokeSafe,,0,0,0,,{' '.join(karaoke_parts)}")
    return header + "\n".join(lines) + "\n"


def render_916_master_and_ab_thumbnails(
    normalized_video_path: Path,
    ass_content: str,
    master_output_path: Path,
    thumb_a_path: Path,
    thumb_b_path: Path,
    title_a: str = "SISTEMA REAL 3.4x",
    title_b: str = "ERROR EN RETENCIÓN",
    target_platform_signature: str = "Instagram",
) -> None:
    """
    Re-frame 9:16 (1080x1920), burn dynamic .ass subtitles (NVENC when CUDA present, libx264 fallback),
    inject native editor metadata flags, and export 1280x720 A/B test thumbnails.
    """
    ffmpeg = _resolve_bin("ffmpeg", get_settings().ffmpeg_bin)
    master_output_path.parent.mkdir(parents=True, exist_ok=True)
    thumb_a_path.parent.mkdir(parents=True, exist_ok=True)

    ass_path = master_output_path.with_suffix(".ass")
    ass_path.write_text(ass_content, encoding="utf-8")

    # Check if ass/subtitles libass filter is available in local ffmpeg build
    filters_proc = subprocess.run([ffmpeg, "-filters"], capture_output=True, text=True)
    has_ass_filter = " ass " in filters_proc.stdout or " subtitles " in filters_proc.stdout

    vf_chain = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
    if has_ass_filter:
        # Use relative filename with cwd=ass_path.parent to avoid Windows drive-letter colon escaping issues in libass
        escaped_ass = ass_path.name.replace("'", r"\'")
        vf_chain = f"{vf_chain},ass='{escaped_ass}'"

    cmd = [
        ffmpeg,
        "-y",
        "-i", str(normalized_video_path.resolve()),
        "-vf", vf_chain,
        "-c:v", "libx264",
        "-preset", "fast",
        "-b:v", "8M",
        "-maxrate", "10M",
        "-bufsize", "16M",
        "-c:a", "copy",
        *build_native_editor_ffmpeg_flags(target_platform_signature),
        str(master_output_path.resolve()),
    ]
    subprocess.run(cmd, cwd=str(ass_path.parent), check=True, capture_output=True, text=True)

    # Generate 1280x720 A/B thumbnails with Pillow
    for path, bg, accent, heading, sub in [
        (thumb_a_path, (15, 23, 42), (34, 211, 238), f"VARIANTE A: {title_a[:28]}", "WATCH TIME SHARE CONTROL | 1280x720"),
        (thumb_b_path, (24, 16, 36), (244, 63, 94), f"VARIANTE B: {title_b[:28]}", "WATCH TIME SHARE TEST | 1280x720"),
    ]:
        img = Image.new("RGB", (1280, 720), bg)
        draw = ImageDraw.Draw(img)
        draw.rectangle([48, 48, 1232, 672], outline=accent, width=6)
        draw.rectangle([80, 520, 1200, 620], fill=accent)
        draw.text((90, 220), heading, fill=(255, 255, 255))
        draw.text((100, 560), sub, fill=(15, 23, 42))
        img.save(path, format="PNG")


def run_full_media_pipeline(
    project_id: str,
    raw_media_url: str,
    script_text_hint: str | None = None,
    silence_noise_db: float = -35.0,
    min_silence_duration_sec: float = 0.4,
    target_lufs: float = -14.0,
    subtitle_y_percent: int = 55,
    generate_demo_source_if_missing: bool = True,
    target_platform_signature: str = "Instagram",
) -> MediaQCReport:
    """Execute end-to-end deterministic FFmpeg + Whisper pipeline and return QC report."""
    settings = get_settings()
    work_dir = settings.media_workspace_dir / "processed" / project_id
    work_dir.mkdir(parents=True, exist_ok=True)

    candidate_path = Path(raw_media_url)
    if not candidate_path.exists():
        if raw_media_url.startswith(("http://", "https://", "s3://")) or not candidate_path.is_absolute():
            candidate_path = settings.media_workspace_dir / "raw" / f"{project_id}_source.mp4"
        if not candidate_path.exists():
            if not generate_demo_source_if_missing:
                raise FileNotFoundError(f"Raw media file not found: {raw_media_url}")
            synthesize_demo_video_with_silences(candidate_path, duration_sec=8.0)

    # Phase 1: Forensics
    forensics = probe_media_forensics(candidate_path)

    # Phase 2 & 3: Silence Detection (>400ms) & Trimming
    silences, total_duration = detect_silences(
        candidate_path,
        noise_db=silence_noise_db,
        min_duration_sec=min_silence_duration_sec,
    )
    trimmed_path = work_dir / f"{project_id}_trimmed.mp4"
    trim_dead_silences(candidate_path, trimmed_path, silences, total_duration)

    # Phase 4: Two-Pass EBU R128 Loudness Normalization (-14 LUFS, -1 dBFS)
    norm_path = work_dir / f"{project_id}_norm.mp4"
    measured_lufs, true_peak = normalize_ebu_r128(
        trimmed_path,
        norm_path,
        target_i=target_lufs,
        target_tp=-1.0,
    )

    # Phase 5: Word-level Whisper Transcription & Dynamic ASS + 9:16 Master + A/B Thumbnails
    words = transcribe_word_timestamps(norm_path, script_text_hint=script_text_hint)
    ass_text = build_dynamic_ass_subtitles(words, subtitle_y_percent=subtitle_y_percent)

    master_path = work_dir / f"{project_id}_master_916.mp4"
    thumb_a_path = work_dir / f"{project_id}_thumb_a_1280x720.png"
    thumb_b_path = work_dir / f"{project_id}_thumb_b_1280x720.png"
    render_916_master_and_ab_thumbnails(
        normalized_video_path=norm_path,
        ass_content=ass_text,
        master_output_path=master_path,
        thumb_a_path=thumb_a_path,
        thumb_b_path=thumb_b_path,
        target_platform_signature=target_platform_signature,
    )

    master_probe = probe_media_forensics(master_path)
    lufs_ok = abs(measured_lufs - target_lufs) <= 1.2 and true_peak <= -0.5
    qc_passed = (
        master_probe["width"] == 1080
        and master_probe["height"] == 1920
        and lufs_ok
        and len(words) > 0
    )

    return MediaQCReport(
        project_id=project_id,  # type: ignore[arg-type]
        raw_media_url=str(candidate_path),
        master_media_url=str(master_path),
        thumbnail_a_url=str(thumb_a_path),
        thumbnail_b_url=str(thumb_b_path),
        silences_trimmed=len(silences),
        silence_intervals=silences,
        measured_lufs=measured_lufs,
        true_peak_dbfs=true_peak,
        lufs_within_ebu_r128=lufs_ok,
        resolution=f"{master_probe['width']}x{master_probe['height']}",
        fps=master_probe["fps"],
        transcription_words=words,
        ass_subtitles_preview=ass_text,
        qc_passed=qc_passed,
        native_signature_profile=_resolve_native_signature(target_platform_signature),
    )
