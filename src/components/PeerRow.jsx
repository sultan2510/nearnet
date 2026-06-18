import React from "react";
import { initialsFor } from "../lib/format.js";

export default function PeerRow({ peer, status, hops, onClick }) {
  const isDirect = status === "connected" && !hops;
  const dotColor = status === "connected" ? "bg-signal" : status === "connecting" ? "bg-amber" : "bg-lo";
  const sub =
    status === "connected"
      ? hops
        ? `mesh \u00b7 ${hops} hop${hops > 1 ? "s" : ""}`
        : "direct connection"
      : status === "connecting"
      ? "connecting\u2026"
      : "discovered";

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-surface text-left">
      <div className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-xs font-medium shrink-0">
        {initialsFor(peer.nickname)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{peer.nickname || "Unnamed device"}</div>
        <div className="text-xs text-lo">{sub}</div>
      </div>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
    </button>
  );
}
