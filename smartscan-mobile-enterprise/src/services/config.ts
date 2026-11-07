export const dataMode = import.meta.env.VITE_DATA_MODE || 'live';
export const isLive = dataMode === 'live';
export const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://smartscan-backend-52s4.onrender.com').replace(/\/$/, '');
export const explorer = 'https://sepolia.etherscan.io';
