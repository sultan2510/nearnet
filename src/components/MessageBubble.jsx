import React from "react";
import { Check, CheckCheck, File, Download } from "lucide-react";
import { formatBytes, formatClock } from "../lib/format.js";

export default function MessageBubble({ message }) {
  const mine = message.fromMe;
  const base = "max-w-[75%] px-3 py-2 rounded-2xl text-sm";
  const sideClass = mine ? "self-end bg-signal text-[#04221E]" : "self-start bg-surface2 text-hi";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`${base} ${sideClass}`}>
        {message.type === "file" ? <FileContent message={message} mine={mine} /> : <span>{message.text}</span>}
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[10px] text-lo">{formatClock(message.ts)}</span>
        {mine && (message.status === "delivered" ? <CheckCheck size={12} className="text-signal" /> : <Check size={12} className="text-lo" />)}
      </div>
    </div>
  );
}

function FileContent({ message, mine }) {
  const { fileMeta } = message;
  const inProgress = message.status === "receiving" || (fileMeta?.progress ?? 100) < 100;

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <File size={18} className={mine ? "text-[#04221E]" : "text-signal"} />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{fileMeta?.name}</div>
        <div className="text-[11px] opacity-75">
          {formatBytes(fileMeta?.size)}
          {inProgress ? ` \u00b7 ${fileMeta?.progress ?? 0}%` : ""}
        </div>
        {inProgress && (
          <div className="h-1 bg-black/20 rounded mt-1 overflow-hidden">
            <div className="h-full bg-current opacity-70" style={{ width: `${fileMeta?.progress ?? 0}%` }} />
          </div>
        )}
      </div>
      {!inProgress && fileMeta?.url && (
        <a href={fileMeta.url} download={fileMeta.name} className="shrink-0" aria-label="Save file">
          <Download size={16} />
        </a>
      )}
    </div>
  );
}
