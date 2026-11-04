import os
from PIL import Image, ImageDraw, ImageFont

diagrams_dir = os.path.abspath("scratch/diagrams")
os.makedirs(diagrams_dir, exist_ok=True)

def get_font(size, bold=False):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        return ImageFont.load_default()

def draw_rounded_card(draw, xy, fill, outline, width=2, radius=12):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([int(x0), int(y0), int(x1), int(y1)], radius=int(radius), fill=fill, outline=outline, width=int(width))

def draw_arrow(draw, start, end, color=(71, 85, 105), width=3):
    x0, y0 = start
    x1, y1 = end
    draw.line([int(x0), int(y0), int(x1), int(y1)], fill=color, width=int(width))
    # Arrow head
    if x1 > x0:  # pointing right
        draw.polygon([(x1, y1), (x1 - 10, y1 - 6), (x1 - 10, y1 + 6)], fill=color)
    elif y1 > y0:  # pointing down
        draw.polygon([(x1, y1), (x1 - 6, y1 - 10), (x1 + 6, y1 - 10)], fill=color)

# =========================================================================
# 1. RETAIL POS BARCODE CHECKOUT & RECEIPT WORKFLOW DIAGRAM
# =========================================================================
def create_pos_diagram():
    W, H = 1300, 680
    img = Image.new("RGB", (W, H), (248, 250, 252)) # #F8FAFC
    draw = ImageDraw.Draw(img)

    # Title Banner
    draw.rectangle([0, 0, W, 70], fill=(30, 58, 138)) # #1E3A8A
    f_title = get_font(24, bold=True)
    f_sub = get_font(13, bold=False)
    draw.text((30, 15), "SmartScan Retail Point-of-Sale (POS) & Checkout Lifecycle", font=f_title, fill=(255, 255, 255))
    draw.text((30, 45), "Authoritative On-Chain Blockchain Validation & Cryptographic Warranty Receipt Flow", font=f_sub, fill=(147, 197, 253))

    f_card_title = get_font(16, bold=True)
    f_body = get_font(12, bold=False)
    f_badge = get_font(11, bold=True)

    # Step 1: Barcode / QR Ingestion
    c1 = [40, 120, 310, 590]
    draw_rounded_card(draw, c1, fill=(255, 255, 255), outline=(37, 99, 235), width=2)
    draw.rectangle([c1[0], c1[1], c1[2], c1[1] + 42], fill=(239, 246, 255))
    draw.text((c1[0] + 16, c1[1] + 12), "1. Scan Ingestion", font=f_card_title, fill=(30, 58, 138))
    
    lines_c1 = [
        ("Hardware Barcode Scanner", True),
        ("Standard USB/BT wedge scanner", False),
        ("Instant scan on product carton", False),
        ("Sends [Enter] keystroke (<50ms)", False),
        ("", False),
        ("Universal Smartphone QR", True),
        ("URL: smartscan/verify/<serial>", False),
        ("Compatible with native camera", False),
        ("", False),
        ("Auto-Focus Wedge Input", True),
        ("Cashier does not touch mouse", False),
        ("Fast client-side parse & sanitization", False)
    ]
    y = c1[1] + 55
    for text, bold in lines_c1:
        draw.text((c1[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    # Arrow 1 -> 2
    draw_arrow(draw, (c1[2], 340), (c1[2] + 45, 340))

    # Step 2: Verification Engine
    c2 = [355, 120, 625, 590]
    draw_rounded_card(draw, c2, fill=(255, 255, 255), outline=(13, 148, 136), width=2)
    draw.rectangle([c2[0], c2[1], c2[2], c2[1] + 42], fill=(240, 253, 250))
    draw.text((c2[0] + 16, c2[1] + 12), "2. Authoritative Engine", font=f_card_title, fill=(15, 118, 110))

    lines_c2 = [
        ("Ethereum Sepolia RPC Query", True),
        ("Direct client-side node call", False),
        ("Contract: IdenteefiV2.sol", False),
        ("Method: getProduct(serial)", False),
        ("", False),
        ("Enterprise REST POS API", True),
        ("Endpoint: POST /api/pos/checkout", False),
        ("Dual-channel backup verification", False),
        ("", False),
        ("Immediate Latency: <250ms", True),
        ("Zero external API dependencies", False),
        ("Checks active registered role", False)
    ]
    y = c2[1] + 55
    for text, bold in lines_c2:
        draw.text((c2[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    # Arrow 2 -> 3
    draw_arrow(draw, (c2[2], 340), (c2[2] + 45, 340))

    # Step 3: Decision & State Checks
    c3 = [670, 120, 940, 590]
    draw_rounded_card(draw, c3, fill=(255, 255, 255), outline=(217, 119, 6), width=2)
    draw.rectangle([c3[0], c3[1], c3[2], c3[1] + 42], fill=(254, 243, 199))
    draw.text((c3[0] + 16, c3[1] + 12), "3. Decision & Fraud Checks", font=f_card_title, fill=(180, 83, 9))

    # Decision Badges inside card 3
    # Case A: Authentic
    draw_rounded_card(draw, [c3[0] + 12, c3[1] + 55, c3[2] - 12, c3[1] + 145], fill=(240, 253, 244), outline=(16, 185, 129), width=1, radius=8)
    draw.text((c3[0] + 20, c3[1] + 62), "🟢 AUTHENTIC / READY TO SELL", font=f_badge, fill=(5, 150, 105))
    draw.text((c3[0] + 20, c3[1] + 82), "Stage 3: Delivered to Store", font=get_font(11, True), fill=(15, 23, 42))
    draw.text((c3[0] + 20, c3[1] + 102), "Audio: 880Hz + 1318Hz Cash Chime", font=get_font(10.5), fill=(71, 85, 105))
    draw.text((c3[0] + 20, c3[1] + 122), "Status: APPROVED FOR RING-UP", font=get_font(10.5, True), fill=(5, 150, 105))

    # Case B: Already Sold
    draw_rounded_card(draw, [c3[0] + 12, c3[1] + 160, c3[2] - 12, c3[1] + 250], fill=(254, 242, 242), outline=(239, 68, 68), width=1, radius=8)
    draw.text((c3[0] + 20, c3[1] + 167), "🚨 FRAUD ALERT / ALREADY SOLD", font=f_badge, fill=(220, 38, 38))
    draw.text((c3[0] + 20, c3[1] + 187), "Serial was already burned as sold", font=get_font(11, True), fill=(15, 23, 42))
    draw.text((c3[0] + 20, c3[1] + 207), "Audio: 220Hz Warning Buzzer", font=get_font(10.5), fill=(71, 85, 105))
    draw.text((c3[0] + 20, c3[1] + 227), "Status: RESALE / COUNTERFEIT CLONE", font=get_font(10.5, True), fill=(220, 38, 38))

    # Case C: Unregistered
    draw_rounded_card(draw, [c3[0] + 12, c3[1] + 265, c3[2] - 12, c3[1] + 355], fill=(255, 241, 242), outline=(225, 29, 72), width=1, radius=8)
    draw.text((c3[0] + 20, c3[1] + 272), "❌ UNREGISTERED IDENTIFIER", font=f_badge, fill=(225, 29, 72))
    draw.text((c3[0] + 20, c3[1] + 292), "Serial absent from blockchain registry", font=get_font(11, True), fill=(15, 23, 42))
    draw.text((c3[0] + 20, c3[1] + 312), "Audio: 220Hz Warning Buzzer", font=get_font(10.5), fill=(71, 85, 105))
    draw.text((c3[0] + 20, c3[1] + 332), "Status: SUSPECTED FAKE ITEM", font=get_font(10.5, True), fill=(225, 29, 72))

    # Case D: In Transit
    draw_rounded_card(draw, [c3[0] + 12, c3[1] + 370, c3[2] - 12, c3[1] + 450], fill=(255, 251, 235), outline=(245, 158, 11), width=1, radius=8)
    draw.text((c3[0] + 20, c3[1] + 377), "⚠️ IN TRANSIT (STAGE 2)", font=f_badge, fill=(180, 83, 9))
    draw.text((c3[0] + 20, c3[1] + 397), "Item dispatched but not received", font=get_font(11, True), fill=(15, 23, 42))
    draw.text((c3[0] + 20, c3[1] + 417), "Confirm delivery before selling", font=get_font(10.5), fill=(71, 85, 105))

    # Arrow 3 -> 4
    draw_arrow(draw, (c3[2], 340), (c3[2] + 45, 340))

    # Step 4: Finalize Sale & Customer Receipt
    c4 = [985, 120, 1255, 590]
    draw_rounded_card(draw, c4, fill=(255, 255, 255), outline=(5, 150, 105), width=2)
    draw.rectangle([c4[0], c4[1], c4[2], c4[1] + 42], fill=(236, 253, 245))
    draw.text((c4[0] + 16, c4[1] + 12), "4. Sale Finalization & Receipt", font=f_card_title, fill=(4, 120, 87))

    lines_c4 = [
        ("1-Tap Blockchain Finalize", True),
        ("Contract: markSold()", False),
        ("Burns passport into terminal Stage 4", False),
        ("Permanent seal against resale reuse", False),
        ("", False),
        ("80mm Thermal Receipt", True),
        ("Standard POS printer compatible", False),
        ("Epson, Star Micronics, Citizen", False),
        ("Unique Cryptographic Receipt ID", False),
        ("", False),
        ("Consumer QR Seal", True),
        ("Customer scans receipt with phone", False),
        ("Displays authentic proof & warranty", False)
    ]
    y = c4[1] + 55
    for text, bold in lines_c4:
        draw.text((c4[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    # Footer banner
    draw.rectangle([0, H - 45, W, H], fill=(241, 245, 249))
    draw.text((W // 2 - 270, H - 32), "SmartScan Decentralized Anti-Counterfeit Platform · Phase 3 POS Specification", font=get_font(12, bold=True), fill=(100, 116, 139))

    out_path = os.path.join(diagrams_dir, "pos_checkout.png")
    img.save(out_path, "PNG")
    print(f"Created: {out_path}")

# =========================================================================
# 2. WAREHOUSE BATCH SCANNING & PACKAGING PIPELINE DIAGRAM
# =========================================================================
def create_batch_diagram():
    W, H = 1300, 680
    img = Image.new("RGB", (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Title Banner
    draw.rectangle([0, 0, W, 70], fill=(15, 23, 42)) # Slate 900
    f_title = get_font(24, bold=True)
    f_sub = get_font(13, bold=False)
    draw.text((30, 15), "SmartScan Warehouse High-Throughput Batch Ingestion & Packaging Pipeline", font=f_title, fill=(255, 255, 255))
    draw.text((30, 45), "Continuous Warehouse Scanning, Web Audio Synthesizer, Manifest Queues & 4×6″ Thermal Label Standard", font=f_sub, fill=(148, 163, 184))

    f_card_title = get_font(16, bold=True)

    # 4 Columns
    # Col 1: Factory Floor & 4x6 Label
    c1 = [40, 120, 310, 590]
    draw_rounded_card(draw, c1, fill=(255, 255, 255), outline=(30, 58, 138), width=2)
    draw.rectangle([c1[0], c1[1], c1[2], c1[1] + 42], fill=(239, 246, 255))
    draw.text((c1[0] + 16, c1[1] + 12), "1. Packaging & Labeling", font=f_card_title, fill=(30, 58, 138))

    lines_c1 = [
        ("One-Flow Mint & Dispatch", True),
        ("Auto-dispatch on registration", False),
        ("Generates canonical SS-UUID", False),
        ("Atomic 1-click execution", False),
        ("", False),
        ("4×6″ Physical Thermal Label", True),
        ("Standard shipping label standard", False),
        ("Zebra, Rollo, Brother, Dymo 4XL", False),
        ("High-density Level H QR Code", False),
        ("Human-readable monospace serial", False),
        ("", False),
        ("Universal Smartphone URL", True),
        ("smart-scan-ten.vercel.app/verify/..", False),
        ("Works with any mobile camera", False)
    ]
    y = c1[1] + 55
    for text, bold in lines_c1:
        draw.text((c1[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c1[2], 340), (c1[2] + 45, 340))

    # Col 2: Warehouse Receiving Dock
    c2 = [355, 120, 625, 590]
    draw_rounded_card(draw, c2, fill=(255, 255, 255), outline=(13, 148, 136), width=2)
    draw.rectangle([c2[0], c2[1], c2[2], c2[1] + 42], fill=(240, 253, 250))
    draw.text((c2[0] + 16, c2[1] + 12), "2. Continuous Batch Mode", font=f_card_title, fill=(15, 118, 110))

    lines_c2 = [
        ("Camera Stays Permanently Open", True),
        ("No closing or navigating away", False),
        ("Operator scans 15-20 cartons/min", False),
        ("High-speed dock receiving throughput", False),
        ("", False),
        ("Smart Repeat Debouncer", True),
        ("Prevents duplicate frame scans", False),
        ("Debounce interval: 2,000ms", False),
        ("Debounces against active queue", False),
        ("", False),
        ("Auto Background Location", True),
        ("IP fast-path resolved in ~180ms", False),
        ("Device GPS refinement in background", False),
        ("Zero manual click requirement", False)
    ]
    y = c2[1] + 55
    for text, bold in lines_c2:
        draw.text((c2[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c2[2], 340), (c2[2] + 45, 340))

    # Col 3: Audio Synthesizer & Feedback
    c3 = [670, 120, 940, 590]
    draw_rounded_card(draw, c3, fill=(255, 255, 255), outline=(99, 102, 241), width=2)
    draw.rectangle([c3[0], c3[1], c3[2], c3[1] + 42], fill=(238, 242, 255))
    draw.text((c3[0] + 16, c3[1] + 12), "3. Audio Feedback Synth", font=f_card_title, fill=(67, 56, 202))

    lines_c3 = [
        ("Native HTML5 Web Audio API", True),
        ("Zero external audio dependencies", False),
        ("Zero MP3 file downloads", False),
        ("Instant synthesis in browser", False),
        ("", False),
        ("880Hz Success Chime (C#6)", True),
        ("Audible beep on genuine item", False),
        ("Immediate positive confirmation", False),
        ("Worker scans without looking down", False),
        ("", False),
        ("320Hz Warning Tone (Sawtooth)", True),
        ("Triggers on duplicate carton", False),
        ("Alerts on unregistered/fake serial", False),
        ("Audible fraud alarm for warehouse", False)
    ]
    y = c3[1] + 55
    for text, bold in lines_c3:
        draw.text((c3[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c3[2], 340), (c3[2] + 45, 340))

    # Col 4: Manifest Queue & Handover
    c4 = [985, 120, 1255, 590]
    draw_rounded_card(draw, c4, fill=(255, 255, 255), outline=(5, 150, 105), width=2)
    draw.rectangle([c4[0], c4[1], c4[2], c4[1] + 42], fill=(236, 253, 245))
    draw.text((c4[0] + 16, c4[1] + 12), "4. Manifest & Handover", font=f_card_title, fill=(4, 120, 87))

    lines_c4 = [
        ("Inbound Scanned Batch List", True),
        ("Live table of all scanned units", False),
        ("Shows item name, brand & serial", False),
        ("Real-time count & verification", False),
        ("", False),
        ("1-Tap Handover Navigation", True),
        ("Routes to UpdateProductDetails", False),
        ("Pre-populates verified serial", False),
        ("Chained handover downstream", False),
        ("", False),
        ("CSV Manifest Export", True),
        ("Timestamped CSV download", False),
        ("Ready for SAP/WMS/ERP intake", False),
        ("Audit trail for logistics team", False)
    ]
    y = c4[1] + 55
    for text, bold in lines_c4:
        draw.text((c4[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    # Footer banner
    draw.rectangle([0, H - 45, W, H], fill=(241, 245, 249))
    draw.text((W // 2 - 280, H - 32), "SmartScan Decentralized Anti-Counterfeit Platform · Phase 2 Warehouse Specification", font=get_font(12, bold=True), fill=(100, 116, 139))

    out_path = os.path.join(diagrams_dir, "batch_manifest.png")
    img.save(out_path, "PNG")
    print(f"Created: {out_path}")

# =========================================================================
# 3. ENTERPRISE ENCAPSULATED SUBACCOUNTS & GAS TREASURY DIAGRAM
# =========================================================================
def create_subaccounts_diagram():
    W, H = 1300, 680
    img = Image.new("RGB", (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Title Banner
    draw.rectangle([0, 0, W, 70], fill=(15, 23, 42)) # #0F172A
    f_title = get_font(24, bold=True)
    f_sub = get_font(13, bold=False)
    draw.text((30, 15), "SmartScan Enterprise Encapsulated Subaccounts & Autonomous Wallets", font=f_title, fill=(255, 255, 255))
    draw.text((30, 45), "Option B Architecture: AES-256-GCM Keystore Vault, Automated Gas Treasury Faucet & Headless Auto-Signing", font=f_sub, fill=(56, 189, 248))

    f_card_title = get_font(16, bold=True)

    # Col 1: Keystore Provisioning
    c1 = [40, 120, 310, 590]
    draw_rounded_card(draw, c1, fill=(255, 255, 255), outline=(59, 130, 246), width=2)
    draw.rectangle([c1[0], c1[1], c1[2], c1[1] + 42], fill=(239, 246, 255))
    draw.text((c1[0] + 16, c1[1] + 12), "1. Vault Provisioning", font=f_card_title, fill=(30, 58, 138))

    lines_c1 = [
        ("Subaccount Creation API", True),
        ("POST /api/subaccounts/create", False),
        ("Facility Name & Code assigned", False),
        ("Bound to parent organization", False),
        ("", False),
        ("Automated Key Generation", True),
        ("Ethers random EVM keypair", False),
        ("Generates unique wallet address", False),
        ("No staff seed phrases or setup", False),
        ("", False),
        ("AES-256-GCM Encryption", True),
        ("16-byte cryptorandom IV", False),
        ("128-bit authentication tag", False),
        ("Tamper-proof PostgreSQL store", False),
        ("Initial status: pending_approval", False)
    ]
    y = c1[1] + 55
    for text, bold in lines_c1:
        draw.text((c1[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c1[2], 340), (c1[2] + 45, 340))

    # Col 2: On-Chain Role & Gas Faucet
    c2 = [355, 120, 625, 590]
    draw_rounded_card(draw, c2, fill=(255, 255, 255), outline=(16, 185, 129), width=2)
    draw.rectangle([c2[0], c2[1], c2[2], c2[1] + 42], fill=(236, 253, 245))
    draw.text((c2[0] + 16, c2[1] + 12), "2. Role & Gas Faucet", font=f_card_title, fill=(4, 120, 87))

    lines_c2 = [
        ("Admin Approval Action", True),
        ("POST /api/subaccounts/:id/approve", False),
        ("Admin reviews facility identity", False),
        ("Single-click onboarding trigger", False),
        ("", False),
        ("On-Chain Role Grant", True),
        ("Contract Owner calls grantRole()", False),
        ("Sets Manufacturer/Supplier/Retailer", False),
        ("Permits authorized state transitions", False),
        ("", False),
        ("Automated Gas Treasury", True),
        ("Treasury balance: ~0.0777 ETH", False),
        ("Disburses 0.005 Sepolia ETH", False),
        ("Status transitions to 'active'", False),
        ("Auto-topup when bal < 0.0005 ETH", False)
    ]
    y = c2[1] + 55
    for text, bold in lines_c2:
        draw.text((c2[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c2[2], 340), (c2[2] + 45, 340))

    # Col 3: Headless Fast Signing
    c3 = [670, 120, 940, 590]
    draw_rounded_card(draw, c3, fill=(255, 255, 255), outline=(245, 158, 11), width=2)
    draw.rectangle([c3[0], c3[1], c3[2], c3[1] + 42], fill=(254, 243, 199))
    draw.text((c3[0] + 16, c3[1] + 12), "3. Headless Auto-Sign", font=f_card_title, fill=(180, 83, 9))

    lines_c3 = [
        ("Client Operation Trigger", True),
        ("POS, Scanner or Custody Hub", False),
        ("POST /api/custody/auto-execute", False),
        ("Action: dispatch | confirm | sell", False),
        ("", False),
        ("Ephemeral In-Memory Signer", True),
        ("AES-256-GCM decrypted in RAM", False),
        ("Ephemeral Wallet instance created", False),
        ("Private key never written to disk", False),
        ("Auth tag verified before signing", False),
        ("", False),
        ("Zero-Friction Execution", True),
        ("Signing completed in <5ms", False),
        ("0 MetaMask browser popups", False),
        ("0 seed phrase exposure to staff", False),
        ("Native blockchain non-repudiation", False)
    ]
    y = c3[1] + 55
    for text, bold in lines_c3:
        draw.text((c3[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    draw_arrow(draw, (c3[2], 340), (c3[2] + 45, 340))

    # Col 4: On-Chain Finality & Verification
    c4 = [985, 120, 1255, 590]
    draw_rounded_card(draw, c4, fill=(255, 255, 255), outline=(139, 92, 246), width=2)
    draw.rectangle([c4[0], c4[1], c4[2], c4[1] + 42], fill=(245, 243, 255))
    draw.text((c4[0] + 16, c4[1] + 12), "4. Sepolia Finality", font=f_card_title, fill=(109, 40, 217))

    lines_c4 = [
        ("Ethereum Sepolia Broadcast", True),
        ("Tx signed with facility address", False),
        ("Broadcast to publicnode RPC", False),
        ("1-block confirmation wait", False),
        ("", False),
        ("Audit Trail & Telemetry", True),
        ("Logged in PostgreSQL DB", False),
        ("Disbursement audit recorded", False),
        ("Subaccount balance tracked", False),
        ("", False),
        ("Universal Verification", True),
        ("SmartScan verify URL updated", False),
        ("Displays authentic facility signer", False),
        ("Warranty certificate issued", False),
        ("Enterprise-grade security achieved", False)
    ]
    y = c4[1] + 55
    for text, bold in lines_c4:
        draw.text((c4[0] + 16, y), text, font=get_font(12, bold=bold), fill=(15, 23, 42) if bold else (71, 85, 105))
        y += 24

    # Footer banner
    draw.rectangle([0, H - 45, W, H], fill=(241, 245, 249))
    draw.text((W // 2 - 310, H - 32), "SmartScan Decentralized Anti-Counterfeit Platform · Phase 4 Enterprise Subaccounts Specification", font=get_font(12, bold=True), fill=(100, 116, 139))

    out_path = os.path.join(diagrams_dir, "subaccounts_vault.png")
    img.save(out_path, "PNG")
    print(f"Created: {out_path}")

if __name__ == '__main__':
    create_pos_diagram()
    create_batch_diagram()
    create_subaccounts_diagram()
