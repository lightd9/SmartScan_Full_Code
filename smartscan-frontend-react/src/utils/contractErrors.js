/**
 * Normalizes blockchain, MetaMask, contract revert, and API errors into
 * clean, concise, human-readable status messages.
 */
export function formatContractError(error, defaultFallback = 'Blockchain transaction failed.') {
  if (!error) return defaultFallback;

  // 1. User rejection in wallet (MetaMask / EIP-1193 code 4001 or ethers ACTION_REJECTED)
  if (
    error.code === 'ACTION_REJECTED' ||
    error.code === 4001 ||
    error.message?.includes('user rejected') ||
    error.message?.includes('User denied')
  ) {
    return 'Transaction was cancelled in your wallet.';
  }

  // 2. Insufficient funds for gas
  if (
    error.code === 'INSUFFICIENT_FUNDS' ||
    error.message?.includes('insufficient funds')
  ) {
    return 'Insufficient Sepolia ETH in your wallet to cover network gas fees.';
  }

  // 3. Network or chain switch error
  if (
    error.code === 'NETWORK_ERROR' ||
    error.message?.includes('chain mismatch')
  ) {
    return 'Please switch your wallet to Sepolia Test Network (Chain ID 11155111).';
  }

  // 4. Extract raw revert reason from ethers error properties
  let rawReason =
    error.reason ||
    error.revert?.args?.[0] ||
    error.shortMessage ||
    '';

  // If reason wasn't on top level, attempt to parse from error.message
  if (!rawReason && typeof error.message === 'string') {
    const revertMatch =
      error.message.match(/execution reverted:\s*["']([^"']+)["']/i) ||
      error.message.match(/reason=["']([^"']+)["']/i) ||
      error.message.match(/reverted with reason string ['"]([^'"]+)['"]/i);
    if (revertMatch) {
      rawReason = revertMatch[1];
    }
  }

  if (rawReason) {
    // Known contract revert reasons map
    const friendlyMap = {
      'IdenteefiV2: wallet already has a role; use replaceRole':
        'This wallet is already assigned an active role on-chain. To transfer or update it, use Replace Role.',
      'IdenteefiV2: wallet role conflict':
        'Wallet role conflict: the new wallet already has an active role, or the previous wallet has no active role.',
      'IdenteefiV2: wallet has no role':
        'This wallet does not have an active on-chain role to revoke or replace.',
      'IdenteefiV2: invalid role':
        'Invalid role specified for on-chain authorization.',
      'IdenteefiV2: invalid role grant':
        'Invalid role grant: the wallet address or selected role is invalid.',
      'IdenteefiV2: unauthorized role':
        'Your connected wallet does not have the required role for this action.',
      'IdenteefiV2: caller is not the owner':
        'Only the contract owner wallet (Admin) is authorized to perform this operation.',
      'IdenteefiV2: product already registered':
        'This product ID has already been registered on the blockchain.',
      'IdenteefiV2: product not found':
        'Product not found on the blockchain.',
      'IdenteefiV2: product already sold':
        'This product has already been sold and cannot transition custody.',
      'IdenteefiV2: product is recalled':
        'This product has been flagged as recalled by its manufacturer or administrator.',
      'IdenteefiV2: recipient role is not authorized':
        'The recipient wallet is not authorized to receive custody of this product.',
      'IdenteefiV2: recipient role is no longer authorized':
        'The recipient wallet role is no longer authorized to accept custody.',
      'IdenteefiV2: recall not authorized':
        'Only the product manufacturer or system administrator can recall this product.',
      'IdenteefiV2: pending owner only':
        'Only the designated pending contract owner can claim ownership.',
    };

    if (friendlyMap[rawReason]) {
      return friendlyMap[rawReason];
    }

    // Strip "IdenteefiV2: " prefix if present and return clean text
    const cleaned = rawReason
      .replace(/^IdenteefiV2:\s*/i, '')
      .replace(/^execution reverted:\s*/i, '')
      .replace(/["']/g, '')
      .trim();

    if (cleaned && !cleaned.includes('{') && cleaned.length < 120) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  // 5. Backend API error response
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // 6. Clean custom error message if reasonably short and non-technical
  if (
    typeof error.message === 'string' &&
    error.message.length < 150 &&
    !error.message.includes('action="') &&
    !error.message.includes('code=') &&
    !error.message.includes('transaction=')
  ) {
    return error.message;
  }

  return defaultFallback;
}

