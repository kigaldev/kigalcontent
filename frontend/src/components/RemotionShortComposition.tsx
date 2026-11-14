"use client";

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TwoColumnScriptBlock, WordTimestamp } from "@/types/engine";

export interface RemotionShortProps {
  title: string;
  blocks: TwoColumnScriptBlock[];
  words: WordTimestamp[];
  subtitleYPercent: number;
  platformOverlay: "TikTok" | "Instagram" | "YouTube";
  showSafeZones: boolean;
}

export const RemotionShortComposition: React.FC<RemotionShortProps> = ({
  title,
  blocks,
  words,
  subtitleYPercent,
  platformOverlay,
  showSafeZones,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const activeWordIdx = words.findIndex(
    (w) => currentMs >= w.start_ms && currentMs <= w.end_ms
  );
  const windowStart = Math.max(0, activeWordIdx === -1 ? 0 : Math.floor(activeWordIdx / 3) * 3);
  const visibleWords = words.slice(windowStart, windowStart + 3);

  const blockIndex = blocks.length
    ? Math.min(blocks.length - 1, Math.floor((frame / (fps * 3.5)) % blocks.length))
    : 0;
  const activeBlock = blocks[blockIndex];

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #164e63 0%, #0f172a 55%, #020617 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Dynamic Visual Cue Header */}
      <div
        style={{
          position: "absolute",
          top: "14%",
          left: "8%",
          right: "16%",
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          border: "2px solid rgba(34, 211, 238, 0.45)",
          borderRadius: 24,
          padding: "24px 28px",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#22d3ee",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {activeBlock?.section_label || "ESCENA PRINCIPAL 9:16"}
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>
          {activeBlock?.on_screen_text || title}
        </div>
        <div style={{ fontSize: 24, color: "#cbd5e1", marginTop: 10 }}>
          {activeBlock?.b_roll_cue || "Speaker + B-Roll dinámico"}
        </div>
      </div>

      {/* Center Speaker Framing Ring */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
          borderRadius: "9999px",
          border: "3px dashed rgba(148, 163, 184, 0.35)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 23, 42, 0.35)",
        }}
      >
        <span style={{ fontSize: 22, color: "#94a3b8", fontWeight: 600 }}>
          SPEAKER EYE-LINE
        </span>
        <span style={{ fontSize: 20, color: "#38bdf8", marginTop: 6 }}>
          1080 × 1920 · 30fps
        </span>
      </div>

      {/* Synchronized Word-by-Word Karaoke Subtitles */}
      <div
        style={{
          position: "absolute",
          top: `${subtitleYPercent}%`,
          left: "8%",
          right: "15%",
          transform: "translateY(-50%)",
          textAlign: "center",
          padding: "18px 20px",
          borderRadius: 20,
          backgroundColor: "rgba(2, 6, 23, 0.78)",
          border:
            subtitleYPercent < 25 || subtitleYPercent > 70
              ? "3px solid #f43f5e"
              : "2px solid rgba(52, 211, 153, 0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {(visibleWords.length > 0
            ? visibleWords
            : [
                { word: "SISTEMAS", start_ms: 0, end_ms: 999, confidence: 1 },
                { word: "QUE", start_ms: 0, end_ms: 999, confidence: 1 },
                { word: "ESCALAN", start_ms: 0, end_ms: 999, confidence: 1 },
              ]
          ).map((w, i) => {
            const isActive =
              currentMs >= w.start_ms && currentMs <= w.end_ms;
            return (
              <span
                key={`${w.word}-${i}`}
                style={{
                  fontSize: 58,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  color: isActive ? "#facc15" : "#ffffff",
                  textShadow: "0 4px 14px rgba(0,0,0,0.95)",
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* UI Safe Zone Guides (25% - 70%) */}
      {showSafeZones && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "25%",
              backgroundColor: "rgba(244, 63, 94, 0.16)",
              borderBottom: "2px dashed rgba(244, 63, 94, 0.8)",
              display: "flex",
              alignItems: "flex-end",
              padding: "12px 24px",
              fontSize: 22,
              fontWeight: 700,
              color: "#fda4af",
            }}
          >
            ZONA MUERTA SUPERIOR ({platformOverlay} Search / Header)
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              backgroundColor: "rgba(244, 63, 94, 0.18)",
              borderTop: "2px dashed rgba(244, 63, 94, 0.8)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fda4af", marginBottom: 12 }}>
              ZONA MUERTA INFERIOR ({platformOverlay} Caption &amp; Audio Bar)
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>
              @{platformOverlay === "TikTok" ? "davidsystems" : "david_solopreneur"}
            </div>
            <div style={{ fontSize: 22, color: "#e2e8f0", marginTop: 6 }}>
              {title.slice(0, 56)}... más
            </div>
          </div>

          {/* Right Engagement Rail */}
          <div
            style={{
              position: "absolute",
              right: 20,
              bottom: "18%",
              width: 110,
              height: 460,
              borderRadius: 24,
              backgroundColor: "rgba(244, 63, 94, 0.22)",
              border: "2px dashed rgba(244, 63, 94, 0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-around",
              padding: "16px 0",
              fontSize: 22,
              fontWeight: 700,
              color: "#fecdd3",
            }}
          >
            <span>♥ 12K</span>
            <span>💬 480</span>
            <span>🔖 2.1K</span>
            <span>↗ 940</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
