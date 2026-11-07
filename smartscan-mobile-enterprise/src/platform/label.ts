import type { Product } from "../domain/types";
import { exportFile } from "./files";
import { isLive } from '../services/config';

// Render a standalone, high-resolution label; exporting a screenshot of the
// screen would include controls and can crop the QR's required quiet zone.
async function labelPng(product: Product, qr: SVGSVGElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 840;
  canvas.height = 1040;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Label image creation is unavailable on this device.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000336";
  ctx.textAlign = "center";
  ctx.font = "600 34px sans-serif";
  ctx.fillText("SmartScan", 420, 64);
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(product.name, 420, 134, 736);
  ctx.font = "24px sans-serif";
  ctx.fillText(product.brand, 420, 174, 736);
  const source = qr.cloneNode(true) as SVGSVGElement;
  source.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  source.setAttribute("width", "600");
  source.setAttribute("height", "600");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    ctx.drawImage(image, 120, 218, 600, 600);
  } finally { URL.revokeObjectURL(url); }
  ctx.font = "22px monospace";
  ctx.fillText(product.id, 420, 864, 760);
  ctx.font = "600 22px sans-serif";
  ctx.fillText(isLive ? 'SMARTSCAN LABEL' : "DEMO LABEL", 420, 934);
  ctx.font = "20px sans-serif";
  ctx.fillText(isLive ? 'Registered on Sepolia test network' : "Sample product · for demonstration only", 420, 972);
  // Some Android WebViews never dispatch toBlob's callback for a detached
  // canvas. This bounded label is under one megapixel; synchronous PNG encoding
  // avoids leaving the export button spinning indefinitely on those devices.
  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("The label could not be created.");
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

export async function exportLabel(product: Product, qr: SVGSVGElement): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await labelPng(product, qr);
  const filename = `SmartScan-${product.id.replace(/[^a-zA-Z0-9-]/g, "_")}.png`;
  return exportFile(blob, filename, `${product.name} label`);
}
