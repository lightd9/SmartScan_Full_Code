export const getEthereumObject = () => window.ethereum;

export const findMetaMaskAccount = async () => {
  try {
    const ethereum = getEthereumObject();
    if (!ethereum) {
      return null;
    }
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts.length !== 0 ? accounts[0] : null;
  } catch (_error) {
    return null;
  }
};

export const connectMetaMask = async () => {
  const ethereum = getEthereumObject();
  if (!ethereum) {
    alert('Get MetaMask!');
    return null;
  }
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
};
