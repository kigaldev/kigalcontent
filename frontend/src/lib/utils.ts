import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  ConversionGoal,
  DurationPreset,
  FSMState,
  SocialChannel,
  TwoColumnScriptBlock,
} from "@/types/engine";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DURATION_PRESET_META: Record<
  DurationPreset,
  {
    label: string;
    shortLabel: string;
    durationRange: [number, number];
    wordRange: [number, number];
    cutInterval: [number, number];
    description: string;
  }
> = {
  MICRO_SHORT: {
    label: "Video Ultracorto (15–30 seg)",
    shortLabel: "15–30 seg",
    durationRange: [15, 30],
    wordRange: [40, 75],
    cutInterval: [1.5, 2.5],
    description: "Ritmo rápido (corte cada 1.5–2.5s). Ideal para que el usuario repita el video en bucle o lo comparta por mensaje directo.",
  },
  STANDARD_SHORT: {
    label: "Short Estándar (45–60 seg)",
    shortLabel: "45–60 seg",
    durationRange: [45, 60],
    wordRange: [110, 150],
    cutInterval: [3.0, 5.0],
    description: "Gancho inicial en 3 segundos, conflicto, 2 argumentos con apoyo visual y llamada a la acción clara.",
  },
  EXTENDED_SHORT: {
    label: "Short Extendido (90–180 seg)",
    shortLabel: "90–180 seg",
    durationRange: [90, 180],
    wordRange: [220, 380],
    cutInterval: [5.0, 8.0],
    description: "Historia o tutorial en 3 pasos con mayor profundidad y llamado a la acción calificado.",
  },
  LONG_FORM: {
    label: "Video Largo / YouTube (8–12 min)",
    shortLabel: "8–12 min",
    durationRange: [480, 720],
    wordRange: [1200, 1700],
    cutInterval: [15.0, 30.0],
    description: "Estructura completa en varios bloques temáticos con marcas de tiempo y retención sostenida.",
  },
};

export const CONVERSION_GOAL_META: Record<
  ConversionGoal,
  { label: string; badge: string; triggerHint: string }
> = {
  EMAIL_LEAD_CAPTURE: {
    label: "Captación de Contactos / Email (vía Mensaje Privado)",
    badge: "Guía o Regalo",
    triggerHint: "Palabra clave para enviar recurso por mensaje (ej. GUIA)",
  },
  B2B_INBOUND_CONVERSATION: {
    label: "Generar Clientes B2B (Conversación Privada)",
    badge: "Asesoría 1:1",
    triggerHint: "Pedir que escriban por mensaje directo para una evaluación",
  },
  RELATIONAL_DISTRIBUTION_SHARES: {
    label: "Contenido para Compartir (Viralidad Relacional)",
    badge: "Compartir con Amigos",
    triggerHint: "Incentiva enviar a un amigo, socio o compañero de equipo",
  },
  PLATFORM_RETENTION_LOOP: {
    label: "Retención en YouTube (Ver Siguiente Video)",
    badge: "Siguiente Video",
    triggerHint: "Llevar al espectador al siguiente video en pantalla final",
  },
};

export const FSM_COLUMNS: Array<{
  state: FSMState;
  title: string;
  tier: 1 | 2 | 3;
  colorClass: string;
  bgClass: string;
  headerBadgeClass: string;
}> = [
  {
    state: "CAPTURED",
    title: "1. Ideas Capturadas",
    tier: 1,
    colorClass: "border-slate-700/90 shadow-sm",
    bgClass: "bg-[#080d1a]",
    headerBadgeClass: "bg-slate-800 text-slate-300 border border-slate-700",
  },
  {
    state: "RESEARCHED_TRIAGED",
    title: "2. Ideas Priorizadas",
    tier: 1,
    colorClass: "border-sky-500/70 shadow-sm shadow-sky-950/20",
    bgClass: "bg-[#071322]",
    headerBadgeClass: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  },
  {
    state: "SCRIPTED_PACKAGED",
    title: "3. Guión Preparado",
    tier: 1,
    colorClass: "border-cyan-500/80 shadow-md shadow-cyan-950/30",
    bgClass: "bg-[#051520]",
    headerBadgeClass: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
  },
  {
    state: "HITL_PENDING_PRODUCTION",
    title: "4. Listo para Grabar",
    tier: 2,
    colorClass: "border-amber-500/80 shadow-md shadow-amber-950/30",
    bgClass: "bg-[#181105]",
    headerBadgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  },
  {
    state: "PRODUCED_VALIDATED",
    title: "5. Video Validado",
    tier: 1,
    colorClass: "border-teal-500/70 shadow-sm shadow-teal-950/20",
    bgClass: "bg-[#061715]",
    headerBadgeClass: "bg-teal-500/20 text-teal-300 border border-teal-500/40",
  },
  {
    state: "HITL_PENDING_PUBLISH",
    title: "6. Listo para Publicar",
    tier: 3,
    colorClass: "border-rose-500/80 shadow-md shadow-rose-950/30",
    bgClass: "bg-[#19090e]",
    headerBadgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  },
  {
    state: "PUBLISHED_LIVE",
    title: "7. Publicado en Redes",
    tier: 3,
    colorClass: "border-emerald-500/80 shadow-md shadow-emerald-950/30",
    bgClass: "bg-[#06170d]",
    headerBadgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  },
  {
    state: "AUDITED_CLOSED_LOOP",
    title: "8. Con Métricas",
    tier: 1,
    colorClass: "border-violet-500/70 shadow-sm shadow-violet-950/20",
    bgClass: "bg-[#120a22]",
    headerBadgeClass: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  },
];

export const HUMAN_STATE_LABELS: Record<FSMState, string> = {
  INIT: "Borrador inicial",
  CAPTURED: "Idea capturada",
  RESEARCHED_TRIAGED: "Priorizada para guión",
  SCRIPTED_PACKAGED: "Guión listo",
  HITL_PENDING_PRODUCTION: "Listo para grabar",
  PRODUCED_VALIDATED: "Video editado y validado",
  HITL_PENDING_PUBLISH: "Listo para publicar",
  PUBLISHED_LIVE: "Publicado en redes",
  AUDITED_CLOSED_LOOP: "Analizado con resultados",
  REJECTED_REVISION: "En revisión de cambios",
  ARCHIVED: "Archivado",
};

export function computeLocalOralTiming(
  blocks: TwoColumnScriptBlock[],
  wpmRate: number,
  preset: DurationPreset
) {
  const wordsPerSec = wpmRate / 60;
  const spec = DURATION_PRESET_META[preset];
  const maxBlockSec = preset === "LONG_FORM" ? 140 : spec.cutInterval[1] * 4.5;

  let totalWords = 0;
  let totalSec = 0;

  const computed = blocks.map((blk) => {
    const wc = blk.audio_voiceover
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const est = wc > 0 ? Math.round((wc / wordsPerSec) * 10) / 10 : 0;
    totalWords += wc;
    totalSec += est;
    return {
      ...blk,
      word_count: wc,
      estimated_seconds: est,
      pacing_warning: est > maxBlockSec,
    };
  });

  const [minW, maxW] = spec.wordRange;
  const [, maxD] = spec.durationRange;
  const withinBudget =
    totalWords >= minW * 0.85 &&
    totalWords <= maxW * 1.15 &&
    totalSec <= maxD * 1.15;

  return {
    blocks: computed,
    wordCount: totalWords,
    estimatedDurationSec: Math.round(totalSec * 10) / 10,
    withinBudget,
  };
}

export function runLocalPreflight(
  channel: SocialChannel,
  title: string | null,
  body: string,
  hashtags: string[],
  firstComment: string | null
): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  let hasBlocker = false;

  if (channel === "LinkedIn") {
    if (/https?:\/\/\S+/i.test(body)) {
      hasBlocker = true;
      messages.push(
        "BLOQUEO: Enlace externo detectado en el cuerpo de LinkedIn. Muévelo al 1er comentario."
      );
    }
    if (!firstComment?.trim()) {
      messages.push("Sugerencia: Define un 1er comentario para el enlace o recurso.");
    }
  } else if (channel === "Instagram") {
    const firstLine = body.split("\n")[0] ?? "";
    if (firstLine.length > 120) {
      hasBlocker = true;
      messages.push(
        `BLOQUEO: Hook inicial de ${firstLine.length} chars supera 120 chars antes de '...más'.`
      );
    }
    if (hashtags.length < 3 || hashtags.length > 5) {
      messages.push(`Recomendado 3–5 hashtags de nicho (actual: ${hashtags.length}).`);
    }
  } else if (channel === "TikTok") {
    if (body.length > 300) {
      messages.push(`Longitud (${body.length} chars) supera el óptimo de 300 chars.`);
    }
    if (body.slice(0, 100).trim().length < 20) {
      hasBlocker = true;
      messages.push("BLOQUEO: Incluye palabras clave de TikTok Search en los primeros 100 chars.");
    }
  } else if (channel === "YouTube") {
    if ((title ?? "").length >= 60) {
      hasBlocker = true;
      messages.push(`BLOQUEO: Título (${(title ?? "").length} chars) se truncará en móvil (<60).`);
    }
    if (!body.includes("00:00")) {
      messages.push("Agrega timestamps empezando por 00:00 para mejorar retención.");
    }
  }

  return { passed: !hasBlocker, messages };
}
