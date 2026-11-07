import { Capacitor } from "@capacitor/core";
export function preferences() {
  try {
    return {
      haptics: true,
      sound: false,
      ...JSON.parse(
        localStorage.getItem("smartscan-enterprise-feedback") || "{}",
      ),
    };
  } catch {
    return { haptics: true, sound: false };
  }
}
let audio: AudioContext | undefined;
export async function feedback(kind: "captured" | "exception" | "confirmed") {
  const prefs = preferences();
  if (prefs.haptics && Capacitor.isNativePlatform()) {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({
      style: kind === "exception" ? ImpactStyle.Medium : ImpactStyle.Light,
    }).catch(() => {});
  }
  if (prefs.sound) {
    try {
      audio ||= new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value =
        kind === "exception" ? 280 : kind === "confirmed" ? 880 : 620;
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.13);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.14);
    } catch {
      /* Optional audio must never interrupt a workflow. */
    }
  }
}
