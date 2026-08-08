export const LORABIZ_KNOWLEDGE_BASE = `
[LORABIZ KNOWLEDGE BASE - FINAL]

## 1. PLATFORM OVERVIEW
Lorabiz is a premium platform designed to provide statutory compliance and utility services for Nigerian businesses and individuals. Core services include Corporate Affairs Commission (CAC) registrations, SCUML certificates, Tax IDs, NIN verification, and utility payments (Airtime).
Our human support operating hours are Monday through Friday, 9:00 AM to 5:00 PM WAT. Support is available via the floating WhatsApp widget on the platform.

**IMPORTANT PRICING RULE:** Service prices are dynamic and subject to change. NEVER quote a hardcoded price to a user. Always instruct the user to check the "Pricing" page (/dashboard/pricing) for the most accurate and up-to-date fees.

## 2. NAVIGATION & DASHBOARD LAYOUT
The User Dashboard is divided into a main workspace and a sidebar navigation.

### Sidebar Navigation:
**Main:**
- **Service Hub** (/dashboard) - The main landing page showing quick access cards for all services and a quick-view of the wallet balance.
- **Transactions** (/dashboard/transactions) - Complete ledger of all financial activities (funding and payments).
- **Wallet** (/dashboard/wallet) - To view wallet balance, funding history, and add funds.
- **Partner Program** (/dashboard/referrals) - The referral dashboard to track invites, earnings, and request bank cashouts.
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
- **Upgrades**: LoraBiz currently uses a single "USER" tier for clients. Admin/Staff have separate portals protected by strict MFA.

## 4. WALLET & PAYMENTS
- **Wallet System**: The platform uses an integrated wallet system. Users fund their wallet via Paystack and use the balance to pay for services.
- **Funding**: Navigate to "Wallet" -> click "Fund Wallet". Enter an amount (Minimum ₦100) -> processed via Paystack.
- **Checkout Options**: When paying for a service, users can use "WALLET" (deducts from balance) or "ONLINE" (direct Paystack checkout).
- **Promo Codes**: Supported at checkout for percentage or fixed discounts.
- **Transactions**: History is available at "Transactions". Credits appear in Green, Debits in default text. Users can view receipt details.
- **No Withdrawals/Transfers**: The main wallet is strictly for platform services. Funds cannot be withdrawn or transferred to other users (Note: The Partner Program balance is separate and CAN be withdrawn).

## 5. SERVICES DETAILED

### A. CAC Registration (/dashboard/cac)
- **Types**: Business Name (Sole proprietor/Partnership), Limited Liability Company (LLC), NGO (Currently disabled/maintenance).
- **Process**:
  1. **Name Search**: Check availability of a proposed name.
  2. **AI Category Assistant (LorabizAI)**: A chat assistant to help select the correct business category/nature.
  3. **Forms**: Fill Company Info, Proprietor/Officer Info, Upload Documents (NIN, Passport, Signature).
  4. **LLC Specifics**: Requires Share Capital distribution, Articles of Association, Objects, and PSC (Persons with Significant Control) declarations.
- **Status Tracking**: Drafts (Unsubmitted) -> Pending -> Queried -> Approved.
- **Queries**: If CAC queries an application, it moves to "Queried" status. Users can resolve this via the resolution wizard which outlines the reason and allows document/data updates.
- **Processing Time**: 30 Mins - 1 Hour for Business Name; 24-72 Working Hours for LLC. Delays occasionally occur due to government processing backlogs.

### B. SCUML Certificate (/dashboard/scuml)
- **Requirements**: CAC Certificate, Status Report, MEMART (for LLC), NGO Constitution (for NGO).
- **Processing Time**: 24-72 hours, sometimes up to 4-5 working days.
- **Tracking**: Check the "History" tab for status (Pending -> Processing -> Completed) and to download the final certificate.

### C. Tax ID (TIN) (/dashboard/tax-id)
- **Types**: Individual (Requires NIN) and Corporate (Requires CAC Number).
- **Processing Time**: Typically within 30 minutes during working hours (9AM-5PM).
- **Tracking**: Check the "History" tab. Completed TINs are prominently displayed and can be copied to clipboard.

### D. NIN Slip Generation (/dashboard/tools/nin-slip)
- **Search By**: NIN or Phone Number linked to NIN.
- **Slip Types**: Regular Slip (Standard long layout), Standard Biometric (Compact layout), Premium Card (Full-colour design for PVC printing).
- **Delivery**: Instant PDF generation and auto-download upon successful payment.

### E. Airtime Top-up (/dashboard/airtime)
- **Supported Networks**: MTN, Airtel, Glo, 9Mobile.
- **Minimum Amount**: ₦50.
- **Duplicate Guard**: Prevents accidental double recharges of the same amount to the same number within 10 minutes.
- **Disputes**: A "Dispute" button is available in the history for failed transactions.

## 6. SETTINGS & PROFILE MANAGEMENT (/dashboard/settings)
- **Avatar & Name**: Can be updated at any time.
- **Email**: Cannot be changed after registration.
- **Phone Number**: Can be updated, but triggers a 30-day security lock preventing further changes for 30 days.
- **Password**: Can be updated via the provided modal.

## 7. PARTNER PROGRAM (REFERRALS)
The Partner Program allows users to earn real cash by inviting others to LoraBiz. 
- **Location**: Users access this via "Partner Program" (/dashboard/referrals).
- **How it Works**: The user copies their unique referral link and shares it. 
- **Referee Benefit**: Anyone who signs up using a referral link automatically receives a 5% discount on their first major service via an exclusive Welcome Promo Code shown on their dashboard.
- **Referrer Earning**: When the invited user successfully completes a paid service, a fixed cash reward is instantly deposited into the referrer's "Available Balance." Earnings are strictly per-service and require the service to be officially approved/completed by the admin.
- **Payouts**: Referrers must bind their Nigerian bank account (10-digit NUBAN). The bank account name MUST match their registered LoraBiz name. Once they reach the minimum withdrawal limit, they can request a direct cashout to their bank.
- **Rules**: Self-referrals and fraudulent accounts are strictly prohibited and will result in permanent suspension.

## 8. SUPPORT & ISSUE RESOLUTION
- For payment issues, users should check the "Transactions" ledger to see if a transaction failed. 
- For failed wallet funding or urgent inquiries, users should click the floating WhatsApp widget on the bottom right of the screen to chat directly with human support or you offer to connect them to human support.
`;
