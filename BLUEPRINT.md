# AuditAI Platform - Blueprint Phase 1

This document is the production-ready **blueprint** for the AuditAI Platform
expansion. It defines the complete frontend/product architecture for:

- **40 Audit Tools** (professional tool UIs, registry, config schemas, report structures)
- **Labs** (experimental modules area)
- **StoryVerse** (community collaborative publishing platform)
- **Platform-wide frontend** (landing, dashboard, history, reports, pricing, checkout, support, account, security, admin, marketplace, library, wallet)

## Phase scope

- This phase delivers **structure, routes, registries, schemas and professional
  frontend UI only**.
- Business logic, AI prompts, scoring algorithms, payment logic and complex
  workers are **intentionally deferred** to future phases.
- No BullMQ/background workers are introduced.
- OCR runs **only when** an input document actually requires it.

## Tech stack

| Layer       | Choice                                  |
| ----------- | --------------------------------------- |
| Framework   | Next.js 14 (App Router) + React 18      |
| Language    | TypeScript (strict)                     |
| Styling     | Tailwind CSS 3 (dark mode via class)    |
| Icons       | lucide-react                            |
| Theme       | Custom Theme Engine (`lib/theme`)       |

## Module map

```
app/
├── page.tsx                  Landing
├── dashboard/page.tsx        Dashboard
├── tools/page.tsx            Audit Tools hub
├── tools/[slug]/page.tsx     40 tool pages (registry-driven)
├── history/page.tsx          Audit History
├── reports/page.tsx          Reports list
├── reports/[id]/page.tsx     Report detail (structure preview)
├── labs/page.tsx             Labs hub
├── labs/[slug]/page.tsx      Lab detail pages
├── storyverse/...            StoryVerse (9 routes)
├── marketplace/...           Platform marketplace (2 routes)
├── library/page.tsx          Platform library
├── wallet/page.tsx           Platform wallet/credits
├── pricing/page.tsx          Pricing
├── checkout/page.tsx         Checkout (payment simulation)
├── support/page.tsx          Support + FAQ
├── account/...               Account + Security
├── admin/page.tsx            Admin overview
├── api/health/route.ts       Health API (static)
└── not-found.tsx             404 page

components/
├── layout/                   Navbar, Footer, Container
├── ui/                       Button, Card, Badge, Table, Tabs, Dialog,
│                             Field, Feedback (skeleton/empty/error), FileUpload,
│                             ToolIcon, Accent, PageHeader
├── tools/                    ToolClient, ConfigForm, ReportSkeleton
└── labs/                     LabClient
└── storyverse/               WorkCard

lib/
├── types.ts                  Shared domain types
├── utils.ts                  cn(), formatters
├── navigation.ts             Nav model
├── theme/theme-engine.tsx    Theme Engine (light/dark/system)
├── tools/registry.ts         40-tool registry
├── labs/registry.ts          Labs registry
├── storyverse/data.ts        StoryVerse blueprint sample data
└── processing/blueprint.ts   Processing architecture decisions
```

## Audit tools (40)

Each tool in `lib/tools/registry.ts` carries:

- identity (slug, name, tagline, description)
- category
- supported input types
- pricing placeholder (tier, price, credits/run)
- basic configuration schema (config fields rendered by `ConfigForm`)
- result/report page structure (report sections rendered by `ReportSkeleton`)
- tool-specific route (`/tools/[slug]`)
- professional frontend UI (`ToolClient`)

| # | Tool | Category |
|---|------|----------|
| 1 | Contract Watchdog | Legal |
| 2 | Insurance Trap Detector | Legal |
| 3 | Privacy Policy Auditor | Privacy & Compliance |
| 4 | Terms & Conditions Analyzer | Privacy & Compliance |
| 5 | Rental Agreement Analyzer | Legal |
| 6 | Employment Contract Analyzer | Employment & Career |
| 7 | Salary Slip Analyzer | Finance |
| 8 | Resume Auditor | Employment & Career |
| 9 | Offer Letter Analyzer | Employment & Career |
| 10 | Invoice Auditor | Finance |
| 11 | GST Invoice Checker | Tax |
| 12 | Tax Notice Analyzer | Tax |
| 13 | Legal Notice Analyzer | Legal |
| 14 | Loan Agreement Analyzer | Finance |
| 15 | Bank Statement Analyzer | Finance |
| 16 | Medical Report Analyzer | Health & Medical |
| 17 | Prescription Checker | Health & Medical |
| 18 | Research Paper Reviewer | Research & IP |
| 19 | Patent Risk Analyzer | Research & IP |
| 20 | Trademark Checker | Research & IP |
| 21 | Copyright Risk Analyzer | Research & IP |
| 22 | Website Privacy Audit | Privacy & Compliance |
| 23 | Cookie Compliance Checker | Privacy & Compliance |
| 24 | SEO Audit | Marketing & SEO |
| 25 | Accessibility Audit | Privacy & Compliance |
| 26 | Cyber Security Checklist | Security |
| 27 | AI Generated Content Detector | Security |
| 28 | Scam Detector | Security |
| 29 | Fraud Risk Analyzer | Security |
| 30 | Financial Risk Analyzer | Finance |
| 31 | Business Proposal Reviewer | Business |
| 32 | NDA Analyzer | Legal |
| 33 | Vendor Agreement Auditor | Business |
| 34 | Partnership Agreement Auditor | Business |
| 35 | Due Diligence Analyzer | Business |
| 36 | Compliance Checker | Privacy & Compliance |
| 37 | Corporate Governance Audit | Business |
| 38 | Document Comparison | Productivity |
| 39 | Clause Risk Detection | Legal |
| 40 | Custom AI Audit | Productivity |

## Labs

`lib/labs/registry.ts` defines 21 experiments across 7 categories
(Experimental AI, Document Intelligence, Research, Security, Compliance,
Data & Forensics, Future AI). Each has a name, description, status
(Experimental/Beta), a basic frontend page (`/labs/[slug]`) and placeholder
configuration. No backend processing is performed.

## StoryVerse

Community collaborative publishing platform with these blueprint routes:

- `/storyverse` - hub
- `/storyverse/create` - create a story + canon rules
- `/storyverse/write/[id]` - writing workspace (contributions, AI check, voting)
- `/storyverse/read/[id]` - reader view + chapters
- `/storyverse/marketplace` - published works
- `/storyverse/marketplace/[id]` - work detail + purchase
- `/storyverse/library` - reader shelf
- `/storyverse/wallet` - author earnings/wallet
- `/storyverse/support/discussion` - community discussions

Core loop: users create stories -> co-authors contribute snippet-level content
-> AI checks continuity/safety -> community votes -> winners become canon ->
rounds/chapters progress -> publication review -> marketplace -> attribution
and revenue shares. All of this is UI blueprint only in this phase.

## Processing architecture

See `lib/processing/blueprint.ts`. Key rules:

1. **No BullMQ / background workers** in this phase. Async processing is only
   added later for operations that genuinely require it (OCR batches, bulk
   comparison, StoryVerse AI continuity over large chapters).
2. **OCR is on-demand only** - triggered solely when the uploaded document
   actually needs it (scanned/image-based files). Selectable-text PDFs, TXT,
   DOCX use direct text extraction.
3. Input-to-pipeline mapping is documented and surfaced in `/admin`.

## Theme engine

`lib/theme/theme-engine.tsx` provides `ThemeProvider`, `useTheme()` and
`ThemeToggle`. Light/dark themes are driven by CSS variables in
`app/globals.css` with `class`-based dark mode. Default follows system
preference; the choice is persisted to `localStorage`.

## Blueprint vs. future phases

Deliberately NOT implemented (see audit report for details):

- Analysis engines, AI prompts, scoring/risk algorithms
- OCR/processing execution (decision matrix only)
- BullMQ/workers
- Billing, payments, payouts, revenue sharing, checkout processing
- Authentication, session management, 2FA, password changes
- Data persistence (audit history, reports, library, wallets, discussions)
- Marketplace commerce/installs
- StoryVerse contribution/voting/canon/publication engines

## Running

```bash
./start.sh            # installs deps if needed and starts dev server on :3000
npm run dev           # or directly
npm run build && npm run start
npm run typecheck     # TypeScript check
npm run lint          # ESLint
```

Health check: `GET /api/health`.
