# Transaction location

Every new demo registration, receipt, dispatch, sale, and recall captures location at submission through `src/services/index.ts`. There is one measurement per operation, shared across its items. Repeating an accepted request key preserves its original location.

- Device permission granted: retain coordinates, reported accuracy, capture time, and a best-effort readable area/address.
- Device unavailable or permission denied: snapshot the acting facility's profile address and identify it as a fallback.
- No usable profile address: explicitly record location unavailable.
- Existing events without a saved location: display "Location was not recorded for this event". Never infer old event locations from today's facility profile.

The product journey, operation details, sale receipt, and CSV manifest expose the saved record. The current custodian's profile address is displayed separately and can change without rewriting history. Location does not choose the custodian; confirmed receiving does.

Device capture has a finite deadline, including unanswered permission prompts. Reverse geocoding has a separate timeout; coordinates remain available if lookup fails. Late device callbacks cannot replace an already submitted fallback. Business location does not use IP geolocation as a store address.

The browser requires HTTPS and permission for location, which is separate from camera access. Coordinates are sent to BigDataCloud for address lookup. Results may identify only an area and are not independent proof of the product's physical presence. All enterprise records remain local demo data until the live service integration milestone. Native location permissions and provider suitability at production scale still require that milestone's validation.
