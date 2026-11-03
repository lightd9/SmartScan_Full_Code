/**
 * Determine the specific, human-readable action to be performed for a product
 * based on its blockchain state, current custodian, and the logged-in user's role.
 */
export function determineCustodyAction({
  stage = 0,
  custodian = '',
  pendingRecipient = '',
  isSold = false,
  isRecalled = false,
  role = '',
  walletAddress = '',
  history = [],
}) {
  const normalizedStage = Number(stage);
  const normalizedRole = (role || '').toLowerCase();
  const normalizedWallet = (walletAddress || '').toLowerCase();
  const normalizedCustodian = (custodian || '').toLowerCase();
  const normalizedPendingRecipient = (pendingRecipient || '').toLowerCase();

  const isCurrentCustodian = Boolean(
    normalizedWallet && normalizedCustodian && normalizedWallet === normalizedCustodian
  );

  const lastEvent = history.length > 0 ? history[history.length - 1] : null;
  const lastAction = lastEvent ? Number(lastEvent.action) : null;
  const senderRole = lastEvent ? Number(lastEvent.actorRole ?? 0) : 0;

  // 1. Recalled State
  if (isRecalled || normalizedStage === 5) {
    return {
      actionKey: 'recalled',
      stageLabel: 'Recalled',
      pillColor: 'red',
      actionTitle: 'Product Recalled',
      actionDescription: 'This product has been officially recalled on-chain. All custody transfers and retail sales are permanently blocked.',
      buttonLabel: 'Product Recalled (Locked)',
      proceedButtonLabel: 'Product Recalled (Locked)',
      canExecute: false,
      reason: 'This product has been recalled.',
    };
  }

  // 2. Sold State
  if (isSold || normalizedStage === 4) {
    return {
      actionKey: 'sold',
      stageLabel: 'Sold & Finalized',
      pillColor: 'purple',
      actionTitle: 'Product Finalized (Sold)',
      actionDescription: 'This authentic product has already been sold to a customer. Its cryptographic passport is permanently sealed to prevent counterfeit duplicate sales.',
      buttonLabel: 'Product Already Sold & Finalized',
      proceedButtonLabel: 'Product Finalized (Sold)',
      canExecute: false,
      reason: 'This product has already been sold.',
    };
  }

  // 3. Stage 1: Manufactured
  if (normalizedStage === 1) {
    if (normalizedRole === 'manufacturer') {
      return {
        actionKey: 'dispatch_from_factory',
        stageLabel: 'Manufactured (At Factory)',
        pillColor: 'blue',
        actionTitle: 'Dispatch Product to Supply Chain',
        actionDescription: 'Record on-chain dispatch from the manufacturing facility. This initiates physical custody handover so the registered logistics supplier can confirm receipt.',
        buttonLabel: 'Sign & Dispatch to Supply Chain',
        proceedButtonLabel: 'Proceed to Dispatch Product →',
        canExecute: true,
      };
    }
    return {
      actionKey: 'awaiting_dispatch',
      stageLabel: 'Manufactured (At Factory)',
      pillColor: 'yellow',
      actionTitle: 'Awaiting Manufacturer Dispatch',
      actionDescription: 'This product has been manufactured but has not yet been dispatched on-chain. The manufacturer must record dispatch before downstream receipt can be confirmed.',
      buttonLabel: 'Awaiting Outbound Dispatch',
      proceedButtonLabel: 'Awaiting Outbound Dispatch',
      canExecute: false,
      reason: 'The manufacturer must dispatch this product on-chain before receipt can be claimed.',
    };
  }

  // 4. Stage 2: Dispatched (In Transit)
  if (normalizedStage === 2) {
    // Check if the user is the one who dispatched it
    if (normalizedWallet && normalizedCustodian && normalizedWallet === normalizedCustodian) {
      return {
        actionKey: 'in_transit_awaiting_recipient',
        stageLabel: 'In Transit (Dispatched)',
        pillColor: 'orange',
        actionTitle: 'Consignment In Transit',
        actionDescription: 'You have dispatched this consignment. It is currently in transit awaiting delivery confirmation from the recipient partner on the blockchain.',
        buttonLabel: 'In Transit (Awaiting Recipient Receipt)',
        proceedButtonLabel: 'Consignment In Transit',
        canExecute: false,
        reason: 'The dispatching account cannot claim its own delivery. A different registered recipient must confirm receipt.',
      };
    }

    // Dispatched by Manufacturer (senderRole 2) -> Target is Supplier
    if (senderRole === 2) {
      if (normalizedRole === 'supplier') {
        return {
          actionKey: 'confirm_delivery_supplier',
          stageLabel: 'In Transit (From Factory)',
          pillColor: 'orange',
          actionTitle: 'Confirm Inbound Consignment Receipt',
          actionDescription: 'Confirm physical receipt of this manufacturer shipment at your warehouse. Custody will be cryptographically transferred to your supplier wallet.',
          buttonLabel: 'Sign & Confirm Warehouse Delivery Receipt',
          proceedButtonLabel: 'Proceed to Confirm Warehouse Receipt →',
          canExecute: true,
        };
      }
      if (normalizedRole === 'retailer') {
        return {
          actionKey: 'awaiting_supplier_transit',
          stageLabel: 'In Transit to Supplier',
          pillColor: 'orange',
          actionTitle: 'In Transit to Supplier Warehouse',
          actionDescription: 'This shipment is in transit from the manufacturer to the distribution supplier. The supplier must receive and dispatch it before retail delivery.',
          buttonLabel: 'In Transit to Supplier',
          proceedButtonLabel: 'In Transit to Supplier',
          canExecute: false,
          reason: 'This shipment must be received by a supplier before it can be sent to retail.',
        };
      }
    }

    // Dispatched by Supplier (senderRole 3) -> Target is Retailer (or downstream supplier)
    if (senderRole === 3) {
      if (normalizedRole === 'retailer') {
        return {
          actionKey: 'confirm_delivery_retailer',
          stageLabel: 'In Transit (To Storefront)',
          pillColor: 'orange',
          actionTitle: 'Confirm Inbound Store Delivery Receipt',
          actionDescription: 'Confirm physical receipt of this shipment from the supplier into your store inventory. Custody will be transferred to your retailer wallet.',
          buttonLabel: 'Sign & Confirm Store Delivery Receipt',
          proceedButtonLabel: 'Proceed to Confirm Store Delivery →',
          canExecute: true,
        };
      }
      if (normalizedRole === 'supplier') {
        return {
          actionKey: 'confirm_delivery_supplier',
          stageLabel: 'In Transit (Consignment)',
          pillColor: 'orange',
          actionTitle: 'Confirm Inbound Consignment Receipt',
          actionDescription: 'Confirm physical receipt of this shipment into your logistics facility.',
          buttonLabel: 'Sign & Confirm Warehouse Delivery Receipt',
          proceedButtonLabel: 'Proceed to Confirm Warehouse Receipt →',
          canExecute: true,
        };
      }
    }

    // Generic Dispatched fallback
    if (normalizedRole === 'retailer') {
      return {
        actionKey: 'confirm_delivery_retailer',
        stageLabel: 'In Transit (Dispatched)',
        pillColor: 'orange',
        actionTitle: 'Confirm Inbound Store Delivery Receipt',
        actionDescription: 'Confirm physical receipt of this shipment into your retail storefront.',
        buttonLabel: 'Sign & Confirm Store Delivery Receipt',
        proceedButtonLabel: 'Proceed to Confirm Store Delivery →',
        canExecute: true,
      };
    }

    if (normalizedRole === 'supplier') {
      return {
        actionKey: 'confirm_delivery_supplier',
        stageLabel: 'In Transit (Dispatched)',
        pillColor: 'orange',
        actionTitle: 'Confirm Inbound Consignment Receipt',
        actionDescription: 'Confirm physical receipt of this shipment at your facility.',
        buttonLabel: 'Sign & Confirm Warehouse Delivery Receipt',
        proceedButtonLabel: 'Proceed to Confirm Warehouse Receipt →',
        canExecute: true,
      };
    }

    return {
      actionKey: 'in_transit_other',
      stageLabel: 'In Transit (Dispatched)',
      pillColor: 'orange',
      actionTitle: 'Consignment In Transit',
      actionDescription: 'This product is currently in transit between supply chain partners.',
      buttonLabel: 'In Transit (Awaiting Partner)',
      proceedButtonLabel: 'Consignment In Transit',
      canExecute: false,
    };
  }

  // 5. Stage 3: Delivered (In Custody)
  if (normalizedStage === 3) {
    if (normalizedRole === 'retailer') {
      return {
        actionKey: 'mark_sold',
        stageLabel: 'Delivered (In Store Inventory)',
        pillColor: 'green',
        actionTitle: 'Finalize Retail Sale (Mark as Sold)',
        actionDescription: 'Sell this authenticated product to a consumer. This marks the product as Sold on the blockchain, permanently sealing the provenance record against counterfeit reuse.',
        buttonLabel: 'Sign & Mark Product as Sold on Blockchain',
        proceedButtonLabel: 'Proceed to Finalize Sale (Mark Sold) →',
        canExecute: true,
      };
    }

    if (normalizedRole === 'supplier') {
      return {
        actionKey: 'dispatch_to_retailer',
        stageLabel: 'Delivered (In Warehouse)',
        pillColor: 'blue',
        actionTitle: 'Dispatch Consignment to Retail Partner',
        actionDescription: 'Record outbound dispatch from warehouse to a verified retail store partner. The retailer will then confirm receipt upon arrival.',
        buttonLabel: 'Sign & Dispatch to Retail Partner',
        proceedButtonLabel: 'Proceed to Dispatch to Retailer →',
        canExecute: true,
      };
    }

    if (normalizedRole === 'manufacturer') {
      return {
        actionKey: 'in_downstream_custody',
        stageLabel: 'Delivered (In Partner Custody)',
        pillColor: 'green',
        actionTitle: 'In Downstream Partner Custody',
        actionDescription: 'This product has been delivered to downstream supply chain inventory.',
        buttonLabel: 'In Downstream Custody',
        proceedButtonLabel: 'In Downstream Custody',
        canExecute: false,
      };
    }
  }

  // Default / Unregistered fallback
  return {
    actionKey: 'generic_custody_action',
    stageLabel: 'Active Product',
    pillColor: 'blue',
    actionTitle: 'Submit Custody Action',
    actionDescription: 'Submit the next verified on-chain custody transition from your linked wallet.',
    buttonLabel: 'Sign & Submit Custody Action',
    proceedButtonLabel: 'Proceed to Update Custody →',
    canExecute: true,
  };
}
