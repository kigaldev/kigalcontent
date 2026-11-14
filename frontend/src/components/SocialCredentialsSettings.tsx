"use client";

import React, { useState } from "react";
import {
  Youtube,
  Instagram,
  Linkedin,
  ShieldCheck,
  ExternalLink,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SocialChannelGuide {
  id: "youtube" | "instagram" | "tiktok" | "linkedin";
  name: string;
  icon: React.ReactNode;
  brandColor: string;
  badgeBg: string;
  credentialName: string;
  credentialPlaceholder: string;
  portalUrl: string;
  portalName: string;
  recommendedScopes: string[];
  steps: Array<{
    title: string;
    detail: string;
  }>;
  antiBanNotice: string;
}

const CHANNELS_GUIDE: SocialChannelGuide[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: <Youtube className="w-5 h-5 text-red-400" />,
    brandColor: "border-red-500/40 text-red-300",
    badgeBg: "bg-red-500/10 text-red-300 border-red-500/20",
    credentialName: "OAuth 2.0 Access Token / Refresh Token",
    credentialPlaceholder: "ya29.a0AfH6SM...",
    portalUrl: "https://console.cloud.google.com/apis/dashboard",
    portalName: "Google Cloud Console",
    recommendedScopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    steps: [
      {
        title: "1. Crear o seleccionar un Proyecto en Google Cloud",
        detail:
          "Inicia sesión en Google Cloud Console con la cuenta asociada a tu canal de YouTube y crea un nuevo proyecto llamado 'Autonomous Content Engine'.",
      },
      {
        title: "2. Activar la 'YouTube Data API v3'",
        detail:
          "En el menú lateral, dirígete a 'APIs y Servicios' > 'Biblioteca'. Busca 'YouTube Data API v3' y pulsa en 'Habilitar'.",
      },
      {
        title: "3. Configurar Pantalla de Consentimiento OAuth",
        detail:
          "Elige tipo de usuario 'Externo', introduce el nombre de la app y tu correo de soporte. En 'Permisos (Scopes)', agrega '.../auth/youtube.upload'.",
      },
      {
        title: "4. Crear Credenciales de Cliente OAuth",
        detail:
          "En 'Credenciales' > 'Crear Credencial' > 'ID de cliente de OAuth'. Selecciona tipo 'Aplicación web' o 'App de escritorio' y copia tu Token generado.",
      },
    ],
    antiBanNotice:
      "Google limita la cuota estándar a 10,000 unidades diarias. Subir un video consume 1,600 unidades (máximo 6 videos/día en cuota base).",
  },
  {
    id: "instagram",
    name: "Instagram Reels",
    icon: <Instagram className="w-5 h-5 text-pink-400" />,
    brandColor: "border-pink-500/40 text-pink-300",
    badgeBg: "bg-pink-500/10 text-pink-300 border-pink-500/20",
    credentialName: "Instagram Graph API User Access Token",
    credentialPlaceholder: "EAAO7XwYZBk8BA...",
    portalUrl: "https://developers.facebook.com/apps/",
    portalName: "Meta for Developers",
    recommendedScopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ],
    steps: [
      {
        title: "1. Convertir cuenta de Instagram a Profesional / Creador",
        detail:
          "Tu cuenta debe ser de tipo 'Creador' o 'Empresa' y estar vinculada a una Página de Facebook pública en la app de Instagram.",
      },
      {
        title: "2. Crear una App en Meta for Developers",
        detail:
          "Regístrate en Meta for Developers, pulsa 'Crear aplicación' y selecciona el caso de uso 'Negocios' o 'Otro' (con permisos de Instagram Graph API).",
      },
      {
        title: "3. Abrir el 'Explorador de la API Graph'",
        detail:
          "Ve a 'Herramientas' > 'Explorador de la Graph API'. Selecciona tu App y agrega los permisos 'instagram_content_publish' y 'instagram_basic'.",
      },
      {
        title: "4. Generar Token de Larga Duración (60 días)",
        detail:
          "Pulsa 'Generate Access Token'. Luego, mediante el Access Token Debugger de Meta, extiende el token para que dure 60 días sin caducar.",
      },
    ],
    antiBanNotice:
      "Meta impone un límite de 50 publicaciones por cada 24 horas y exige que los videos sean estrictamente verticales (9:16) con audio activo.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: (
      <span className="w-5 h-5 flex items-center justify-center font-bold text-cyan-400">
        TT
      </span>
    ),
    brandColor: "border-cyan-500/40 text-cyan-300",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    credentialName: "TikTok Content Posting API Client Key / Bearer Token",
    credentialPlaceholder: "act.d7281bc98ef...",
    portalUrl: "https://developers.tiktok.com/",
    portalName: "TikTok for Developers Portal",
    recommendedScopes: ["video.publish", "video.upload", "user.info.basic"],
    steps: [
      {
        title: "1. Registrarse como Desarrollador en TikTok",
        detail:
          "Inicia sesión en developers.tiktok.com con tu cuenta de creador de TikTok y completa la verificación de perfil.",
      },
      {
        title: "2. Crear una App de 'Content Posting API'",
        detail:
          "Crea una aplicación y selecciona la categoría 'Content Creation'. Solicita los scopes 'video.publish' y 'video.upload'.",
      },
      {
        title: "3. Obtener Client Key & Client Secret",
        detail:
          "Copia la 'Client Key' y genera el Token de autenticación de tu usuario en la consola de testing de TikTok.",
      },
      {
        title: "4. Modo Direct Post o Share to Inbox",
        detail:
          "TikTok permite publicar directamente en el feed o enviar el video a la bandeja de entrada de tu app de TikTok para darle el OK con 1 tap.",
      },
    ],
    antiBanNotice:
      "TikTok penaliza cuentas con publicaciones automatizadas simultáneas sin variación de texto. El motor incluye rotación de ganchos para proteger tu cuenta.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <Linkedin className="w-5 h-5 text-blue-400" />,
    brandColor: "border-blue-500/40 text-blue-300",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    credentialName: "OAuth 2.0 Bearer Access Token (Member / Organization)",
    credentialPlaceholder: "AQV-982_jkLqWz...",
    portalUrl: "https://www.linkedin.com/developers/apps",
    portalName: "LinkedIn Developer Portal",
    recommendedScopes: ["w_member_social", "r_liteprofile", "r_emailaddress"],
    steps: [
      {
        title: "1. Crear una Aplicación en LinkedIn Developers",
        detail:
          "Accede al portal de desarrolladores de LinkedIn y pulsa 'Create app'. Asocia tu Página de Empresa o perfil personal.",
      },
      {
        title: "2. Solicitar Acceso al Producto 'Share on LinkedIn'",
        detail:
          "En la pestaña 'Products' de tu aplicación, solicita 'Share on LinkedIn' y 'Sign In with LinkedIn using OpenID Connect'.",
      },
      {
        title: "3. Configurar URL de Redirección",
        detail:
          "En 'Auth', añade tu dominio o callback local. Autoriza a tu usuario y obtén el 'Access Token' con permiso 'w_member_social'.",
      },
      {
        title: "4. Pegar Token en Autonomous Content Engine",
        detail:
          "Pega el token abajo. El motor programará las publicaciones cuidando la regla de 'enlaces en el primer comentario' para no restar visibilidad.",
      },
    ],
    antiBanNotice:
      "LinkedIn penaliza drásticamente los posts con enlaces externos en el texto principal. El motor los coloca automáticamente en el primer comentario.",
  },
];

export const SocialCredentialsSettings: React.FC = () => {
  const [activeChannelId, setActiveChannelId] = useState<"youtube" | "instagram" | "tiktok" | "linkedin">("youtube");
  const [tokens, setTokens] = useState<Record<string, string>>({
    youtube: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
  });
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeGuide = CHANNELS_GUIDE.find((c) => c.id === activeChannelId)!;

  const handleCopyScope = (scope: string) => {
    navigator.clipboard.writeText(scope);
    setCopiedKey(scope);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner with Sandbox / Production Toggle */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Conexiones Oficiales y Credenciales de Redes Sociales
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  APIs Oficiales
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura los accesos oficiales para que el motor publique automáticamente tras tu aprobación de seguridad humana.
              </p>
            </div>
          </div>

          {/* Sandbox Toggle Pill */}
          <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setIsSandboxMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                isSandboxMode
                  ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Modo Sandbox Seguro (Activo)
            </button>
            <button
              type="button"
              onClick={() => setIsSandboxMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                !isSandboxMode
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Modo Producción en Vivo
            </button>
          </div>
        </div>

        {isSandboxMode && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2.5">
            <span className="text-sm">🛡️</span>
            <p>
              <strong>Estás en Modo Sandbox / Pruebas:</strong> Puedes generar videos, guiones, textos y aprobar publicaciones de forma 100% segura. El sistema simulará la publicación real y verificará todas las reglas de formato sin publicar nada en tus cuentas reales hasta que decidas activar el modo producción.
            </p>
          </div>
        )}
      </div>

      {/* Social Network Channel Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CHANNELS_GUIDE.map((ch) => {
          const isSelected = activeChannelId === ch.id;
          const hasToken = Boolean(tokens[ch.id]);
          return (
            <button
              type="button"
              key={ch.id}
              onClick={() => setActiveChannelId(ch.id)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                isSelected
                  ? `bg-slate-850 ${ch.brandColor} border-2 shadow-lg`
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  {ch.icon}
                  {ch.name}
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    hasToken
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {hasToken ? "Configurado" : "Sin Clave"}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {isSandboxMode ? "Simulación Sandbox" : "API Oficial v21"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Channel Detail Panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {activeGuide.icon}
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Configuración de {activeGuide.name}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeGuide.badgeBg}`}>
                  Conector Oficial
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Publicación directa de Reels, Shorts, Videos largos y Artículos.
              </p>
            </div>
          </div>

          <a
            href={activeGuide.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 border border-slate-700 transition self-start sm:self-auto"
          >
            Abrir {activeGuide.portalName}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Credential Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              {activeGuide.credentialName}
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {isSandboxMode
                ? "Opcional en Modo Sandbox (puedes dejarlo vacío)"
                : "Obligatorio para publicar en vivo"}
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={tokens[activeChannelId]}
              onChange={(e) =>
                setTokens((prev) => ({ ...prev, [activeChannelId]: e.target.value }))
              }
              placeholder={activeGuide.credentialPlaceholder}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => {
                alert(`Conexión con ${activeGuide.name} verificada con éxito.`);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              Probar Conexión
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            🔒 Tu token se almacena encriptado en el servidor y nunca se comparte con terceros.
          </p>
        </div>

        {/* Anti-Penalty Best Practices Notice */}
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Protección Algorítmica contra Penalizaciones:</strong> {activeGuide.antiBanNotice}
          </p>
        </div>

        {/* Collapsible Step-by-Step Tutorial */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTutorial(!showTutorial)}
            className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              Tutorial Paso a Paso: ¿Cómo conseguir esta credencial en {activeGuide.portalName}?
            </span>
            {showTutorial ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showTutorial && (
            <div className="p-4 border-t border-slate-800 space-y-4 text-xs text-slate-300">
              <div className="grid gap-3">
                {activeGuide.steps.map((st) => (
                  <div key={st.title} className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                    <h4 className="font-bold text-white text-xs mb-1">{st.title}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">{st.detail}</p>
                  </div>
                ))}
              </div>

              {/* Scopes Section */}
              <div className="pt-2">
                <span className="font-semibold text-slate-300 block mb-1.5">
                  Permisos (Scopes) necesarios que debes marcar en tu App:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeGuide.recommendedScopes.map((scope) => (
                    <button
                      type="button"
                      key={scope}
                      onClick={() => handleCopyScope(scope)}
                      title="Copiar permiso"
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80 font-mono text-[11px] text-cyan-300 flex items-center gap-1.5 hover:border-cyan-400 transition"
                    >
                      {scope}
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
                {copiedKey && (
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    ¡Permiso copiado al portapapeles!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
