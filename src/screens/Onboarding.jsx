import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  const [name, setName] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    completeOnboarding(name.trim() || "Anonymous");
  }

  return (
    <div className="flex flex-col h-full px-7 justify-center">
      <h1 className="text-xl font-bold font-display text-center mb-1.5">Welcome to NearNet</h1>
      <p className="text-xs text-lo text-center mb-7">
        no email, no phone number, no account \u2014 just pick a name people nearby will see.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="what should people call you?"
          className="w-full bg-surface border border-line rounded-lg px-3.5 py-3 text-sm outline-none focus:border-signal mb-3"
        />
        <button type="submit" className="w-full bg-signal text-[#04221E] font-medium rounded-lg py-3">
          Continue
        </button>
      </form>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-lo mt-6">
        <ShieldCheck size={13} />
        a private key is generated on this device and never leaves it
      </div>
    </div>
  );
}
