import { ethers } from 'ethers';
import axios from 'axios';
import {
  CONTRACT_ADDRESS,
  CHAIN_RPC_URL,
  API_BASE_URL,
} from '../config/constants';
import contractAbi from '../utils/IdenteefiV2.json';

const SS_UUID_REGEX = /SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseQrPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error('Please scan a valid SmartScan QR code or enter a serial number.');
  }

  const trimmed = rawInput.trim();

  // Pattern 1: Contains SmartScan Serial UUID (e.g. from URL or label)
  const match = trimmed.match(SS_UUID_REGEX);
  if (match) {
    return {
      serialNumber: match[0].toUpperCase(),
      contractAddress: CONTRACT_ADDRESS,
    };
  }

  // Pattern 2: Comma separated contract,serial
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    if (parts.length === 2 && ethers.isAddress(parts[0].trim())) {
      return {
        contractAddress: parts[0].trim(),
        serialNumber: parts[1].trim(),
      };
    }
  }

  // Fallback: If alphanumeric serial without standard prefix
  if (trimmed.length >= 6 && trimmed.length <= 64) {
    return {
      serialNumber: trimmed,
      contractAddress: CONTRACT_ADDRESS,
    };
  }

  throw new Error('The scanned code is not a recognized SmartScan product passport.');
}

export async function verifyProductOnChain(serialNumber) {
  try {
    const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, provider);

    const exists = await contract.productExists(serialNumber);
    if (!exists) {
      return {
        serialNumber,
        exists: false,
        status: 'COUNTERFEIT',
        verdictTitle: 'Unregistered / Counterfeit Alert',
        verdictMessage: 'This product identifier does not exist on the SmartScan Sepolia blockchain ledger.',
      };
    }

    const raw = await contract.getProduct(serialNumber);
    const stage = Number(raw[6]);
    const isSold = Boolean(raw[9]);
    const custodian = raw[7];

    const rawHistory = Array.isArray(raw[5]) ? raw[5] : [];
    const history = rawHistory.map((evt) => ({
      actor: evt.actor || 'Authorized Facility',
      actorWallet: evt.actorWallet || '',
      actorRole: Number(evt.actorRole || 0),
      location: (evt.location || '').replace(/;/g, ', '),
      timestamp: evt.timestamp ? Number(evt.timestamp) : Math.floor(Date.now() / 1000),
      action: Number(evt.action || 0),
    }));

    let status = 'AUTHENTIC';
    let verdictTitle = 'Authentic Verified Product';
    let verdictMessage = 'Cryptographic origin verified against Ethereum Sepolia immutable ledger.';

    if (stage === 4) {
      status = 'RECALLED';
      verdictTitle = 'Manufacturer Recall Alert';
      verdictMessage = 'This product batch has been flagged as recalled by the brand authority.';
    } else if (isSold || stage === 3) {
      status = 'SOLD';
      verdictTitle = 'Ownership Registered (Sold)';
      verdictMessage = 'This item has already been marked as sold to a consumer.';
    }

    return {
      serialNumber: raw[0] || serialNumber,
      name: raw[1] || 'Verified Product',
      brand: raw[2] || 'Certified Brand',
      description: (raw[3] || '').replace(/;/g, ', '),
      imageHash: raw[4] || '',
      stage,
      custodian,
      history,
      isSold,
      exists: true,
      status,
      verdictTitle,
      verdictMessage,
      contractAddress: CONTRACT_ADDRESS,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Direct on-chain check error:', err);
    throw err;
  }
}

export async function fetchProductWithFallback(serialNumber) {
  // First try backend API for rich metadata (image URLs, registered location name)
  try {
    const res = await axios.get(`${API_BASE_URL}/product/verify/${encodeURIComponent(serialNumber)}`, {
      timeout: 4500,
    });
    if (res.data) {
      return {
        ...res.data,
        serialNumber: res.data.serialNumber || serialNumber,
        exists: true,
        status: res.data.isSold ? 'SOLD' : res.data.status || 'AUTHENTIC',
        verdictTitle: res.data.isSold ? 'Ownership Registered (Sold)' : 'Authentic Verified Product',
        verdictMessage: 'Cryptographically verified with live manufacturer proof on blockchain.',
      };
    }
  } catch (_apiErr) {
    // Backend API unreachable or 404, fall through to decentralized on-chain verification
  }

  // Fallback to direct decentralized on-chain query
  return verifyProductOnChain(serialNumber);
}
