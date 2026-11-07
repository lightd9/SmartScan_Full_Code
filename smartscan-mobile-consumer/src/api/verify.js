import { ethers } from 'ethers';
import axios from 'axios';
import { CONTRACT_ADDRESS, CHAIN_RPC_URL, API_BASE_URL, CHAIN_ID } from '../config/constants.js';
import contractAbi from '../utils/IdenteefiV2.json' with { type: 'json' };

const SS_UUID_REGEX = /^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseQrPayload(rawInput) {
  if (typeof rawInput !== 'string' || !rawInput.trim()) throw new Error('Please scan a valid SmartScan QR code or enter a serial number.');
  const trimmed = rawInput.trim();
  let serialNumber = trimmed;
  let contractAddress = null;
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(/\/verify\/([^/]+)\/?$/);
    serialNumber = pathMatch ? decodeURIComponent(pathMatch[1]) : url.searchParams.get('serialNumber');
  } else if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    if (parts.length !== 2) throw new Error('The scanned code is not a recognized SmartScan product passport.');
    [contractAddress, serialNumber] = parts.map(part => part.trim());
  }
  if (contractAddress && !ethers.isAddress(contractAddress)) throw new Error('The scanned code points to an unrecognized contract.');
  if (!SS_UUID_REGEX.test(serialNumber || '')) throw new Error('The scanned code is not a recognized SmartScan product passport.');
  // Contract string keys are case-sensitive; retain the identifier as issued.
  return { serialNumber, contractAddress };
}

export function normalizeChainProduct(raw, serialNumber, verifiedAt = new Date().toISOString()) {
  if (!raw || raw[0] !== serialNumber) return { serialNumber, exists: false, status: 'NOT_FOUND', source: 'chain', contractAddress: CONTRACT_ADDRESS, chainId: String(CHAIN_ID), verifiedAt };
  const stage = Number(raw[6]);
  const recalled = raw[10] === true || stage === 5;
  const isSold = raw[9] === true || stage === 4;
  return {
    serialNumber: raw[0], name: raw[1] || 'Registered product', brand: raw[2] || '',
    description: (raw[3] || '').replace(/;/g, ', '), imageHash: raw[4] || '',
    stage, custodian: raw[7], pendingRecipient: raw[8], recalled, isSold,
    history: Array.from(raw[5] || [], event => ({
      actor: event.actor ?? event[1] ?? '', actorWallet: event.actorWallet ?? event[2] ?? '',
      actorRole: Number(event.actorRole ?? event[7] ?? 0), location: event.location ?? event[3] ?? '',
      timestamp: String(event.timestamp ?? event[4] ?? ''), action: Number(event.action ?? event[5] ?? 0),
    })),
    exists: true, status: recalled ? 'RECALLED' : isSold ? 'SOLD' : 'REGISTERED', source: 'chain',
    contractAddress: CONTRACT_ADDRESS, chainId: String(CHAIN_ID), verifiedAt,
  };
}

export async function verifyProductOnChain(serialNumber) {
  const request = new ethers.FetchRequest(CHAIN_RPC_URL);
  request.timeout = 9000;
  const provider = new ethers.JsonRpcProvider(request);
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) throw new Error('Verification network mismatch');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, provider);
    if (!await contract.productExists(serialNumber)) return normalizeChainProduct(null, serialNumber);
    return normalizeChainProduct(await contract.getProduct(serialNumber), serialNumber);
  } finally { provider.destroy(); }
}

export function mergeVerificationResults(serialNumber, registry, chain) {
  const metadata = registry.status === 'fulfilled' && registry.value.data?.exists === true ? registry.value.data : null;
  if (chain.status === 'fulfilled') {
    // Never merge stale registry lifecycle fields into a fresh chain read.
    return { ...chain.value, imageHash: metadata?.imageHash || chain.value.imageHash || '', scanWarnings: ['scan_risk_check_unavailable'] };
  }
  if (metadata) return {
    serialNumber, name: metadata.name, brand: metadata.brand, description: metadata.description,
    imageHash: metadata.imageHash, exists: true, source: 'registry', stage: metadata.stage,
    recalled: metadata.recalled === true || Number(metadata.stage) === 5,
    isSold: metadata.isSold === true || Number(metadata.stage) === 4,
    status: Number(metadata.stage) === 5 || metadata.recalled === true ? 'RECALLED' : 'REGISTERED',
    registryUpdatedAt: metadata.registryUpdatedAt || null, verifiedAt: null,
    contractAddress: CONTRACT_ADDRESS, chainId: String(CHAIN_ID), scanWarnings: ['scan_risk_check_unavailable'],
  };
  throw new Error('We could not verify this product. Check your connection and try again.');
}

export function createProductVerifier({ api = axios, readChain = verifyProductOnChain } = {}) {
  return async function fetchProduct(serialNumber, { eventId = crypto.randomUUID(), contractAddress, purchase } = {}) {
    try {
      const response = await api.post(`${API_BASE_URL}/v1/assessments`, {
        serialNumber, ...(contractAddress ? {contractAddress} : {}), eventId, purpose: 'consumer', ...(purchase ? {purchase} : {}),
      }, { timeout: 12000 });
      const { product, assessment, flags } = response.data || {};
      if (![200, 201].includes(response.status) || !assessment?.summary || !['v2-evidence-1','evidence-2'].includes(assessment.policyVersion)
        || !Array.isArray(assessment.findings) || !Array.isArray(flags) || product?.serialNumber !== serialNumber
        || !ethers.isAddress(product?.contractAddress || '') || product.contractAddress.toLowerCase() !== assessment.source?.contractAddress?.toLowerCase()
        || (contractAddress && product.contractAddress.toLowerCase() !== contractAddress.toLowerCase())
        || !['v2','receipt-v3'].includes(product.protocol || 'v2') || String(product?.chainId) !== String(CHAIN_ID)) throw new Error('Assessment unavailable');
      return { ...product, assessment, scanWarnings: flags };
    } catch {
      if (purchase || (contractAddress && contractAddress.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase())) throw new Error('Current verification checks are unavailable. Reconnect and try again.');
      const [registry, chain] = await Promise.allSettled([
        api.get(`${API_BASE_URL}/product/verify/${encodeURIComponent(serialNumber)}`, { timeout: 4500 }),
        readChain(serialNumber),
      ]);
      if (registry.status === 'fulfilled' && registry.value.data?.protocol === 'receipt-v3') throw new Error('Current verification checks are unavailable. Reconnect and try again.');
      if (!contractAddress && registry.status !== 'fulfilled' && chain.status === 'fulfilled' && !chain.value.exists) throw new Error('The product authority could not be resolved. Reconnect and try again.');
      return mergeVerificationResults(serialNumber, registry, chain);
    }
  };
}

export const fetchProductWithFallback = createProductVerifier();
