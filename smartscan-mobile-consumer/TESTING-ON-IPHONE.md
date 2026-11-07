# Test the consumer app on iPhone

Safari and Home Screen web apps require a trusted HTTPS connection to open the camera. An HTTP LAN address such as `http://172.20.10.5:5176` cannot use the camera, even when Safari has camera permission. Photo uploads and manual entry still work over HTTP.

1. In `smartscan-mobile-consumer`, run `npm run dev:https`. Keep your computer and phone on the same network. The terminal prints the current addresses; HTTPS uses port **5177**, and the certificate download uses port **5178**.
2. On the iPhone, open `http://172.20.10.5:5178/smartscan-dev-ca.cer` in Safari and allow the profile download. Use the IP printed by the command if it has changed.
3. Go to **Settings > General > VPN & Device Management**, select **SmartScan Local Development**, and install the downloaded profile.
4. Go to **Settings > General > About > Certificate Trust Settings** and enable full trust for **SmartScan Local Development**.
5. Open **https://172.20.10.5:5177** in Safari. Tap **Enable camera** and allow camera access. The page must load without a certificate warning.
6. Remove the old HTTP Home Screen shortcut and add this HTTPS page using **Share > Add to Home Screen**. Open it and allow camera access if asked; the Home Screen app can have its own permission. Re-adding also applies the updated full-screen/status-bar metadata.

If the phone cannot connect, allow Node.js through Windows Firewall for your private testing network. Restart `npm run dev:https` after your computer's IP changes; it creates a new server certificate for the current addresses. The development CA stays the same, so it does not need reinstalling until it expires (one year).

The command stores its CA and private key in `~/.smartscan/dev-certificates`, outside the app's served files. Only the public certificate is available through the download endpoint. It does not install a certificate on your computer. Remove the SmartScan profile from the iPhone when local HTTPS testing is finished. These certificates are for local development; hosted builds should use their hosting provider's HTTPS certificate.

Check the scanner in both Safari and the Home Screen app: live rear camera, camera flip, an actual product QR code, permission denied then retry, photo upload, manual entry, and leaving Scan while the camera is active. Flashlight requires a camera/browser that exposes torch support. Check that the QR frame stays above the hint and that content clears the Dynamic Island and home indicator.

## Top blur or a blank band below the app

The app deliberately omits `apple-mobile-web-app-status-bar-style=black-translucent`. Recent iOS versions add a system overlay in this deprecated mode and can expose a viewport shorter than the screen, leaving a bottom band. The normal status bar uses the page's theme color, with the content below it. See [WebKit's guidance](https://bugs.webkit.org/show_bug.cgi?id=317153#c2) and the [reported bottom-gap issue](https://bugs.webkit.org/show_bug.cgi?id=313800).

If you installed an earlier version with the translucent setting, remove its Home Screen shortcut, open the updated HTTPS page in Safari, and add it again. Reloading alone does not refresh the status-bar mode saved with the old shortcut. The existing certificate remains valid; do not reinstall it. After re-adding, check the top heading and bottom navigation, rotate the phone, and open and close the manual-entry keyboard to confirm the app still fills the available screen.
