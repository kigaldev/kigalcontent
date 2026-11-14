"use client";

import { create } from "zustand";
import type {
  AnalyticsOverview,
  AuditLogEntry,
  ContentProject,
  CreatorProfile,
  FSMState,
  ProjectDetail,
} from "@/types/engine";

export type ActiveStudioTab =
  | "pipeline"
  | "script-studio"
  | "mobile-simulator"
  | "publishing-hitl"
  | "analytics-rmta"
  | "social-credentials";

interface PendingHITLModal {
  open: boolean;
  projectId: string;
  assetCode: string;
  targetState: FSMState;
  tier: 2 | 3;
  action: string;
  description: string;
}

interface EngineState {
  activeTab: ActiveStudioTab;
  backendOnline: boolean;
  projects: ContentProject[];
  selectedProjectId: string | null;
  selectedDetail: ProjectDetail | null;
  creatorProfile: CreatorProfile | null;
  auditLogs: AuditLogEntry[];
  analytics: AnalyticsOverview | null;
  liveEvents: Array<{ event: string; timestamp: string; summary: string }>;
  hitlModal: PendingHITLModal | null;
  toastMessage: { type: "success" | "error" | "info"; text: string } | null;

  setActiveTab: (tab: ActiveStudioTab) => void;
  setBackendOnline: (online: boolean) => void;
  setProjects: (projects: ContentProject[]) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedDetail: (detail: ProjectDetail | null) => void;
  setCreatorProfile: (profile: CreatorProfile) => void;
  setAuditLogs: (logs: AuditLogEntry[]) => void;
  setAnalytics: (analytics: AnalyticsOverview) => void;
  pushLiveEvent: (ev: { event: string; timestamp: string; summary: string }) => void;
  openHitlModal: (modal: PendingHITLModal) => void;
  closeHitlModal: () => void;
  showToast: (type: "success" | "error" | "info", text: string) => void;
  clearToast: () => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  activeTab: "pipeline",
  backendOnline: false,
  projects: [],
  selectedProjectId: null,
  selectedDetail: null,
  creatorProfile: null,
  auditLogs: [],
  analytics: null,
  liveEvents: [],
  hitlModal: null,
  toastMessage: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setBackendOnline: (backendOnline) => set({ backendOnline }),
  setProjects: (projects) =>
    set((state) => ({
      projects,
      selectedProjectId:
        state.selectedProjectId && projects.some((p) => p.id === state.selectedProjectId)
          ? state.selectedProjectId
          : projects[0]?.id ?? null,
    })),
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  setSelectedDetail: (selectedDetail) => set({ selectedDetail }),
  setCreatorProfile: (creatorProfile) => set({ creatorProfile }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setAnalytics: (analytics) => set({ analytics }),
  pushLiveEvent: (ev) =>
    set((state) => ({
      liveEvents: [ev, ...state.liveEvents].slice(0, 15),
    })),
  openHitlModal: (hitlModal) => set({ hitlModal }),
  closeHitlModal: () => set({ hitlModal: null }),
  showToast: (type, text) => set({ toastMessage: { type, text } }),
  clearToast: () => set({ toastMessage: null }),
}));
