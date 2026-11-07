export type TransactionLocation = {
  address: string;
  source: "device" | "profile" | "unavailable";
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

export function profileLocation(address = "", now = Date.now()): TransactionLocation {
  return {
    address: address.trim() || "Location not available",
    source: address.trim() ? "profile" : "unavailable",
    capturedAt: new Date(now).toISOString(),
  };
}

// One measurement per operation, shared by every item in that operation.
// The deadline also covers browsers that leave a permission prompt unanswered.
export async function captureTransactionLocation(profileAddress = ""): Promise<TransactionLocation> {
  const fallback = () => profileLocation(profileAddress);
  if (typeof navigator === "undefined" || !navigator.geolocation) return fallback();
  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 5500);
    const finish = (value: GeolocationPosition | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    try {
      navigator.geolocation.getCurrentPosition(finish, () => finish(null), {
        enableHighAccuracy: true, timeout: 5000, maximumAge: 0,
      });
    } catch { finish(null); }
  });
  if (!position) return fallback();
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return fallback();
  let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: controller.signal },
    );
    if (response.ok) {
      const data = await response.json();
      const parts = [...new Set([data.locality, data.city, data.principalSubdivision, data.countryName]
        .filter((part): part is string => typeof part === "string" && Boolean(part.trim())))];
      if (parts.length) address = parts.join(", ");
    }
  } catch { /* Coordinates remain useful when address lookup is unavailable. */ }
  finally { clearTimeout(timer); }
  return {
    address, source: "device", latitude, longitude,
    accuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

export function locationSourceLabel(location?: TransactionLocation): string {
  if (!location) return "Location was not recorded for this event";
  if (location.source === "profile") return "Profile address · device location unavailable";
  if (location.source === "unavailable") return "Location unavailable";
  return `Device-reported location${location.accuracyMeters === undefined ? "" : ` · accuracy ±${Math.ceil(location.accuracyMeters)} m`}`;
}
