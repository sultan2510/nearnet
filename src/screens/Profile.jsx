import React, { useState } from "react";
import { Edit2, ShieldCheck, ScanLine } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import QRCodeView from "../components/QRCodeView.jsx";
import QRScanner from "../components/QRScanner.jsx";

export default function Profile() {
  const { identity, setNickname, addContactFromScan, contacts } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity?.nickname || "");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);

  if (!identity) return null;

  const qrPayload = JSON.stringify({ v: 1, peerId: identity.peerId, publicKey: identity.publicKeyRaw, nickname: identity.nickname });

  async function saveNickname() {
    const value = draft.trim() || "Anonymous";
    await setNickname(value);
    setEditing(false);
  }

  async function handleScanResult(data) {
    setScanning(false);
    try {
      const record = await addContactFromScan(data);
      setScanMsg(`Keys exchanged with ${record.nickname}. Your chats with them are now end-to-end encrypted.`);
    } catch (err) {
      setScanMsg(err.message);
    }
    setTimeout(() => setScanMsg(null), 4000);
  }

  return (
    <div className="flex-1 overflow-auto px-5 py-5 relative">
      <div className="flex justify-center mb-4">
        <div className="bg-hi p-3 rounded-xl">
          <QRCodeView data={qrPayload} />
        </div>
      </div>
      <p className="text-center text-xs text-lo mb-2">scan to exchange encryption keys</p>
      <button
        onClick={() => setScanning(true)}
        className="w-full flex items-center justify-center gap-2 bg-surface border border-line rounded-lg py-2.5 text-sm mb-5"
      >
        <ScanLine size={16} className="text-signal" />
        Scan someone's code
      </button>
      {scanMsg && <p className="text-center text-xs text-signal mb-4">{scanMsg}</p>}

      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <div className="text-[11px] text-lo">peer id</div>
        <div className="font-mono text-sm mt-0.5">{identity.peerId}</div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <div className="text-[11px] text-lo">nickname</div>
        {editing ? (
          <div className="flex gap-2 mt-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={24}
              className="flex-1 bg-void border border-line rounded-md px-2 py-1 text-sm outline-none focus:border-signal"
            />
            <button onClick={saveNickname} className="text-signal text-sm">
              Save
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-sm">{identity.nickname}</span>
            <button onClick={() => setEditing(true)} aria-label="Edit nickname" className="text-lo">
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <div className="text-[11px] text-lo mb-1">verified contacts</div>
        {Object.keys(contacts).length === 0 ? (
          <div className="text-xs text-lo">none yet \u2014 scan a code to add one</div>
        ) : (
          Object.values(contacts).map((c) => (
            <div key={c.peerId} className="text-sm py-1 flex justify-between">
              <span>{c.nickname}</span>
              <span className="text-[10px] text-lo font-mono">{c.peerId}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-signal mt-2">
        <ShieldCheck size={14} />
        private key never leaves this device
      </div>

      {scanning && <QRScanner onResult={handleScanResult} onClose={() => setScanning(false)} />}
    </div>
  );
}
