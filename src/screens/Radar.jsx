import React, { useMemo } from "react";
import { useApp } from "../context/AppContext.jsx";
import PeerRow from "../components/PeerRow.jsx";
import { formatTimeLeft } from "../lib/format.js";

const RINGS = [62, 118, 150];

function hashAngle(peerId) {
  let h = 0;
  for (let i = 0; i < peerId.length; i++) h = (h * 31 + peerId.charCodeAt(i)) % 360;
  return h;
}

export default function Radar() {
  const { peers, connectionStatus, openChat, roomExpiresAt } = useApp();

  const positioned = useMemo(
    () =>
      peers.map((p) => {
        const status = connectionStatus[p.peerId] || "discovered";
        const hop = status === "connected" ? 0 : 1; // direct vs relayed is reflected via hop count below
        const angle = hashAngle(p.peerId);
        const radius = status === "connected" ? 62 + (hashAngle(p.peerId + "r") % 30) : 118 + (hashAngle(p.peerId + "r2") % 32);
        const rad = (angle * Math.PI) / 180;
        const x = 150 + radius * Math.cos(rad);
        const y = 150 + radius * Math.sin(rad);
        return { peer: p, status, x, y, hop };
      }),
    [peers, connectionStatus]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-3 pb-1 text-[11px] text-lo flex justify-between">
        <span>~50m direct &middot; ~200m via mesh relay</span>
        <span>{formatTimeLeft(roomExpiresAt)}</span>
      </div>

      <div className="relative mx-auto shrink-0" style={{ width: 300, height: 300 }}>
        {RINGS.map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-line"
            style={{ left: 150 - r, top: 150 - r, width: r * 2, height: r * 2 }}
          />
        ))}
        <div
          className="absolute animate-sweep"
          style={{ left: 150, top: 150, width: 160, height: 160, transformOrigin: "1px 1px" }}
        >
          <svg width="160" height="160" style={{ position: "absolute", left: -1, top: -1 }}>
            <path d="M1,1 L1,-149 A150,150 0 0,1 130,-69 Z" fill="#3FE6CE" opacity="0.13" />
          </svg>
        </div>
        {positioned.map(({ peer, status, x, y }) => (
          <button
            key={peer.peerId}
            onClick={() => openChat(peer.peerId)}
            title={peer.nickname}
            className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold -translate-x-1/2 -translate-y-1/2 ${
              status === "connected" ? "bg-signal text-[#04221E] animate-pulse2" : "bg-amber text-[#3a2705]"
            }`}
            style={{ left: x, top: y }}
          >
            {(peer.nickname || "??").slice(0, 2).toUpperCase()}
          </button>
        ))}
        <div className="absolute w-1.5 h-1.5 rounded-full bg-hi -translate-x-1/2 -translate-y-1/2" style={{ left: 150, top: 150 }} />
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        {peers.length === 0 ? (
          <p className="text-center text-xs text-lo mt-8">scanning for nearby peers\u2026</p>
        ) : (
          peers.map((p) => (
            <PeerRow
              key={p.peerId}
              peer={p}
              status={connectionStatus[p.peerId] || "discovered"}
              onClick={() => openChat(p.peerId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
