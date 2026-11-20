"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  Lightbulb,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import {
  AstryxBadge,
  AstryxBanner,
  AstryxButton,
} from "@/components/ui/AstryxPrimitives";
import { apiClient } from "@/lib/api";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { useEngineStore } from "@/store/useEngineStore";
import type {
  LinkedInAdLibraryItem,
  LinkedInAdLibrarySearchResponse,
  LinkedInAdLibraryStatusResponse,
} from "@/types/engine";

export interface LinkedInAdsLibraryExplorerProps {
  onUseAdAsReference?: (topic: string, advertiser: string) => void;
  onIdeaImported?: () => Promise<void> | void;
}

const COUNTRY_OPTIONS = [
  { code: "ES", label: "ES — España" },
  { code: "US", label: "US — Estados Unidos" },
  { code: "GB", label: "GB — Reino Unido" },
  { code: "FR", label: "FR — Francia" },
  { code: "DE", label: "DE — Alemania" },
  { code: "MX", label: "MX — México" },
  { code: "CO", label: "CO — Colombia" },
  { code: "AR", label: "AR — Argentina" },
] as const;

const QUICK_KEYWORD_PRESETS = [
  "automatización IA",
  "servicios B2B",
  "lead generation B2B",
  "software SaaS",
] as const;

const BODY_COLLAPSE_THRESHOLD = 260;

export function LinkedInAdsLibraryExplorer({
  onUseAdAsReference,
  onIdeaImported,
}: LinkedInAdsLibraryExplorerProps) {
  const showToast = useEngineStore((s) => s.showToast);

  const [apiStatus, setApiStatus] =
    useState<LinkedInAdLibraryStatusResponse | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("automatización IA");
  const [advertiser, setAdvertiser] = useState("");
  const [country, setCountry] = useState("ES");
  const [dateStart, setDateStart] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchResponse, setSearchResponse] =
    useState<LinkedInAdLibrarySearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [expandedAds, setExpandedAds] = useState<Record<string, boolean>>({});
  const [importingAdId, setImportingAdId] = useState<string | null>(null);
  const [importedAdCodes, setImportedAdCodes] = useState<Record<string, string>>(
    {}
  );
  const [copiedAdId, setCopiedAdId] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setCheckingStatus(true);
    setStatusError(null);
    try {
      const status = await apiClient.getLinkedInAdLibraryStatus();
      setApiStatus(status);
    } catch (err) {
      setApiStatus(null);
      setStatusError(
        err instanceof Error
          ? err.message
          : "No se pudo consultar el estado de LinkedIn Ad Library API."
      );
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKeyword = keyword.trim();
    const cleanAdvertiser = advertiser.trim();

    if (!cleanKeyword && !cleanAdvertiser) {
      showToast(
        "info",
        "Introduce una palabra clave o el nombre de un anunciante para buscar en LinkedIn Ads Library."
      );
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const res = await apiClient.searchLinkedInAdLibrary({
        keyword: cleanKeyword || undefined,
        advertiser: cleanAdvertiser || undefined,
        countries: country ? [country] : undefined,
        date_start: dateStart || undefined,
        count: 12,
      });
      setSearchResponse(res);
      if (res.live && res.items.length > 0) {
        showToast(
          "success",
          `${res.items.length} anuncios reales recuperados desde LinkedIn Ads Library.`
        );
      }
    } catch (err) {
      setSearchResponse(null);
      const msg =
        err instanceof Error
          ? err.message
          : "Error de red al consultar LinkedIn Ads Library API.";
      setSearchError(msg);
      showToast("error", msg);
    } finally {
      setSearching(false);
    }
  };

  const handleImportToIdea = async (item: LinkedInAdLibraryItem) => {
    setImportingAdId(item.ad_id);
    try {
      const res = await apiClient.importLinkedInAdToIdea({
        advertiser_name: item.advertiser_name,
        headline: item.headline ?? null,
        body_text: item.body_text,
        format: item.format,
        landing_page_url: item.landing_page_url ?? null,
      });
      setImportedAdCodes((prev) => ({
        ...prev,
        [item.ad_id]: res.asset_code,
      }));
      showToast(
        "success",
        `Anuncio importado al Tablero de Ideas como ${res.asset_code}: "${res.working_title}".`
      );
      await onIdeaImported?.();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo importar el anuncio al Tablero de Ideas.";
      showToast("error", msg);
    } finally {
      setImportingAdId(null);
    }
  };

  const handleUseInCampaign = (item: LinkedInAdLibraryItem) => {
    const firstLine =
      item.body_text
        .split(/\n+/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "";
    const rawTopic =
      item.headline?.trim() ||
      (firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine) ||
      `Estrategia B2B inspirada en ${item.advertiser_name}`;

    onUseAdAsReference?.(rawTopic, item.advertiser_name);
  };

  const handleCopyAd = async (item: LinkedInAdLibraryItem) => {
    const parts = [
      item.headline?.trim() ? `Titular: ${item.headline.trim()}` : null,
      item.body_text.trim(),
      item.description?.trim() ? `Descripción: ${item.description.trim()}` : null,
      item.landing_page_url?.trim()
        ? `Landing: ${item.landing_page_url.trim()}`
        : null,
    ].filter(Boolean);
    const ok = await copyPreservingLineBreaks(parts.join("\n\n"));
    if (ok) {
      setCopiedAdId(item.ad_id);
      showToast("success", `Copy del anuncio de ${item.advertiser_name} copiado.`);
      setTimeout(() => {
        setCopiedAdId((prev) => (prev === item.ad_id ? null : prev));
      }, 2200);
    } else {
      showToast("error", "No se pudo copiar el texto del anuncio.");
    }
  };

  const toggleExpandAd = (adId: string) => {
    setExpandedAds((prev) => ({ ...prev, [adId]: !prev[adId] }));
  };

  const renderStatusBanner = () => {
    const refreshAction = (
      <AstryxButton
        type="button"
        variant="ghost"
        size="sm"
        label={checkingStatus ? "Verificando..." : "Reverificar"}
        icon={<RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />}
        isDisabled={checkingStatus}
        onClick={() => void checkStatus()}
      />
    );

    if (checkingStatus && !apiStatus && !statusError) {
      return (
        <AstryxBanner
          status="info"
          title="Verificando acceso a LinkedIn Ad Library API..."
          description="Comprobando token OAuth, versión de API y permisos activos en el servidor."
          collapsible={false}
        />
      );
    }

    if (statusError) {
      return (
        <AstryxBanner
          status="warning"
          title="No se pudo verificar el estado de LinkedIn Ad Library API"
          description={`${statusError}. Comprueba que el backend esté en línea y configura tu token OAuth en Conexiones Oficiales (canal LinkedIn).`}
          collapsible={false}
          endContent={refreshAction}
        />
      );
    }

    if (!apiStatus) return null;

    if (apiStatus.live_verified) {
      const metaParts = [
        apiStatus.account_name ? `Cuenta: ${apiStatus.account_name}` : null,
        apiStatus.api_version_used
          ? `LinkedIn-Version: ${apiStatus.api_version_used}`
          : null,
        apiStatus.token_source ? `Origen: ${apiStatus.token_source}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <AstryxBanner
          status="success"
          title="LinkedIn Ad Library API verificada en vivo"
          description={`${apiStatus.message}${metaParts ? ` (${metaParts})` : ""}`}
          collapsible={false}
          endContent={refreshAction}
        />
      );
    }

    const isAuthError =
      apiStatus.status_code === 401 || apiStatus.status_code === 403;
    const warningTitle = isAuthError
      ? `LinkedIn Ad Library API devolvió HTTP ${apiStatus.status_code} (Producto no autorizado o token caducado)`
      : !apiStatus.configured
      ? "Token de LinkedIn no configurado para Ad Library API"
      : "LinkedIn Ad Library API requiere autorización adicional";

    const warningDescription = isAuthError
      ? `${apiStatus.message} El producto "LinkedIn Ad Library" en LinkedIn Developer Portal requiere generar un token OAuth con ese producto autorizado (o pegarlo en el campo dedicado de Conexiones Oficiales → LinkedIn).`
      : `${apiStatus.message} Para consultar anuncios reales en vivo, autoriza el producto LinkedIn Ad Library en tu app de LinkedIn Developers y pega el token OAuth en Conexiones Oficiales.`;

    return (
      <AstryxBanner
        status="warning"
        title={warningTitle}
        description={warningDescription}
        collapsible={false}
        endContent={refreshAction}
      />
    );
  };

  const hasLiveResults = Boolean(
    searchResponse && searchResponse.live && searchResponse.items.length > 0
  );

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Live API Verification Banner */}
      {renderStatusBanner()}

      {/* Search Form Card */}
      <form
        onSubmit={handleSearch}
        aria-label="Buscador de LinkedIn Ads Library"
        className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kc-border)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              Explorador Oficial de LinkedIn Ads Library
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Analiza anuncios B2B reales de competidores por palabra clave, empresa, país y fecha, e impórtalos como ideas o referencias de campaña.
            </p>
          </div>
          {apiStatus?.api_version_used && (
            <AstryxBadge
              label={`API v${apiStatus.api_version_used}`}
              variant="cyan"
            />
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label
              htmlFor="li-lib-keyword"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Palabra clave
            </label>
            <input
              id="li-lib-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Ej. automatización IA, servicios B2B"
              className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="li-lib-advertiser"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Anunciante / Empresa (opcional)
            </label>
            <input
              id="li-lib-advertiser"
              type="text"
              value={advertiser}
              onChange={(e) => setAdvertiser(e.target.value)}
              placeholder="Ej. HubSpot, Make, Salesforce"
              className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="li-lib-country"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              País
            </label>
            <select
              id="li-lib-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="li-lib-date-start"
              className="block text-xs font-semibold text-slate-200 mb-1"
            >
              Fecha inicio (opcional)
            </label>
            <input
              id="li-lib-date-start"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Búsquedas rápidas:</span>
            {QUICK_KEYWORD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setKeyword(preset)}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition ${
                  keyword === preset
                    ? "border-cyan-400 bg-cyan-500/15 text-cyan-200"
                    : "border-slate-800 bg-[#020306] text-slate-300 hover:border-slate-600"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <AstryxButton
            type="submit"
            variant="primary"
            label="Buscar en LinkedIn Ads Library"
            icon={<Search className="w-4 h-4" />}
            isLoading={searching}
          />
        </div>
      </form>

      {/* Diagnostic Banner when API returns error/non-live or network error (NO FAKE ADS) */}
      {(searchError || (searchResponse && !searchResponse.live)) && (
        <AstryxBanner
          status={
            searchResponse?.status_code === 401 ||
            searchResponse?.status_code === 403 ||
            searchResponse?.source === "not_configured"
              ? "warning"
              : "error"
          }
          title={
            searchResponse?.status_code === 401 || searchResponse?.status_code === 403
              ? `No autorizado en LinkedIn Ads Library (HTTP ${searchResponse.status_code})`
              : searchResponse?.source === "not_configured"
              ? "Falta token autorizado para LinkedIn Ads Library"
              : "Error al consultar LinkedIn Ads Library"
          }
          description={searchError || searchResponse?.message || "La API oficial no devolvió resultados en vivo."}
          collapsible={false}
        >
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
            <li>
              Verifica en LinkedIn Developer Portal que tu aplicación tenga habilitado el producto{" "}
              <strong className="text-white">LinkedIn Ad Library</strong>.
            </li>
            <li>
              Si tu token principal solo tiene permisos de publicación (<code className="font-mono text-cyan-300">w_member_social</code>), pega un token dedicado en{" "}
              <strong className="text-white">Conexiones Oficiales → LinkedIn → Token dedicado para LinkedIn Ads Library</strong>.
            </li>
            <li>
              Comprueba que la palabra clave, empresa o rango de fechas no restrinjan en exceso la consulta.
            </li>
          </ul>
        </AstryxBanner>
      )}

      {/* Empty live result */}
      {searchResponse && searchResponse.live && searchResponse.items.length === 0 && (
        <AstryxBanner
          status="info"
          title="Consulta verificada sin coincidencias"
          description={
            searchResponse.message ||
            "La API oficial de LinkedIn Ads Library respondió correctamente, pero no encontró anuncios activos con estos filtros. Prueba con una palabra clave más general o cambia el país."
          }
          collapsible={false}
        />
      )}

      {/* Insights Summary Bar */}
      {hasLiveResults && searchResponse && (
        <div className="rounded-xl border border-[var(--kc-border-specular)] bg-[#07090e] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              Insights competitivos detectados
            </h4>
            {searchResponse.api_version_used && (
              <span className="text-[11px] font-mono text-slate-400">
                LinkedIn-Version {searchResponse.api_version_used}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[var(--kc-surface)] p-3">
              <span className="text-[11px] text-slate-400 block">
                Total anuncios
              </span>
              <span className="text-lg font-black font-mono text-white mt-0.5 block">
                {searchResponse.total_returned ?? searchResponse.items.length}
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[var(--kc-surface)] p-3">
              <span className="text-[11px] text-slate-400 block">
                Longitud media copy
              </span>
              <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">
                {Math.round(searchResponse.insights?.avg_copy_chars ?? 0)} chars
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[var(--kc-surface)] p-3">
              <span className="text-[11px] text-slate-400 block mb-1">
                Formatos dominantes
              </span>
              <div className="flex flex-wrap gap-1">
                {searchResponse.insights?.top_formats?.length ? (
                  searchResponse.insights.top_formats.slice(0, 3).map((fmt) => (
                    <AstryxBadge
                      key={fmt.format}
                      label={`${fmt.format} (${fmt.count})`}
                      variant="blue"
                    />
                  ))
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[var(--kc-surface)] p-3">
              <span className="text-[11px] text-slate-400 block mb-1">
                Ángulos detectados
              </span>
              <div className="flex flex-wrap gap-1">
                {searchResponse.insights?.detected_angles?.length ? (
                  searchResponse.insights.detected_angles.slice(0, 4).map((angle) => (
                    <AstryxBadge key={angle} label={angle} variant="cyan" />
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Sin patrones dominantes</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ad Results Grid */}
      {hasLiveResults && searchResponse && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {searchResponse.items.map((item) => {
            const isExpanded = Boolean(expandedAds[item.ad_id]);
            const isLongCopy = item.body_text.length > BODY_COLLAPSE_THRESHOLD;
            const visibleCopy =
              isLongCopy && !isExpanded
                ? `${item.body_text.slice(0, BODY_COLLAPSE_THRESHOLD).trimEnd()}…`
                : item.body_text;
            const isActive = item.status?.toUpperCase() === "ACTIVE";
            const importedCode = importedAdCodes[item.ad_id];

            return (
              <article
                key={item.ad_id}
                className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg shadow-black/25"
              >
                <div className="space-y-3">
                  {/* Advertiser + Format & Status Badges */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Briefcase className="w-4 h-4 text-sky-400 shrink-0" />
                        {item.advertiser_url ? (
                          <a
                            href={item.advertiser_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-white hover:text-cyan-300 transition inline-flex items-center gap-1"
                          >
                            <span>{item.advertiser_name}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <h4 className="text-sm font-bold text-white">
                            {item.advertiser_name}
                          </h4>
                        )}
                      </div>
                      {item.payer_name && item.payer_name !== item.advertiser_name && (
                        <p className="text-[11px] text-slate-400">
                          Pagado por: {item.payer_name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <AstryxBadge label={item.format || "AD"} variant="cyan" />
                      <AstryxBadge
                        label={item.status || "DESCONOCIDO"}
                        variant={isActive ? "success" : "neutral"}
                      />
                      {importedCode && (
                        <AstryxBadge
                          label={`Idea ${importedCode}`}
                          variant="green"
                        />
                      )}
                    </div>
                  </div>

                  {/* Dates & Impressions Metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    {(item.first_shown_date || item.last_shown_date) && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-[#020306] px-2 py-0.5 font-mono">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        {item.first_shown_date || "?"} →{" "}
                        {item.last_shown_date || "Actualidad"}
                      </span>
                    )}
                    {item.impressions_range && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-300">
                        Impresiones: {item.impressions_range}
                      </span>
                    )}
                    {item.ad_url && (
                      <a
                        href={item.ad_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-300 hover:underline font-medium ml-auto"
                      >
                        Ver en Ad Library
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Countries & Targeting Pills */}
                  {(item.top_countries.length > 0 ||
                    item.targeting_included.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.top_countries.map((c) => (
                        <span
                          key={`${item.ad_id}-country-${c}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-[#07090e] px-2 py-0.5 text-[10px] font-mono text-slate-200"
                        >
                          <Globe className="w-2.5 h-2.5 text-cyan-400" />
                          {c}
                        </span>
                      ))}
                      {item.targeting_included.map((tgt) => (
                        <span
                          key={`${item.ad_id}-tgt-${tgt}`}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200"
                        >
                          <Target className="w-2.5 h-2.5 text-violet-300" />
                          {tgt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Headline & Body Copy */}
                  <div className="rounded-lg border border-slate-800 bg-[#020306] p-3.5 space-y-2">
                    {item.headline && (
                      <h5 className="text-xs sm:text-sm font-bold text-cyan-200">
                        {item.headline}
                      </h5>
                    )}
                    <p className="text-xs text-slate-100 whitespace-pre-line leading-relaxed">
                      {visibleCopy || "Sin texto principal disponible."}
                    </p>
                    {isLongCopy && (
                      <button
                        type="button"
                        onClick={() => toggleExpandAd(item.ad_id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Contraer copy
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Ver copy completo ({item.body_text.length} chars)
                          </>
                        )}
                      </button>
                    )}
                    {item.description && (
                      <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Landing Page URL */}
                  {item.landing_page_url && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0">Destino:</span>
                      <a
                        href={item.landing_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-300 hover:underline truncate font-mono inline-flex items-center gap-1"
                      >
                        <span className="truncate">{item.landing_page_url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-[var(--kc-border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AstryxButton
                      type="button"
                      variant="primary"
                      size="sm"
                      label="Importar a Tablero de Ideas"
                      icon={<Lightbulb className="w-3.5 h-3.5" />}
                      isLoading={importingAdId === item.ad_id}
                      onClick={() => void handleImportToIdea(item)}
                    />
                    <AstryxButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      label="Usar en Campaña B2B"
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      onClick={() => handleUseInCampaign(item)}
                    />
                  </div>

                  <AstryxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    label={copiedAdId === item.ad_id ? "Copiado" : "Copiar texto"}
                    icon={
                      copiedAdId === item.ad_id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                    onClick={() => void handleCopyAd(item)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
