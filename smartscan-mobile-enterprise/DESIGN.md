# Enterprise screen blueprint

The consumer app defines the visual family. Enterprise adds operational context, explicit action review, and recoverable work. The shared palette uses navy `#000336`, raised indigo `#303a80`, blue `#4656a6`, and pale surfaces `#dfe5ff` / `#f0f3ff`.

## Screen structure

```text
Welcome: choose an explicitly labelled demo role
  Workspace shell: demo indicator + business wordmark + active facility
    Home / Overview
      Role-specific primary action
      Three actionable counts
      Arriving items / drafts / approval queue
      Recent operations
    Products / Inventory / Accounts
      Search and filters -> record detail -> eligible action
    Scan / Operations
      Explicit task -> capture -> review -> saved operation
    More
      Business details, activity, feedback preferences, scenarios, leave demo
```

Business-role navigation is Home / Products-or-Inventory / Scan / More. Admin navigation is Overview / Accounts / Operations / More. Facility context is visible across every screen; switching locations changes scoped lists and actions. Product details preserve identity and show registration independently of physical custody.

## Operational flows and states

| Flow | Input/review | Result | Recovery/exception |
| --- | --- | --- | --- |
| Register | Saved one-item form, photo, generated serial, facility | Persisted registration operation, then QR/label and dispatch | Keep the original serial; draft remains available if submission cannot proceed |
| Receive | Session of codes, exact acting facility, physical arrival confirmation | Received custody at that facility | Wrong recipient, revoked facility, recall, duplicate, unknown serial, offline, partial completion |
| Dispatch | Held products; open destination by default, optional named facility | In-transit items awaiting receipt | Recheck custody and destination; preserve completed items in partial sessions |
| Sell | Received stock held by this retailer; direct single-item sale or select individual session items at review | Recorded sale and printable demo receipt | Unselected items stay in custody/session; no pre-sale completed receipt; reprint without recording another sale |
| Recall | Authorized actor, product, reason, consequence | Recalled item, retained history | Further normal custody actions blocked |
| Facility administration | Business role, facility code/location, explicit approval or revocation | Readiness state and administration activity | Revoked facilities do not silently reactivate |

All submitted demo operations have stable identity and per-item status. Captured codes are not confirmed operations. Pending work is discoverable from Home and Activity. The interface never uses an overall success message when some items failed.

## Mobile composition

Use rounded white surfaces, restrained shadows, Plus Jakarta Sans, consistent Lucide strokes, pill actions, and a quiet four-item bottom bar. Keep the main inventory as a searchable list. Product passports provide a richer image/identity card and a vertical custody timeline.

Home uses a pale navy hero and a single main action. The scanner uses the consumer-style navy camera panel, a clear viewfinder, and a readable instruction pill. Capture feedback occupies its own space; it must not obscure the review action. Longer queues scroll, while review remains within the available viewport above navigation.

Short choices and confirmations use focus-trapped sheets with Escape and focus restoration. Long registrations, scanning sessions, and action reviews use full screens. Preserve list search/filter/scroll position on return from details.

## Motion and safe areas

Use brief screen entrances, sheet entrances/dismissal, and a quick sliding hint icon when the camera becomes ready. Stable camera imagery has no looping decorative animation. Respect reduced motion. Audio and haptics distinguish capture, exception, and confirmed completion.

Only the root owns dynamic viewport height. Safe-area padding belongs to the top context strip and bottom navigation. Avoid a translucent status-bar overlay, overlapping viewfinders, and a second canvas height that creates a bottom gap. Test small phones, landscape, keyboard-open sheets, and native hardware separately.

## Current boundary

The interface supports all four demo workspaces. Live authentication, facility/custody read models, server operation recovery, chain confirmation, and real receipt records remain integration work. The existing consumer app is unchanged. Direct printer connections, a geographic journey map, staff membership permissions, payments/refunds, and consumer-report synchronization are follow-up scope.
