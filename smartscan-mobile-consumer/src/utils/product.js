import { API_BASE_URL } from '../config/constants.js';

export function needsPurchaseDetails(product) {
  return product?.exists === true && Boolean(product.assessment?.score) && product.purchaseAnswers?.completed !== true;
}

export function canShowEvidenceScore(product) {
  return Boolean(product?.assessment?.score) && !needsPurchaseDetails(product);
}

export function productStatus(product) {
  if (needsPurchaseDetails(product) && product.assessment.summary?.status !== 'RECALLED') {
    return { label: 'Two quick questions', title: 'Finish your verification.', tone: 'neutral', description: 'Confirm where you got the product and when you are checking to see your result.' };
  }
  if (product?.assessment?.summary) return product.assessment.summary;
  const status = String(product?.status || '').toUpperCase();
  if (Number(product?.stage) === 5 || product?.recalled === true || (product?.stage == null && status === 'RECALLED')) {
    return { label: 'Recalled', title: 'This product has been recalled.', tone: 'warning', description: 'Contact the manufacturer before using this product.' };
  }
  if (product?.exists === false || ['COUNTERFEIT', 'NOT_FOUND', 'UNREGISTERED'].includes(status)) {
    return { label: 'Not registered', title: 'We couldn’t verify this product.', tone: 'warning', description: 'This serial number was not found in the product registry.' };
  }
  if (product?.source === 'registry') {
    return { label: 'Registry only', title: 'Product found in the registry.', tone: 'neutral', description: 'Current blockchain status could not be checked. Try again before relying on this record.' };
  }
  if (product?.isSold || Number(product?.stage) === 4 || (product?.stage == null && status === 'SOLD')) {
    return { label: 'More checks needed', title: 'More verification needed.', tone: 'neutral', description: 'The registered code has a sale recorded. Reconnect for custody, retailer and other authenticity checks.' };
  }
  if (product?.exists === true && (product.source === 'chain' || status === 'AUTHENTIC')) {
    return { label: 'Identity found', title: 'Registered identity found.', tone: 'neutral', description: 'The code matches a registered record. Scan anomaly checks are unavailable; a copied code can also match.' };
  }
  if (status === 'REGISTERED') {
    return { label: 'Registered', title: 'Product found in the registry.', tone: 'neutral', description: 'Live blockchain verification is unavailable. Try scanning again.' };
  }
  return { label: 'Not verified', title: 'Verification is unavailable.', tone: 'neutral', description: 'Scan again when you have an internet connection.' };
}

export function productImage(product) {
  const value = product?.imageUrl || product?.imageHash || '';
  if (/^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  if (value.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${value.slice(7).replace(/^ipfs\//, '')}`;
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)(\/.*)?$/.test(value)) return `https://ipfs.io/ipfs/${value}`;
  if (/^\/?file\/product\//.test(value)) return `${API_BASE_URL}/${value.replace(/^\//, '')}`;
  if (/^[A-Za-z0-9_.-]+\.(png|jpe?g|webp|avif)$/i.test(value)) return `${API_BASE_URL}/file/product/${encodeURIComponent(value)}`;
  return '';
}

function coordinates(value) {
  if (!value) return null;
  let lat, lng;
  if (Array.isArray(value)) [lat, lng] = value;
  else if (typeof value === 'object') {
    lat = value.latitude ?? value.lat;
    lng = value.longitude ?? value.lng ?? value.lon;
  } else if (typeof value === 'string') {
    const device = value.match(/^(?:\[Device\s+|Device-reported\s+)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (device) return coordinates([device[1], device[2]]);
    const match = value.match(/^(?:Lat(?:itude)?\s*[:=]?\s*)?(-?\d+(?:\.\d+)?)\s*[,;]\s*(?:(?:Long?(?:itude)?|Lng)\s*[:=]?\s*)?(-?\d+(?:\.\d+)?)$/i);
    if (match) [, lat, lng] = match;
  }
  if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') return null;
  lat = Number(lat); lng = Number(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
}

const roles = { 2: 'Manufacturer', 3: 'Supplier', 4: 'Retailer' };
export function supplyChain(product) {
  const events = Array.isArray(product?.history) ? product.history : Array.isArray(product?.supplyChain) ? product.supplyChain : [];
  return events.map((event, index) => {
    const location = typeof event.location === 'string' ? event.location.replace(/;/g, ', ') : event.location?.name || '';
    return {
      role: roles[event.actorRole] || event.role || 'Supply-chain stop',
      name: event.actor || event.name || roles[event.actorRole] || 'Registered facility',
      location,
      coordinates: coordinates(event.coordinates) || coordinates(event) || coordinates(event.location),
      approximate: true,
      timestamp: event.timestamp,
      id: `${index}-${event.actorWallet || event.actor || 'stop'}`,
    };
  });
}

export function scanDate(product) {
  const date = new Date(product?.scannedAt || product?.verifiedAt || '');
  return Number.isNaN(date.getTime()) ? 'Saved scan' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
