import { useEffect, useState } from "react";
import type { WhiteboardCursor } from "../../services/whiteboard-socket";

interface CollaboratorCursorProps {
  cursor: WhiteboardCursor;
  color: string;
  zoom: number;
  scrollX: number;
  scrollY: number;
}

export function collaboratorColor(userId: string): string {
  const palette = ["#e11d48", "#7c3aed", "#0369a1", "#047857", "#b45309", "#c026d3", "#0f766e", "#be123c"];
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function CollaboratorCursor({ cursor, color, zoom, scrollX, scrollY }: CollaboratorCursorProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [cursor.x, cursor.y, cursor.pressed]);

  const left = (cursor.x + scrollX) * zoom;
  const top = (cursor.y + scrollY) * zoom;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left,
        top,
        zIndex: 20,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transform: `translate(-2px, -2px) scale(${cursor.pressed ? 0.92 : 1})`,
        transformOrigin: "top left",
        transition: "left 120ms cubic-bezier(.22,1,.36,1), top 120ms cubic-bezier(.22,1,.36,1), opacity 180ms ease, transform 120ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
        <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 2.5L24.5 20.25L15.75 21.75L20.5 29.25L16.75 31.25L12 23.5L5.5 29L3 2.5Z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span style={{ background: color, color: "white", borderRadius: 999, padding: "3px 8px", fontSize: 11, lineHeight: "16px", fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }}>
          {cursor.displayName}
        </span>
      </div>
    </div>
  );
}
