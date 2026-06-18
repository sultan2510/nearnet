import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function QRCodeView({ data, size = 190 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 1,
      color: { dark: "#0A0E13", light: "#ECF4F3" }
    }).catch(() => {});
  }, [data, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-md" />;
}
