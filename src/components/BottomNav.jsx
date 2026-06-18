import React from "react";
import { Radar as RadarIcon, AlertTriangle, User } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";

const ITEMS = [
  { key: "radar", label: "Nearby", Icon: RadarIcon },
  { key: "emergency", label: "Emergency", Icon: AlertTriangle },
  { key: "profile", label: "Profile", Icon: User }
];

export default function BottomNav() {
  const { screen, setScreen, networkAvailable } = useApp();

  return (
    <div className="flex justify-around items-center border-t border-line py-2 shrink-0 bg-void">
      {ITEMS.map(({ key, label, Icon }) => {
        const active = screen === key;
        const isEmergency = key === "emergency";
        return (
          <button
            key={key}
            onClick={() => setScreen(key)}
            className="flex flex-col items-center gap-1 px-4 py-1"
            aria-current={active ? "page" : undefined}
          >
            <Icon
              size={20}
              className={
                isEmergency && !networkAvailable
                  ? "text-amber animate-pulse2"
                  : active
                  ? "text-signal"
                  : "text-lo"
              }
            />
            <span className={`text-[10px] ${active ? "text-hi" : "text-lo"}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
