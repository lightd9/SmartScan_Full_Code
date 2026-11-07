import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureTransactionLocation, locationSourceLabel } from "./location";

let gps = vi.fn();
const position = { coords: { latitude: 0, longitude: 0, accuracy: 18 }, timestamp: 1700000000000 };
beforeEach(() => {
  gps = vi.fn((success) => success(position));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: gps } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ city: "Lagos", countryName: "Nigeria" }) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("transaction location capture", () => {
  it("preserves coordinates, accuracy and capture time even at zero coordinates", async () => {
    const location = await captureTransactionLocation("Demo store");
    expect(location).toMatchObject({ source: "device", latitude: 0, longitude: 0, accuracyMeters: 18, address: "Lagos, Nigeria" });
    expect(location.capturedAt).toBe(new Date(position.timestamp).toISOString());
    expect(gps.mock.calls[0][2]).toMatchObject({ maximumAge: 0 });
  });
  it("labels a profile fallback when permission is denied", async () => {
    gps.mockImplementation((_success, fail) => fail({ code: 1 }));
    const location = await captureTransactionLocation("Demo store");
    expect(location).toMatchObject({ source: "profile", address: "Demo store" });
    expect(location.latitude).toBeUndefined();
    expect(locationSourceLabel(location)).toContain("device location unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never fabricates a location if the device and profile have none", async () => {
    vi.stubGlobal("navigator", {});
    expect((await captureTransactionLocation()).source).toBe("unavailable");
    expect(locationSourceLabel()).toContain("not recorded");
  });
  it("retains device coordinates if address lookup fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    expect(await captureTransactionLocation("Demo store")).toMatchObject({ source: "device", address: "0.00000, 0.00000" });
  });
  it("bounds an unanswered permission prompt and ignores a late answer", async () => {
    vi.useFakeTimers();
    let lateSuccess = (_value: typeof position) => {};
    gps.mockImplementation(success => { lateSuccess = success; });
    const pending = captureTransactionLocation("Demo store");
    await vi.advanceTimersByTimeAsync(5501);
    const location = await pending;
    lateSuccess(position);
    expect(location.source).toBe("profile");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("aborts a slow address lookup and still records the device measurement", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("timeout")));
    }));
    const pending = captureTransactionLocation("Demo store");
    await vi.advanceTimersByTimeAsync(2501);
    expect((await pending).source).toBe("device");
  });
});
