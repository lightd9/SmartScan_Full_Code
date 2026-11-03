import { describe, expect, it } from 'vitest';
import { formatContractError } from './contractErrors';

describe('formatContractError', () => {
  it('translates the exact wallet already has a role gas estimation error', () => {
    const rawMessage = 'execution reverted: "IdenteefiV2: wallet already has a role; use replaceRole" (action="estimateGas", data="0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000374964656e746565666956323a2077616c6c657420616c726561647920686173206120726f6c653b20757365207265706c616365526f6c65000000000000000000", reason="IdenteefiV2: wallet already has a role; use replaceRole", transaction={ "data": "0x085ca97b0000000000000000000000009f1a0f33f6de899c3de19bde7db31e5fb513cb8d00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000b434b20537570706c696572000000000000000000000000000000000000000000", "from": "0x90f8f5120b235C56798D28c2De8AF5D4671F1D4E", "to": "0x94aedd70DAd352140a71A413bA1D0c6C769Ebc6c" }, invocation=null, revert={ "args": [ "IdenteefiV2: wallet already has a role; use replaceRole" ], "name": "Error", "signature": "Error(string)" }, code=CALL_EXCEPTION, version=6.17.0)';

    const error = {
      message: rawMessage,
      reason: 'IdenteefiV2: wallet already has a role; use replaceRole',
      revert: { args: ['IdenteefiV2: wallet already has a role; use replaceRole'] },
      code: 'CALL_EXCEPTION',
    };

    expect(formatContractError(error)).toBe(
      'This wallet is already assigned an active role on-chain. To transfer or update it, use Replace Role.'
    );
  });

  it('translates error when only raw error.message is available', () => {
    const error = new Error(
      'execution reverted: "IdenteefiV2: product already sold" (action="estimateGas", transaction={...})'
    );
    expect(formatContractError(error)).toBe(
      'This product has already been sold and cannot transition custody.'
    );
  });

  it('translates MetaMask user rejection cleanly', () => {
    const error = { code: 'ACTION_REJECTED', message: 'user rejected action' };
    expect(formatContractError(error)).toBe('Request was cancelled in your wallet.');
  });

  it('translates insufficient funds error', () => {
    const error = { code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds for gas * price + value' };
    expect(formatContractError(error)).toBe(
      'Insufficient Sepolia ETH in your wallet to cover network gas fees.'
    );
  });

  it('prioritizes API server error messages even when error.shortMessage exists', () => {
    const error = {
      shortMessage: 'could not coalesce error',
      response: { data: { error: 'This wallet is already linked to another business account' } }
    };
    expect(formatContractError(error)).toBe('This wallet is already linked to another business account');
  });

  it('unwraps ethers UNKNOWN_ERROR with nested -32002 already pending error', () => {
    const error = {
      code: 'UNKNOWN_ERROR',
      shortMessage: 'could not coalesce error',
      message: 'could not coalesce error (error={"code":-32002,"message":"Request of type eth_requestAccounts already pending..."}, payload={...})',
      error: {
        code: -32002,
        message: "Request of type 'eth_requestAccounts' already pending for origin http://localhost:5173. Please wait."
      }
    };

    expect(formatContractError(error)).toBe(
      'A MetaMask request is already pending. Please click the MetaMask extension icon in your browser toolbar to approve or reject it.'
    );
  });

  it('unwraps nested 4001 user rejection inside ethers un-coalesced error', () => {
    const error = {
      code: 'UNKNOWN_ERROR',
      shortMessage: 'could not coalesce error',
      info: {
        error: {
          code: 4001,
          message: 'User rejected the request.'
        }
      }
    };

    expect(formatContractError(error)).toBe('Request was cancelled in your wallet.');
  });

  it('never outputs raw "Could not coalesce error" for generic ethers unknown errors', () => {
    const error = {
      code: 'UNKNOWN_ERROR',
      shortMessage: 'could not coalesce error',
      message: 'could not coalesce error (payload={...})'
    };

    const formatted = formatContractError(error);
    expect(formatted).not.toContain('could not coalesce');
    expect(formatted).not.toContain('Could not coalesce');
    expect(formatted).toBe(
      'MetaMask encountered an unexpected communication issue. Please open the MetaMask extension icon in your toolbar, make sure it is unlocked, and try again.'
    );
  });

  it('translates BAD_DATA / could not decode result data to Sepolia network switch prompt', () => {
    const error = {
      code: 'BAD_DATA',
      shortMessage: 'could not decode result data',
      message: 'could not decode result data (value="0x", info={ "method": "getProduct" }, code=BAD_DATA, version=6.17.0)'
    };
    expect(formatContractError(error)).toBe(
      'Please switch your wallet to Sepolia Test Network (Chain ID 11155111).'
    );
  });

  it('strips IdenteefiV2 prefix from unknown revert messages', () => {
    const error = { reason: 'IdenteefiV2: custom validation check failed' };
    expect(formatContractError(error)).toBe('Custom validation check failed');
  });
});
