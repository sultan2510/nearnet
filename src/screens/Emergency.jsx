import React, { useState } from "react";
import { WifiOff, Wifi, Zap, BatteryMedium } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";

const STEPS = [
  "turn on your phone's mobile hotspot",
  "share the hotspot name & password out loud",
  "others connect to it \u2014 NearNet reconnects automatically"
];

export default function Emergency() {
  const { networkAvailable, battery, setBattery, isAnchor, setIsAnchor, broadcastEmergency, broadcasts } = useApp();
  const [draft, setDraft] = useState("");

  const level = battery.supported ? battery.level : battery.manual;
  const barColor = level > 50 ? "bg-signal" : level > 20 ? "bg-amber" : "bg-danger";

  function handleSend(e) {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    broadcastEmergency(value);
    setDraft("");
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 border ${
          networkAvailable ? "bg-surface border-line" : "bg-amberdim border-amber"
        }`}
      >
        {networkAvailable ? <Wifi size={16} className="text-lo" /> : <WifiOff size={16} className="text-amber" />}
        <span className={`text-xs ${networkAvailable ? "text-lo" : "text-amber"}`}>
          {networkAvailable ? "network looks fine right now" : "no network detected \u2014 emergency mode available"}
        </span>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-lo flex items-center gap-1.5">
          <BatteryMedium size={14} /> your battery
        </span>
        {!battery.supported && <span className="text-[10px] text-lo">manual estimate</span>}
      </div>
      <div className="h-2 bg-surface2 rounded mb-1 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${level}%` }} />
      </div>
      {!battery.supported && (
        <input
          type="range"
          min="0"
          max="100"
          value={battery.manual}
          onChange={(e) => setBattery((prev) => ({ ...prev, manual: Number(e.target.value) }))}
          className="w-full mb-4"
        />
      )}
      {battery.supported && <div className="mb-4" />}

      <div className="text-xs text-lo mb-2.5">become the anchor</div>
      {STEPS.map((step, i) => (
        <div key={step} className="flex gap-2.5 mb-2.5 items-start">
          <div className="w-5 h-5 rounded-full bg-surface2 text-[11px] font-mono flex items-center justify-center shrink-0">{i + 1}</div>
          <p className="text-xs pt-0.5">{step}</p>
        </div>
      ))}
      <button
        onClick={() => setIsAnchor((v) => !v)}
        className={`w-full rounded-lg py-2.5 font-medium text-sm mt-1 mb-3 ${
          isAnchor ? "bg-surface2 text-signal border border-signal" : "bg-signal text-[#04221E]"
        }`}
      >
        {isAnchor ? "You're anchoring this room" : "Become the anchor"}
      </button>

      <form onSubmit={handleSend} className="mb-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="emergency broadcast message"
          className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-danger mb-2"
        />
        <button type="submit" className="w-full flex items-center justify-center gap-2 bg-transparent border border-danger text-danger rounded-lg py-2.5 font-medium text-sm">
          <Zap size={14} />
          Emergency broadcast
        </button>
      </form>
      <p className="text-[10px] text-lo text-center mb-4">sends to everyone currently reachable in this room, direct or via mesh</p>

      {broadcasts.length > 0 && (
        <div>
          <div className="text-[11px] text-lo mb-2">recent broadcasts</div>
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-dangerdim border border-danger rounded-lg px-3 py-2 mb-2 text-xs">
              {b.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
