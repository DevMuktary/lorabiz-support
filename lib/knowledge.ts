export const LORABIZ_KNOWLEDGE_BASE = `
[LORABIZ KNOWLEDGE BASE - FINAL]

## 1. PLATFORM OVERVIEW
Lorabiz is a premium platform designed to provide statutory compliance and utility services for Nigerian businesses and individuals. Core services include Corporate Affairs Commission (CAC) registrations, SCUML certificates, Tax IDs, NIN verification, and utility payments (Airtime).
Our human support operating hours are Monday through Friday, 9:00 AM to 5:00 PM WAT. Support is available via the floating WhatsApp widget on the platform.

**IMPORTANT PRICING RULE:** Service prices are dynamic and subject to change. NEVER quote a hardcoded price to a user. Always instruct the user to check the "Pricing" page (/dashboard/pricing) for the most accurate and up-to-date fees.

## 2. NAVIGATION & DASHBOARD LAYOUT
The User Dashboard is divided into a main workspace and a sidebar navigation.

### Sidebar Navigation:
- **Service Hub** (/dashboard) - Main landing page.
- **Transactions** (/dashboard/transactions) - Complete financial ledger.
- **Wallet** (/dashboard/wallet) - View balance, funding history, and add funds.
- **Partner Program** (/dashboard/referrals) - Track invites, earnings, and cashouts.
- **Pricing** (/dashboard/pricing) - Current price list for all services.
- **Available Services:** CAC Services, SCUML, NIN Services, Airtime, Tax ID (TIN).
- **Profile Settings** (/dashboard/settings) - Manage name, avatar, phone number, and password.

## 3. ACCOUNT, WALLET & PAYMENTS
- **Authentication**: Email/Password + 6-digit OTP (2-Step Verification) + Cloudflare Turnstile.
- **Wallet System**: Funded via KoraPay (Min ₦100). Balance used to pay for services. No external transfers.
- **Checkout Options**: "WALLET" (deducts from balance) or "ONLINE" (direct KoraPay checkout). Promo codes are supported.

## 4. DETAILED SERVICE: CAC REGISTRATION (/dashboard/cac)
This section contains the exact field-by-field guide for users stuck on the CAC registration forms.

### A. BUSINESS NAME REGISTRATION - FIELD GUIDE

**Step 1: Company Details**
- **Business Name**: (Auto-filled/Locked) The approved name from CAC.
- **Nature of Business**: (Auto-filled/Locked) The category selected during the name search.
- **Company Email**: Must be a valid email format.
- **Business Commencement Date**: The exact date the business officially starts operating.
- **State / City / Street No / Street Address**: The primary physical location of the business in Nigeria.

**Step 2: Proprietors**
- **Surname / First Name / Other Name**: Legal names exactly as they appear on the user's ID.
- **Email**: Valid email address.
- **Phone Number**: Must be valid.
- **Gender**: MALE or FEMALE.
- **Date of Birth**: Used to calculate age. *Rule*: If under 18, the system will warn that CAC requires at least 2 adult partners to register with a minor.
- **State / LGA / City / Street No / Service Address**: The residential address of the proprietor. 
- *UX Rule*: Users MUST click "Save" to collapse a proprietor's card before the "+ Add New Proprietor" button will work.

**Step 3: Document Uploads**
- **NIN Card/Slip**: Accepts PDF, JPG, or PNG.
- **Passport Photo**: Accepts JPG or PNG ONLY. Must be a perfect square. PDFs are strictly rejected.
- **Signature**: Accepts JPG or PNG ONLY. Must be signed on plain white paper. PDFs are strictly rejected.

---

### B. LIMITED LIABILITY COMPANY (LLC) REGISTRATION - FIELD GUIDE

**Step 1: Company Information**
- **Company Email**: Primary contact email for the business.
- **Description of Business Activity**: A brief sentence describing what the company will actually do daily.
- **Registered Office Address (State/LGA/City/Postal Code/House No/Street)**: The official, legal address of the company in Nigeria.
- **Head Office Address**: Where day-to-day operations happen. Users can click the "Same as Registered Address" toggle to auto-fill this.

**Step 2: Articles & Memorandum**
- **Objects of Memorandum**: Defines the company's legal purpose. *Instruction*: Users should start the text with "To carry on the business of..." and list specific activities.
- **Articles of Association**: Internal rules. Users can click "Use CAMA Defaults" to automatically load standard Nigerian corporate rules, or add custom clauses (Requires Part, Title, and Content).
- **Details of Witness**: A third party must witness the articles. 
  - *Rule*: The witness MUST be at least 18 years old and CANNOT be a director or shareholder of the company. Requires their Name, DOB, Gender, Occupation, Email, Phone, and Residential Address.

**Step 3: Share Capital & Allotment (CRITICAL STEP)**
- **Type of Company**: Dropdown selection. This determines the Minimum Share Capital required by law.
- **Total Company Issued Share Capital**: The master capital value (usually ₦1,000,000 minimum).
- **Share Details Breakdown (Classes)**: 
  - Users must click "Add Share Class". They must have at least one "EQUITY (ORDINARY)" class. 
  - They assign a "Total Value" to the class and divide it into "Units". 
  - *Math Rule*: The sum of all Share Classes MUST exactly equal the "Total Company Issued Share Capital".
- **Shareholders Allotment**: 
  - 100% of the created Share Units must be distributed to owners.
  - Users click "Allot" next to a person's name and type in the number of units they own.
  - *Add Standalone Shareholder*: Used if an owner is ONLY an investor and not a Director.

**Step 4: Company Officers**
- *Rule*: Private companies MUST have at least one (1) Director. A Secretary is optional for small companies.
- **Add Director / Add Secretary**: Opens the officer form.
- **Personal Details**: Surname, First Name, DOB (Must be 18+), Gender, Occupation, Nationality.
- **Identification**: Means of ID (NIN, Passport, Driver's License, Voters Card). *Rule*: If NIN is selected, the ID Number MUST be exactly 11 digits.
- **Director Checkbox**: Directors have a toggle asking "Is this Director also a Shareholder?". If checked, they will magically appear in the Step 3 Allotment table so shares can be assigned to them.

**Step 5: Persons with Significant Control (PSC)**
- *Auto-Detection*: Any Shareholder who was allotted 5% or more of the total share units in Step 3 is automatically listed here.
- *Action Required*: Users must click "Edit" on the auto-detected PSC to complete their profile.
- **PSC Fields**: 
  - "Is the PSC a Politically Exposed Person (PEP)?" (Yes/No)
  - "Does the PSC have any affiliation?" (Yes/No)
  - "Details of Interest Held": Direct/Indirect voting rights, power to appoint/remove directors, significant influence.

**Step 6: Document Uploads**
- **Means of ID**: For all officers. Accepts PDF, JPG, or PNG (Max 4MB).
- **Signatures**: For the Witness, the Declarant, and all Officers. Accepts JPG or PNG ONLY (plain white paper). PDFs are strictly rejected.

**Step 7: Compliance (Declarant)**
- **Who fills this?**: This is the person making the statutory declaration (usually the user applying on the platform).
- **Fields**: Surname, First Name, Accreditation Number (Leave blank if not an accredited agent), Phone, Email, Residential Address.
- **Acknowledgement**: The user MUST click the checkbox to confirm compliance with CAMA 2020 before the payment buttons will activate.

## 5. OTHER SERVICES (SCUML, TAX ID, NIN, AIRTIME)
- **SCUML**: Standard fee applies. Takes 24-72 hrs (up to 5 days). Requires CAC Cert, Status Report, MEMART.
- **Tax ID**: Individual (requires NIN) or Corporate (requires CAC Number). Usually ready in 30 mins during working hours.
- **NIN Slip**: Search by NIN or linked Phone. 3 types: Regular, Standard Biometric, Premium Card. Instant delivery.
- **Airtime**: Minimum ₦50. Has a 10-minute duplicate guard to prevent accidental double recharges.

## 6. PARTNER PROGRAM (REFERRALS)
- **Location**: /dashboard/referrals
- **Referee Benefit**: 5% discount on first major service via Welcome Promo Code.
- **Referrer Earning**: Fixed cash rewards deposited into "Available Balance" when the invited user successfully completes a paid service.
- **Payouts**: Requires linking a Nigerian bank account (10-digit NUBAN). Account name MUST match registered LoraBiz name.
`;
