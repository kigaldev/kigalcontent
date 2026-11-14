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
    label: "Micro-Short (15–30s)",
    shortLabel: "15–30s",
    durationRange: [15, 30],
    wordRange: [40, 75],
    cutInterval: [1.5, 2.5],
    description: "Cortes cada 1.5–2.5s. Enfocado en Loop Rate y Sends per Reach.",
  },
  STANDARD_SHORT: {
    label: "Standard Short (45–60s)",
    shortLabel: "45–60s",
    durationRange: [45, 60],
    wordRange: [110, 150],
    cutInterval: [3.0, 5.0],
    description: "Gancho 0–3s, conflicto, 2 argumentos con B-roll y CTA directa.",
  },
  EXTENDED_SHORT: {
    label: "Extended Short (90–180s)",
    shortLabel: "90–180s",
    durationRange: [90, 180],
    wordRange: [220, 380],
    cutInterval: [5.0, 8.0],
    description: "Historia + marco de 3 pasos + CTA de cualificación.",
  },
  LONG_FORM: {
    label: "Long-Form (8–12 min)",
    shortLabel: "8–12m",
    durationRange: [480, 720],
    wordRange: [1200, 1700],
    cutInterval: [15.0, 30.0],
    description: "Estructura STP en 5–7 bucles, timestamps y retención de catálogo.",
  },
};

export const CONVERSION_GOAL_META: Record<
  ConversionGoal,
  { label: string; badge: string; triggerHint: string }
> = {
  EMAIL_LEAD_CAPTURE: {
    label: "Email Lead Capture (ManyChat / DM)",
    badge: "Lead Magnet",
    triggerHint: "Palabra clave automática (ej. BLUEPRINT)",
  },
  B2B_INBOUND_CONVERSATION: {
    label: "B2B Inbound Conversation",
    badge: "Diagnóstico 1:1",
    triggerHint: "Solicitud de auditoría por DM (ej. SISTEMAS)",
  },
  RELATIONAL_DISTRIBUTION_SHARES: {
    label: "Relational Distribution (Sends/Reach)",
    badge: "Dark Social >2%",
    triggerHint: "Compartir por mensaje privado con socio/equipo",
  },
  PLATFORM_RETENTION_LOOP: {
    label: "Platform Retention Loop (YouTube)",
    badge: "End Screen Loop",
    triggerHint: "Encadenar sesión hacia siguiente video técnico",
  },
};

export const FSM_COLUMNS: Array<{
  state: FSMState;
  title: string;
  tier: 1 | 2 | 3;
  colorClass: string;
}> = [
  { state: "CAPTURED", title: "Captured", tier: 1, colorClass: "border-slate-600/60" },
  { state: "RESEARCHED_TRIAGED", title: "Researched (ICE ≥7)", tier: 1, colorClass: "border-sky-500/50" },
  { state: "SCRIPTED_PACKAGED", title: "Scripted & Packaged", tier: 1, colorClass: "border-indigo-500/50" },
  { state: "HITL_PENDING_PRODUCTION", title: "HITL Tier 2: Production", tier: 2, colorClass: "border-amber-500/60" },
  { state: "PRODUCED_VALIDATED", title: "Produced (-14 LUFS QC)", tier: 1, colorClass: "border-teal-500/50" },
  { state: "HITL_PENDING_PUBLISH", title: "HITL Tier 3: Publish Gate", tier: 3, colorClass: "border-rose-500/60" },
  { state: "PUBLISHED_LIVE", title: "Published Live", tier: 3, colorClass: "border-emerald-500/60" },
  { state: "AUDITED_CLOSED_LOOP", title: "Audited (RMT-A)", tier: 1, colorClass: "border-violet-500/60" },
];

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
