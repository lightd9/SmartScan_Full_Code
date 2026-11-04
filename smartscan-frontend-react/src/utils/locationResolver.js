/**
 * Universal Location Resolver for SmartScan
 * 
 * Provides robust multi-layer geolocation:
 * 1. High-accuracy browser GPS / WiFi geolocation
 * 2. Low-accuracy browser fallback (if high accuracy times out)
 * 3. Client-side reverse geocoding to human-readable address (BigDataCloud / OpenStreetMap)
 * 4. IP-based fallback if hardware geolocation is unavailable or denied
 */

/**
 * Helper to extract clean address string from BigDataCloud response
 */
function formatBigDataCloudAddress(data) {
  const parts = [];
  if (data.locality && data.locality !== data.city) parts.push(data.locality);
  if (data.city) parts.push(data.city);
  if (data.principalSubdivision && data.principalSubdivision !== data.city) parts.push(data.principalSubdivision);
  if (data.countryName) parts.push(data.countryName);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  return data.locality || data.city || data.countryName || '';
}

/**
 * Reverse geocode coordinates to a clean address string
 */
export async function reverseGeocode(latitude, longitude, googleApiKey = '') {
  // 1. Try Google if API key is provided
  if (googleApiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`;
      const res = await fetch(gUrl);
      const data = await res.json();
      if (data.results && data.results[0]?.formatted_address) {
        return data.results[0].formatted_address;
      }
    } catch (e) {
      console.warn('Google reverse geocode failed, falling back to open provider:', e);
    }
  }

  // 2. Free client-side reverse geocoding via BigDataCloud (no API key required, CORS-enabled)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
    if (res.ok) {
      const data = await res.json();
      const formatted = formatBigDataCloudAddress(data);
      if (formatted) return formatted;
    }
  } catch (e) {
    console.warn('BigDataCloud reverse geocode failed:', e);
  }

  // 3. Fallback: Clean coordinate string
  return `Lat ${Number(latitude).toFixed(4)}, Long ${Number(longitude).toFixed(4)}`;
}

/**
 * Fallback to IP-based location when browser GPS is unavailable
 */
export async function fetchIpLocation() {
  // Try BigDataCloud IP client
  try {
    const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
    if (res.ok) {
      const data = await res.json();
      const address = formatBigDataCloudAddress(data);
      if (address) {
        return {
          location: address,
          latitude: data.latitude,
          longitude: data.longitude,
          source: 'ip_estimate',
          notice: `Location estimated from network (${address}). Review or edit if needed.`,
        };
      }
    }
  } catch (e) {
    console.warn('BigDataCloud IP lookup failed, trying backup provider:', e);
  }

  // Backup: ipwho.is
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false) {
        const parts = [data.city, data.region, data.country].filter(Boolean);
        const address = parts.join(', ');
        return {
          location: address,
          latitude: data.latitude,
          longitude: data.longitude,
          source: 'ip_estimate',
          notice: `Location estimated from network (${address}). Review or edit if needed.`,
        };
      }
    }
  } catch (e) {
    console.warn('ipwho.is lookup failed:', e);
  }

  throw new Error('Could not detect location from network. Please enter your location manually.');
}

/**
 * Detect location with multiple fallbacks:
 * 1. High-accuracy GPS/Wi-Fi
 * 2. Low-accuracy Wi-Fi/Cell
 * 3. IP-based location fallback
 */
export async function detectLocation(googleApiKey = '') {
  // If browser doesn't support geolocation at all, go straight to IP fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return await fetchIpLocation();
  }

  // Helper for Promise-wrapped getCurrentPosition
  const getPosition = (options) => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  let position = null;

  // Attempt 1: High accuracy
  try {
    position = await getPosition({ enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
  } catch (err1) {
    console.warn('High accuracy geolocation timed out or failed, trying low accuracy...', err1);
    // Attempt 2: Low accuracy (coarse, works better on desktop/Windows without GPS hardware)
    try {
      position = await getPosition({ enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
    } catch (err2) {
      console.warn('Browser geolocation failed completely, falling back to IP geolocation...', err2);
      // Attempt 3: IP fallback
      return await fetchIpLocation();
    }
  }

  // If we got coordinates from browser
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const address = await reverseGeocode(lat, lng, googleApiKey);

  return {
    location: address,
    latitude: lat,
    longitude: lng,
    source: 'browser_location',
    notice: `Location detected via device (${address}). Review or edit if needed.`,
  };
}
