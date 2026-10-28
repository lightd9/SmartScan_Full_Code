import { ethers } from 'ethers';

export function parseProductQr(qrData, expectedContract) {
    if (typeof qrData !== 'string') throw new Error('This is not a valid SmartScan product QR code.');
    const trimmed = qrData.trim();
    let contractAddress;
    let serialNumber;

    if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        if (parts.length !== 2) throw new Error('This is not a valid SmartScan product QR code.');
        [contractAddress, serialNumber] = parts;
    } else if (/^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        contractAddress = expectedContract;
        serialNumber = trimmed;
    } else {
        throw new Error('This is not a valid SmartScan product QR code.');
    }

    if (!ethers.isAddress(contractAddress) || !serialNumber?.trim()) {
        throw new Error('This is not a valid SmartScan product QR code.');
    }
    if (!/^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serialNumber.trim())) {
        throw new Error('This QR code contains an invalid product identifier.');
    }
    if (!ethers.isAddress(expectedContract) || contractAddress.toLowerCase() !== expectedContract.toLowerCase()) {
        throw new Error('This QR code points to an unrecognized contract. Do not rely on this product record.');
    }
    return { contractAddress, serialNumber: serialNumber.trim() };
}

export async function getRegisteredProduct(contract, serialNumber) {
    if (!(await contract.productExists(serialNumber))) {
        throw new Error('This product identifier is not registered on the configured blockchain.');
    }
    return contract.getProduct(serialNumber);
}

export function parseHistoryTimestamp(value) {
    if (typeof value === 'bigint' || typeof value === 'number') return Number(value);
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
    const parsed = Date.parse(String(value || ''));
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}
