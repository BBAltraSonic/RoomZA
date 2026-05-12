# RoomZA Production Feature Blueprint

This document outlines the end-to-end plan to transition the RoomZA MVP into a fully-fledged, production-ready Platform. It covers expansive user flows, a comprehensive screen inventory, monetization strategies, and new technical integrations.

## 1. Executive Summary

The MVP successfully built the discovery, application, matching, and offline scheduling loop. Production readiness demands that RoomZA become a **high-trust transactional platform** handling identity vetting, risk profiling, digital lease execution, payment collection, and post-occupancy relationship management. 

## 2. Expanded Target Personas

1. **The Verified Renter**: A tenant seeking transparency, fast approvals, and digital-first interactions (not wanting to print or email sensitive files).
2. **The Solo Landlord**: Manages 1-5 properties; needs peace of mind, standardized leases, guaranteed rent, and automated processes.
3. **The Property Management Agency**: Manages 10+ properties; needs bulk actions, staff roles (RBAC), API integrations, and pipeline views.
4. **The RoomZA Admin**: Super-users maintaining platform safety, dispute resolution, and auditing transactions.

---

## 3. End-to-End User Flows

### A. Renter Flows

#### 1. Discovery & Intelligence Flow
- **Event:** Renter opens app.
- **Actions:** 
  - Searches map, sets detailed criteria (pet-friendly, fiber-ready, backup power).
  - Can view *EskomSePush* integration for load-shedding schedules of the area.
  - Can view *Isochrone* commute overlays (e.g., "30 min drive to Sandton").
  - Saves search and enables Push/WhatsApp alerts for new matching inventory.

#### 2. KYC & Financial Passport Flow
- **Event:** Renter wants to apply for a premium listing.
- **Actions:** 
  - Renter goes through an automated identity check (e.g., SmileID) requiring a selfie and ID photo.
  - Connects bank via Open Banking (e.g., Stitch.money) for automatic income verification.
  - Opts into a soft credit check (e.g., TransUnion SA).
  - RoomZA assigns a "Verified Trust Score", eliminating manual document checking for the landlord.

#### 3. Leasing & Checkout Flow
- **Event:** Application is approved.
- **Actions:**
  - Renter receives push notification and email of approval with a dynamic digital lease.
  - Renter reviews lease, inputs custom clauses if negotiated, and e-signs (e.g., HelloSign/DocuSign API).
  - Redirected to Checkout screen.
  - Renter pays deposit + first month's rent + admin fee via Paystack (EFT, Card, Apple/Google Pay).
  - RoomZA holds funds in escrow until the move-in inspection is signed off.

#### 4. Occupancy & Maintenance Flow
- **Event:** Renter moves in.
- **Actions:**
  - Performs a digital condition inspection (uploads photos of existing damage to app).
  - During lease: Submits maintenance tickets with photos and priority ratings.
  - Pays monthly rent through automatic debit orders natively synced to the platform.
  - Receives automatic utility bill split invoices.

### B. Landlord & Agency Flows

#### 1. Portfolio & Listing Operations
- **Event:** Agency wants to scale.
- **Actions:**
  - Agency bulk uploads properties via CSV or API sync.
  - Uses AI assistant to generate marketing copy based on property features.
  - Purchases "Premium Placement" to boost visibility on the map.
  - Configures viewing availability via 2-way Google/Outlook Calendar sync.

#### 2. Advanced Applicant Screening
- **Event:** Applications arrive.
- **Actions:**
  - Landlord views a Kanban board of applicants (New -> Screening -> Interviewing -> Offered).
  - Immediately sees algorithmic Risk Score (Credit, Affordability, Verified Income).
  - One-click reference check emails sent to previous landlords/employers.

#### 3. Onboarding & Payment Collection
- **Event:** Tenant selects move-in date.
- **Actions:**
  - Landlord uses RoomZA's standardized, legally compliant SA Rental Act lease templates.
  - Adds specific house rules addendums.
  - System automatically reconciles incoming rent and updates the financial dashboard.
  - Notifies landlord of arrears via WhatsApp/Email.

---

## 4. Comprehensive Screen Inventory

### Renter Application & Portal
| Screen | Description / Features |
|--------|------------------------|
| **KYC Identity Verification** | Live facial recognition -> ID scan -> Success confirmation. |
| **Financial Passport** | Open banking link modal, Credit check consent toggle, Document wallet. |
| **Advanced Map Filters** | Bottom sheet: Bed, Bath, Price, Property Type, Pet Policy, Fiber, Generator/Solar, Security (Estate, Electric Fence). |
| **Saved Searches Setup** | Define alert parameters, select frequency (Realtime, Daily digest), channel (Email, Push, WA). |
| **Offer Validation & E-Sign** | Secure view of PDF, signature block drawn on device, "Accept Lease" terms. |
| **Payment Gateway** | Paystack checkout inline UI, Invoice breakdown (Rent, Deposit, Fees). |
| **Tenant Dashboard Home** | Quick actions (Pay Rent, Log Fault), Next billing date, Active lease summary. |
| **Maintenance Desk** | List of tickets. "New Ticket" wizard (Category, Description, Upload Photos, Access Permission). |
| **Wallet & Billing History** | Paged list of past payments, downloadable PDF statements. |
| **Move-in/out Inspection** | Guided camera flow covering each room, signature checkoff. |

### Landlord & Agency Command Center
| Screen | Description / Features |
|--------|------------------------|
| **Executive Overview** | MRR (Monthly Recurring Revenue), Occupancy Rate gauge, Arrears alert, Pending tasks. |
| **Listing Manager (Table/Grid)** | View all properties, toggle Draft/Published/Archived, tags for "Boosted". |
| **Intelligent Listing Builder** | Multi-step form. Step 1: Address mapping. Step 2: Details & Pricing. Step 3: Media (drag-and-drop sort, cover select). Step 4: AI Description. Step 5: Publish. |
| **Applicant Pipeline (Kanban)** | Drag and drop applicant cards across columns. Hover for quick stats (Income:Rent ratio). |
| **Applicant Deep Dive Profile** | Trust Score dial, Credit Report PDF summary, Open banking income verification badge, Private landlord notes, Chat inline window. |
| **Lease & Document Center** | Template editor, Placeholder tokens (`{{tenant_name}}`), Sent leases tracking. |
| **Financial Tracker** | Ledger view per property, Automated reconciliation marks, Tax-ready CSV export. |
| **Team Settings (Agency only)** | Invite team members. Roles: Admin, Agent, Finance, Maintenance. |

### SuperAdmin Dashboard
| Screen | Description / Features |
|--------|------------------------|
| **Platform Analytics** | GMV, Total Active Leases, CAC, User Growth. |
| **Review & Moderation Queue** | Flagged chats, reported scam listings. "Ban User", "Takedown Listing" actions. |
| **Payouts Ledger** | Escrow release manual overrides, platform commission tracking. |

---

## 5. Technical Enhancements & Integrations

To accomplish this production state, the tech stack must expand:

1. **Identity & Background:** 
   - **SmileID / Yoti:** Fraud-proof biometric identity verification.
   - **TransUnion / Experian SA:** Soft credit pulls via API.
2. **Financial Data & Payments:**
   - **Stitch / Mono:** Verify actual income from bank transactions securely without uploaded payslip fraud.
   - **Paystack / Stripe:** Escrow, splits (routing landlord rent and RoomZA commission), and subscription billing.
3. **Digital Signatures:**
   - **DocuSign / HelloSign API:** Programmatic generation of legally binding lease agreements.
4. **Search Infrastructure:**
   - **Typesense or Algolia:** Moving away from standard Postgres for faster, typo-tolerant, faceted search over millions of properties.
5. **Hyper-Local API Context:**
   - **EskomSePush API:** Critical in SA context, to show real-time load-shedding areas.
   - **OpenStreetMap / Google Distance Matrix:** Travel time calculations.
6. **Communications:**
   - **Twilio / WhatsApp Business API:** High-conversion transactional notifications.
   - **PWA Push Notifications:** Native feel without app store tax.

---

## 6. Business Logic & Monetization Strategy

**How RoomZA Makes Money:**

1. **The Renter Trust Profile (Optional Renter Fee)**
   - Renter pays a once-off fee (~R150) for a verified background credit & criminal check that validates them for 30 days across any application.
2. **Landlord Premium Placements (Advertising)**
   - Landlords pay for their pins to appear larger and pulse on the map, and rank #1 in the side-panel list.
3. **Transaction / Management Convenience Fee (Take Rate)**
   - Free plan: Manual. Premium automated plan: RoomZA manages rent collection, keeps 2-4% processing fee, and guarantees 1st of month payouts regardless of tenant delays (requires backing capital).
4. **Lease Generation Fees**
   - R100 per legally vetted generated digital lease signature.

---

## 7. Implementation Roadmap

### Phase 1: Deep Verification & Confidence Engine
- Integrate Open Banking & Auto-KYC for application flows.
- Transition manual application review to a "Trust Score" algorithm.
- Build the comprehensive Landlord Application pipeline (Kanban view).

### Phase 2: Transaction Layer & E-Signatures
- Programmatic PDF generation and dynamic lease templating.
- Paystack integration for secure Deposit and Rent holding.
- Setup RoomZA escrow logic to prevent rental scams.

### Phase 3: Occupancy Lifecycle Platform
- The multi-user Tenant portal (Invoices, Leases, Helpdesk).
- Landlord maintenance ticketing and vendor allocation.
- Move-in / Move-out digital inspections flow.

### Phase 4: Pro-Tools & Scale
- Bulk listing uploads for agencies.
- Team Roles (RBAC).
- AI ad-copy generation and automated rent estimation data models.
- Migrate web app to enclosed React Native applications for App Store/Play Store distribution.
