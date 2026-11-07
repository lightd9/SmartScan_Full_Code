import { Capacitor } from "@capacitor/core";

export async function exportFile(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  // Callers provide a fixed extension; strip path components before caching.
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    if (!(await Share.canShare()).value) throw new Error("File sharing is unavailable on this device.");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The file could not be read."));
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: `exports/${safeName}`, directory: Directory.Cache, data, recursive: true });
    try {
      await Share.share({ title, files: [file.uri], dialogTitle: "Save or share" });
      return "shared";
    } catch (error) {
      if (/cancel/i.test(String((error as Error).message))) return "cancelled";
      throw error;
    }
    // Receiving apps can open the file after the share sheet closes. Retain it
    // in cache; exporting the same file again replaces it rather than growing it.
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "downloaded";
}
