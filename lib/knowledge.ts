export const LORABIZ_KNOWLEDGE_BASE = `
[LORABIZ KNOWLEDGE BASE - FINAL]

## 1. PLATFORM OVERVIEW
Lorabiz is a premium platform designed to provide statutory compliance and utility services for Nigerian businesses and individuals. Core services include Corporate Affairs Commission (CAC) registrations, SCUML certificates, Tax IDs, NIN verification, and utility payments (Airtime).
Our human support operating hours are Monday through Friday, 9:00 AM to 5:00 PM WAT. Support is available via the floating WhatsApp widget on the platform.

## 2. NAVIGATION & DASHBOARD LAYOUT
The User Dashboard is divided into a main workspace and a sidebar navigation (collapsible on desktop, hamburger menu on mobile).

### Sidebar Navigation:
**Main:**
- **Service Hub** (/dashboard) - The main landing page showing quick access cards for all services and a quick-view of the wallet balance.
- **Transactions** (/dashboard/transactions) - Complete ledger of all financial activities (funding and payments).
- **Wallet** (/dashboard/wallet) - To view wallet balance, funding history, and add funds.
- **Pricing** (/dashboard/pricing) - View the current price list for all services.

**Available Services:**
- **CAC Services** (/dashboard/cac) - Business Name and LLC registrations.
- **SCUML** (/dashboard/scuml) - Special Control Unit Against Money Laundering certificates.
- **NIN Services** (/dashboard/tools/nin-slip) - Generate and download NIN slips.
- **Airtime** (/dashboard/airtime) - Mobile airtime top-up for all major networks.
- **Tax ID (TIN)** (/dashboard/tax-id) - Individual and corporate tax identification numbers.

**Upcoming Services (Waitlist available):**
- CAC Post Incorporation
- Trademark (IPO)
- SMEDAN

**Management:**
- **Profile Settings** (/dashboard/settings) - Manage name, avatar, phone number, and password.

## 3. ACCOUNT & AUTHENTICATION
- **Registration**: Requires Name, Email, Phone, Address, and Password. Email verification via 6-digit OTP is mandatory before form submission.
- **Login**: Requires Email and Password, followed by a mandatory 6-digit OTP sent to the email (2-Step Verification).
- **Security**: Cloudflare Turnstile CAPTCHA is enforced on both login and registration to prevent bots.
- **Upgrades**: LoraBiz currently uses a single "USER" tier for clients. Admin/Staff have separate portals (/quadrox-lorabiz-team) protected by strict MFA.

## 4. WALLET & PAYMENTS
- **Wallet System**: The platform uses an integrated wallet system. Users fund their wallet via Paystack and use the balance to pay for services.
- **Funding**: Navigate to "Wallet" -> click "Fund Wallet". Enter an amount (Minimum ₦100) -> processed via Paystack.
- **Checkout Options**: When paying for a service, users can use "WALLET" (deducts from balance) or "ONLINE" (direct Paystack checkout).
- **Promo Codes**: Supported at checkout for percentage or fixed discounts.
- **Transactions**: History is available at "Transactions". Credits appear in Green, Debits in default text. Users can view receipt details but PDF downloads are not currently supported.
- **No Withdrawals/Transfers**: The wallet is strictly for platform services. Funds cannot be withdrawn or transferred to other users.

## 5. SERVICES DETAILED

### A. CAC Registration (/dashboard/cac)
- **Types**: Business Name (Sole proprietor/Partnership), Limited Liability Company (LLC), NGO (Currently disabled/maintenance).
- **Process**:
  1. **Name Search**: Check availability of a proposed name.
  2. **AI Category Assistant (LorabizAI)**: A chat assistant to help select the correct business category/nature.
  3. **Forms**: Fill Company Info, Proprietor/Officer Info, Upload Documents (NIN, Passport, Signature).
  4. **LLC Specifics**: Requires Share Capital distribution, Articles of Association, Objects, and PSC (Persons with Significant Control) declarations.
- **Pricing**: Business Name is typically ₦29,000. LLC starts at ₦35,000 for 1M share capital, with ₦15,000 for each additional 1M shares.
- **Status Tracking**: Drafts (Unsubmitted) -> Pending -> Queried -> Approved.
- **Queries**: If CAC queries an application, it moves to "Queried" status. Users can resolve this via the resolution wizard which outlines the reason and allows document/data updates.
- **Standard Processing Time**: 30 Mins - 1 Hour for Business Name; 24-72 Working Hours for LLC. Delays occasionally occur due to government processing backlogs.

### B. SCUML Certificate (/dashboard/scuml)
- **Requirements**: CAC Certificate, Status Report, MEMART (for LLC), NGO Constitution (for NGO).
- **Pricing**: Standard fee is ₦15,000.
- **Processing Time**: 24-72 hours, sometimes up to 4-5 working days.
- **Tracking**: Check the "History" tab for status (Pending -> Processing -> Completed) and to download the final certificate.

### C. Tax ID (TIN) (/dashboard/tax-id)
- **Types**: Individual (Requires NIN) and Corporate (Requires CAC Number).
- **Pricing**: Individual ₦500, Corporate ₦1000.
- **Processing Time**: Typically within 30 minutes during working hours (9AM-5PM).
- **Tracking**: Check the "History" tab. Completed TINs are prominently displayed and can be copied to clipboard.

### D. NIN Slip Generation (/dashboard/tools/nin-slip)
- **Search By**: NIN or Phone Number linked to NIN.
- **Slip Types**:
  - Regular Slip (₦500) - Standard long layout for corporate filings.
  - Standard Biometric (₦700) - Compact layout.
  - Premium Card (₦1000) - Full-colour design for PVC printing.
- **Delivery**: Instant PDF generation and auto-download upon successful payment. History log available on the same page.

### E. Airtime Top-up (/dashboard/airtime)
- **Supported Networks**: MTN, Airtel, Glo, 9Mobile.
- **Minimum Amount**: ₦50.
- **Payment**: Directly deducted from wallet (Face value, no extra fees).
- **Duplicate Guard**: Prevents accidental double recharges of the same amount to the same number within 10 minutes.
- **Disputes**: A "Dispute" button is available in the history for failed transactions.

## 6. SETTINGS & PROFILE MANAGEMENT (/dashboard/settings)
- **Avatar & Name**: Can be updated at any time.
- **Email**: Cannot be changed after registration.
- **Phone Number**: Can be updated, but triggers a 30-day security lock preventing further changes for 30 days.
- **Password**: Can be updated via the provided modal.
- **Notifications**: WhatsApp critical security alerts are permanently enabled.

## 7. SUPPORT & ISSUE RESOLUTION
- **Failed Wallet Funding**: Users can click the "Having payment issues?" banner in the Wallet section to reach WhatsApp support with a pre-filled message.
- **CAC Queries**: Displayed clearly in the dashboard with a "Resolve" button.
- **Airtime Issues**: Use the "Dispute" button in Airtime History.
\`;
