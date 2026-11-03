import { describe, it, expect } from 'vitest';
import { determineCustodyAction } from './stageActions';

describe('determineCustodyAction', () => {
  it('identifies recalled state regardless of role', () => {
    const action = determineCustodyAction({
      stage: 5,
      isRecalled: true,
      role: 'retailer',
    });
    expect(action.actionKey).toBe('recalled');
    expect(action.buttonLabel).toBe('Product Recalled (Locked)');
    expect(action.canExecute).toBe(false);
  });

  it('identifies sold state for retailer', () => {
    const action = determineCustodyAction({
      stage: 4,
      isSold: true,
      role: 'retailer',
    });
    expect(action.actionKey).toBe('sold');
    expect(action.buttonLabel).toBe('Product Already Sold & Finalized');
    expect(action.canExecute).toBe(false);
  });

  it('identifies manufacturer dispatch for Stage 1 (Manufactured)', () => {
    const action = determineCustodyAction({
      stage: 1,
      role: 'manufacturer',
    });
    expect(action.actionKey).toBe('dispatch_from_factory');
    expect(action.buttonLabel).toBe('Sign & Dispatch to Supply Chain');
    expect(action.actionTitle).toBe('Dispatch Product to Supply Chain');
    expect(action.canExecute).toBe(true);
  });

  it('prevents supplier from claiming an un-dispatched manufactured product', () => {
    const action = determineCustodyAction({
      stage: 1,
      role: 'supplier',
    });
    expect(action.actionKey).toBe('awaiting_dispatch');
    expect(action.buttonLabel).toBe('Awaiting Outbound Dispatch');
    expect(action.canExecute).toBe(false);
  });

  it('identifies warehouse delivery confirmation for supplier when manufacturer dispatched', () => {
    const action = determineCustodyAction({
      stage: 2,
      role: 'supplier',
      history: [{ actorRole: 2, action: 1 }],
    });
    expect(action.actionKey).toBe('confirm_delivery_supplier');
    expect(action.buttonLabel).toBe('Sign & Confirm Warehouse Delivery Receipt');
    expect(action.actionTitle).toBe('Confirm Inbound Consignment Receipt');
    expect(action.canExecute).toBe(true);
  });

  it('identifies store delivery confirmation for retailer when supplier dispatched', () => {
    const action = determineCustodyAction({
      stage: 2,
      role: 'retailer',
      history: [{ actorRole: 3, action: 1 }],
    });
    expect(action.actionKey).toBe('confirm_delivery_retailer');
    expect(action.buttonLabel).toBe('Sign & Confirm Store Delivery Receipt');
    expect(action.actionTitle).toBe('Confirm Inbound Store Delivery Receipt');
    expect(action.canExecute).toBe(true);
  });

  it('prevents dispatcher wallet from confirming its own outbound delivery', () => {
    const wallet = '0x1111111111111111111111111111111111111111';
    const action = determineCustodyAction({
      stage: 2,
      custodian: wallet,
      walletAddress: wallet,
      role: 'supplier',
    });
    expect(action.actionKey).toBe('in_transit_awaiting_recipient');
    expect(action.canExecute).toBe(false);
    expect(action.buttonLabel).toBe('In Transit (Awaiting Recipient Receipt)');
  });

  it('identifies retailer mark sold for Stage 3 (Delivered)', () => {
    const action = determineCustodyAction({
      stage: 3,
      role: 'retailer',
      custodian: '0x0106A67c9DB9C5Cd2b7Fe110fA6fCd92D2b810Ec',
    });
    expect(action.actionKey).toBe('mark_sold');
    expect(action.buttonLabel).toBe('Sign & Mark Product as Sold on Blockchain');
    expect(action.actionTitle).toBe('Finalize Retail Sale (Mark as Sold)');
    expect(action.canExecute).toBe(true);
  });

  it('identifies supplier dispatch to retail for Stage 3 (Delivered)', () => {
    const action = determineCustodyAction({
      stage: 3,
      role: 'supplier',
    });
    expect(action.actionKey).toBe('dispatch_to_retailer');
    expect(action.buttonLabel).toBe('Sign & Dispatch to Retail Partner');
    expect(action.actionTitle).toBe('Dispatch Consignment to Retail Partner');
    expect(action.canExecute).toBe(true);
  });
});
