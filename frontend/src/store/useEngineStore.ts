"use client";

import { create } from "zustand";
import type {
  AnalyticsOverview,
  AuditLogEntry,
  ContentProject,
  CreatorProfile,
  ProjectDetail,
} from "@/types/engine";

export type ActiveStudioTab =
  | "pipeline"
  | "script-studio"
  | "mobile-simulator"
  | "publishing-hitl"
  | "ads-studio"
  | "analytics-rmta"
  | "automations-n8n"
  | "connections-apis";

export type PublishingSubTab =
  | "planner"
  | "copy-native"
  | "autolists"
  | "kigalchat-dm"
  | "hitl-audit";

export type ConnectionsSubTab =
  | "llm-minipc"
  | "social-apis"
  | "visual-ai";

interface EngineState {
  activeTab: ActiveStudioTab;
  publishingSubTab: PublishingSubTab;
  connectionsSubTab: ConnectionsSubTab;
  isNavDrawerOpen: boolean;
  isCreationGuideOpen: boolean;
  backendOnline: boolean;
  projects: ContentProject[];
  selectedProjectId: string | null;
  selectedDetail: ProjectDetail | null;
  creatorProfile: CreatorProfile | null;
  auditLogs: AuditLogEntry[];
  analytics: AnalyticsOverview | null;
  liveEvents: Array<{ event: string; timestamp: string; summary: string }>;
  toastMessage: { type: "success" | "error" | "info"; text: string } | null;

  setActiveTab: (tab: ActiveStudioTab) => void;
  setPublishingSubTab: (tab: PublishingSubTab) => void;
  setConnectionsSubTab: (tab: ConnectionsSubTab) => void;
  setNavDrawerOpen: (open: boolean) => void;
  setCreationGuideOpen: (open: boolean) => void;
  navigateToTool: (
    tab: ActiveStudioTab,
    options?: {
      publishingSubTab?: PublishingSubTab;
      connectionsSubTab?: ConnectionsSubTab;
    }
  ) => void;
  setBackendOnline: (online: boolean) => void;
  setProjects: (projects: ContentProject[]) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedDetail: (detail: ProjectDetail | null) => void;
  setCreatorProfile: (profile: CreatorProfile) => void;
  setAuditLogs: (logs: AuditLogEntry[]) => void;
  setAnalytics: (analytics: AnalyticsOverview) => void;
  pushLiveEvent: (ev: { event: string; timestamp: string; summary: string }) => void;
  showToast: (type: "success" | "error" | "info", text: string) => void;
  clearToast: () => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  activeTab: "pipeline",
  publishingSubTab: "planner",
  connectionsSubTab: "llm-minipc",
  isNavDrawerOpen: false,
  isCreationGuideOpen: false,
  backendOnline: false,
  projects: [],
  selectedProjectId: null,
  selectedDetail: null,
  creatorProfile: null,
  auditLogs: [],
  analytics: null,
  liveEvents: [],
  toastMessage: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setPublishingSubTab: (publishingSubTab) => set({ publishingSubTab }),
  setConnectionsSubTab: (connectionsSubTab) => set({ connectionsSubTab }),
  setNavDrawerOpen: (isNavDrawerOpen) => set({ isNavDrawerOpen }),
  setCreationGuideOpen: (isCreationGuideOpen) => set({ isCreationGuideOpen }),
  navigateToTool: (tab, options) =>
    set((state) => ({
      activeTab: tab,
      publishingSubTab: options?.publishingSubTab ?? state.publishingSubTab,
      connectionsSubTab: options?.connectionsSubTab ?? state.connectionsSubTab,
      isNavDrawerOpen: false,
    })),
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
  showToast: (type, text) => set({ toastMessage: { type, text } }),
  clearToast: () => set({ toastMessage: null }),
}));
