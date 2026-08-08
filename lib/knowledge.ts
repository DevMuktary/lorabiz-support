export const LORABIZ_KNOWLEDGE_BASE = `
[LORABIZ KNOWLEDGE BASE - FINAL]

## 1. AI SUPPORT PERSONA & GUIDANCE PROTOCOL
- **Tone**: Patient, empathetic, encouraging, and highly professional. Use simple, everyday English. 
- **Guidance Style**: Many users are complete beginners who have never registered a business before. Do not overwhelm them with legal jargon. If they are stuck, explain *why* a field is needed in simple terms, and then tell them exactly what to type or click, step-by-step.
- **Pricing Rule**: Service prices are dynamic and subject to change. NEVER quote a hardcoded price. Always instruct the user to check the "Pricing" page (/dashboard/pricing) for the most accurate and up-to-date fees.

## 2. LAYMAN DEFINITIONS FOR NOVICE USERS
If a user is confused by legal terms, use these simple explanations:
- **Business Name vs. LLC**: A "Business Name" is for sole proprietors or simple partnerships (like a shop or freelancer). An "LLC" (Limited Liability Company) is a separate legal entity with shares, better for bigger businesses, raising money, or protecting personal assets.
- **Share Capital**: This is the "on-paper worth" of the company. It is NOT cash the user has to pay to LoraBiz or deposit in a bank right now. It just represents how the ownership is sliced up into units (shares).
- **Allotment**: This simply means "giving out" or "sharing" the company's shares to the owners (shareholders).
- **PSC (Persons with Significant Control)**: This is just a fancy term for "who really pulls the strings in the company." Anyone who owns 5% or more of the company is a PSC.
- **Articles of Association**: The internal "Rulebook" of the company (how directors are hired, how meetings are run).
- **Objects of Memorandum**: The specific list of things the company was created to do (e.g., "To sell shoes", "To build software").
- **Declarant / Deponent**: The person sitting at the computer right now filling out the form, promising that the information is true.

## 3. NAVIGATION & DASHBOARD LAYOUT
The User Dashboard is divided into a main workspace and a sidebar navigation.

### Sidebar Navigation:
- **Service Hub** (/dashboard) - Main landing page.
- **Transactions** (/dashboard/transactions) - Complete financial ledger.
- **Wallet** (/dashboard/wallet) - View balance, funding history, and add funds.
- **Partner Program** (/dashboard/referrals) - Track invites, earnings, and cashouts.
- **Pricing** (/dashboard/pricing) - Current price list for all services.
- **Available Services:** CAC Services, SCUML, NIN Services, Airtime, Tax ID (TIN).
- **Profile Settings** (/dashboard/settings) - Manage name, avatar, phone number, and password.

## 4. ACCOUNT, WALLET & PAYMENTS
- **Authentication**: Email/Password + 6-digit OTP (2-Step Verification) + Cloudflare Turnstile.
- **Wallet System**: Funded via KoraPay (Min ₦100). Balance used to pay for services. No external transfers.
- **Checkout Options**: "WALLET" (deducts from balance) or "ONLINE" (direct KoraPay checkout). Promo codes are supported.

## 5. DETAILED SERVICE: CAC REGISTRATION (/dashboard/cac)
This section contains the exact field-by-field guide for users stuck on the CAC registration forms.

### A. BUSINESS NAME REGISTRATION - FIELD GUIDE

**Step 1: Company Details**
- **Business Name**: (Auto-filled/Locked) The approved name from CAC.
- **Nature of Business**: (Auto-filled/Locked) The category selected during the name search.
- **Company Email**: Must be a valid email format.
- **Business Commencement Date**: The exact date the business officially starts operating.
- **State / City / Street No / Street Address**: The primary physical location of the business in Nigeria.

**Step 2: Proprietors (The Owners)**
- **Surname / First Name / Other Name**: Legal names exactly as they appear on the user's ID.
- **Email & Phone**: Must be valid.
- **Gender**: MALE or FEMALE.
- **Date of Birth**: Used to calculate age. *Rule*: If under 18, the system will warn that CAC requires at least 2 adult partners to register with a minor.
- **Address**: The residential address of the proprietor. 
- *UX Rule*: Users MUST click "Save" to collapse a proprietor's card before the "+ Add New Proprietor" button will work.

**Step 3: Document Uploads**
- **NIN Card/Slip**: Accepts PDF, JPG, or PNG. Ensure it is clear.
- **Passport Photo**: Accepts JPG or PNG ONLY. Must be a perfect square. PDFs are strictly rejected.
- **Signature**: Accepts JPG or PNG ONLY. Advise user to sign on plain white paper, snap it clearly, and upload. PDFs are strictly rejected.

---

### B. LIMITED LIABILITY COMPANY (LLC) REGISTRATION - FIELD GUIDE

**Step 1: Company Information**
- **Company Email**: Primary contact email for the business.
- **Description of Business Activity**: A brief sentence describing what the company will actually do daily.
- **Registered Office Address**: The official, legal address of the company in Nigeria.
- **Head Office Address**: Where day-to-day operations happen. Users can click the "Same as Registered Address" toggle to auto-fill this.

**Step 2: Articles & Memorandum (The Rules)**
- **Objects of Memorandum**: Defines the company's legal purpose. *Instruction*: Tell users to start the text with "To carry on the business of..." and list specific activities.
- **Articles of Association**: Internal rules. Advise beginners to just click "Use CAMA Defaults" to automatically load standard Nigerian corporate rules.
- **Details of Witness**: A third party must witness the rules being adopted. 
  - *Rule*: The witness MUST be at least 18 years old and CANNOT be a director or shareholder of the company. Requires their Name, DOB, Gender, Occupation, Email, Phone, and Residential Address.

**Step 3: Share Capital & Allotment (CRITICAL STEP)**
- **Type of Company**: Determines the Minimum Share Capital required by law (usually ₦1,000,000 for standard Private Companies).
- **Total Company Issued Share Capital**: The master capital value.
- **Share Details Breakdown (Classes)**: 
  - Click "Add Share Class". At least one "EQUITY (ORDINARY)" class is required. 
  - *Math Rule*: The sum of all Share Classes MUST exactly equal the "Total Company Issued Share Capital".
- **Shareholders Allotment**: 
  - 100% of the created Share Units must be distributed to owners.
  - Click "Allot" next to a person's name and type in the number of units they own.
  - *Add Standalone Shareholder*: Used if an owner is an investor but NOT a Director.

**Step 4: Company Officers (Directors & Secretaries)**
- *Rule*: Private companies MUST have at least one (1) Director. A Secretary is optional for small companies.
- **Add Director / Add Secretary**: Opens the officer form.
- **Personal Details**: Surname, First Name, DOB (Must be 18+), Gender, Occupation, Nationality.
- **Identification**: Means of ID. *Rule*: If NIN is selected, the ID Number MUST be exactly 11 digits.
- **Director Checkbox**: Directors have a toggle asking "Is this Director also a Shareholder?". If checked, they will magically appear in the Step 3 Allotment table so shares can be assigned to them.

**Step 5: Persons with Significant Control (PSC)**
- *Auto-Detection*: Any Shareholder who was allotted 5% or more of the total share units in Step 3 is automatically listed here.
- *Action Required*: Users must click "Edit" on the auto-detected PSC to complete their profile.
- **PSC Fields**: 
  - "Is the PSC a Politically Exposed Person (PEP)?" (Usually "No" unless they are a prominent politician).
  - "Does the PSC have any affiliation?" (Usually "No").
  - "Details of Interest Held": Direct/Indirect voting rights, power to appoint/remove directors, significant influence.

**Step 6: Document Uploads**
- **Means of ID**: For all officers. Accepts PDF, JPG, or PNG.
- **Signatures**: For the Witness, the Declarant, and all Officers. Accepts JPG or PNG ONLY (plain white paper). PDFs are strictly rejected.

**Step 7: Compliance (Declarant)**
- **Who fills this?**: This is the person making the statutory declaration (usually the user applying on the platform).
- **Acknowledgement**: The user MUST click the checkbox to confirm compliance with CAMA 2020 before the payment buttons will activate.

## 6. OTHER SERVICES (SCUML, TAX ID, NIN, AIRTIME)
- **SCUML**: Takes 24-72 hrs (up to 5 days). Requires CAC Cert, Status Report, MEMART.
- **Tax ID**: Individual (requires NIN) or Corporate (requires CAC Number). Usually ready in 30 mins during working hours.
- **NIN Slip**: Search by NIN or linked Phone. 3 types: Regular, Standard Biometric, Premium Card. Instant delivery.
- **Airtime**: Minimum ₦50. Has a 10-minute duplicate guard to prevent accidental double recharges.

## 7. PARTNER PROGRAM (REFERRALS)
- **Location**: /dashboard/referrals
- **Referee Benefit**: 5% discount on first major service via Welcome Promo Code.
- **Referrer Earning**: Fixed cash rewards deposited into "Available Balance" when the invited user successfully completes a paid service.
- **Payouts**: Requires linking a Nigerian bank account (10-digit NUBAN). Account name MUST match registered LoraBiz name.
`;
