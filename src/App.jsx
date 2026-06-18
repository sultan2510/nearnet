import React from "react";
import { useApp } from "./context/AppContext.jsx";
import TopBar from "./components/TopBar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Onboarding from "./screens/Onboarding.jsx";
import RoomEntry from "./screens/RoomEntry.jsx";
import Radar from "./screens/Radar.jsx";
import Chat from "./screens/Chat.jsx";
import Profile from "./screens/Profile.jsx";
import Emergency from "./screens/Emergency.jsx";

export default function App() {
  const { booting, needsOnboarding, screen } = useApp();

  if (booting) {
    return (
      <div className="nn-app-shell items-center justify-center">
        <span className="text-signal text-sm font-mono animate-pulse2">NearNet</span>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="nn-app-shell">
        <Onboarding />
      </div>
    );
  }

  if (screen === "entry") {
    return (
      <div className="nn-app-shell">
        <RoomEntry />
      </div>
    );
  }

  if (screen === "chat") {
    return (
      <div className="nn-app-shell">
        <Chat />
      </div>
    );
  }

  return (
    <div className="nn-app-shell">
      <TopBar />
      {screen === "radar" && <Radar />}
      {screen === "profile" && <Profile />}
      {screen === "emergency" && <Emergency />}
      <BottomNav />
    </div>
  );
}
