import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";

export default function QRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch (err) {
        setError("Camera access was denied or is unavailable. You can paste a key manually instead.");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        onResult(code.data);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="absolute inset-0 bg-void z-20 flex flex-col">
      <div className="flex justify-between items-center px-4 py-3 border-b border-line">
        <span className="text-sm">Scan a NearNet QR code</span>
        <button onClick={onClose} aria-label="Close scanner">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <p className="text-sm text-lo px-8 text-center">{error}</p>
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        )}
        <canvas ref={canvasRef} className="hidden" />
        {!error && <div className="absolute w-56 h-56 border-2 border-signal rounded-2xl" />}
      </div>
    </div>
  );
}
