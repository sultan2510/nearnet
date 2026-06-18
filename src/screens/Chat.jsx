import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, LockOpen, Paperclip, Send } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import MessageBubble from "../components/MessageBubble.jsx";

export default function Chat() {
  const { activePeerId, peers, messages, sendMessage, sendFile, setScreen, contacts } = useApp();
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const peer = peers.find((p) => p.peerId === activePeerId) || { peerId: activePeerId, nickname: "Unknown" };
  const thread = messages[activePeerId] || [];
  const verified = Boolean(contacts[activePeerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length]);

  async function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    await sendMessage(activePeerId, value);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await sendFile(activePeerId, file);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-line shrink-0">
        <button onClick={() => setScreen("radar")} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center text-[11px]">
          {(peer.nickname || "??").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{peer.nickname || "Unnamed device"}</div>
          <div className="text-[10px] text-lo">direct or via mesh, automatically</div>
        </div>
        {verified ? <Lock size={16} className="text-signal" /> : <LockOpen size={16} className="text-lo" />}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 flex flex-col gap-2.5">
        {thread.length === 0 && (
          <p className="text-center text-[11px] text-lo mt-6">
            no messages yet {verified ? "" : "\u2014 scan their QR code on Profile to enable full end-to-end encryption"}
          </p>
        )}
        {thread.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2.5 border-t border-line shrink-0">
        <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach file" className="text-lo">
          <Paperclip size={18} />
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="message"
          className="flex-1 bg-surface border border-line rounded-full px-3.5 py-2 text-sm outline-none focus:border-signal"
        />
        <button type="submit" aria-label="Send" className="text-signal">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
