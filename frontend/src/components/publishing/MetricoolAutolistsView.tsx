"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  FolderInput,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  COMMON_TIMEZONES,
  TIMEZONE_LABELS,
  WEEKDAY_SHORT_ES,
} from "@/lib/scheduling";
import { useEngineStore } from "@/store/useEngineStore";
import { RichTextToolbar } from "@/components/RichTextToolbar";
import {
  AstryxBadge,
  AstryxBanner,
  AstryxButton,
  AstryxCard,
  AstryxSwitch,
} from "@/components/ui/AstryxPrimitives";
import type {
  AutolistItemRecord,
  AutolistRecord,
  SocialChannel,
} from "@/types/engine";

export interface MetricoolAutolistsViewProps {
  onAutolistChanged?: () => void;
}

const ALL_CHANNELS: SocialChannel[] = [
  "LinkedIn",
  "Instagram",
  "TikTok",
  "YouTube",
];

export function MetricoolAutolistsView({
  onAutolistChanged,
}: MetricoolAutolistsViewProps) {
  const { backendOnline, selectedDetail, showToast } = useEngineStore();

  const [autolists, setAutolists] = useState<AutolistRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create Autolist form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newChannels, setNewChannels] = useState<SocialChannel[]>(["LinkedIn"]);
  const [newTimezone, setNewTimezone] = useState<string>("Europe/Madrid");
  const [slotDay, setSlotDay] = useState<number>(1); // Martes default
  const [slotTime, setSlotTime] = useState<string>("09:00");
  const [newSlots, setNewSlots] = useState<
    Array<{ day_of_week: number; time: string }>
  >([
    { day_of_week: 1, time: "09:00" },
    { day_of_week: 3, time: "13:00" },
  ]);
  const [creatingList, setCreatingList] = useState(false);

  // Add item form state
  const [itemTitle, setItemTitle] = useState("");
  const [itemBody, setItemBody] = useState("");
  const [itemFirstComment, setItemFirstComment] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [importingProject, setImportingProject] = useState(false);
  const itemBodyRef = useRef<HTMLTextAreaElement>(null);

  const loadAutolists = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiClient.listAutolists();
      setAutolists(list);
      setSelectedId((cur) =>
        cur && list.some((a) => a.id === cur) ? cur : list[0]?.id ?? null
      );
    } catch {
      // Keep local state cleanly in offline mode
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAutolists();
  }, [loadAutolists, backendOnline]);

  const selectedAutolist = useMemo(
    () => autolists.find((a) => a.id === selectedId) ?? autolists[0] ?? null,
    [autolists, selectedId]
  );

  const toggleNewChannel = (ch: SocialChannel) => {
    setNewChannels((prev) =>
      prev.includes(ch)
        ? prev.length > 1
          ? prev.filter((c) => c !== ch)
          : prev
        : [...prev, ch]
    );
  };

  const handleAddSlot = () => {
    const exists = newSlots.some(
      (s) => s.day_of_week === slotDay && s.time === slotTime
    );
    if (exists) return;
    setNewSlots((prev) =>
      [...prev, { day_of_week: slotDay, time: slotTime }].sort((a, b) =>
        a.day_of_week !== b.day_of_week
          ? a.day_of_week - b.day_of_week
          : a.time.localeCompare(b.time)
      )
    );
  };

  const handleRemoveSlot = (idx: number) => {
    setNewSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateAutolist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast("error", "Escribe un nombre para la Autolista.");
      return;
    }
    if (newSlots.length === 0) {
      showToast("error", "Añade al menos una franja semanal.");
      return;
    }

    setCreatingList(true);
    try {
      if (backendOnline) {
        const created = await apiClient.createAutolist({
          name: newName.trim(),
          description: newDesc.trim(),
          channels: newChannels,
          schedule_slots: newSlots,
          timezone: newTimezone,
          is_active: true,
          repeat_loop: true,
        });
        setAutolists((prev) => [created, ...prev]);
        setSelectedId(created.id);
      } else {
        const localCreated: AutolistRecord = {
          id: `local-al-${Date.now()}`,
          name: newName.trim(),
          description: newDesc.trim(),
          channels: newChannels,
          schedule_slots: newSlots,
          timezone: newTimezone,
          is_active: true,
          repeat_loop: true,
          items: [],
          created_at: new Date().toISOString(),
        };
        setAutolists((prev) => [localCreated, ...prev]);
        setSelectedId(localCreated.id);
      }
      setNewName("");
      setNewDesc("");
      onAutolistChanged?.();
      showToast("success", "♻️ Autolista Evergreen creada.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "No se pudo crear la Autolista."
      );
    } finally {
      setCreatingList(false);
    }
  };

  const handleToggleActive = async (al: AutolistRecord, nextActive: boolean) => {
    setAutolists((prev) =>
      prev.map((a) => (a.id === al.id ? { ...a, is_active: nextActive } : a))
    );
    try {
      if (backendOnline) {
        await apiClient.updateAutolist(al.id, { is_active: nextActive });
      }
      onAutolistChanged?.();
      showToast(
        "info",
        `Autolista "${al.name}" ${nextActive ? "activada" : "pausada"}.`
      );
    } catch (err) {
      setAutolists((prev) =>
        prev.map((a) => (a.id === al.id ? { ...a, is_active: !nextActive } : a))
      );
      showToast(
        "error",
        err instanceof Error ? err.message : "Error actualizando Autolista."
      );
    }
  };

  const handleToggleRepeatLoop = async (
    al: AutolistRecord,
    nextRepeat: boolean
  ) => {
    setAutolists((prev) =>
      prev.map((a) => (a.id === al.id ? { ...a, repeat_loop: nextRepeat } : a))
    );
    try {
      if (backendOnline) {
        await apiClient.updateAutolist(al.id, { repeat_loop: nextRepeat });
      }
      onAutolistChanged?.();
    } catch (err) {
      setAutolists((prev) =>
        prev.map((a) =>
          a.id === al.id ? { ...a, repeat_loop: !nextRepeat } : a
        )
      );
      showToast(
        "error",
        err instanceof Error ? err.message : "Error actualizando modo bucle."
      );
    }
  };

  const handleDeleteAutolist = async (al: AutolistRecord) => {
    const prevList = autolists;
    const remaining = autolists.filter((a) => a.id !== al.id);
    setAutolists(remaining);
    if (selectedId === al.id) {
      setSelectedId(remaining[0]?.id ?? null);
    }
    try {
      if (backendOnline) {
        await apiClient.deleteAutolist(al.id);
      }
      onAutolistChanged?.();
      showToast("success", `Autolista "${al.name}" eliminada.`);
    } catch (err) {
      setAutolists(prevList);
      showToast(
        "error",
        err instanceof Error ? err.message : "Error eliminando Autolista."
      );
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAutolist) return;
    if (!itemBody.trim()) {
      showToast("error", "Escribe el texto de la publicación evergreen.");
      return;
    }

    setAddingItem(true);
    try {
      let createdItem: AutolistItemRecord;
      if (backendOnline) {
        createdItem = await apiClient.addAutolistItem(selectedAutolist.id, {
          title: itemTitle.trim() || null,
          post_body: itemBody.trim(),
          first_comment: itemFirstComment.trim() || null,
        });
      } else {
        createdItem = {
          id: `local-item-${Date.now()}`,
          autolist_id: selectedAutolist.id,
          title: itemTitle.trim() || null,
          post_body: itemBody.trim(),
          first_comment: itemFirstComment.trim() || null,
          position: selectedAutolist.items.length,
          times_published: 0,
        };
      }

      setAutolists((prev) =>
        prev.map((a) =>
          a.id === selectedAutolist.id
            ? { ...a, items: [...a.items, createdItem] }
            : a
        )
      );
      setItemTitle("");
      setItemBody("");
      setItemFirstComment("");
      onAutolistChanged?.();
      showToast("success", "Elemento añadido a la cola evergreen.");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error añadiendo elemento."
      );
    } finally {
      setAddingItem(false);
    }
  };

  const handleImportActiveProject = async () => {
    if (!selectedAutolist || !selectedDetail?.project) return;
    setImportingProject(true);
    try {
      const preferredPost =
        selectedDetail.social_posts.find((p) =>
          selectedAutolist.channels.includes(p.channel)
        ) ??
        selectedDetail.social_posts.find((p) => p.channel === "LinkedIn") ??
        selectedDetail.social_posts[0];

      const importedTitle =
        preferredPost?.title?.trim() || selectedDetail.project.working_title;
      const scriptFallbackBody =
        selectedDetail.script?.two_column_blocks
          ?.map((b) => b.audio_voiceover)
          .filter(Boolean)
          .join("\n\n") ||
        selectedDetail.project.context_notes ||
        `Claves prácticas sobre ${selectedDetail.project.working_title}`;
      const importedBody = preferredPost?.post_body?.trim() || scriptFallbackBody;
      const importedComment = preferredPost?.first_comment?.trim() || null;

      let createdItem: AutolistItemRecord;
      if (backendOnline) {
        createdItem = await apiClient.addAutolistItem(selectedAutolist.id, {
          project_id: selectedDetail.project.id,
          title: importedTitle,
          post_body: importedBody,
          first_comment: importedComment,
        });
      } else {
        createdItem = {
          id: `local-imp-${Date.now()}`,
          autolist_id: selectedAutolist.id,
          project_id: selectedDetail.project.id,
          title: importedTitle,
          post_body: importedBody,
          first_comment: importedComment,
          position: selectedAutolist.items.length,
          times_published: 0,
        };
      }

      setAutolists((prev) =>
        prev.map((a) =>
          a.id === selectedAutolist.id
            ? { ...a, items: [...a.items, createdItem] }
            : a
        )
      );
      onAutolistChanged?.();
      showToast(
        "success",
        `Proyecto ${selectedDetail.project.asset_code} importado a "${selectedAutolist.name}".`
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error importando proyecto."
      );
    } finally {
      setImportingProject(false);
    }
  };

  const handleMoveItem = (itemIdx: number, direction: -1 | 1) => {
    if (!selectedAutolist) return;
    const targetIdx = itemIdx + direction;
    if (targetIdx < 0 || targetIdx >= selectedAutolist.items.length) return;

    setAutolists((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAutolist.id) return a;
        const copy = [...a.items];
        const [moved] = copy.splice(itemIdx, 1);
        copy.splice(targetIdx, 0, moved);
        return {
          ...a,
          items: copy.map((it, idx) => ({ ...it, position: idx })),
        };
      })
    );
  };

  const handleDeleteItem = async (item: AutolistItemRecord) => {
    if (!selectedAutolist) return;
    const prevList = autolists;
    setAutolists((prev) =>
      prev.map((a) =>
        a.id === selectedAutolist.id
          ? { ...a, items: a.items.filter((it) => it.id !== item.id) }
          : a
      )
    );
    try {
      if (backendOnline) {
        await apiClient.deleteAutolistItem(selectedAutolist.id, item.id);
      }
      onAutolistChanged?.();
      showToast("success", "Elemento eliminado de la Autolista.");
    } catch (err) {
      setAutolists(prevList);
      showToast(
        "error",
        err instanceof Error ? err.message : "Error eliminando elemento."
      );
    }
  };

  return (
    <div className="space-y-5">
      <AstryxBanner
        status="info"
        title="Autolistas Evergreen Cíclicas"
        description="Crea colas temáticas con franjas horarias fijas. El planificador proyecta automáticamente tus publicaciones evergreen en los huecos libres y las recicla cuando el Modo Bucle está activo."
        collapsible={false}
      />

      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: Existing Autolists + Create Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="nle-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Repeat className="h-4 w-4 text-violet-400" />
                Tus Autolistas ({autolists.length})
              </h3>
              {loading && (
                <span className="text-[11px] text-slate-400">Cargando...</span>
              )}
            </div>

            {autolists.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--kc-border)] p-5 text-center text-xs text-slate-400">
                Aún no tienes Autolistas creadas. Usa el formulario inferior para crear tu primera cola evergreen.
              </div>
            ) : (
              <div className="space-y-3">
                {autolists.map((al) => {
                  const isSelected = selectedAutolist?.id === al.id;
                  return (
                    <AstryxCard
                      key={al.id}
                      variant={isSelected ? "cyan" : "default"}
                      elevation="low"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedId(al.id)}
                            className="text-left min-w-0 flex-1 focus:outline-none"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white truncate">
                                {al.name}
                              </span>
                              <AstryxBadge
                                label={`${al.items.length} posts`}
                                variant="neutral"
                              />
                            </div>
                            {al.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                                {al.description}
                              </p>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteAutolist(al)}
                            aria-label={`Eliminar Autolista ${al.name}`}
                            className="rounded p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Channels & Weekly Slots */}
                        <div className="flex flex-wrap gap-1.5">
                          {al.channels.map((ch) => (
                            <AstryxBadge key={ch} label={ch} variant="info" />
                          ))}
                          {al.repeat_loop && (
                            <AstryxBadge label="♻️ Bucle" variant="purple" />
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {al.schedule_slots.map((slot, idx) => (
                            <span
                              key={`${slot.day_of_week}-${slot.time}-${idx}`}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2 py-0.5 font-mono text-[10px] text-slate-300"
                            >
                              <Clock className="h-2.5 w-2.5 text-cyan-400" />
                              {WEEKDAY_SHORT_ES[slot.day_of_week] ?? "Lun"}{" "}
                              {slot.time}
                            </span>
                          ))}
                        </div>

                        {/* Switches */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kc-border)] pt-2.5">
                          <AstryxSwitch
                            label="Activa"
                            value={al.is_active}
                            onChange={(val) => void handleToggleActive(al, val)}
                            size="sm"
                          />
                          <AstryxSwitch
                            label="Modo Bucle"
                            value={al.repeat_loop}
                            onChange={(val) =>
                              void handleToggleRepeatLoop(al, val)
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    </AstryxCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create New Autolist Card */}
          <AstryxCard variant="muted" elevation="none">
            <form onSubmit={handleCreateAutolist} className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-cyan-400" />
                Nueva Autolista
              </h4>

              <label className="block text-xs text-slate-300 space-y-1">
                <span>Nombre de la cola</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Casos de Éxito B2B Evergreen"
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  required
                />
              </label>

              <label className="block text-xs text-slate-300 space-y-1">
                <span>Descripción (opcional)</span>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Contenido atemporal para rellenar huecos semanales"
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-xs text-slate-300 block">
                  Canales objetivo
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CHANNELS.map((ch) => {
                    const active = newChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleNewChannel(ch)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                          active
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                            : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-400"
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Day/Time Slot Builder */}
              <div className="space-y-2">
                <span className="text-xs text-slate-300 block">
                  Franjas semanales de publicación
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Día de la semana"
                    value={slotDay}
                    onChange={(e) => setSlotDay(Number(e.target.value))}
                    className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-white"
                  >
                    {WEEKDAY_SHORT_ES.map((lbl, idx) => (
                      <option key={lbl} value={idx}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label="Hora de la franja"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-white"
                  />
                  <AstryxButton
                    variant="secondary"
                    size="sm"
                    label="Añadir Franja"
                    onClick={handleAddSlot}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {newSlots.map((s, idx) => (
                    <span
                      key={`${s.day_of_week}-${s.time}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-mono text-cyan-200"
                    >
                      {WEEKDAY_SHORT_ES[s.day_of_week]} {s.time}
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(idx)}
                        aria-label="Quitar franja"
                        className="hover:text-rose-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <label className="block text-xs text-slate-300 space-y-1">
                <span>Zona horaria</span>
                <select
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {TIMEZONE_LABELS[tz] ?? tz}
                    </option>
                  ))}
                </select>
              </label>

              <AstryxButton
                type="submit"
                variant="primary"
                size="md"
                width="100%"
                isLoading={creatingList}
                label="Crear Autolista"
              />
            </form>
          </AstryxCard>
        </div>

        {/* RIGHT COLUMN: Selected Autolist Queue + Add Evergreen Post + 1-Click Import */}
        <div className="lg:col-span-7 space-y-4">
          {!selectedAutolist ? (
            <div className="nle-panel p-10 text-center space-y-2 text-slate-400">
              <Repeat className="h-8 w-8 mx-auto text-violet-400/70" />
              <p className="text-sm font-semibold text-slate-200">
                Selecciona o crea una Autolista para gestionar su cola
              </p>
              <p className="text-xs">
                Podrás añadir publicaciones desde cero o importar tu proyecto activo en 1 clic.
              </p>
            </div>
          ) : (
            <>
              {/* Queue Header + 1-Click Import Active Project */}
              <div className="nle-panel p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedAutolist.name}
                    </h3>
                    <AstryxBadge
                      label={selectedAutolist.is_active ? "Activa" : "Pausada"}
                      variant={selectedAutolist.is_active ? "success" : "neutral"}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedAutolist.items.length} elementos en cola ·{" "}
                    {selectedAutolist.repeat_loop
                      ? "Ciclo infinito activado"
                      : "Una pasada"}
                  </p>
                </div>

                <AstryxButton
                  variant="secondary"
                  size="md"
                  icon={<FolderInput className="h-4 w-4 text-cyan-400" />}
                  isDisabled={!selectedDetail?.project}
                  isLoading={importingProject}
                  label={
                    selectedDetail?.project
                      ? `Importar Proyecto Activo (${selectedDetail.project.asset_code})`
                      : "Importar Proyecto Activo (Selecciona en Paso 1)"
                  }
                  onClick={handleImportActiveProject}
                />
              </div>

              {/* Queue Items */}
              <div className="nle-panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cola de Publicaciones Evergreen
                </h4>

                {selectedAutolist.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--kc-border)] p-6 text-center text-xs text-slate-400">
                    Esta Autolista aún está vacía. Añade un post evergreen abajo o importa el proyecto activo.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedAutolist.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--kc-border)] bg-[var(--kc-canvas)]/80 p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-violet-500/20 border border-violet-500/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-200">
                              #{idx + 1}
                            </span>
                            {item.title && (
                              <span className="text-xs font-bold text-white truncate">
                                {item.title}
                              </span>
                            )}
                            <AstryxBadge
                              label={`Publicado ${item.times_published}×`}
                              variant="neutral"
                            />
                          </div>

                          <p className="text-xs text-slate-300 whitespace-pre-line line-clamp-3">
                            {item.post_body}
                          </p>

                          {item.first_comment && (
                            <p className="text-[11px] text-emerald-300/90">
                              💬 1er comentario: {item.first_comment}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(idx, -1)}
                            disabled={idx === 0}
                            aria-label={`Subir elemento ${idx + 1}`}
                            className="rounded border border-slate-700 bg-slate-900 p-1 text-slate-300 hover:border-cyan-400 disabled:opacity-35 transition"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(idx, 1)}
                            disabled={idx === selectedAutolist.items.length - 1}
                            aria-label={`Bajar elemento ${idx + 1}`}
                            className="rounded border border-slate-700 bg-slate-900 p-1 text-slate-300 hover:border-cyan-400 disabled:opacity-35 transition"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item)}
                            aria-label={`Eliminar elemento ${idx + 1}`}
                            className="rounded border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:border-rose-500/50 hover:text-rose-300 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Evergreen Post Form */}
              <form
                onSubmit={handleAddItem}
                className="nle-panel p-4 space-y-3"
              >
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  Añadir Publicación Evergreen a &ldquo;{selectedAutolist.name}&rdquo;
                </h4>

                <label className="block text-xs text-slate-300 space-y-1">
                  <span>Título / Gancho (opcional)</span>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="Ej. Checklist de arquitectura para agentes B2B"
                    className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-300 block">
                    Texto de la publicación
                  </span>
                  <RichTextToolbar
                    value={itemBody}
                    onChange={setItemBody}
                    inputRef={itemBodyRef}
                  />
                  <textarea
                    ref={itemBodyRef}
                    rows={5}
                    value={itemBody}
                    onChange={(e) => setItemBody(e.target.value)}
                    placeholder="Redacta el contenido evergreen que rotará automáticamente en las franjas de esta autolista..."
                    className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <label className="block text-xs text-slate-300 space-y-1">
                  <span>Primer Comentario Automático (opcional, para enlaces)</span>
                  <input
                    type="text"
                    value={itemFirstComment}
                    onChange={(e) => setItemFirstComment(e.target.value)}
                    placeholder="Ej. Accede al recurso aquí: https://..."
                    className="w-full rounded-lg border border-emerald-500/30 bg-[var(--kc-canvas)] px-3 py-1.5 text-xs text-emerald-100 focus:outline-none focus:border-emerald-400"
                  />
                </label>

                <div className="flex justify-end">
                  <AstryxButton
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={addingItem}
                    label="Añadir a esta Autolista"
                  />
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
