"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertOctagon,
  CheckCircle2,
  Cpu,
  DownloadCloud,
  Eye,
  Film,
  FolderOpen,
  HelpCircle,
  Scissors,
  UploadCloud,
  Volume2,
  X,
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
  const [showExplanation, setShowExplanation] = useState(false);
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

  const [showGDriveModal, setShowGDriveModal] = useState(false);
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [isImportingGDrive, setIsImportingGDrive] = useState(false);

  const handleImportGoogleDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !gdriveUrl.trim()) return;
    setIsImportingGDrive(true);
    try {
      const res = await fetch("/api/v1/media/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProjectId,
          file_url_or_id: gdriveUrl.trim(),
          auto_process: true,
        }),
      });
      if (res.ok) {
        const report: MediaQCReport = await res.json();
        setLiveQc(report);
        setShowGDriveModal(false);
        setGdriveUrl("");
        showToast(
          "success",
          `Video importado desde Google Drive: ${report.silences_trimmed} pausas recortadas.`
        );
        await onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Error al importar desde Google Drive.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Error al conectar con Google Drive.");
    } finally {
      setIsImportingGDrive(false);
    }
  };

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
        showToast("success", `Preparación de subida lista (${res.upload_id}).`);
      } else {
        setS3Info({
          upload_id: "mpu_offline_demo_01",
          object_key: `projects/${selectedProjectId}/raw/A_ROLL.mp4`,
          download_url: "s3://ace-media-vault/demo.mp4",
        });
        showToast("info", "Enlace de subida simulado localmente.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error preparando subida");
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
          `Video procesado: ${qc.silences_trimmed} pausas eliminadas · Volumen ajustado a ${qc.measured_lufs} LUFS.`
        );
      } else {
        showToast("info", "Simulación completada: audio normalizado a -14.0 LUFS y video 9:16.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error procesando video");
    } finally {
      setProcessing(false);
    }
  };

  if (!selectedDetail?.project) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un video en el Paso 1 para verificar el encuadre 9:16 y el audio.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              3
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
              {selectedDetail.project.asset_code}
            </span>
            <h2 className="text-base font-bold text-white">
              Paso 3: Vista Previa y Calidad de Video (9:16)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Comprueba que los subtítulos no queden ocultos por botones de TikTok o Instagram y optimiza el audio con volumen estándar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowExplanation((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-medium transition"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>{showExplanation ? "Ocultar Guía" : "¿Por qué es importante?"}</span>
        </button>
      </div>

      {/* Explanatory Banner */}
      {showExplanation && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-slate-200 space-y-2">
          <div className="font-bold text-cyan-300 text-sm flex items-center gap-2">
            💡 ¿Qué son las Zonas Seguras y la Normalización de Volumen?
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <strong className="text-white block mb-1">1. Zonas de Interfaz (Zonas Seguras):</strong>
              En TikTok, Instagram Reels y YouTube Shorts, el lateral derecho tiene botones de me gusta, comentarios y guardar; y la parte inferior tiene la descripción y el nombre del perfil. Si colocas los subtítulos muy abajo o muy a la derecha, la gente no podrá leerlos.
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <strong className="text-white block mb-1">2. Volumen Estándar (-14 LUFS):</strong>
              Es la norma oficial que usan las redes sociales para que el volumen sea parejo. Evita que tu video suene demasiado bajo (haciendo que el usuario lo pase) o con picos que distorsionen el sonido en los altavoces del móvil.
            </div>
          </div>
        </div>
      )}

      {/* Simulator + Processing Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Interactive Remotion 9:16 Simulator */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" />
              Simulador Móvil en Tiempo Real
            </h3>
            <button
              type="button"
              onClick={() => setShowSafeZones((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                showSafeZones
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showSafeZones ? "Ocultar Botones de Redes" : "Mostrar Botones de Redes"}
            </button>
          </div>

          {/* Platform Overlay Switcher */}
          <div className="grid grid-cols-3 gap-2">
            {(["Instagram", "TikTok", "YouTube"] as const).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setPlatformOverlay(plat)}
                className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                  platformOverlay === plat
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                {plat === "Instagram" ? "Instagram Reels" : plat === "YouTube" ? "YouTube Shorts" : "TikTok"}
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
              <span className="text-slate-200 font-semibold">
                Altura vertical de los subtítulos
              </span>
              <span
                className={`font-mono font-bold ${
                  isDeadZoneCollision ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {subtitleYPercent}% de altura
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
                ¡Atención! A esta altura los subtítulos quedan tapados por los botones de {platformOverlay}.
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Posición segura: los subtítulos son 100% legibles sin interferencias.
              </div>
            )}
          </div>
        </div>

        {/* Right: Audio & Subtitle Automated Processing */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Optimización Automática de Audio y Subtítulos
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Corta pausas muertas, ajusta el volumen al estándar de redes sociales y sincroniza los subtítulos palabra por palabra.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between mb-1">
                  <span>Sensibilidad para detectar silencio</span>
                  <span className="font-mono text-cyan-300 font-bold">{silenceDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-55}
                  max={-20}
                  value={silenceDb}
                  onChange={(e) => setSilenceDb(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  -35 dB detecta pausas naturales sin cortar palabras
                </span>
              </label>

              <label className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between mb-1">
                  <span>Duración mínima de pausa a recortar</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {(minSilenceSec).toFixed(2)} seg
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
                <span className="text-[10px] text-slate-400 block mt-1">
                  Corta cualquier silencio superior a 0.40 segundos
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleInitS3Multipart}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
              >
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                1. Subir Archivo Local (R2/S3)
              </button>

              <button
                type="button"
                onClick={() => setShowGDriveModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 hover:border-indigo-400 text-xs font-semibold text-indigo-200 transition"
              >
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                Importar de Google Drive
              </button>

              <button
                type="button"
                onClick={handleRunMediaPipeline}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-sm"
              >
                <Scissors className="w-4 h-4" />
                {processing
                  ? "Procesando audio y subtítulos..."
                  : "2. Optimizar Video, Volumen y Subtítulos"}
              </button>
            </div>

            {s3Info && (
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-300 space-y-1">
                <div className="text-emerald-300">Enlace de subida listo</div>
                <div className="truncate text-slate-400">{s3Info.object_key}</div>
              </div>
            )}
          </div>

          {/* Quality Control Results */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                Control de Calidad del Video (Audio y Formato)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  videoQc?.qc_passed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {videoQc?.qc_passed ? "CALIDAD VERIFICADA" : "PENDIENTE DE PROCESAR"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Volumen Normalizado</span>
                <div className="text-lg font-bold text-emerald-300 mt-0.5">
                  {videoQc?.measured_lufs?.toFixed(1) ?? "-14.0"} LUFS
                </div>
                <span className="text-[10px] text-slate-500">Estándar oficial</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Pico Máximo</span>
                <div className="text-lg font-bold text-cyan-300 mt-0.5">
                  {videoQc?.true_peak_dbfs?.toFixed(1) ?? "-1.0"} dB
                </div>
                <span className="text-[10px] text-slate-500">Sin distorsión</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Pausas Recortadas</span>
                <div className="text-lg font-bold text-white mt-0.5">
                  {videoQc?.silences_trimmed ?? 0} cortes
                </div>
                <span className="text-[10px] text-slate-500">Silencios eliminados</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[11px] text-slate-400">Resolución Vertical</span>
                <div className="text-lg font-bold text-violet-300 mt-0.5">
                  1080×1920
                </div>
                <span className="text-[10px] text-slate-500">Full HD 9:16</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-2">
                Subtítulos Dinámicos Palabra por Palabra
              </h4>
              <div className="flex flex-wrap gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
                {(videoQc?.transcription_json ?? []).map((w: WordTimestamp, idx: number) => (
                  <span
                    key={`${w.word}-${idx}`}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  >
                    {w.word}{" "}
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {w.start_ms}–{w.end_ms}ms
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Drive Import Dialog */}
      {showGDriveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-indigo-500/40 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Importar Video desde Google Drive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGDriveModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportGoogleDrive} className="space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Pega el enlace de <strong>Compartir de tu archivo o carpeta de Google Drive</strong>. El sistema descargará el clip y aplicará el recorte de pausas y subtitulado automáticamente.
              </p>

              <div>
                <label className="block text-slate-200 font-medium mb-1">
                  Enlace de Google Drive (Archivo o Carpeta)
                </label>
                <input
                  type="url"
                  required
                  value={gdriveUrl}
                  onChange={(e) => setGdriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/1A2B3C.../view?usp=sharing"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-400"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  💡 Asegúrate de que el archivo tenga permisos de acceso &quot;Cualquier persona con el enlace&quot;.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGDriveModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isImportingGDrive || !gdriveUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isImportingGDrive ? (
                    "Descargando y Procesando..."
                  ) : (
                    <>
                      <DownloadCloud className="w-4 h-4" />
                      Importar y Procesar Video
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
