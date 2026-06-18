import React, { useState } from "react";
import { Lock } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { isValidRoomCode, normalizeRoomCode } from "../lib/roomCode.js";

export default function RoomEntry() {
  const { createAndEnterRoom, joinRoomWithCode, roomError } = useApp();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleJoin(e) {
    e.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) return;
    setJoining(true);
    await joinRoomWithCode(normalized);
    setJoining(false);
  }

  async function handleCreate() {
    setCreating(true);
    await createAndEnterRoom();
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full px-6 py-9 overflow-auto">
      <div className="text-center mb-7">
        <h1 className="text-2xl font-bold font-display">NearNet</h1>
        <p className="text-xs text-lo mt-1">offline, encrypted, peer to peer</p>
      </div>

      <form onSubmit={handleJoin} className="bg-surface border border-line rounded-2xl p-4 mb-4">
        <div className="text-sm text-lo mb-2">Join a room</div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="M7KP2X"
          className="w-full bg-void border border-line rounded-lg px-3 py-3 text-center text-lg font-mono tracking-[6px] uppercase outline-none focus:border-signal"
        />
        <button
          type="submit"
          disabled={!isValidRoomCode(code) || joining}
          className="w-full mt-2.5 bg-signal text-[#04221E] font-medium rounded-lg py-2.5 disabled:opacity-40"
        >
          {joining ? "Joining\u2026" : "Join room"}
        </button>
      </form>

      <div className="bg-surface border border-line rounded-2xl p-4">
        <div className="text-sm text-lo mb-2">Create a room</div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-transparent text-hi border border-signal rounded-lg py-2.5 font-medium disabled:opacity-40"
        >
          {creating ? "Creating\u2026" : "Create & enter room"}
        </button>
      </div>

      {roomError && <p className="text-danger text-xs text-center mt-4">{roomError}</p>}

      <div className="mt-auto pt-8 flex items-center justify-center gap-1.5 text-[11px] text-lo">
        <Lock size={12} />
        no messages ever touch a server
      </div>
    </div>
  );
}
