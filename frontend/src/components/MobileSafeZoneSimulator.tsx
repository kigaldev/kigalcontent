"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  Eye,
  Film,
  Scissors,
  UploadCloud,
  Volume2,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import {
  RemotionShortComposition,
  type RemotionShortProps,
} from "@/components/RemotionShortComposition";
import type { MediaQCReport, WordTimestamp } from "@/types/engine";

const RemotionPlayer = dynamic(
  () =>
    import("@remotion/player").then(
      (mod) =>
        mod.Player as React.ComponentType<{
          component: React.ComponentType<RemotionShortProps>;
          inputProps: RemotionShortProps;
          durationInFrames: number;
          fps: number;
          compositionWidth: number;
          compositionHeight: number;
          style?: React.CSSProperties;
          controls?: boolean;
          loop?: boolean;
        }>
    ),
  { ssr: false }
);

interface MobileSafeZoneSimulatorProps {
  onRefresh: () => Promise<void>;
}

export function MobileSafeZoneSimulator({
  onRefresh,
}: MobileSafeZoneSimulatorProps) {
  const { selectedDetail, selectedProjectId, backendOnline, showToast } =
    useEngineStore();

  const [platformOverlay, setPlatformOverlay] = useState<
    "TikTok" | "Instagram" | "YouTube"
  >("Instagram");
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [subtitleYPercent, setSubtitleYPercent] = useState(55);
  const [silenceDb, setSilenceDb] = useState(-35);
  const [minSilenceSec, setMinSilenceSec] = useState(0.4);
  const [processing, setProcessing] = useState(false);
  const [s3Info, setS3Info] = useState<{
    upload_id: string;
    object_key: string;
    download_url: string;
  } | null>(null);
  const [liveQc, setLiveQc] = useState<MediaQCReport | null>(null);

  const videoQc = liveQc
    ? {
        silences_trimmed: liveQc.silences_trimmed,
        silence_segments_json: liveQc.silence_intervals,
        measured_lufs: liveQc.measured_lufs,
        true_peak_dbfs: liveQc.true_peak_dbfs,
        transcription_json: liveQc.transcription_words,
        qc_passed: liveQc.qc_passed,
        master_media_url: liveQc.master_media_url,
        ass_subtitles: liveQc.ass_subtitles_preview,
      }
    : selectedDetail?.video_asset;

  const isDeadZoneCollision = subtitleYPercent < 25 || subtitleYPercent > 70;

  const handleInitS3Multipart = async () => {
    if (!selectedProjectId) return;
    try {
      if (backendOnline) {
        const res = await apiClient.initS3Multipart({
          project_id: selectedProjectId,
          filename: `${selectedDetail?.project.asset_code ?? "RAW"}_A_ROLL.mp4`,
          part_count: 3,
        });
        setS3Info(res);
        showToast("success", `URLs prefirmadas S3 multiparte generadas (${res.upload_id}).`);
      } else {
        setS3Info({
          upload_id: "mpu_offline_demo_01",
          object_key: `projects/${selectedProjectId}/raw/A_ROLL.mp4`,
          download_url: "s3://ace-media-vault/demo.mp4",
        });
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error S3 Multipart");
    }
  };

  const handleRunMediaPipeline = async () => {
    if (!selectedProjectId) return;
    setProcessing(true);
    try {
      if (backendOnline) {
        const qc = await apiClient.processMedia({
          project_id: selectedProjectId,
          raw_media_url: s3Info?.download_url || "s3://ace-media-vault/demo.mp4",
          silence_noise_db: silenceDb,
          min_silence_duration_sec: minSilenceSec,
          target_lufs: -14.0,
          subtitle_y_percent: subtitleYPercent,
        });
        setLiveQc(qc);
        await onRefresh();
        showToast(
          "success",
          `Pipeline FFmpeg + Whisper completado: ${qc.silences_trimmed} silencios podados · ${qc.measured_lufs} LUFS.`
        );
      } else {
        showToast("info", "Simulación local QC completada (-14.0 LUFS / 9:16).");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error ejecutando pipeline");
    } finally {
      setProcessing(false);
    }
  };

  if (!selectedDetail?.project) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un proyecto para inspeccionar el simulador 9:16 y pipeline QC.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      {/* Left: Interactive Remotion 9:16 Simulator with Native UI Dead Zones */}
      <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" />
            Simulador Móvil 9:16 (Remotion Canvas)
          </h2>
          <button
            type="button"
            onClick={() => setShowSafeZones((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              showSafeZones
                ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                : "bg-slate-800 border-slate-700 text-slate-300"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {showSafeZones ? "Ocultar Zonas Muertas" : "Mostrar Zonas Muertas"}
          </button>
        </div>

        {/* Platform Overlay Switcher */}
        <div className="grid grid-cols-3 gap-2">
          {(["Instagram", "TikTok", "YouTube"] as const).map((plat) => (
            <button
              key={plat}
              type="button"
              onClick={() => setPlatformOverlay(plat)}
              className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                platformOverlay === plat
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {plat === "Instagram" ? "IG Reels" : plat === "YouTube" ? "YT Shorts" : "TikTok"}
            </button>
          ))}
        </div>

        {/* 9:16 Remotion Player Frame */}
        <div className="mx-auto w-full max-w-[320px] rounded-[28px] border-4 border-slate-800 bg-black overflow-hidden shadow-2xl">
          <RemotionPlayer
            component={RemotionShortComposition}
            inputProps={{
              title: selectedDetail.project.working_title,
              blocks: selectedDetail.script?.two_column_blocks ?? [],
              words: videoQc?.transcription_json ?? [],
              subtitleYPercent,
              platformOverlay,
              showSafeZones,
            }}
            durationInFrames={180}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{ width: "100%", aspectRatio: "9 / 16" }}
            controls
            loop
          />
        </div>

        {/* Subtitle Vertical Safe-Zone Slider */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              Altura Subtítulos (.ass Safe Zone 25%–70%)
            </span>
            <span
              className={`font-mono font-bold ${
                isDeadZoneCollision ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {subtitleYPercent}%
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={85}
            value={subtitleYPercent}
            onChange={(e) => setSubtitleYPercent(Number(e.target.value))}
            className="w-full"
          />
          {isDeadZoneCollision ? (
            <div className="flex items-center gap-1.5 text-xs text-rose-300">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              Colisión detectada: los subtítulos quedan tapados por la UI de {platformOverlay}.
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Posición segura validada dentro del 70% central vertical.
            </div>
          )}
        </div>
      </div>

      {/* Right: S3 Multipart Ingest & FFmpeg/Whisper GPU Worker Pipeline */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Worker Pipeline: S3 Multipart + FFmpeg 7 + Faster-Whisper
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Poda determinista de silencios &gt;400ms, normalización EBU R128 a -14.0 LUFS (-1.0 dBFS) y subtítulos fonéticos.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between mb-1">
                <span>Umbral Silencio (dB)</span>
                <span className="font-mono text-cyan-300">{silenceDb} dB</span>
              </div>
              <input
                type="range"
                min={-55}
                max={-20}
                value={silenceDb}
                onChange={(e) => setSilenceDb(Number(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <div className="flex justify-between mb-1">
                <span>Pausa Mínima a Podar</span>
                <span className="font-mono text-cyan-300">
                  {Math.round(minSilenceSec * 1000)} ms
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={1.2}
                step={0.05}
                value={minSilenceSec}
                onChange={(e) => setMinSilenceSec(Number(e.target.value))}
                className="w-full"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleInitS3Multipart}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
            >
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              1. Generar Presigned S3 Multipart
            </button>

            <button
              type="button"
              onClick={handleRunMediaPipeline}
              disabled={processing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition"
            >
              <Scissors className="w-4 h-4" />
              {processing
                ? "Ejecutando FFmpeg + Whisper..."
                : "2. Procesar Master 9:16 & QC (-14 LUFS)"}
            </button>
          </div>

          {s3Info && (
            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
              <div className="text-cyan-300">S3 Upload ID: {s3Info.upload_id}</div>
              <div className="truncate text-slate-400">Key: {s3Info.object_key}</div>
            </div>
          )}
        </div>

        {/* QC Telemetry & Whisper Word Alignment */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              Certificación Broadcast EBU R128 &amp; Reporte QC
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                videoQc?.qc_passed
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {videoQc?.qc_passed ? "QC PASSED" : "PENDIENTE"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Sonoridad Integrada</span>
              <div className="text-lg font-mono font-bold text-emerald-300 mt-0.5">
                {videoQc?.measured_lufs?.toFixed(1) ?? "-14.0"} LUFS
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">True Peak Máx</span>
              <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5">
                {videoQc?.true_peak_dbfs?.toFixed(1) ?? "-1.0"} dBFS
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Silencios Podados</span>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                {videoQc?.silences_trimmed ?? 0} cortes
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] text-slate-400">Resolución Master</span>
              <div className="text-lg font-mono font-bold text-violet-300 mt-0.5">
                1080×1920
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-2">
              Alineación Fonética Palabra por Palabra (Faster-Whisper)
            </h4>
            <div className="flex flex-wrap gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
              {(videoQc?.transcription_json ?? []).map((w: WordTimestamp, idx: number) => (
                <span
                  key={`${w.word}-${idx}`}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                >
                  {w.word}{" "}
                  <span className="text-[10px] text-cyan-400">
                    {w.start_ms}–{w.end_ms}ms
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
