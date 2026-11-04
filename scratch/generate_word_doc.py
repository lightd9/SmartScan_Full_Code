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
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Styles & Colors
    NAVY = RGBColor(30, 58, 138)       # #1E3A8A - Primary Header
    TEAL = RGBColor(13, 148, 136)      # #0D9488 - Accent / Secondary Header
    DARK_TEXT = RGBColor(30, 41, 59)   # #1E293B - Body Text
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

    # Ensure diagram directories
    diagrams_dir = os.path.abspath("scratch/diagrams")
    artifact_diag_dir = os.path.abspath(r"C:\Users\HP\.gemini\antigravity\brain\8070b4d5-b4db-4989-beab-f3bc95ba44c5\diagrams")
    os.makedirs(artifact_diag_dir, exist_ok=True)
    for fname in ["arch.png", "state.png", "sequence.png", "verify.png"]:
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
    r_sub = p_sub.add_run("System Architecture, Operational Workflow & Authenticity Verification Specification")
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = TEAL

    # Document Control Metadata Box
    ctrl_table = doc.add_table(rows=6, cols=2)
    ctrl_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    ctrl_table.autofit = False
    col_widths = [Inches(2.2), Inches(4.3)]
    
    meta_rows = [
        ("Document Classification:", "System Architecture Document (SAD) / Technical Design Document (TDD)"),
        ("Target Stakeholders:", "Project Managers, Technical Leads, Solution Architects, Operations"),
        ("Version & Status:", "Version 2.1 (Production-Ready Architecture)"),
        ("Blockchain Network:", "Ethereum Sepolia Testnet (Chain ID 11155111)"),
        ("Active Smart Contract:", "IdenteefiV2.sol (0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96)"),
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
        "Counterfeit pharmaceuticals, luxury items, and consumer goods cause hundreds of billions of dollars "
        "in economic damage annually, posing grave health and safety risks. Traditional anti-counterfeit measures—such as "
        "static barcodes, holograms, or standalone serial numbers—suffer from a fatal vulnerability: replication. "
        "A bad actor can purchase a single genuine product, photocopy its barcode, and paste it across thousands of counterfeit units."
    )

    add_p(
        "SmartScan eliminates this vulnerability by binding physical goods to immutable cryptographic digital passports on "
        "the Ethereum blockchain. Rather than merely verifying a static string, SmartScan verifies active physical custody, "
        "multi-party custody transfers, and terminal sale state."
    )

    add_callout(
        "Core Value Proposition: SmartScan combines decentralized public ledger verification (zero-trust consumer scans directly against Ethereum nodes) "
        "with centralized heuristic anomaly detection (spotting duplicate scans in impossible locations or velocity spikes) and terminal state burning "
        "(marking items as Sold on-chain so duplicated codes immediately alarm future buyers).",
        title="CORE VALUE PROPOSITION",
        fill="F0FDF4",
        border_color="059669"
    )

    # =========================================================================
    # 2. SYSTEM ARCHITECTURE
    # =========================================================================
    style_heading_1("2. System Architecture & Component Model")

    add_p(
        "SmartScan is architected across five distinct operational layers, ensuring high throughput, zero-trust verification, "
        "and strict administrative governance:"
    )

    # Component Table
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
        ("1. Presentation Layer", "React 18, Vite, Material-UI, Ethers.js v6, Capacitor", "Responsive Web App & Mobile Scanner; renders stage-aware actions and verifies direct blockchain status without server reliance."),
        ("2. Security & Gateway", "Node.js 24, Express, EIP-191 Signatures, JWT", "Dual-auth system (wallet key signature + JWT), transaction rate-limiting, and pre-flight write authorization gate (/wallet/authorize-write)."),
        ("3. Persistence & Cache", "Neon PostgreSQL, Upstash Redis (TLS)", "Enterprise relational data storage with transactional advisory locks; token revocation, user audit trails, and distributed rate limiting."),
        ("4. Background Workers", "Node.js Daemons, PostgreSQL Advisory Locks", "Asynchronous transaction reconciliation worker (verifying block depth and event logs) and privacy retention worker (pruning raw IP/GPS data)."),
        ("5. Decentralized Ledger", "Solidity 0.8.17, IdenteefiV2, Ethereum Sepolia", "Immutable product custody ledger, role-based access control (RBAC), tamper-proof audit trail, and terminal state locks."),
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

    style_heading_2("Architecture Data Flow & Interactions")
    add_bullet(" The browser directly queries decentralized public Ethereum JSON-RPC endpoints to verify product authenticity, guaranteeing that even if the SmartScan API server goes offline, product verification cannot be intercepted or falsified.", "Zero-Trust Client Inquiries:")
    add_bullet(" Any supply-chain write transaction (register, dispatch, confirm delivery, mark sold) must pass through /wallet/authorize-write before MetaMask signoff. The gateway verifies user credentials, role permissions, and active wallet bindings.", "Dual-Gated Authorization:")
    add_bullet(" A dedicated Node.js service runs continuously under PostgreSQL advisory locking (pg_try_advisory_lock). It verifies confirmed block depths, detects chain reorganizations, recovers unpersisted hashes from deployment blocks, and updates database statuses.", "Supervised Asynchronous Reconciler:")

    # =========================================================================
    # 3. END-TO-END SUPPLY CHAIN WORKFLOW
    # =========================================================================
    style_heading_1("3. Supply Chain Operational Lifecycle")

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
    style_heading_2("The Two-Phase Custody Handshake Workflow")
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
    add_bullet(" When the shipment arrives at the destination dock, the receiving partner scans the physical QR code. The app automatically recognizes the inbound delivery and prompts for confirmDelivery(serialNumber, location...). The contract verifies that the caller is an eligible receiver and not the dispatching wallet, then updates the current custodian to the receiving wallet.", "Phase 2 (Inbound Receipt):")

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
    add_p(
        "When a consumer or auditor scans the product's QR code (payload: ContractAddress,SerialNumber):"
    )
    add_bullet(" The application extracts the contract address and verifies it matches the platform's official deployed contract, preventing attackers from launching fake contracts.", "1. Contract Integrity Check:")
    add_bullet(" The client connects directly to Ethereum Sepolia via ethers.js (fallback to public decentralized RPCs). It calls getProduct(serialNumber) to fetch the immutable on-chain record.", "2. Public Blockchain Query:")
    add_bullet(" The client inspects the append-only history array. It verifies that every hop was signed by a registered wallet matching the authorized role (Manufacturer, Supplier, Retailer), complete with block timestamps and geographical locations.", "3. Custody Provenance Traversal:")
    add_bullet(" The client inspects stage and flags: if stage == Sold, it notes the sale date; if stage == Recalled, it displays a high-priority recall alert; if stage == Delivered, it verifies that the physical seller matches the current on-chain custodian.", "4. Terminal State Evaluation:")

    style_heading_2("Layer 2: Heuristic Anti-Cloning & Anomaly Detection")
    add_p(
        "To combat optical barcode copying (where a counterfeiter prints 500 copies of a genuine active QR code), "
        "every scan submits non-PII telemetry to the backend anomaly engine:"
    )
    add_bullet(" If the same serial code is scanned in New York and then 20 minutes later in Frankfurt, the anomaly engine flags a suspicious_location alert for impossible travel velocity.", "Impossible Velocity Detection:")
    add_bullet(" Legitimate products in circulation are scanned 2–4 times total. A sudden burst of 25 scans within an hour triggers an unusual_frequency alert, notifying the brand manufacturer of potential counterfeiting.", "Scan Burst Frequency:")
    add_bullet(" If a product marked Sold is scanned repeatedly in commercial retail settings, the system flags duplicate retail circulation.", "Post-Sale Scanning:")

    # =========================================================================
    # 5. SECURITY & THREAT MITIGATION MATRIX
    # =========================================================================
    style_heading_1("5. Threat Model & Security Controls")

    threat_table = doc.add_table(rows=6, cols=3)
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
    # 6. RECOMMENDATIONS FOR THE PROJECT MANAGER
    # =========================================================================
    style_heading_1("6. Strategic Recommendations & Production Roadmap")

    add_p(
        "To transition SmartScan from its current staging deployment on Sepolia into a commercial-grade, "
        "high-volume enterprise solution, the following strategic initiatives should be prioritized on the product roadmap:"
    )

    style_heading_2("1. Layer 2 Rollup Migration (Arbitrum / Base / Polygon)")
    add_bullet(" While Sepolia testnet is free, deploying to Ethereum Mainnet incurs $1.00–$5.00+ gas fees per transition, making serialization of low-cost consumer goods economically unviable.", "Rationale:")
    add_bullet(" Migrate production contract deployment to an Ethereum Layer 2 rollup (such as Arbitrum One, Base, or Polygon PoS). This reduces gas costs to less than $0.005 per custody handover while retaining Ethereum's underlying settlement security.", "Action:")

    style_heading_2("2. Hardware Cryptographic Binding (NFC NTAG424 DNA)")
    add_bullet(" Printed QR codes can still be physically copied prior to consumer sale, requiring statistical velocity heuristics to detect.", "Rationale:")
    add_bullet(" Introduce dual packaging with encrypted NFC tags (such as NXP NTAG424 DNA). Each physical tap generates an encrypted SUN CMAC token that changes dynamically. Photocopying or recording the tag is mathematically impossible.", "Action:")

    style_heading_2("3. Pallet & Batch Minting (ERC-1155 / Merkle Trees)")
    add_bullet(" Registering 20,000 individual pharmaceutical bottles requires 20,000 sequential transactions, causing factory line bottlenecks.", "Rationale:")
    add_bullet(" Implement registerProductBatch and Merkle root anchoring. The factory registers an entire production run in a single transaction, publishing individual cryptographic branch proofs for each unit.", "Action:")

    style_heading_2("4. Native App Store Distribution (Capacitor Packaging)")
    add_bullet(" Mobile browser camera access requires user permissions on every domain visit and lacks background NFC scanning capabilities.", "Rationale:")
    add_bullet(" Package the existing Capacitor codebase into native iOS (.ipa) and Android (.apk) releases for distribution on Google Play and Apple App Store. This unlocks instant background NFC tap authentication.", "Action:")

    style_heading_2("5. Enterprise ERP Webhook Adapters (SAP / Oracle NetSuite)")
    add_bullet(" Warehouse workers will resist manually entering transactions into both company ERPs and SmartScan.", "Rationale:")
    add_bullet(" Provide standard REST webhook adapters. Scanning an outbound shipping barcode in SAP or Oracle can trigger the SmartScan /wallet/authorize-write pipeline automatically via corporate custody wallets.", "Action:")

    # =========================================================================
    # 7. GLOSSARY
    # =========================================================================
    style_heading_1("7. Technical Glossary")

    glossary = [
        ("Canonical Serial Number:", "The globally unique identifier for a physical unit (e.g., SS-1a0a75a9-9d5e-4c23-8ae3-4df58fcb0667)."),
        ("Custodian:", "The Ethereum wallet address legally and cryptographically recognized as holding physical possession of the asset."),
        ("EIP-191:", "Ethereum standard for signed personal messages; used for zero-gas cryptographic wallet ownership proof during sign-in."),
        ("Reconciliation Engine:", "Supervised background worker verifying on-chain event mining, block confirmation depth, and state alignment."),
        ("Terminal State:", "An irreversible state (Sold or Recalled) that permanently seals the item's digital passport against further transfer."),
    ]

    for term, defn in glossary:
        add_bullet(f" {defn}", bold_prefix=term)

    # Save to both project root and artifact directory
    target_path_1 = r"c:\Users\HP\Desktop\anti-counterfeit-product-identification-system-using-blockchain-backup\SmartScan_System_Architecture_and_Workflow_Specification.docx"
    target_path_2 = r"C:\Users\HP\.gemini\antigravity\brain\8070b4d5-b4db-4989-beab-f3bc95ba44c5\SmartScan_System_Architecture_and_Workflow_Specification.docx"

    doc.save(target_path_1)
    doc.save(target_path_2)
    print(f"Successfully generated DOCX with embedded diagrams at:\n1. {target_path_1}\n2. {target_path_2}")

if __name__ == '__main__':
    create_document()
