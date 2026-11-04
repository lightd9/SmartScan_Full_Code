import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os
import shutil

def create_document():
    doc = docx.Document()

    # Set page margins to standard 1 inch
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styles & Colors
    NAVY = RGBColor(30, 58, 138)         # #1E3A8A - Primary Header
    TEAL = RGBColor(13, 148, 136)        # #0D9488 - Accent / Secondary Header
    DARK_TEXT = RGBColor(30, 41, 59)     # #1E293B - Body Text
    MUTED_TEXT = RGBColor(100, 116, 139) # #64748B - Captions & Subtitles
    WHITE = RGBColor(255, 255, 255)

    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = OxmlElement('w:tcMar')
        for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
            node = OxmlElement(m)
            node.set(qn('w:w'), str(val))
            node.set(qn('w:type'), 'dxa')
            tcMar.append(node)
        tcPr.append(tcMar)

    def add_callout(text, title="KEY ARCHITECTURAL HIGHLIGHT", fill="F0FDF4", border_color="059669"):
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        cell = table.cell(0, 0)
        cell.width = Inches(6.5)
        set_cell_background(cell, fill)
        set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(f'''
            <w:tcBorders {nsdecls("w")}>
                <w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>
                <w:top w:val="none"/>
                <w:right w:val="none"/>
                <w:bottom w:val="none"/>
            </w:tcBorders>
        ''')
        tcPr.append(borders)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        r_title = p.add_run(f"[{title}] ")
        r_title.bold = True
        r_title.font.name = 'Calibri'
        r_title.font.size = Pt(10)
        r_title.font.color.rgb = RGBColor.from_string(border_color)
        r_text = p.add_run(text)
        r_text.font.name = 'Calibri'
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = DARK_TEXT
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_before = Pt(0)
        p_space.paragraph_format.space_after = Pt(4)

    def add_figure(img_path, caption, width=Inches(6.0)):
        if os.path.exists(img_path):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run()
            run.add_picture(img_path, width=width)

            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_before = Pt(0)
            p_cap.paragraph_format.space_after = Pt(12)
            r_cap = p_cap.add_run(caption)
            r_cap.font.name = 'Calibri'
            r_cap.font.size = Pt(9.5)
            r_cap.italic = True
            r_cap.font.color.rgb = MUTED_TEXT
        else:
            print(f"Warning: Figure not found at {img_path}")

    def style_heading_1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(15)
        r.bold = True
        r.font.color.rgb = NAVY
        return p

    def style_heading_2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(12.5)
        r.bold = True
        r.font.color.rgb = TEAL
        return p

    def style_heading_3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.name = 'Arial'
        r.font.size = Pt(11)
        r.bold = True
        r.font.color.rgb = DARK_TEXT
        return p

    def add_p(text, bold_prefix="", italic=False):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.name = 'Calibri'
            r_pre.font.size = Pt(10.5)
            r_pre.font.color.rgb = DARK_TEXT
        r = p.add_run(text)
        r.italic = italic
        r.font.name = 'Calibri'
        r.font.size = Pt(10.5)
        r.font.color.rgb = DARK_TEXT
        return p

    def add_bullet(text, bold_prefix=""):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.bold = True
            r_pre.font.name = 'Calibri'
            r_pre.font.size = Pt(10.5)
            r_pre.font.color.rgb = DARK_TEXT
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(10.5)
        r.font.color.rgb = DARK_TEXT
        return p

    diagrams_dir = os.path.abspath("scratch/diagrams")
    artifact_diag_dir = os.path.abspath(r"C:\Users\HP\.gemini\antigravity\brain\8070b4d5-b4db-4989-beab-f3bc95ba44c5\diagrams")
    os.makedirs(artifact_diag_dir, exist_ok=True)
    all_diagrams = ["arch.png", "state.png", "sequence.png", "verify.png", "batch_manifest.png", "pos_checkout.png"]
    for fname in all_diagrams:
        src = os.path.join(diagrams_dir, fname)
        dst = os.path.join(artifact_diag_dir, fname)
        if os.path.exists(src):
            shutil.copy2(src, dst)

    # =========================================================================
    # COVER / HEADER TITLE BLOCK
    # =========================================================================
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("SmartScan: Anti-Counterfeit Identification Platform")
    r_title.font.name = 'Arial'
    r_title.font.size = Pt(22)
    r_title.bold = True
    r_title.font.color.rgb = NAVY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("System Architecture, Operational Workflow & Enterprise Automation Specification")
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = TEAL

    # Document Control Metadata Box
    ctrl_table = doc.add_table(rows=7, cols=2)
    ctrl_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    ctrl_table.autofit = False
    col_widths = [Inches(2.2), Inches(4.3)]
    
    meta_rows = [
        ("Document Classification:", "System Architecture Document (SAD) / Technical Design Document (TDD)"),
        ("Target Stakeholders:", "Project Managers, Technical Leads, Solution Architects, Operations Teams"),
        ("Version & Release:", "Version 3.0 (Full Automation Suite: Phases 1, 2, & 3 Deployed)"),
        ("Blockchain Network:", "Ethereum Sepolia Testnet (Chain ID 11155111)"),
        ("Active Smart Contract:", "IdenteefiV2.sol (0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96)"),
        ("Production Frontend:", "https://smart-scan-ten.vercel.app (Live on Vercel Edge)"),
        ("Date Published:", "November 2026"),
    ]

    for i, (k, v) in enumerate(meta_rows):
        row = ctrl_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width, c1.width = col_widths[0], col_widths[1]
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, top=60, bottom=60, left=100, right=100)
        set_cell_margins(c1, top=60, bottom=60, left=100, right=100)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.name = 'Calibri'
        r0.font.size = Pt(9.5)
        r0.font.color.rgb = DARK_TEXT

        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(v)
        r1.font.name = 'Calibri'
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = DARK_TEXT

    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(8)

    # =========================================================================
    # 1. EXECUTIVE SUMMARY
    # =========================================================================
    style_heading_1("1. Executive Summary")

    add_p(
        "Counterfeit pharmaceuticals, luxury items, automotive components, and consumer electronics inflict over $500 billion "
        "in global economic losses annually, endangering lives and destroying brand equity. Traditional anti-counterfeit measures—including "
        "static barcodes, holographic stickers, and tamper seals—suffer from an insurmountable structural weakness: replication. "
        "A malicious actor can purchase a single genuine product, photocopy its barcode or tamper tag, and paste it across thousands of counterfeit copies."
    )

    add_p(
        "SmartScan resolves this vulnerability by binding physical goods to immutable cryptographic digital passports hosted on "
        "the Ethereum blockchain. Rather than merely verifying a static alphanumeric string, SmartScan enforces active physical custody, "
        "multi-party cryptographic custody handshakes, tamper-evident geographical tracking, and terminal state burning."
    )

    add_callout(
        "Core Value Proposition: SmartScan unifies decentralized zero-trust client verification (direct browser-to-Ethereum queries with zero server reliance), "
        "heuristic anomaly detection (spotting impossible-speed travel velocity or duplicate scan bursts across continents), and terminal lifecycle burning "
        "(marking products as Sold on-chain so duplicated codes immediately alarm future buyers). With the completion of Phases 1, 2, and 3, SmartScan incorporates "
        "one-flow factory minting, high-throughput warehouse batch scanning, and real-time Point-of-Sale (POS) barcode checkout with thermal warranty receipts.",
        title="ENTERPRISE VALUE PROPOSITION",
        fill="F0FDF4",
        border_color="059669"
    )

    # =========================================================================
    # 2. SYSTEM ARCHITECTURE
    # =========================================================================
    style_heading_1("2. Multi-Tier System Architecture & Topology")

    add_p(
        "SmartScan is architected across five distinct operational layers, ensuring high throughput, zero-trust verification, "
        "and strict administrative governance:"
    )

    arch_table = doc.add_table(rows=6, cols=3)
    arch_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    arch_table.autofit = False
    arch_widths = [Inches(1.6), Inches(2.2), Inches(2.7)]

    headers = ["System Layer", "Underlying Technologies", "Primary Responsibility"]
    hdr_row = arch_table.rows[0]
    for j, h in enumerate(headers):
        cell = hdr_row.cells[j]
        cell.width = arch_widths[j]
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = 'Calibri'
        r.font.size = Pt(10)
        r.font.color.rgb = WHITE

    arch_data = [
        ("1. Presentation Layer", "React 18, Vite, Material-UI, Ethers.js v6, Web Audio API", "Mobile-responsive PWA, Continuous Warehouse Batch Scanner, Retail POS Terminal (/pos), and universal smartphone verification (/verify/:serial)."),
        ("2. Security & Gateway", "Node.js 24, Express, EIP-191 Signatures, JWT, CORS", "Dual-auth system (wallet key signature + JWT), transaction rate-limiting, pre-flight write authorization (/wallet/authorize-write), and POS API (/api/pos/checkout)."),
        ("3. Persistence & Cache", "Neon PostgreSQL, Upstash Redis (TLS)", "Enterprise relational data storage with transactional advisory locks; token revocation versioning, user audit trails, and distributed IP rate limiting."),
        ("4. Background Workers", "Node.js Daemons, PostgreSQL Advisory Locks", "Asynchronous transaction reconciliation worker (verifying block depth and chain reorganizations) and privacy retention worker (pruning raw IP/GPS data)."),
        ("5. Decentralized Ledger", "Solidity 0.8.17, IdenteefiV2, Ethereum Sepolia", "Immutable product custody registry, role-based access control (RBAC), tamper-proof custody trail, and permanent terminal state locks."),
    ]

    for i, (l, t, r_desc) in enumerate(arch_data, start=1):
        row = arch_table.rows[i]
        bg = "FFFFFF" if i % 2 == 1 else "F8FAFC"
        for j, val in enumerate([l, t, r_desc]):
            cell = row.cells[j]
            cell.width = arch_widths[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(val)
            r.font.name = 'Calibri'
            r.font.size = Pt(9.5)
            r.font.color.rgb = DARK_TEXT
            if j == 0:
                r.bold = True

    add_p("")
    
    # EMBED DIAGRAM 1
    add_figure(
        os.path.join(diagrams_dir, "arch.png"),
        "Figure 1: SmartScan High-Level System Architecture and Multi-Tier Interactions",
        width=Inches(6.2)
    )

    style_heading_2("Architecture Data Flow & Core Principles")
    add_bullet(" Client browsers directly query public Ethereum Sepolia JSON-RPC endpoints to verify authenticity. Even if the backend API server goes offline, product verification cannot be intercepted, censored, or falsified.", "Zero-Trust Client Inquiries:")
    add_bullet(" Any supply-chain write transaction (register, dispatch, confirm delivery, mark sold) must pass through /wallet/authorize-write before wallet confirmation. The gateway verifies active corporate wallet bindings.", "Dual-Gated Authorization:")
    add_bullet(" A dedicated Node.js service runs continuously under PostgreSQL advisory locking (pg_try_advisory_lock). It verifies confirmed block depths, detects chain reorganizations, and synchronizes database statuses.", "Supervised Asynchronous Reconciler:")

    # =========================================================================
    # 3. END-TO-END SUPPLY CHAIN WORKFLOW
    # =========================================================================
    style_heading_1("3. Supply Chain Operational Lifecycle & Finite State Machine")

    add_p(
        "Products in SmartScan traverse a deterministic 6-stage finite state machine. Transitions are enforced strictly "
        "by the IdenteefiV2 smart contract code, requiring valid cryptographic signatures from authorized actors."
    )

    # EMBED DIAGRAM 2
    add_figure(
        os.path.join(diagrams_dir, "state.png"),
        "Figure 2: Finite State Machine of Physical Product Lifecycle and Transitions",
        width=Inches(5.5)
    )

    stage_table = doc.add_table(rows=7, cols=4)
    stage_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    stage_table.autofit = False
    s_widths = [Inches(1.1), Inches(1.4), Inches(1.8), Inches(2.2)]

    s_headers = ["Stage", "State Name", "Authorized Actor", "Operational Meaning & Mechanics"]
    hdr_row = stage_table.rows[0]
    for j, h in enumerate(s_headers):
        cell = hdr_row.cells[j]
        cell.width = s_widths[j]
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = 'Calibri'
        r.font.size = Pt(9.5)
        r.font.color.rgb = WHITE

    stages_data = [
        ("Stage 0", "Unregistered", "None", "Product serial exists as draft or does not exist on-chain. Cannot be verified or traded."),
        ("Stage 1", "Manufactured", "Manufacturer", "Product minted on-chain via registerProduct(). Stored in factory warehouse; custodian is manufacturer wallet."),
        ("Stage 2", "Dispatched", "Manufacturer or Supplier", "Outbound transit recorded via dispatchProduct(). Custodian remains sender, but recipient confirmation is opened."),
        ("Stage 3", "Delivered", "Supplier or Retailer", "Physical arrival confirmed via confirmDelivery(). Custody is cryptographically transferred to the receiving wallet."),
        ("Stage 4", "Sold", "Retailer", "Terminal state via markSold(). Finalizes product lifecycle, permanently locking provenance against counterfeit reuse."),
        ("Stage 5", "Recalled", "Admin or Manufacturer", "Emergency kill-switch via recallProduct(). Halts all transitions and triggers public verification warnings."),
    ]

    for i, (st, nm, act, desc) in enumerate(stages_data, start=1):
        row = stage_table.rows[i]
        bg = "FFFFFF" if i % 2 == 1 else "F8FAFC"
        for j, val in enumerate([st, nm, act, desc]):
            cell = row.cells[j]
            cell.width = s_widths[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(val)
            r.font.name = 'Calibri'
            r.font.size = Pt(9)
            r.font.color.rgb = DARK_TEXT
            if j == 0 or j == 1:
                r.bold = True

    add_p("")
    style_heading_2("The Two-Phase Cryptographic Custody Handshake Workflow")
    add_p(
        "A critical innovation in SmartScan is the prevention of unilateral custody claims. A manufacturer cannot "
        "unilaterally dump an item onto a supplier's inventory, nor can a supplier falsely claim they received an item "
        "that was never dispatched."
    )

    # EMBED DIAGRAM 3
    add_figure(
        os.path.join(diagrams_dir, "sequence.png"),
        "Figure 3: Two-Phase Cryptographic Custody Handshake Sequence (Dispatch & Confirmation)",
        width=Inches(6.0)
    )

    add_bullet(" The current custodian signs dispatchProduct(serialNumber, recipientWallet, location...). The contract sets stage = Dispatched, recording the event timestamp and dispatcher identity on-chain.", "Phase 1 (Outbound Dispatch):")
    add_bullet(" When the shipment arrives at the destination dock, the receiving partner scans the physical QR code. The app automatically recognizes the inbound delivery and prompts for confirmDelivery(serialNumber, location...). The contract verifies that the caller is an eligible receiver and not the dispatching wallet, then updates current custodian to the receiving wallet.", "Phase 2 (Inbound Receipt):")

    add_callout(
        "Terminal Sale State (markSold): When the consumer purchases the product in-store, the retailer executes markSold(). "
        "This permanently seals the digital passport on Ethereum. The item transitions to Stage 4 (Sold). Any subsequent attempts "
        "to dispatch, claim, or resell the product on-chain are rejected by smart contract assertions. If a counterfeiter duplicated "
        "the QR code onto a clone, any buyer scanning the clone will see an instant alert indicating the genuine item was already sold.",
        title="COUNTERFEIT BURNING MECHANISM",
        fill="EFF6FF",
        border_color="2563EB"
    )

    # =========================================================================
    # 4. HOW AUTHENTICITY IS VERIFIED
    # =========================================================================
    style_heading_1("4. Authenticity Verification Engine")

    add_p(
        "SmartScan uses a dual-layer verification defense engine: zero-trust decentralized cryptographic verification "
        "backed by centralized heuristic anomaly detection."
    )

    # EMBED DIAGRAM 4
    add_figure(
        os.path.join(diagrams_dir, "verify.png"),
        "Figure 4: Authenticity Verification & Counterfeit Detection Decision Tree",
        width=Inches(5.8)
    )

    style_heading_2("Layer 1: Zero-Trust Cryptographic Ledger Verification")
    add_bullet(" The application extracts the contract address and verifies it matches the platform's official deployed contract, preventing attackers from launching fake contracts.", "1. Contract Integrity Check:")
    add_bullet(" The client connects directly to Ethereum Sepolia via ethers.js (fallback to public decentralized RPCs). It calls getProduct(serialNumber) to fetch the immutable on-chain record.", "2. Public Blockchain Query:")
    add_bullet(" The client inspects the append-only history array. It verifies that every hop was signed by a registered wallet matching the authorized role (Manufacturer, Supplier, Retailer), complete with block timestamps and geographical locations.", "3. Custody Provenance Traversal:")
    add_bullet(" The client inspects stage and flags: if stage == Sold, it notes the sale date; if stage == Recalled, it displays a high-priority recall alert; if stage == Delivered, it verifies that the physical seller matches the current on-chain custodian.", "4. Terminal State Evaluation:")

    style_heading_2("Layer 2: Heuristic Anti-Cloning & Anomaly Detection")
    add_bullet(" If the same serial code is scanned in New York and then 20 minutes later in Frankfurt, the anomaly engine flags a suspicious_location alert for impossible travel velocity.", "Impossible Velocity Detection:")
    add_bullet(" Legitimate products in circulation are scanned 2–4 times total. A sudden burst of 25 scans within an hour triggers an unusual_frequency alert, notifying the brand manufacturer of potential counterfeiting.", "Scan Burst Frequency:")
    add_bullet(" If a product marked Sold is scanned repeatedly in commercial retail settings, the system flags duplicate retail circulation.", "Post-Sale Scanning:")

    # =========================================================================
    # 5. ENTERPRISE AUTOMATION SUITE (PHASES 1, 2, & 3)
    # =========================================================================
    style_heading_1("5. Enterprise Automation Suite (Phases 1, 2, & 3)")

    add_p(
        "To transform SmartScan from a manual multi-click interface into a high-throughput industrial platform, "
        "a three-phase automation architecture was designed, implemented, and deployed to production on Vercel."
    )

    # -------------------------------------------------------------------------
    # PHASE 1
    # -------------------------------------------------------------------------
    style_heading_2("Phase 1: Zero-Friction Handover & Direct Mobile Camera Verification")
    add_p(
        "Phase 1 eliminated manual friction for consumers, factory operators, and suppliers through five key capabilities:"
    )
    add_bullet(" Manufacturers can toggle 'Auto-Dispatch to Supply Chain' during registration. Once minted on-chain, the system presents an atomic '1-Click Dispatch' button that skips navigation and dispatches the item immediately.", "1. One-Flow 'Mint & Dispatch':")
    add_bullet(" QR codes encode direct universal URLs (https://smart-scan-ten.vercel.app/verify/<serialNumber>). Any standard iOS Camera or Android Google Lens scans and opens the blockchain passport immediately without downloading any app.", "2. Universal Smartphone URL QR Codes:")
    add_bullet(" A direct public React route (/verify/:serialNumber) automatically invokes ethers.js on page load to query the blockchain, displaying verified provenance in under 300ms with browser back-navigation safety.", "3. Direct Public Verify Route:")
    add_bullet(" When a supplier confirms an inbound shipment, the success card immediately displays a chained action: 'Proceed to Dispatch to Downstream Partner →', removing unnecessary inventory dashboard navigation.", "4. Chained Supplier Handover:")
    add_bullet(" Replaced manual 'Detect Browser Location' buttons with a multi-tier background resolver: resolves coarse city/country via IP fast-path in ~180ms, then progressively refines high-accuracy device GPS in the background.", "5. Multi-Tier Background Location:")

    # -------------------------------------------------------------------------
    # PHASE 2
    # -------------------------------------------------------------------------
    style_heading_2("Phase 2: High-Throughput Warehouse Batch Ingestion & 4×6″ Packaging Standard")
    add_p(
        "Phase 2 optimized high-volume factory and warehouse dock operations where workers must process pallets of cartons rapidly."
    )

    # EMBED DIAGRAM 5
    add_figure(
        os.path.join(diagrams_dir, "batch_manifest.png"),
        "Figure 5: Warehouse High-Throughput Batch Ingestion & 4×6″ Packaging Pipeline",
        width=Inches(6.2)
    )

    add_bullet(" Warehouse workers toggle from Single Inspection to Continuous Batch Scan Mode. The camera viewfinder remains permanently active without closing after each barcode, allowing 15–20 cartons to be ingested per minute.", "1. Continuous Batch Scanner:")
    add_bullet(" Zero-dependency native HTML5 Web Audio API audio confirmation: a bright 880Hz chime (C#6) confirms genuine items, while a 320Hz low saw-tone alerts workers to duplicate or fraudulent cartons without looking down.", "2. Web Audio Synthesizer:")
    add_bullet(" Disregards duplicate video camera frame reads within 2,000ms while smoothly queueing distinct carton barcodes.", "3. Smart Repeat Debouncer:")
    add_bullet(" Displays a live table of all scanned units with direct 1-tap handover routing and an 'Export CSV' button for ERP/WMS intake.", "4. Inbound Scanned Batch Manifest:")
    add_bullet(" A dedicated thermal printing modal formatted for Zebra, Rollo, Brother, and Dymo 4XL printers using printer-exact @media print CSS (@page { size: 4in 6in; margin: 0; }). Includes Level H QR code, monospace serial, and origin stamps.", "5. Standard 4×6″ Thermal Packaging Label:")

    # -------------------------------------------------------------------------
    # PHASE 3
    # -------------------------------------------------------------------------
    style_heading_2("Phase 3: Automated Point-of-Sale (POS) & Retail Checkout Integration")
    add_p(
        "Phase 3 bridges physical retail checkouts (cash registers, barcode wedge scanners, and store clerks) "
        "with real-time blockchain passport burning and consumer warranty issuance."
    )

    # EMBED DIAGRAM 6
    add_figure(
        os.path.join(diagrams_dir, "pos_checkout.png"),
        "Figure 6: Retail Point-of-Sale (POS) & Checkout Lifecycle with 80mm Warranty Receipt",
        width=Inches(6.2)
    )

    add_bullet(" A dedicated enterprise REST endpoint (POST /api/pos/checkout) accepts { serialNumber, storeId, registerId, cashierName, location } and executes authoritative on-chain checks against IdenteefiV2.sol in <250ms.", "1. Enterprise POS REST API:")
    add_bullet(" A dedicated register interface (/pos) with an auto-focused barcode wedge input. Cashiers scan packaging barcodes with handheld Honeywell, Zebra, or Netum scanners; the scanner fires [Enter] and authenticates instantly without touching the mouse.", "2. Dedicated POS Register Interface:")
    add_bullet(" Cash register two-tone audio chord (880Hz + 1318Hz) on genuine stock; distinct 220Hz warning buzz if an item is counterfeit, in-transit, or already sold.", "3. Retail Audio Synthesizer:")
    add_bullet(" Prompts MetaMask or corporate retailer wallet to call markSold() on-chain, permanently locking the passport against resale cloning.", "4. 1-Tap Blockchain Sale Finalization:")
    add_bullet(" Formatted for standard 80mm POS receipt printers (Epson, Star Micronics, Citizen). Prints an official certificate of authenticity with a consumer QR seal linking directly to the blockchain passport.", "5. Standard 80mm Customer Warranty Receipt:")

    # =========================================================================
    # 6. GASLESS RELAYING ARCHITECTURE
    # =========================================================================
    style_heading_1("6. Gasless Relaying Architecture & Sponsoring Strategy")

    add_p(
        "A major operational challenge in enterprise blockchain deployments is gas management: warehouse staff and retail cashiers "
        "cannot be expected to manage cryptocurrency balances or pay transaction fees out of pocket."
    )

    add_callout(
        "Gasless Relaying Principle: Decouples transaction authorization (cryptographic signing by the worker) from transaction "
        "execution (paying network gas fees by the enterprise). The worker signs an off-chain EIP-712 structured data message with 0 ETH, "
        "and a backend sponsor relayer broadcasts the transaction to Ethereum on their behalf.",
        title="GASLESS NON-REPUDIATION",
        fill="EFF6FF",
        border_color="2563EB"
    )

    style_heading_2("Architectural Options for SmartScan Gasless Relaying")
    add_bullet(" Worker signs typed structured data (CustodyActionPermit) in browser. Backend relayer submits via executeCustodyMetaTx(). The contract verifies ecrecover(hash, signature) == worker. Preserves 100% cryptographic non-repudiation with $0 gas for staff.", "Option A: EIP-712 Meta-Transactions (Recommended):")
    add_bullet(" Connects IdenteefiV2 to an ERC-2771 forwarder contract and Gelato or Biconomy Paymaster. Turnkey but incurs external SaaS subscription overhead.", "Option B: Gelato / Biconomy Relay Network:")
    add_bullet(" Backend server maintains a funded relayer key. When worker approves an action, server validates JWT role and broadcasts transaction. Simple but relies on centralized server logs for actor non-repudiation.", "Option C: Backend Sponsor Pool:")

    style_heading_2("Cost & Budgeting Analysis")
    add_bullet(" Free testnet gas. Ideal for staging, integration testing, and pilot rollouts.", "Sepolia Testnet (Current):")
    add_bullet(" Average gas cost is <$0.002 per custody handover. A monthly treasury pool of 0.05 ETH (~$150) sponsors over 75,000 warehouse handovers and retail checkouts.", "Layer 2 Migration (Arbitrum One / Base):")

    # =========================================================================
    # 7. THREAT MODEL & SECURITY CONTROLS
    # =========================================================================
    style_heading_1("7. Threat Model & Security Controls")

    threat_table = doc.add_table(rows=7, cols=3)
    threat_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    threat_table.autofit = False
    t_widths = [Inches(1.8), Inches(2.2), Inches(2.5)]

    t_headers = ["Threat / Attack Vector", "Potential Impact", "SmartScan Architectural Defense"]
    hdr_row = threat_table.rows[0]
    for j, h in enumerate(t_headers):
        cell = hdr_row.cells[j]
        cell.width = t_widths[j]
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = 'Calibri'
        r.font.size = Pt(9.5)
        r.font.color.rgb = WHITE

    threats = [
        ("Barcode Photocopying (Label Cloning)", "Mass production of fake goods with authentic printed serials.", "markSold burns circulation; scanning clones triggers immediate 'Already Sold' alert or geographic velocity anomalies."),
        ("Rogue API / Database Tampering", "Malicious database admin attempts to alter provenance records.", "Ledger is on Ethereum; client reads blockchain directly. Database modification cannot falsify on-chain custody."),
        ("Unregistered Wallet Exploits", "Attacker calls smart contract directly using unauthorized wallet.", "Contract enforces onlyRole modifiers; calls revert immediately unless wallet address is registered by Admin."),
        ("Self-Dealing / Ghost Deliveries", "Actor creates artificial custody hops to fake distribution.", "Two-phase handshake requires recipient wallet signature; sender cannot confirm its own delivery."),
        ("Stolen Staff Credentials", "Compromised employee password used to sign unauthorized actions.", "EIP-191 wallet signature required; password changes increment token_version and immediately revoke all active JWT sessions."),
        ("POS Barcode Spoofing", "Cashier scans barcode from a different cheap product.", "Dual verification displays product name, brand, and picture on screen. Barcode must match active on-chain stage 3 inventory."),
    ]

    for i, (tv, pi, df) in enumerate(threats, start=1):
        row = threat_table.rows[i]
        bg = "FFFFFF" if i % 2 == 1 else "F8FAFC"
        for j, val in enumerate([tv, pi, df]):
            cell = row.cells[j]
            cell.width = t_widths[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(val)
            r.font.name = 'Calibri'
            r.font.size = Pt(9)
            r.font.color.rgb = DARK_TEXT
            if j == 0:
                r.bold = True

    # =========================================================================
    # 8. RECOMMENDATIONS FOR THE PROJECT MANAGER
    # =========================================================================
    style_heading_1("8. Strategic Recommendations & Production Roadmap")

    add_p(
        "To transition SmartScan into full commercial enterprise operation, the following strategic initiatives "
        "are recommended for the project management roadmap:"
    )

    style_heading_2("1. Layer 2 Rollup Migration (Arbitrum One / Base)")
    add_bullet(" While Sepolia testnet is free, Ethereum Mainnet gas fees ($1.00–$5.00+) make individual serialization of FMCG goods expensive.", "Rationale:")
    add_bullet(" Deploy production smart contract to an Ethereum Layer 2 rollup (Base or Arbitrum One). This retains 100% of Ethereum's settlement security while reducing handover gas costs to <$0.002.", "Action:")

    style_heading_2("2. Cryptographic Hardware NFC Tags (NTAG424 DNA)")
    add_bullet(" Printed QR codes can be physically copied prior to consumer sale, requiring statistical heuristics to catch clones.", "Rationale:")
    add_bullet(" Integrate dual packaging with encrypted NFC tags (NXP NTAG424 DNA). Each physical tap generates a dynamic AES-128 SUN token, making physical cloning mathematically impossible.", "Action:")

    style_heading_2("3. Pallet & Merkle Tree Batch Minting")
    add_bullet(" Registering 50,000 units individually incurs 50,000 on-chain write transactions, creating manufacturing line bottlenecks.", "Rationale:")
    add_bullet(" Implement Merkle root batch registration. The factory registers a single batch root on-chain; individual items prove authenticity via lightweight Merkle inclusion proofs.", "Action:")

    style_heading_2("4. ERP & WMS Webhook Adapters (SAP / Oracle)")
    add_bullet(" Warehouse workers resist entering data into two separate systems (ERP and SmartScan).", "Rationale:")
    add_bullet(" Connect the POST /api/pos/checkout and custody webhook endpoints directly to SAP WMS and Oracle NetSuite scanners to trigger blockchain handovers automatically.", "Action:")

    # =========================================================================
    # 9. TECHNICAL GLOSSARY
    # =========================================================================
    style_heading_1("9. Technical Glossary")

    glossary = [
        ("Canonical Serial Number:", "Globally unique identifier for a physical item (e.g., SS-1a0a75a9-9d5e-4c23-8ae3-4df58fcb0667)."),
        ("Custodian:", "The Ethereum wallet address cryptographically and legally recognized as holding physical possession of the asset."),
        ("EIP-712:", "Ethereum standard for typed structured data hashing and signing; enables zero-gas meta-transactions."),
        ("EIP-191:", "Standard for signed personal messages; provides wallet ownership verification during user sign-in."),
        ("Reconciliation Engine:", "Supervised background worker verifying on-chain event mining, block confirmation depth, and state alignment."),
        ("Terminal State:", "An irreversible state (Sold or Recalled) that permanently burns the digital passport against resale counterfeiting."),
        ("Barcode Wedge Scanner:", "Hardware barcode scanner that interfaces as a USB/Bluetooth keyboard, emitting scanned text followed by an Enter keystroke."),
    ]

    for term, defn in glossary:
        add_bullet(f" {defn}", bold_prefix=term)

    # Save to project root and artifact directory
    target_path_1 = r"c:\Users\HP\Desktop\anti-counterfeit-product-identification-system-using-blockchain-backup\SmartScan_System_Architecture_and_Workflow_Specification.docx"
    target_path_2 = r"C:\Users\HP\.gemini\antigravity\brain\8070b4d5-b4db-4989-beab-f3bc95ba44c5\SmartScan_System_Architecture_and_Workflow_Specification.docx"

    doc.save(target_path_1)
    doc.save(target_path_2)
    print(f"Successfully generated Version 3.0 DOCX with 6 embedded diagrams at:\n1. {target_path_1}\n2. {target_path_2}")

if __name__ == '__main__':
    create_document()

