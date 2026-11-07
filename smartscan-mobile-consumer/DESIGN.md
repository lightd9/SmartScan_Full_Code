# Mobile interface reference

The supplied three-screen reference is the visual source of truth. Keep this composition when changing content or adding features.

| Reference detail | SmartScan implementation |
| --- | --- |
| Large rounded upper panel with a deep blue, indigo, and mist-blue background | Camera panel on Scan. Live video fills the same panel once enabled. |
| White heading over the upper panel, translucent pill, inset white card | Scan heading, QR positioning hint, and camera instruction/action card. |
| Services with small white pills | Shortcuts: Upload from photos and Enter serial manually. |
| Quiet, four-item bottom bar | Scan, History, Report, More. Fixed outside screen content. |
| Circular back button, left-aligned title, raised segmented switch | Shared product result and History header. Carousel/list selection remains in place. |
| Tall white card with a thin white rim and a large image fading into its body | Product photo, verification verdict, metadata, dark pill action, and two circular actions. |
| Neighboring card visible at the edge | Scroll-snap carousel with one card per saved scan. Stops at the first and last scan; no duplicate cards or wrapping. |
| Pale map and concentric blue/gray markers | Interactive grayscale OpenStreetMap, recorded supply-chain stops, connecting route, and fit/zoom controls. |
| Low stack of horizontal cards with fading thumbnails | History list overlays the lower map. Its handle expands the list; selecting a product returns to its card. |

Typography uses Plus Jakarta Sans, with medium/semibold headings, approximately 20–24px screen/card headings, 29–34px hero headings, and restrained supporting text. Use the CSS tokens for grayscale surfaces, pale blue badges, soft shadows, and deep blue gradient buttons. Cards use approximately 31–43px corners; controls use circles or full pills.

The accent palette is anchored at `--accent: #000336`, with `#303a80` for raised gradient surfaces, `#4656a6` for smaller accent details, `#dfe5ff` for badges, and `#f0f3ff` for subtle selected surfaces. Primary actions, active navigation, enabled switches, and the scan hint icon share the deep blue treatment. Use white on dark accents and navy on pale blue surfaces. The scanner hint has a sufficiently opaque white backing to remain readable over both the blue backdrop and live camera video. Warning and error states retain their warm red/brown colors and explicit labels.

Scan must remain non-scrollable. At small heights, shorten the viewfinder and reduce supporting content before compromising controls or navigation. Report, More, the history list, and sheets may scroll. Browser mobile viewports fill the available screen; desktop previews retain the rounded phone canvas.

## Data and interactions

- An error must never produce an authentic result. Live blockchain state controls the verdict and supply-chain history. Registry-only responses explicitly say that live verification is unavailable.
- No sample products or fabricated coordinates are inserted into normal history. Missing product images use a neutral product-passport placeholder.
- Recorded coordinates are used directly. Text-only facility addresses are resolved through Photon and marked approximate. Unavailable locations remain available as text in the journey sheet.
- Reports are saved locally and can be downloaded. There is currently no report-submission endpoint in the backend; do not imply delivery to a manufacturer.
- Camera streams close when leaving Scan or switching cameras. Flashlight state changes only if supported hardware accepts the request.
- Sheets trap focus, support Escape, and restore focus. Buttons have descriptive labels; reduced-motion preferences disable animation.

## Motion

Use brief motion to explain state changes: 140ms feedback, 240–280ms entrances, and 180ms sheet dismissal. Tabs reveal the new screen once; the previous camera screen unmounts immediately so transitions do not prolong camera access. History's selector slides between its two positions, list entrances stagger by at most 96ms, and photos fade only after loading. The scan hint retains its quick slide when live scanning starts.

Keep live camera imagery steady. Do not add ambient loops or bounce effects. New motion uses opacity and transforms without changing control hit areas. Sheets retain their focus trap until dismissal finishes; form submission and navigation actions proceed immediately. Respect `prefers-reduced-motion` for CSS and JavaScript animations, including immediate sheet dismissal.

## Browser review

Run `npm run dev` in this directory and open http://localhost:5175 in a mobile viewport. No native build is necessary. Review the initial camera state, permission denied state, manual entry, a real QR photo, result verdicts, carousel first/last boundaries, list selection, route changes, reports, and More preferences. Verify Scan at 390×844, 375×667, 320×568, and landscape. Device hardware is still needed to confirm actual flashlight behavior.
