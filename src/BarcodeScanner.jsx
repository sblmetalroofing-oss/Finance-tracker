import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { lookupBarcode } from "./productLookup";

// Full-screen camera barcode scanner. Decodes EAN/UPC barcodes, looks up the
// product name (price book -> Open Food Facts -> manual), then collects a price.
export default function BarcodeScanner({ priceBook, onConfirm, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [looking, setLooking] = useState(false);
  const [pending, setPending] = useState(null); // { barcode, name, price, source }
  const [toast, setToast] = useState(null);

  // Start (or restart) the camera and listen for a decoded barcode.
  const startScan = async () => {
    setError(null);
    setPending(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not available on this device/browser. Add items manually instead.");
      return;
    }
    try {
      const reader = readerRef.current || new BrowserMultiFormatReader();
      readerRef.current = reader;
      // Prefer the rear/environment camera for scanning (phones default to the
      // front camera otherwise). "ideal" keeps a graceful fallback on laptops.
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result, err, controls) => {
          if (result) {
            controls.stop();
            controlsRef.current = null;
            handleDecoded(result.getText());
          }
        }
      );
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access or add items manually."
          : "Could not start the camera. You can still add items manually."
      );
    }
  };

  const stopCamera = () => {
    try { controlsRef.current?.stop(); } catch { /* camera already stopped */ }
    controlsRef.current = null;
  };

  const handleDecoded = async (barcode) => {
    setLooking(true);
    const info = await lookupBarcode(barcode, priceBook);
    setLooking(false);
    setPending({
      barcode: info.barcode,
      name: info.name,
      price: info.lastPrice != null ? String(info.lastPrice) : "",
      source: info.source,
    });
  };

  const confirm = (scanNext) => {
    if (!pending) return;
    onConfirm({
      barcode: pending.barcode,
      name: pending.name.trim() || `Item ${pending.barcode.slice(-4)}`,
      price: parseFloat(pending.price) || 0,
    });
    setPending(null);
    if (scanNext) {
      setToast("Added ✓");
      setTimeout(() => setToast(null), 1200);
      startScan();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    startScan();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = {
    position: "fixed", inset: 0, zIndex: 1000, background: "rgba(8,8,20,0.97)",
    display: "flex", flexDirection: "column", color: "#e0e0e0",
    fontFamily: "'DM Sans', sans-serif",
  };
  const inp = {
    background: "#12122a", border: "1px solid #2a2a4a", borderRadius: 8, color: "#eee",
    padding: "10px 12px", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box",
  };
  const btn = (bg, brd, col) => ({
    background: bg, border: `1px solid ${brd}`, color: col, borderRadius: 8,
    padding: "12px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", flex: 1,
    fontFamily: "'DM Sans'",
  });

  const srcLabel = pending && {
    priceBook: "From your price book — price prefilled",
    openfoodfacts: "Found in Open Food Facts",
    unknown: "Not found — name it (common for Aldi own-brand)",
  }[pending.source];

  return (
    <div style={overlay}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>Scan barcode</span>
        <button onClick={() => { stopCamera(); onClose(); }}
          style={{ background: "#1a1a2e", border: "none", color: "#bbb", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}>
          Close
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
        {!pending && !error && (
          <div style={{ position: "absolute", width: "70%", maxWidth: 320, height: 120, border: "2px solid #2A9D8F", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(8,8,20,0.45)" }} />
        )}
        {looking && (
          <div style={{ position: "absolute", bottom: 24, fontSize: 14, color: "#2A9D8F" }}>Looking up product…</div>
        )}
        {toast && (
          <div style={{ position: "absolute", top: 16, background: "#2A9D8F", color: "#04201c", padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 14 }}>{toast}</div>
        )}
      </div>

      {error && (
        <div style={{ padding: 20 }}>
          <div style={{ background: "#2a1a1a", border: "1px solid #5a2a2a", color: "#E8675A", borderRadius: 10, padding: 14, fontSize: 14, lineHeight: 1.5 }}>{error}</div>
          <button onClick={() => { stopCamera(); onClose(); }} style={{ ...btn("#1a1a2e", "#2a2a4a", "#bbb"), width: "100%", marginTop: 12 }}>Back to list</button>
        </div>
      )}

      {pending && (
        <div style={{ padding: 20, background: "#0f0f23", borderTop: "1px solid #1a1a3a", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Barcode {pending.barcode}</div>
          {srcLabel && <div style={{ fontSize: 12, color: pending.source === "unknown" ? "#E9C46A" : "#2A9D8F" }}>{srcLabel}</div>}
          <div>
            <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Product name</label>
            <input autoFocus={pending.source === "unknown"} value={pending.name}
              onChange={(e) => setPending({ ...pending, name: e.target.value })}
              style={inp} placeholder="Product name" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Price ($)</label>
            <input type="number" inputMode="decimal" value={pending.price}
              onChange={(e) => setPending({ ...pending, price: e.target.value })}
              style={{ ...inp, textAlign: "right" }} placeholder="0.00" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={() => confirm(true)} style={btn("#12241f", "#2A9D8F", "#2A9D8F")}>Add &amp; scan next</button>
            <button onClick={() => confirm(false)} style={btn("#2A9D8F", "#2A9D8F", "#04201c")}>Add &amp; done</button>
          </div>
        </div>
      )}
    </div>
  );
}
