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
 * Auto-detect location progressively:
 * 1. Instantly queries IP geolocation (resolves in ~150-300ms) and calls onUpdate immediately.
 * 2. Concurrently queries browser navigator.geolocation (GPS / Wi-Fi).
 *    - Timeout is kept short (4500ms).
 *    - If device coordinates resolve, reverse geocodes them and invokes onUpdate with the refined address.
 *    - If device coordinates fail/time out, it fails gracefully because onUpdate was ALREADY called with the valid IP location!
 * 3. Returns the final resolved location object.
 * 
 * @param {Object} [options]
 * @param {string} [options.googleApiKey]
 * @param {Function} [options.onUpdate] - Callback ({ location, latitude, longitude, source, notice })
 * @param {Function} [options.onProgress] - Callback (message)
 * @returns {Promise<Object>}
 */
export async function autoDetectLocation({
  googleApiKey = '',
  onUpdate = () => {},
  onProgress = () => {},
} = {}) {
  let resolvedResult = null;
  let isDeviceRefined = false;

  if (typeof onProgress === 'function') onProgress('Resolving location...');

  // 1. FAST-PATH: Run IP geolocation immediately
  const ipPromise = (async () => {
    try {
      const ipRes = await fetchIpLocation();
      if (!isDeviceRefined && ipRes && ipRes.location) {
        resolvedResult = ipRes;
        if (typeof onUpdate === 'function') {
          onUpdate(ipRes);
        }
      }
      return ipRes;
    } catch (err) {
      console.warn('IP fast-path lookup failed:', err);
      return null;
    }
  })();

  // 2. DEVICE GEOLOCATION: Run in parallel / background
  const devicePromise = (async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    // Check permission state if permissions API is available
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          return null; // Don't delay if user explicitly blocked browser location
        }
      } catch (_e) {
        // Permissions query not supported or throws, proceed to getCurrentPosition
      }
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const address = await reverseGeocode(lat, lng, googleApiKey);

            const deviceRes = {
              location: address,
              latitude: lat,
              longitude: lng,
              source: 'browser_location',
              notice: `Location refined via device GPS / Wi-Fi (${address}). Review or edit if needed.`,
            };

            isDeviceRefined = true;
            resolvedResult = deviceRes;
            if (typeof onUpdate === 'function') {
              onUpdate(deviceRes);
            }
            resolve(deviceRes);
          } catch (err) {
            console.warn('Reverse geocoding device coordinates failed:', err);
            resolve(null);
          }
        },
        (err) => {
          console.info('Device geolocation unresolvable or timed out (code ' + (err?.code || 'unknown') + '): ' + (err?.message || 'timeout'));
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 4500,
          maximumAge: 60000,
        }
      );
    });
  })();

  const [ipResult, deviceResult] = await Promise.all([ipPromise, devicePromise]);

  if (deviceResult) return deviceResult;
  if (ipResult) return ipResult;
  if (resolvedResult) return resolvedResult;

  // Final fallback
  return await fetchIpLocation();
}

/**
 * Standard detectLocation function (backward-compatible)
 */
export async function detectLocation(googleApiKey = '') {
  return await autoDetectLocation({ googleApiKey });
}

