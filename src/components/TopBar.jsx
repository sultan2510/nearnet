import React from "react";
import { LogOut, Copy } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";

export default function TopBar() {
  const { roomCode, peers, leaveRoom } = useApp();

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
      <button onClick={copyCode} className="flex items-center gap-2 bg-surface2 text-signal text-xs font-mono px-2.5 py-1.5 rounded-md tracking-widest">
        {roomCode}
        <Copy size={12} />
      </button>
      <span className="text-xs text-lo">{peers.length + 1} peers</span>
      <button onClick={leaveRoom} aria-label="Leave room" className="text-lo">
        <LogOut size={18} />
      </button>
    </div>
  );
}
