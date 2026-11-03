/**
 * Normalizes blockchain, MetaMask, contract revert, and API errors into
 * clean, concise, human-readable status messages.
 */
export function formatContractError(error, defaultFallback = 'Blockchain transaction failed.') {
  if (!error) return defaultFallback;

  // 1. Prioritize backend API error response (e.g. Axios 4xx/5xx responses)
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // Extract nested error info from Ethers v6 wrapper (error.error or error.info?.error)
  const nested = error.error || error.info?.error;
  const errorCode = nested?.code ?? error.code;
  const combinedMessage = [
    error.message,
    error.shortMessage,
    error.reason,
    nested?.message,
    nested?.data?.message,
  ]
    .filter((m) => typeof m === 'string')
    .join(' ');

  // 2. MetaMask pending request (-32002: Request already pending)
  if (
    errorCode === -32002 ||
    errorCode === '-32002' ||
    combinedMessage.includes('already pending') ||
    combinedMessage.includes('Resource unavailable')
  ) {
    return 'A MetaMask request is already pending. Please click the MetaMask extension icon in your browser toolbar to approve or reject it.';
  }

  // 3. User rejection in wallet (MetaMask / EIP-1193 code 4001 or ethers ACTION_REJECTED)
  if (
    errorCode === 'ACTION_REJECTED' ||
    errorCode === 4001 ||
    errorCode === '4001' ||
    combinedMessage.toLowerCase().includes('user rejected') ||
    combinedMessage.toLowerCase().includes('user denied')
  ) {
    return 'Request was cancelled in your wallet.';
  }

  // 4. Insufficient funds for gas
  if (
    errorCode === 'INSUFFICIENT_FUNDS' ||
    combinedMessage.toLowerCase().includes('insufficient funds')
  ) {
    return 'Insufficient Sepolia ETH in your wallet to cover network gas fees.';
  }

  // 5. Network, chain switch error or BAD_DATA (contract returns 0x because wallet is on wrong chain)
  if (
    errorCode === 'NETWORK_ERROR' ||
    errorCode === 'BAD_DATA' ||
    combinedMessage.toLowerCase().includes('chain mismatch') ||
    combinedMessage.toLowerCase().includes('could not decode result data') ||
    combinedMessage.toLowerCase().includes('value="0x"')
  ) {
    return 'Please switch your wallet to Sepolia Test Network (Chain ID 11155111).';
  }

  // 6. Extract raw revert reason from ethers error properties
  let rawReason =
    error.reason ||
    error.revert?.args?.[0] ||
    '';

  // If error.shortMessage is present, ONLY use it if it's NOT the un-coalesced or generic wrapper message
  if (!rawReason && typeof error.shortMessage === 'string') {
    const sm = error.shortMessage.toLowerCase();
    if (
      !sm.includes('could not coalesce') &&
      !sm.includes('could not decode') &&
      !sm.includes('unknown error') &&
      !sm.includes('missing revert data')
    ) {
      rawReason = error.shortMessage;
    }
  }

  // Check nested reason/message if rawReason is still empty
  if (!rawReason && nested?.message && typeof nested.message === 'string') {
    const nm = nested.message;
    if (
      !nm.toLowerCase().includes('could not coalesce') &&
      !nm.toLowerCase().includes('could not decode') &&
      !nm.toLowerCase().includes('unknown error')
    ) {
      rawReason = nm;
    }
  }

  // If reason wasn't on top level, attempt to parse from error.message / combinedMessage
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
      'IdenteefiV2: caller is current custodian':
        'The dispatching wallet cannot claim its own delivery. A different eligible wallet must confirm receipt.',
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

    // Ensure we do not return "could not coalesce error" or technical strings
    if (
      cleaned &&
      !cleaned.includes('{') &&
      !cleaned.toLowerCase().includes('could not coalesce') &&
      !cleaned.toLowerCase().includes('could not decode') &&
      cleaned.length < 120
    ) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  // 7. If this was an un-coalesced error from ethers, return a clean instruction rather than the raw string
  if (
    combinedMessage.toLowerCase().includes('could not coalesce') ||
    error.code === 'UNKNOWN_ERROR'
  ) {
    return 'MetaMask encountered an unexpected communication issue. Please open the MetaMask extension icon in your toolbar, make sure it is unlocked, and try again.';
  }

  // 8. Clean custom error message if reasonably short and non-technical
  if (
    typeof error.message === 'string' &&
    error.message.length < 350 &&
    !error.message.includes('action="') &&
    !error.message.includes('code=') &&
    !error.message.includes('transaction=') &&
    !error.message.toLowerCase().includes('could not coalesce') &&
    !error.message.toLowerCase().includes('could not decode')
  ) {
    return error.message;
  }

  return defaultFallback;
}
