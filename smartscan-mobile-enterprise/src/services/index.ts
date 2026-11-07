import type { EnterpriseService } from "./enterprise";
import { demoService } from "../dev/service";
import { captureTransactionLocation } from "../platform/location";
import { liveService } from './live';
import { dataMode } from './config';
export { isLive } from './config';

// UI features depend on this boundary. A future live implementation is selected
// here explicitly; unavailable live services never fall back to sample data.
function configuredService(): EnterpriseService {
  if (dataMode === 'live') return liveService;
  if (dataMode !== "demo") {
    throw new Error(
      "Live enterprise services are not configured for this build.",
    );
  }
  return demoService;
}

export const enterpriseService: EnterpriseService = {
  snapshot: () => configuredService().snapshot(),
  products: (...args) => configuredService().products(...args),
  submit: async (input) => {
    const service = configuredService();
    const state = await service.snapshot();
    const previous = state.operations.find((op) => op.requestKey === input.requestKey);
    // An idempotent retry must preserve its original measurement.
    if (previous) return previous;
    if (state.scenario === "offline" || navigator.onLine === false)
      throw new Error("You’re offline. Reconnect before recording an action.");
    const facility = state.facilities.find((f) => f.id === input.workspace.facilityId);
    const location = await captureTransactionLocation(facility?.location);
    return service.submit({ ...input, location });
  },
  createProduct: (...args) => configuredService().createProduct(...args),
  saveDraft: (draft) => configuredService().saveDraft(draft),
  setFacilityStatus: (...args) =>
    configuredService().setFacilityStatus(...args),
  createAccount: (...args) => configuredService().createAccount(...args),
  createFacility: (...args) => configuredService().createFacility(...args),
  reset: (scenario) => configuredService().reset(scenario),
};
