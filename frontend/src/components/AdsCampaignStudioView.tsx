"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BarChart3,
  Check,
  Copy,
  Film,
  KeyRound,
  Layers,
  Link2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { LinkedInAdsLibraryExplorer } from "@/components/ads/LinkedInAdsLibraryExplorer";
import { LinkedInB2BAdsPanel } from "@/components/ads/LinkedInB2BAdsPanel";
import { AstryxBadge, AstryxButton } from "@/components/ui/AstryxPrimitives";
import { apiClient } from "@/lib/api";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { useEngineStore } from "@/store/useEngineStore";
import type {
  AdCampaignGenerateRequest,
  AdCampaignResponse,
  AdCreativeVariant,
  LinkedInAdsSpec,
} from "@/types/engine";

interface AdsCampaignStudioViewProps {
  onRefresh?: () => Promise<void> | void;
}

type AdsResultTabId =
  | "creatives"
  | "linkedin-ads"
  | "linkedin-library"
  | "google-rsa"
  | "remotion-utm";

const AD_PLATFORMS = [
  {
    id: "LinkedIn Ads (B2B & Thought Leader)",
    short: "LinkedIn Ads",
    hint: "Thought Leader + PDF Lead Gen + Ads Library",
  },
  {
    id: "Meta Ads (IG/FB)",
    short: "Meta Ads",
    hint: "Reels 9:16 + Feed PAS",
  },
  {
    id: "Google Search Ads",
    short: "Google Search",
    hint: "RSA 5 Titulares + Negativas",
  },
  {
    id: "YouTube In-Stream Ads",
    short: "YouTube Ads",
    hint: "Gancho 5s Skip-Proof",
  },
  {
    id: "TikTok Spark Ads",
    short: "TikTok Spark",
    hint: "UGC Nativo + Safe Zone",
  },
] as const;

const AD_OBJECTIVES = [
  "Leads / ManyChat DM",
  "Tráfico a Landing",
  "Demos B2B",
  "Retargeting",
] as const;

const RESULT_TABS: Array<{ id: AdsResultTabId; label: string; shortLabel: string }> = [
  {
    id: "creatives",
    label: "1. Creatividades PAS / Autoridad",
    shortLabel: "1. Creatividades",
  },
  {
    id: "linkedin-ads",
    label: "2. 💼 LinkedIn Ads B2B",
    shortLabel: "2. 💼 LinkedIn Ads",
  },
  {
    id: "linkedin-library",
    label: "3. 🔍 LinkedIn Ads Library",
    shortLabel: "3. 🔍 Ads Library",
  },
  {
    id: "google-rsa",
    label: "4. Google RSA & Search Console",
    shortLabel: "4. Google RSA",
  },
  {
    id: "remotion-utm",
    label: "5. Storyboard 9:16 & UTMs GA4",
    shortLabel: "5. Remotion & UTMs",
  },
];

function truncateAtLimit(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.55 ? cut.slice(0, lastSpace) : cut).trim();
}

function slugifyUtm(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_|_$)/g, "")
      .slice(0, 40) || "campana_ace"
  );
}

function buildUtmUrl(
  baseUrl: string,
  params: {
    source: string;
    medium: string;
    campaign: string;
    content?: string;
    term?: string;
  }
): string {
  const safeBase =
    baseUrl.trim() && /^https?:\/\//i.test(baseUrl.trim())
      ? baseUrl.trim()
      : `https://${(baseUrl.trim() || "contentengine.local/recurso").replace(/^\/+/, "")}`;

  try {
    const parsed = new URL(safeBase);
    parsed.searchParams.set("utm_source", params.source);
    parsed.searchParams.set("utm_medium", params.medium);
    parsed.searchParams.set("utm_campaign", params.campaign);
    if (params.content) parsed.searchParams.set("utm_content", params.content);
    if (params.term) parsed.searchParams.set("utm_term", params.term);
    return parsed.toString();
  } catch {
    const query = new URLSearchParams({
      utm_source: params.source,
      utm_medium: params.medium,
      utm_campaign: params.campaign,
      ...(params.content ? { utm_content: params.content } : {}),
      ...(params.term ? { utm_term: params.term } : {}),
    });
    return `${safeBase}?${query.toString()}`;
  }
}

function buildLocalLinkedInAdsSpec(
  req: AdCampaignGenerateRequest,
  context: {
    niche?: string;
    icp?: string;
    creatorName?: string;
    hookHint?: string;
  }
): LinkedInAdsSpec {
  const topic = req.topic.trim() || "Sistema de Automatización con IA";
  const keyword = (req.trigger_keyword || "BLUEPRINT").trim().toUpperCase();
  const targetUrl =
    req.target_url?.trim() || "https://contentengine.local/blueprint";
  const icp = context.icp || "fundadores, directivos y equipos B2B";
  const niche = context.niche || "automatización con IA y sistemas B2B";
  const creatorName = context.creatorName || "Nuestro equipo";
  const shortTopic = truncateAtLimit(topic, 48);
  const shortIcp = truncateAtLimit(icp, 48);
  const shortNiche = truncateAtLimit(niche, 48);

  const tlCtaSoft =
    req.objective === "Demos B2B"
      ? `Si quieres revisar cómo encajaría en tu equipo, escríbeme "${keyword}" por DM y coordinamos 15 min.`
      : req.objective === "Tráfico a Landing"
      ? `Dejo el acceso directo al recurso completo en el primer comentario (o comenta "${keyword}").`
      : `Si quieres la guía paso a paso + plantilla, comenta "${keyword}" abajo y te la envío por DM.`;

  const singleCtaLabel =
    req.objective === "Demos B2B"
      ? "Solicitar demo"
      : req.objective === "Leads / ManyChat DM"
      ? "Descargar"
      : "Más información";

  const tlHook = truncateAtLimit(
    context.hookHint?.trim() ||
      `Dejamos de improvisar en ${shortTopic} y multiplicamos x3.4 los leads B2B sin ampliar equipo.`,
    148
  );

  return {
    thought_leader_ad: {
      intro_hook: tlHook,
      full_post_body: [
        `Durante meses vimos al mismo patrón repetirse en ${shortIcp}: muchas horas creando piezas sueltas y cero trazabilidad real en pipeline.`,
        `Al estructurar "${shortTopic}" dentro de ${shortNiche}, cambiamos 3 piezas clave:`,
        `1. Empaque y gancho validado antes de producir.\n2. Distribución multicanal sin enlaces dentro del cuerpo.\n3. Captura directa con palabra clave ${keyword} y seguimiento medible.`,
        `Resultado: conversaciones B2B cualificadas cada semana con menos de la mitad de esfuerzo manual.`,
      ].join("\n\n"),
      cta_soft: tlCtaSoft,
      target_audience_note: `Patrocinar publicación orgánica desde perfil personal de ${creatorName} hacia ${shortIcp} (excluyendo juniors y estudiantes).`,
      estimated_ctr_benchmark: "1.6% – 2.9% CTR (Thought Leader)",
    },
    single_image_ad: {
      intro_text: truncateAtLimit(
        `¿Tu equipo en ${shortNiche} sigue invirtiendo horas manuales sin retorno predecible?\n\nCon "${shortTopic}" diseñas un sistema B2B medible para ${shortIcp}: de idea validada a leads cualificados con ${keyword}.`,
        595
      ),
      headline: truncateAtLimit(`Sistema B2B: ${shortTopic}`, 68),
      description: truncateAtLimit(
        `Arquitectura lista para ${shortIcp}. Activa con ${keyword}.`,
        96
      ),
      cta_label: singleCtaLabel,
      visual_brief: `Diagrama oscuro NLE (fondo #07090e, acentos cyan #22d3ee) en 1200×627 comparando "Flujo Manual Disperso" vs "Arquitectura ${shortTopic}" con 3 nodos y métrica destacada "+3.4x Watch Time / CPL -38%".`,
    },
    document_carousel_ad: {
      intro_text: truncateAtLimit(
        `Desliza este documento de 5 páginas con la hoja de ruta exacta de "${shortTopic}" aplicada a ${shortNiche}. Descárgalo gratis al final.`,
        595
      ),
      headline: truncateAtLimit(`Blueprint PDF: ${shortTopic}`, 68),
      slides_outline: [
        `Portada: Cómo dominar ${shortTopic} sin añadir horas operativas`,
        `El cuello de botella oculto que frena a ${shortIcp}`,
        `Arquitectura en 3 fases: Hook · Producción -14 LUFS · Captura ${keyword}`,
        `Métricas de control B2B (Hold Rate 3s, Watch Time Share y CPL)`,
        `Checklist de implementación + Acceso completo (${keyword})`,
      ],
      lead_gen_form_fields: [
        "Nombre",
        "Email corporativo",
        "Empresa",
        "Cargo",
      ],
      thank_you_message: `¡Perfecto! Tu recurso de "${shortTopic}" está listo. Ábrelo ahora aquí: ${targetUrl}`,
    },
    conversation_ad: {
      subject: truncateAtLimit(`Sobre ${shortTopic} en tu equipo`, 58),
      opening_message: `Hola %FIRSTNAME%,\n\nViendo tu rol en %COMPANYNAME%, te comparto el esquema con el que ${shortIcp} está reduciendo a la mitad el tiempo operativo en ${shortTopic} sin perder control de marca.\n\n¿Te paso el documento técnico o prefieres ver un diagnóstico rápido de 15 minutos?`,
      cta_buttons: [
        `Enviar blueprint (${keyword})`,
        "Agendar diagnóstico 15 min",
        "Solo explorar métricas",
      ],
    },
    targeting_blueprint: {
      job_titles: [
        "Founder & CEO",
        "Head of Growth",
        "Marketing Director",
        "VP of Revenue",
        "COO / Operations Lead",
      ],
      seniorities: ["Owner", "CXO", "VP", "Director", "Partner"],
      company_sizes: [
        "11-50 empleados",
        "51-200 empleados",
        "201-500 empleados",
      ],
      industries: [
        truncateAtLimit(niche, 38),
        "Software y Tecnología (SaaS)",
        "Consultoría y Servicios B2B",
        "Marketing y Publicidad",
      ],
      geographies: [
        "España (ES)",
        "México (MX)",
        "Colombia (CO)",
        "Argentina (AR)",
        "Estados Unidos (ES/EN)",
      ],
      recommended_daily_budget_eur:
        "30 € – 50 €/día (70% Thought Leader + 30% Document Ad)",
    },
  };
}

function normalizeCampaignResponse(
  res: AdCampaignResponse,
  req: AdCampaignGenerateRequest,
  context: {
    niche?: string;
    icp?: string;
    creatorName?: string;
    hookHint?: string;
  }
): AdCampaignResponse {
  const normalizedVariants = res.variants.map((variant) => ({
    ...variant,
    remotion_916_storyboard: (variant.remotion_916_storyboard || []).map(
      (blk) => {
        const raw = blk as unknown as Record<string, string | undefined>;
        return {
          timecode: blk.timecode || raw.timecode || "00:00",
          visual: blk.visual || raw.visual_direction || "",
          copy_overlay: blk.copy_overlay || raw.on_screen_text || "",
          audio: blk.audio || raw.audio_voiceover || "",
        };
      }
    ),
  }));

  return {
    ...res,
    variants: normalizedVariants,
    linkedin_ads:
      res.linkedin_ads ?? buildLocalLinkedInAdsSpec(req, context),
  };
}

function buildLocalAdCampaign(
  req: AdCampaignGenerateRequest,
  context: {
    niche?: string;
    icp?: string;
    creatorName?: string;
    hookHint?: string;
  }
): AdCampaignResponse {
  const topic = req.topic.trim() || "Sistema de Automatización con IA";
  const keyword = (req.trigger_keyword || "BLUEPRINT").trim().toUpperCase();
  const targetUrl =
    req.target_url?.trim() || "https://contentengine.local/blueprint";
  const icp = context.icp || "fundadores, consultores y equipos B2B";
  const niche = context.niche || "automatización y sistemas de contenido";
  const campaignSlug = slugifyUtm(topic);

  const ctaByObjective: Record<string, string> = {
    "Leads / ManyChat DM": "Enviar mensaje",
    "Tráfico a Landing": "Más información",
    "Demos B2B": "Solicitar demo",
    Retargeting: "Ver caso ahora",
  };
  const ctaButton = ctaByObjective[req.objective] ?? "Más información";

  const actionLine =
    req.objective === "Leads / ManyChat DM"
      ? `Comenta "${keyword}" o pulsa en "${ctaButton}" y te enviamos el blueprint paso a paso por DM.`
      : req.objective === "Demos B2B"
      ? `Agenda tu diagnóstico técnico en ${targetUrl} (cupos limitados esta semana).`
      : req.objective === "Retargeting"
      ? `Viste nuestra arquitectura de ${truncateAtLimit(niche, 38)}: da el siguiente paso hoy en ${targetUrl}.`
      : `Accede al recurso completo y plantillas en ${targetUrl}.`;

  const variants: AdCreativeVariant[] = [
    {
      variant_id: "VAR-A-PAS",
      angle_name: "Dolor PAS (Problema · Agitación · Solución)",
      framework: "PAS",
      primary_text: `¿Sigues publicando todos los días sin retorno predecible?\n\nPara ${truncateAtLimit(
        icp,
        68
      )}, improvisar cada pieza quema horas operativas y hunde la retención en los primeros 3 segundos.\n\nCon "${truncateAtLimit(
        topic,
        64
      )}" reemplazas esfuerzo manual por un flujo medible (-14 LUFS, guión en 2 columnas y captura automatizada).\n\n👉 ${actionLine}`,
      headline: truncateAtLimit(`Deja de improvisar: ${topic}`, 40),
      description: truncateAtLimit(
        `Sistema probado para ${icp}. Activa con ${keyword}.`,
        78
      ),
      cta_button: ctaButton,
      remotion_916_storyboard: [
        {
          timecode: "0-3s Hook Visual",
          visual:
            "Plano cerrado a cámara con zoom 115% + fondo rojo alerta en zona segura superior.",
          copy_overlay: "PIERDES 80% DE ALCANCE ASÍ",
          audio:
            context.hookHint ||
            "Si grabas sin validar tu empaque y gancho de 3 segundos, estás quemando tu presupuesto.",
        },
        {
          timecode: "3-10s Prueba",
          visual:
            "Split-screen Remotion: timeline manual caótico vs pipeline automatizado 3.4x Watch Time.",
          copy_overlay: "3.4x WATCH TIME · -14 LUFS",
          audio:
            "Al estructurar el guión por bloques y podar silencios mayores a 400ms, la retención sube sin aumentar horas.",
        },
        {
          timecode: "10-15s CTA",
          visual:
            "Mockup del recurso en mano + flecha animada sobre zona segura inferior.",
          copy_overlay: `COMENTA "${keyword}" ↓`,
          audio: actionLine,
        },
      ],
    },
    {
      variant_id: "VAR-B-AUTH",
      angle_name: "Autoridad / Métrica Comprobada",
      framework: "Autoridad",
      primary_text: `3.4x más tiempo de retención y menos de la mitad de horas de producción.\n\nEsta es la arquitectura exacta detrás de "${truncateAtLimit(
        topic,
        64
      )}" que aplicamos en ${truncateAtLimit(
        niche,
        55
      )}:\n• Empaque A/B validado antes de encender cámara\n• Poda automática >400ms + normalización -14 LUFS\n• Captura directa con palabra clave ${keyword}\n\n👉 ${actionLine}`,
      headline: truncateAtLimit(`Arquitectura 3.4x: ${topic}`, 40),
      description: truncateAtLimit(
        `Métricas reales 24h/7d y plantilla lista para implementar hoy.`,
        78
      ),
      cta_button: ctaButton,
      remotion_916_storyboard: [
        {
          timecode: "0-3s Hook Visual",
          visual:
            "Gráfica animada subiendo a 74% Hold Rate 3s sobre estudio oscuro #0b0e14.",
          copy_overlay: "74% HOLD RATE EN 3 SEGUNDOS",
          audio:
            "No es suerte ni algoritmo: estas tres métricas explican por qué una pieza escala 3.4 veces más.",
        },
        {
          timecode: "3-10s Prueba",
          visual:
            "Screen recording rápido de dashboard RMT-A + subtítulos karaoke en zona 55%.",
          copy_overlay: "GUIÓN 2 COL. + RMT-A",
          audio:
            "Medimos retención al segundo 3, densidad de envío por DM y Watch Time Share antes de invertir en pauta.",
        },
        {
          timecode: "10-15s CTA",
          visual:
            "Tarjeta limpia con portada del Blueprint + badge de descarga inmediata.",
          copy_overlay: `ESCRIBE ${keyword} AHORA`,
          audio: actionLine,
        },
      ],
    },
    {
      variant_id: "VAR-C-DEMO",
      angle_name: "Demo Contraintuitiva (Anti-Volumen)",
      framework: "Demo Contraintuitiva",
      primary_text: `Publicar más veces a la semana NO arregla una mala retención; solo multiplica trabajo manual.\n\nMira en esta demo rápida cómo "${truncateAtLimit(
        topic,
        60
      )}" convierte 1 idea validada en video 9:16, post sin enlaces en LinkedIn, hilo en X y leads cualificados.\n\n👉 ${actionLine}`,
      headline: truncateAtLimit(`Menos volumen, más sistema (${keyword})`, 40),
      description: truncateAtLimit(
        `Demo técnica en 60s. Sin relleno ni agencias lentas.`,
        78
      ),
      cta_button: ctaButton,
      remotion_916_storyboard: [
        {
          timecode: "0-3s Hook Visual",
          visual:
            "Tachado animado sobre calendario de 30 posts/mes + corte seco de audio.",
          copy_overlay: "PUBLICAR DIARIO NO SIRVE",
          audio:
            "Publicar más videos sin sistema solo acelera tu desgaste. Mira esta alternativa en 15 segundos.",
        },
        {
          timecode: "3-10s Prueba",
          visual:
            "Secuencia B-roll 1.8s por plano mostrando exportación multiplataforma y ManyChat.",
          copy_overlay: "1 IDEA → 5 CANALES + DM",
          audio:
            "De un guión en dos columnas salen Reels, YouTube, LinkedIn, X y la automatización de respuesta directa.",
        },
        {
          timecode: "10-15s CTA",
          visual:
            "Cierre directo a cámara con botón visual apuntando al enlace o comentario.",
          copy_overlay: `PIDE EL RECURSO: ${keyword}`,
          audio: actionLine,
        },
      ],
    },
  ];

  const shortTopic = truncateAtLimit(topic, 22);
  const headlines = [
    truncateAtLimit(`Sistema ${shortTopic}`, 30),
    truncateAtLimit(`Automatiza ${shortTopic}`, 30),
    truncateAtLimit(`Guía ${keyword} en 15 Min`, 30),
    truncateAtLimit(`Escala Sin Horas Manuales`, 30),
    truncateAtLimit(`Arquitectura IA B2B 2026`, 30),
  ];

  const descriptions = [
    truncateAtLimit(
      `Implementa ${truncateAtLimit(topic, 36)} con métricas reales y plantilla lista.`,
      90
    ),
    truncateAtLimit(
      `Ideal para ${truncateAtLimit(icp, 44)}. Acceso directo con ${keyword}.`,
      90
    ),
  ];

  const coreKw = topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 3)
    .join(" ");

  const exactBase = coreKw || "sistema automatizacion ia";

  const ga4_utm_links = req.platforms.map((plat) => {
    const low = plat.toLowerCase();
    const src = low.includes("linkedin")
      ? "linkedin_ads"
      : low.includes("meta")
      ? "meta_ads"
      : low.includes("google")
      ? "google_search"
      : low.includes("youtube")
      ? "youtube_ads"
      : "tiktok_spark";
    const med = low.includes("search") ? "cpc" : "paid_social";
    const content = low.includes("linkedin")
      ? `li_thought_leader_${keyword.toLowerCase()}`
      : `var_a_pas_${keyword.toLowerCase()}`;
    return {
      platform: plat,
      utm_url: buildUtmUrl(targetUrl, {
        source: src,
        medium: med,
        campaign: `${campaignSlug}_${slugifyUtm(req.objective)}`,
        content,
      }),
    };
  });

  return {
    topic,
    objective: req.objective,
    platforms: req.platforms,
    variants,
    google_rsa: {
      headlines,
      descriptions,
      search_keywords_exact: [
        `[${exactBase}]`,
        `[automatizacion contenido ia]`,
        `[sistema leads b2b]`,
      ],
      search_keywords_phrase: [
        `"${exactBase}"`,
        `"como escalar contenido con ia"`,
        `"embudo manychat y video corto"`,
      ],
      search_keywords_negative: [
        "-gratis",
        "-curso pirata",
        "-plantilla word",
        "-empleo",
        "-tutorial basico",
      ],
      youtube_5s_hook: `Si eres parte de ${truncateAtLimit(
        icp,
        42
      )} y sigues perdiendo horas editando sin leads: NO saltes este anuncio—mira en 15s cómo ${truncateAtLimit(
        topic,
        46
      )} lo resuelve con ${keyword}.`,
    },
    linkedin_ads: buildLocalLinkedInAdsSpec(req, context),
    ga4_utm_links,
  };
}

export function AdsCampaignStudioView({
  onRefresh,
}: AdsCampaignStudioViewProps) {
  const {
    selectedDetail,
    selectedProjectId,
    creatorProfile,
    backendOnline,
    showToast,
    setProjects,
  } = useEngineStore();

  const resultTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeResultTab, setActiveResultTab] =
    useState<AdsResultTabId>("creatives");

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "LinkedIn Ads (B2B & Thought Leader)",
    "Meta Ads (IG/FB)",
    "Google Search Ads",
    "YouTube In-Stream Ads",
    "TikTok Spark Ads",
  ]);
  const [topic, setTopic] = useState(
    selectedDetail?.project?.working_title ?? ""
  );
  const [objective, setObjective] = useState<string>("Leads / ManyChat DM");
  const [triggerKeyword, setTriggerKeyword] = useState("BLUEPRINT");
  const [targetUrl, setTargetUrl] = useState(
    "https://contentengine.local/blueprint"
  );

  const [generating, setGenerating] = useState(false);
  const [generationSource, setGenerationSource] = useState<"backend" | "local">(
    "local"
  );
  const [campaign, setCampaign] = useState<AdCampaignResponse>(() =>
    buildLocalAdCampaign(
      {
        project_id: selectedProjectId ?? null,
        topic:
          selectedDetail?.project?.working_title ?? "Campaña de Contenido",
        platforms: [
          "LinkedIn Ads (B2B & Thought Leader)",
          "Meta Ads (IG/FB)",
          "Google Search Ads",
          "YouTube In-Stream Ads",
          "TikTok Spark Ads",
        ],
        objective: "Leads / ManyChat DM",
        target_url: "https://contentengine.local/blueprint",
        trigger_keyword: "BLUEPRINT",
      },
      {
        niche: creatorProfile?.niche,
        icp: creatorProfile?.ideal_customer_profile,
        creatorName: creatorProfile?.name,
        hookHint: selectedDetail?.script?.hook_variants?.[0]?.hook_text,
      }
    )
  );

  const [selectedStoryboardIdx, setSelectedStoryboardIdx] = useState(0);
  const [selectedFrameBlockIdx, setSelectedFrameBlockIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive GA4 Custom UTM Builder state
  const [utmSource, setUtmSource] = useState("linkedin_ads");
  const [utmMedium, setUtmMedium] = useState("paid_social");
  const [utmCampaignName, setUtmCampaignName] = useState("ace_101_leads");
  const [utmContent, setUtmContent] = useState("li_thought_leader");
  const [utmTerm, setUtmTerm] = useState("");

  const manychatTriggers = useMemo(
    () => creatorProfile?.manychat_triggers ?? [],
    [creatorProfile]
  );
  const leadMagnets = useMemo(
    () => creatorProfile?.lead_magnets ?? [],
    [creatorProfile]
  );

  // Sync topic when switching project
  const projectId = selectedDetail?.project?.id;
  const projectTitle = selectedDetail?.project?.working_title;
  useEffect(() => {
    if (projectTitle) {
      setTopic(projectTitle);
      setUtmCampaignName(slugifyUtm(projectTitle));
    }
  }, [projectId, projectTitle]);

  // Sync Paso 0 keyword & URL defaults when profile loads
  useEffect(() => {
    if (!creatorProfile) return;
    const activeRule =
      creatorProfile.manychat_triggers?.find((t) => t.active) ??
      creatorProfile.manychat_triggers?.[0];
    if (activeRule) {
      setTriggerKeyword(activeRule.keyword);
      const linkedLm = creatorProfile.lead_magnets?.find(
        (lm) => lm.id === activeRule.lead_magnet_id
      );
      if (linkedLm?.delivery_url) {
        setTargetUrl(linkedLm.delivery_url);
      }
    } else {
      const catTrigger =
        creatorProfile.conversion_goals_catalog?.[
          creatorProfile.active_conversion_goal
        ]?.trigger_word;
      if (catTrigger) setTriggerKeyword(catTrigger);
      if (creatorProfile.lead_magnets?.[0]?.delivery_url) {
        setTargetUrl(creatorProfile.lead_magnets[0].delivery_url);
      }
    }
  }, [creatorProfile]);

  const customGa4Url = useMemo(
    () =>
      buildUtmUrl(targetUrl, {
        source: utmSource.trim() || "linkedin_ads",
        medium: utmMedium.trim() || "paid_social",
        campaign: utmCampaignName.trim() || "ace_campaign",
        content: utmContent.trim() || undefined,
        term: utmTerm.trim() || undefined,
      }),
    [targetUrl, utmSource, utmMedium, utmCampaignName, utmContent, utmTerm]
  );

  const handleCopy = useCallback(
    async (key: string, value: string, label: string) => {
      const ok = await copyPreservingLineBreaks(value);
      if (ok) {
        setCopiedKey(key);
        showToast("success", `${label} copiado al portapapeles.`);
        setTimeout(() => {
          setCopiedKey((prev) => (prev === key ? null : prev));
        }, 2200);
      } else {
        showToast("error", "No se pudo copiar al portapapeles.");
      }
    },
    [showToast]
  );

  const handleTogglePlatform = (platId: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platId)) {
        if (prev.length === 1) {
          showToast("info", "Mantén al menos 1 plataforma publicitaria activa.");
          return prev;
        }
        return prev.filter((p) => p !== platId);
      }
      return [...prev, platId];
    });
  };

  const handleSelectTriggerPreset = (keyword: string) => {
    setTriggerKeyword(keyword);
    const rule = manychatTriggers.find((r) => r.keyword === keyword);
    if (rule?.lead_magnet_id) {
      const lm = leadMagnets.find((item) => item.id === rule.lead_magnet_id);
      if (lm?.delivery_url) setTargetUrl(lm.delivery_url);
    }
  };

  const campaignContext = useMemo(
    () => ({
      niche: creatorProfile?.niche,
      icp: creatorProfile?.ideal_customer_profile,
      creatorName: creatorProfile?.name,
      hookHint: selectedDetail?.script?.hook_variants?.[0]?.hook_text,
    }),
    [creatorProfile, selectedDetail]
  );

  const executeCampaignGeneration = useCallback(
    async (
      topicOverride?: string,
      platformsOverride?: string[],
      customBannerMessage?: string
    ) => {
      const effectiveTopic = (topicOverride ?? topic).trim();
      if (!effectiveTopic) {
        showToast("error", "Introduce un tema u oferta para generar la campaña.");
        return;
      }

      const effectivePlatforms = platformsOverride ?? selectedPlatforms;
      const payload: AdCampaignGenerateRequest = {
        project_id: selectedProjectId ?? null,
        topic: effectiveTopic,
        platforms: effectivePlatforms,
        objective,
        target_url: targetUrl.trim() || undefined,
        trigger_keyword: triggerKeyword.trim() || undefined,
      };

      setGenerating(true);
      try {
        if (backendOnline) {
          const rawRes = await apiClient.generateAdCampaign(payload);
          const normalized = normalizeCampaignResponse(
            rawRes,
            payload,
            campaignContext
          );
          setCampaign(normalized);
          setGenerationSource("backend");
          setSelectedStoryboardIdx(0);
          setSelectedFrameBlockIdx(0);
          setUtmCampaignName(slugifyUtm(normalized.topic));
          showToast(
            "success",
            customBannerMessage ||
              `Campaña generada (${normalized.variants.length} creatividades + LinkedIn B2B + RSA + Remotion 9:16 + UTMs).`
          );
        } else {
          const local = buildLocalAdCampaign(payload, campaignContext);
          setCampaign(local);
          setGenerationSource("local");
          setSelectedStoryboardIdx(0);
          setSelectedFrameBlockIdx(0);
          setUtmCampaignName(slugifyUtm(local.topic));
          showToast(
            customBannerMessage ? "success" : "info",
            customBannerMessage ||
              "Campaña generada con motor local rico (LinkedIn B2B + Meta + Google RSA + Remotion 9:16)."
          );
        }
      } catch {
        const fallback = buildLocalAdCampaign(payload, campaignContext);
        setCampaign(fallback);
        setGenerationSource("local");
        setSelectedStoryboardIdx(0);
        setSelectedFrameBlockIdx(0);
        setUtmCampaignName(slugifyUtm(fallback.topic));
        showToast(
          "info",
          customBannerMessage ||
            "Backend sin respuesta para /ads/generate-campaign: campaña generada con fallback local."
        );
      } finally {
        setGenerating(false);
      }
    },
    [
      topic,
      selectedPlatforms,
      selectedProjectId,
      objective,
      targetUrl,
      triggerKeyword,
      backendOnline,
      campaignContext,
      showToast,
    ]
  );

  const handleGenerateCampaign = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeCampaignGeneration();
  };

  const selectResultTab = (tabId: AdsResultTabId, idx?: number) => {
    setActiveResultTab(tabId);
    const resolvedIdx =
      typeof idx === "number"
        ? idx
        : RESULT_TABS.findIndex((t) => t.id === tabId);
    if (resolvedIdx >= 0) {
      resultTabRefs.current[resolvedIdx]?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const handleUseAdAsReference = async (
    refTopic: string,
    advertiser: string
  ) => {
    const cleanTopic = refTopic.trim() || `Estrategia B2B (${advertiser})`;
    setTopic(cleanTopic);
    setUtmCampaignName(slugifyUtm(cleanTopic));

    const liPlatformId = "LinkedIn Ads (B2B & Thought Leader)";
    const nextPlatforms = selectedPlatforms.includes(liPlatformId)
      ? selectedPlatforms
      : [liPlatformId, ...selectedPlatforms];
    setSelectedPlatforms(nextPlatforms);

    selectResultTab("linkedin-ads", 1);
    await executeCampaignGeneration(
      cleanTopic,
      nextPlatforms,
      `Referencia de ${advertiser} aplicada a tu Campaña LinkedIn Ads B2B.`
    );
  };

  const handleIdeaImported = async () => {
    if (onRefresh) {
      await onRefresh();
      return;
    }
    try {
      const updated = await apiClient.listProjects();
      setProjects(updated);
    } catch {
      // silent fallback
    }
  };

  const handleResultTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % RESULT_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + RESULT_TABS.length) % RESULT_TABS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = RESULT_TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const target = RESULT_TABS[nextIdx];
    selectResultTab(target.id, nextIdx);
    resultTabRefs.current[nextIdx]?.focus();
  };

  const handleUpdateVariantField = (
    idx: number,
    field: "primary_text" | "headline" | "description" | "cta_button",
    val: string
  ) => {
    setCampaign((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === idx ? { ...v, [field]: val } : v
      ),
    }));
  };

  const handleUpdateRsaHeadline = (idx: number, val: string) => {
    setCampaign((prev) => ({
      ...prev,
      google_rsa: {
        ...prev.google_rsa,
        headlines: prev.google_rsa.headlines.map((h, i) => (i === idx ? val : h)),
      },
    }));
  };

  const handleUpdateRsaDescription = (idx: number, val: string) => {
    setCampaign((prev) => ({
      ...prev,
      google_rsa: {
        ...prev.google_rsa,
        descriptions: prev.google_rsa.descriptions.map((d, i) =>
          i === idx ? val : d
        ),
      },
    }));
  };

  const handleUpdateStoryboardBlock = (
    variantIdx: number,
    blockIdx: number,
    field: "timecode" | "visual" | "copy_overlay" | "audio",
    val: string
  ) => {
    setCampaign((prev) => ({
      ...prev,
      variants: prev.variants.map((v, vi) =>
        vi === variantIdx
          ? {
              ...v,
              remotion_916_storyboard: v.remotion_916_storyboard.map((blk, bi) =>
                bi === blockIdx ? { ...blk, [field]: val } : blk
              ),
            }
          : v
      ),
    }));
  };

  const activeVariant =
    campaign.variants[selectedStoryboardIdx] ?? campaign.variants[0];
  const activeStoryboard = activeVariant?.remotion_916_storyboard ?? [];
  const previewBlock =
    activeStoryboard[selectedFrameBlockIdx] ?? activeStoryboard[0];

  const resolvedLinkedInSpec = useMemo<LinkedInAdsSpec>(() => {
    if (campaign.linkedin_ads) return campaign.linkedin_ads;
    return buildLocalLinkedInAdsSpec(
      {
        project_id: selectedProjectId ?? null,
        topic: campaign.topic || topic || "Campaña B2B",
        platforms: campaign.platforms,
        objective: campaign.objective || objective,
        target_url: targetUrl,
        trigger_keyword: triggerKeyword,
      },
      campaignContext
    );
  }, [
    campaign.linkedin_ads,
    campaign.topic,
    campaign.platforms,
    campaign.objective,
    selectedProjectId,
    topic,
    objective,
    targetUrl,
    triggerKeyword,
    campaignContext,
  ]);

  return (
    <div className="space-y-5">
      {/* Pro Dark NLE Paid Ads Studio Header */}
      <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-black/30">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <AstryxBadge
              label="PAID ADS STUDIO"
              variant="orange"
              icon={<Megaphone className="w-3.5 h-3.5" />}
            />
            {selectedDetail?.project && (
              <AstryxBadge
                label={selectedDetail.project.asset_code}
                variant="cyan"
              />
            )}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Estudio de Campañas Paid Ads (LinkedIn B2B + Meta + Google RSA + Remotion 9:16)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Convierte tu guión y oferta de Paso 0 en creatividades PAS/Autoridad, suite LinkedIn Ads B2B &amp; Ads Library, Google RSA, storyboard 9:16 y UTMs GA4.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AstryxBadge
            label={
              generationSource === "backend"
                ? "Sincronizado con Backend IA"
                : "Motor Studio Local Listo"
            }
            variant={generationSource === "backend" ? "success" : "info"}
          />

          {onRefresh && (
            <AstryxButton
              type="button"
              variant="secondary"
              size="sm"
              label="Actualizar Proyecto"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => void onRefresh()}
            />
          )}
        </div>
      </div>

      {/* Campaign Configuration Panel */}
      <form
        onSubmit={handleGenerateCampaign}
        aria-label="Configuración de campaña publicitaria"
        className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-5"
      >
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Ad Platforms Multi-Selector */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                1. Plataformas Publicitarias ({selectedPlatforms.length} activas)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AD_PLATFORMS.map((plat, platIdx) => {
                const active = selectedPlatforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleTogglePlatform(plat.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      platIdx === 0 ? "sm:col-span-2" : ""
                    } ${
                      active
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{plat.id}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          active ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />
                    </div>
                    <p className="text-[10px] font-mono opacity-80 mt-0.5">
                      {plat.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Objective Radio Group */}
          <fieldset className="lg:col-span-6 space-y-2">
            <legend className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              2. Objetivo de Campaña
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {AD_OBJECTIVES.map((obj) => {
                const checked = objective === obj;
                return (
                  <label
                    key={obj}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition text-xs font-semibold ${
                      checked
                        ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ad-campaign-objective"
                      value={obj}
                      checked={checked}
                      onChange={() => setObjective(obj)}
                      className="accent-emerald-400 cursor-pointer"
                    />
                    <span>{obj}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Topic / Offer + Trigger Keyword + Destination URL */}
        <div className="grid gap-4 lg:grid-cols-12 pt-3 border-t border-slate-800/80">
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="ads-topic-input"
                className="text-xs font-bold text-slate-200"
              >
                3. Tema / Oferta Principal
              </label>
              {selectedDetail?.project?.working_title &&
                topic !== selectedDetail.project.working_title && (
                  <button
                    type="button"
                    onClick={() =>
                      setTopic(selectedDetail.project.working_title)
                    }
                    className="text-[11px] text-cyan-300 hover:text-white underline"
                  >
                    Usar título del proyecto
                  </button>
                )}
            </div>
            <input
              id="ads-topic-input"
              name="topic"
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. Blueprint 6x6 de Automatización con IA"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="ads-trigger-keyword"
              className="block text-xs font-bold text-slate-200 mb-1"
            >
              4. Palabra Clave / Trigger (Paso 0)
            </label>
            <div className="flex gap-1.5">
              <input
                id="ads-trigger-keyword"
                name="trigger_keyword"
                type="text"
                value={triggerKeyword}
                onChange={(e) => setTriggerKeyword(e.target.value.toUpperCase())}
                placeholder="BLUEPRINT"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono uppercase text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>
            {manychatTriggers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {manychatTriggers.slice(0, 4).map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => handleSelectTriggerPreset(rule.keyword)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                      triggerKeyword === rule.keyword
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <KeyRound className="w-2.5 h-2.5 inline mr-1" />
                    {rule.keyword}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <label
              htmlFor="ads-target-url"
              className="block text-xs font-bold text-slate-200 mb-1"
            >
              5. URL Destino / Landing Page
            </label>
            <input
              id="ads-target-url"
              name="target_url"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://tu-dominio.com/recurso"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
            />
            {leadMagnets.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {leadMagnets.slice(0, 3).map((lm) => (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => {
                      if (lm.delivery_url) setTargetUrl(lm.delivery_url);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] border border-slate-800 bg-slate-950 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200 truncate max-w-[180px]"
                    title={lm.delivery_url}
                  >
                    Lead Magnet: {lm.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-400">
            Genera 3 ángulos PAS/Autoridad, Suite LinkedIn Ads B2B (Thought Leader + PDF Lead Gen + InMail), 5 titulares RSA (&le;30 chars), storyboard 9:16 y UTMs GA4.
          </p>
          <AstryxButton
            type="submit"
            variant="primary"
            size="lg"
            label={
              generating
                ? "Generando Campaña..."
                : "Generar Campaña Completa (LinkedIn B2B + Meta + Google + Remotion)"
            }
            icon={<Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />}
            isLoading={generating}
          />
        </div>
      </form>

      {/* Results Area with Clean Accessible Tablist */}
      <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl shadow-black/25">
        <div
          role="tablist"
          aria-label="Resultados de campaña publicitaria"
          className="bg-slate-950/80 px-2 sm:px-4 border-b border-slate-800/80 gap-1"
        >
          {RESULT_TABS.map((tab, idx) => {
            const isSelected = activeResultTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  resultTabRefs.current[idx] = el;
                }}
                id={`ads-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`ads-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectResultTab(tab.id, idx)}
                onKeyDown={(e) => handleResultTabKeyDown(e, idx)}
                className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-[-2px] ${
                  isSelected
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* =============================================================== */}
        {/* RESULT TAB 1: Creatividades PAS / Autoridad                     */}
        {/* =============================================================== */}
        <div
          role="tabpanel"
          id="ads-panel-creatives"
          aria-labelledby="ads-tab-creatives"
          hidden={activeResultTab !== "creatives"}
        >
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  3 Variantes de Creatividad (Dolor PAS · Autoridad/Métrica · Demo Contraintuitiva)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Edita cualquier campo y copia el bloque completo para Meta Ads Manager o TikTok Ads.
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1">
                {campaign.variants.length} variantes listas
              </span>
            </div>

            <div className="grid xl:grid-cols-3 gap-4">
              {campaign.variants.map((variant, idx) => {
                const fullBlock = `【${variant.angle_name}】\n\nTexto Principal:\n${variant.primary_text}\n\nTitular: ${variant.headline}\nDescripción: ${variant.description}\nCTA: ${variant.cta_button}`;
                return (
                  <article
                    key={variant.variant_id}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/90 pb-2.5">
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300">
                            {variant.framework}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-white mt-1.5">
                            {variant.angle_name}
                          </h4>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 shrink-0">
                          <MousePointerClick className="w-3 h-3" />
                          {variant.cta_button}
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor={`ad-primary-${idx}`}
                          className="block text-[11px] font-semibold text-slate-300 mb-1"
                        >
                          Texto Principal (Primary Text)
                        </label>
                        <textarea
                          id={`ad-primary-${idx}`}
                          rows={6}
                          value={variant.primary_text}
                          onChange={(e) =>
                            handleUpdateVariantField(
                              idx,
                              "primary_text",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <label
                            htmlFor={`ad-headline-${idx}`}
                            className="font-semibold text-slate-300"
                          >
                            Titular (Headline)
                          </label>
                          <span
                            className={`font-mono ${
                              variant.headline.length <= 40
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {variant.headline.length} / 40
                          </span>
                        </div>
                        <input
                          id={`ad-headline-${idx}`}
                          type="text"
                          value={variant.headline}
                          onChange={(e) =>
                            handleUpdateVariantField(idx, "headline", e.target.value)
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`ad-desc-${idx}`}
                          className="block text-[11px] font-semibold text-slate-300 mb-1"
                        >
                          Descripción
                        </label>
                        <input
                          id={`ad-desc-${idx}`}
                          type="text"
                          value={variant.description}
                          onChange={(e) =>
                            handleUpdateVariantField(
                              idx,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStoryboardIdx(idx);
                          setSelectedFrameBlockIdx(0);
                          selectResultTab("remotion-utm");
                        }}
                        className="text-[11px] text-cyan-300 hover:text-white font-semibold"
                      >
                        Ver Storyboard 9:16 →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            `variant-${variant.variant_id}`,
                            fullBlock,
                            variant.angle_name
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
                      >
                        {copiedKey === `variant-${variant.variant_id}` ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        Copiar Variante
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* RESULT TAB 2: LinkedIn Ads B2B & Thought Leader                 */}
        {/* =============================================================== */}
        <div
          role="tabpanel"
          id="ads-panel-linkedin-ads"
          aria-labelledby="ads-tab-linkedin-ads"
          hidden={activeResultTab !== "linkedin-ads"}
        >
          <LinkedInB2BAdsPanel
            spec={resolvedLinkedInSpec}
            topic={campaign.topic}
            onTopicSuggestion={() => selectResultTab("linkedin-library", 2)}
          />
        </div>

        {/* =============================================================== */}
        {/* RESULT TAB 3: LinkedIn Ads Library Explorer                     */}
        {/* =============================================================== */}
        <div
          role="tabpanel"
          id="ads-panel-linkedin-library"
          aria-labelledby="ads-tab-linkedin-library"
          hidden={activeResultTab !== "linkedin-library"}
        >
          <LinkedInAdsLibraryExplorer
            onIdeaImported={handleIdeaImported}
            onUseAdAsReference={(refTopic, advertiser) =>
              void handleUseAdAsReference(refTopic, advertiser)
            }
          />
        </div>

        {/* =============================================================== */}
        {/* RESULT TAB 4: Google Ads RSA & Search Console                   */}
        {/* =============================================================== */}
        <div
          role="tabpanel"
          id="ads-panel-google-rsa"
          aria-labelledby="ads-tab-google-rsa"
          hidden={activeResultTab !== "google-rsa"}
        >
          <div className="p-4 sm:p-5 space-y-5">
            {/* YouTube 5s Skip-Proof Hook */}
            <section
              aria-label="Gancho YouTube 5 Segundos"
              className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-950 to-cyan-950/20 p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-amber-200">
                    Gancho YouTube In-Stream 5 Segundos (Skip-Proof)
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono text-amber-300">
                    00:00 – 00:05 · Pre-Skip
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      "yt-5s-hook",
                      campaign.google_rsa.youtube_5s_hook,
                      "Gancho YouTube 5s"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition"
                >
                  {copiedKey === "yt-5s-hook" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar Gancho 5s
                </button>
              </div>
              <textarea
                rows={2}
                value={campaign.google_rsa.youtube_5s_hook}
                onChange={(e) =>
                  setCampaign((prev) => ({
                    ...prev,
                    google_rsa: {
                      ...prev.google_rsa,
                      youtube_5s_hook: e.target.value,
                    },
                  }))
                }
                aria-label="Gancho YouTube de 5 segundos"
                className="w-full rounded-lg bg-slate-950/90 border border-amber-500/30 px-3 py-2 text-xs text-white leading-relaxed focus:outline-none focus:border-amber-400"
              />
            </section>

            {/* RSA Headlines (<=30 chars) & Descriptions (<=90 chars) */}
            <div className="grid lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-cyan-300">
                      Titulares RSA (Hasta 5 · &le;30 chars)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Límite estricto de Google Ads Search por titular.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        "rsa-headlines",
                        campaign.google_rsa.headlines.slice(0, 5).join("\n"),
                        "5 Titulares RSA"
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    {copiedKey === "rsa-headlines" ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copiar Todos
                  </button>
                </div>

                <div className="space-y-2.5">
                  {campaign.google_rsa.headlines.slice(0, 5).map((hl, idx) => {
                    const over = hl.length > 30;
                    return (
                      <div key={`rsa-hl-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label
                            htmlFor={`rsa-headline-${idx}`}
                            className="font-mono text-slate-400"
                          >
                            Titular {idx + 1}
                          </label>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold ${
                                over ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {hl.length} / 30
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopy(
                                  `rsa-hl-${idx}`,
                                  hl,
                                  `Titular RSA ${idx + 1}`
                                )
                              }
                              aria-label={`Copiar titular ${idx + 1}`}
                              className="text-slate-400 hover:text-cyan-300"
                            >
                              {copiedKey === `rsa-hl-${idx}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <input
                          id={`rsa-headline-${idx}`}
                          type="text"
                          value={hl}
                          onChange={(e) =>
                            handleUpdateRsaHeadline(idx, e.target.value)
                          }
                          className={`w-full rounded-lg bg-slate-900 border px-3 py-1.5 text-xs text-white focus:outline-none ${
                            over
                              ? "border-rose-500/70 focus:border-rose-400"
                              : "border-slate-700 focus:border-cyan-400"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      Descripciones RSA (&le;90 chars)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Propuesta de valor y llamada a la acción para Google Search.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        "rsa-descriptions",
                        campaign.google_rsa.descriptions.join("\n"),
                        "Descripciones RSA"
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20"
                  >
                    {copiedKey === "rsa-descriptions" ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copiar Todas
                  </button>
                </div>

                <div className="space-y-3">
                  {campaign.google_rsa.descriptions.map((desc, idx) => {
                    const over = desc.length > 90;
                    return (
                      <div key={`rsa-desc-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <label
                            htmlFor={`rsa-desc-${idx}`}
                            className="font-mono text-slate-400"
                          >
                            Descripción {idx + 1}
                          </label>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold ${
                                over ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {desc.length} / 90
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopy(
                                  `rsa-desc-${idx}`,
                                  desc,
                                  `Descripción RSA ${idx + 1}`
                                )
                              }
                              aria-label={`Copiar descripción ${idx + 1}`}
                              className="text-slate-400 hover:text-emerald-300"
                            >
                              {copiedKey === `rsa-desc-${idx}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <textarea
                          id={`rsa-desc-${idx}`}
                          rows={2}
                          value={desc}
                          onChange={(e) =>
                            handleUpdateRsaDescription(idx, e.target.value)
                          }
                          className={`w-full rounded-lg bg-slate-900 border px-3 py-2 text-xs text-slate-100 focus:outline-none ${
                            over
                              ? "border-rose-500/70 focus:border-rose-400"
                              : "border-slate-700 focus:border-emerald-400"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Search Console Style Keywords: Exact, Phrase, Negative */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Exact Match */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    Keywords Exactas [exact]
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        "kw-exact",
                        campaign.google_rsa.search_keywords_exact.join("\n"),
                        "Keywords Exactas"
                      )
                    }
                    className="text-[11px] text-cyan-300 hover:text-white font-semibold"
                  >
                    Copiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.google_rsa.search_keywords_exact.map((kw, i) => (
                    <span
                      key={`exact-${i}`}
                      className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 font-mono text-[11px] text-cyan-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Phrase Match */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    Phrase Match &ldquo;frase&rdquo;
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        "kw-phrase",
                        campaign.google_rsa.search_keywords_phrase.join("\n"),
                        "Keywords Phrase Match"
                      )
                    }
                    className="text-[11px] text-emerald-300 hover:text-white font-semibold"
                  >
                    Copiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.google_rsa.search_keywords_phrase.map((kw, i) => (
                    <span
                      key={`phrase-${i}`}
                      className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 font-mono text-[11px] text-emerald-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Negative Keywords */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    Keywords Negativas (-excluir)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        "kw-negative",
                        campaign.google_rsa.search_keywords_negative.join("\n"),
                        "Keywords Negativas"
                      )
                    }
                    className="text-[11px] text-rose-300 hover:text-white font-semibold"
                  >
                    Copiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.google_rsa.search_keywords_negative.map((kw, i) => (
                    <span
                      key={`neg-${i}`}
                      className="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 font-mono text-[11px] text-rose-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* RESULT TAB 5: Storyboard 9:16 Remotion & UTMs GA4               */}
        {/* =============================================================== */}
        <div
          role="tabpanel"
          id="ads-panel-remotion-utm"
          aria-labelledby="ads-tab-remotion-utm"
          hidden={activeResultTab !== "remotion-utm"}
        >
          <div className="p-4 sm:p-5 space-y-6">
            {/* Remotion 9:16 Storyboard Section */}
            <section aria-label="Storyboard Remotion 9:16" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-cyan-400" />
                    Storyboard Remotion 9:16 por Bloques de Tiempo (0–15s)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Selecciona la variante creativa para editar el ritmo visual, overlays cinéticos y locución en zona segura 9:16.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {campaign.variants.map((v, idx) => (
                    <button
                      key={v.variant_id}
                      type="button"
                      aria-pressed={selectedStoryboardIdx === idx}
                      onClick={() => {
                        setSelectedStoryboardIdx(idx);
                        setSelectedFrameBlockIdx(0);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                        selectedStoryboardIdx === idx
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {v.framework}
                    </button>
                  ))}

                  {activeVariant && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          "storyboard-md",
                          activeVariant.remotion_916_storyboard
                            .map(
                              (b) =>
                                `[${b.timecode}]\nVisual: ${b.visual}\nOverlay 9:16: ${b.copy_overlay}\nAudio: ${b.audio}`
                            )
                            .join("\n\n"),
                          "Storyboard Remotion 9:16"
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
                    >
                      {copiedKey === "storyboard-md" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      Copiar Storyboard
                    </button>
                  )}
                </div>
              </div>

              <div className="grid xl:grid-cols-12 gap-5 items-start">
                {/* Timeline Blocks (0-3s Hook Visual, 3-10s Prueba, 10-15s CTA) */}
                <div className="xl:col-span-8 space-y-3">
                  {activeStoryboard.map((blk, bIdx) => {
                    const activePreview = selectedFrameBlockIdx === bIdx;
                    return (
                      <div
                        key={`sb-blk-${bIdx}`}
                        className={`rounded-xl border p-4 space-y-3 transition ${
                          activePreview
                            ? "border-cyan-500/60 bg-slate-950"
                            : "border-slate-800 bg-slate-950/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 font-mono text-xs font-bold text-cyan-300">
                            {blk.timecode}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedFrameBlockIdx(bIdx)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition ${
                              activePreview
                                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                            }`}
                          >
                            {activePreview
                              ? "● En Visor 9:16"
                              : "Previsualizar en 9:16"}
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor={`sb-visual-${bIdx}`}
                              className="block text-[11px] font-semibold text-cyan-300 mb-1"
                            >
                              Pista Visual / Cámara
                            </label>
                            <textarea
                              id={`sb-visual-${bIdx}`}
                              rows={2}
                              value={blk.visual}
                              onChange={(e) =>
                                handleUpdateStoryboardBlock(
                                  selectedStoryboardIdx,
                                  bIdx,
                                  "visual",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`sb-overlay-${bIdx}`}
                              className="block text-[11px] font-semibold text-amber-300 mb-1"
                            >
                              Copy Overlay Remotion (Zona Segura)
                            </label>
                            <textarea
                              id={`sb-overlay-${bIdx}`}
                              rows={2}
                              value={blk.copy_overlay}
                              onChange={(e) =>
                                handleUpdateStoryboardBlock(
                                  selectedStoryboardIdx,
                                  bIdx,
                                  "copy_overlay",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`sb-audio-${bIdx}`}
                            className="block text-[11px] font-semibold text-emerald-300 mb-1"
                          >
                            Pista Audio / Locución
                          </label>
                          <input
                            id={`sb-audio-${bIdx}`}
                            type="text"
                            value={blk.audio}
                            onChange={(e) =>
                              handleUpdateStoryboardBlock(
                                selectedStoryboardIdx,
                                bIdx,
                                "audio",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compact 9:16 Safe-Zone Frame Simulator */}
                <div className="xl:col-span-4 flex flex-col items-center">
                  <div className="w-full max-w-[260px] rounded-[28px] border-2 border-slate-700 bg-gradient-to-b from-slate-950 via-cyan-950/30 to-slate-950 aspect-[9/16] relative overflow-hidden shadow-2xl flex flex-col justify-between p-4">
                    {/* Top 25% Safe Zone */}
                    <div className="rounded-lg border border-dashed border-rose-500/40 bg-rose-950/20 px-2 py-1.5 text-[9px] font-mono text-rose-300 text-center">
                      ZONA SEGURA SUPERIOR (25%)
                    </div>

                    {/* Center Safe Area (25% - 70%) */}
                    <div className="space-y-3 text-center px-1">
                      <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-mono font-bold text-cyan-300">
                        {previewBlock?.timecode || "0-3s Hook Visual"}
                      </span>
                      <div className="rounded-xl bg-slate-950/90 border border-amber-400/60 px-3 py-2.5 shadow-lg">
                        <p className="text-sm font-black uppercase tracking-tight text-amber-300 leading-tight">
                          {previewBlock?.copy_overlay || "HOOK VISUAL 9:16"}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug bg-slate-900/70 rounded-lg p-2 border border-slate-800">
                        {previewBlock?.visual}
                      </p>
                    </div>

                    {/* Bottom 30% Ad CTA Zone */}
                    <div className="rounded-xl border border-dashed border-rose-500/40 bg-rose-950/20 p-2.5 space-y-1.5">
                      <div className="text-[9px] font-mono text-rose-300 text-center">
                        CAPA UI ANUNCIO (30% INF.)
                      </div>
                      <div className="rounded-lg bg-emerald-500 text-slate-950 text-center py-1.5 text-xs font-extrabold">
                        {activeVariant?.cta_button || "Más información"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* GA4 UTMs Builder Section */}
            <section
              aria-label="Constructor de Enlaces UTM para GA4"
              className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Enlaces UTM para Google Analytics 4 (GA4)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Copia los enlaces etiquetados por plataforma o construye una URL UTM personalizada en vivo.
                  </p>
                </div>
              </div>

              {/* Per-Platform Generated UTM Links */}
              <div className="space-y-2">
                {campaign.ga4_utm_links.map((item, idx) => (
                  <div
                    key={`${item.platform}-${idx}`}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#0b0e14] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-cyan-300 block">
                        {item.platform}
                      </span>
                      <code className="text-[11px] font-mono text-slate-300 break-all">
                        {item.utm_url || item.url || ""}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          `utm-${idx}`,
                          item.utm_url || item.url || "",
                          `UTM ${item.platform}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 transition"
                    >
                      {copiedKey === `utm-${idx}` ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copiar UTM
                    </button>
                  </div>
                ))}
              </div>

              {/* Interactive GA4 UTM Builder */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  Constructor Rápido UTM Personalizado (GA4)
                </h4>

                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <label className="text-[11px] text-slate-400">
                    utm_source
                    <input
                      type="text"
                      value={utmSource}
                      onChange={(e) => setUtmSource(e.target.value)}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    utm_medium
                    <input
                      type="text"
                      value={utmMedium}
                      onChange={(e) => setUtmMedium(e.target.value)}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    utm_campaign
                    <input
                      type="text"
                      value={utmCampaignName}
                      onChange={(e) => setUtmCampaignName(e.target.value)}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    utm_content
                    <input
                      type="text"
                      value={utmContent}
                      onChange={(e) => setUtmContent(e.target.value)}
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    utm_term (opcional)
                    <input
                      type="text"
                      value={utmTerm}
                      onChange={(e) => setUtmTerm(e.target.value)}
                      placeholder="keyword_exacta"
                      className="mt-1 w-full rounded bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/30 bg-[#0b0e14] px-3 py-2.5">
                  <code className="text-[11px] font-mono text-cyan-200 break-all flex-1">
                    {customGa4Url}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy("utm-custom", customGa4Url, "Enlace UTM GA4")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shrink-0 transition"
                  >
                    {copiedKey === "utm-custom" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copiar UTM GA4
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
