# NinjaGym PWA — Claude Code Build Instructions
## Project: ninjagym.com (Full Replacement of dojo.ninjagym.com)
## Stack: Next.js 15 · Supabase · Vercel · Resend · TypeScript · Tailwind CSS · PWA

---

## WHAT WE ARE BUILDING

A full Progressive Web App (PWA) that:
- Replaces the current Laravel app at dojo.ninjagym.com
- Lives at ninjagym.com (Vercel hosted)
- Works as a full-screen app on an Android tablet at the front desk (PWA installed from Chrome)
- Handles member registration, QR check-in, PromptPay slip uploads, birthday/event bookings, shop orders, staff dashboards, and cash drawer + receipt printing via a local Bluetooth bridge service on the tablet
- Is usable offline for basic check-in (service worker caching)
- Supports Thai, English, and Russian (flag switcher on public-facing forms)

This is NOT a redesign — it is a feature-complete rebuild of the existing system with the same business logic, plus PWA and POS capabilities.

---

## STACK

| Service | Role |
|---|---|
| Next.js 15 (App Router) | Framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Supabase | Postgres DB + Auth + Storage |
| Vercel | Hosting + auto-deploy on git push |
| Resend | Transactional email |
| next-pwa (or built-in manifest) | PWA install + offline support |

---

## PHASE PLAN

Build in this order. Complete each phase before starting the next.

### Phase 1 — Foundation
- Project scaffolding (Next.js 15, TypeScript, Tailwind)
- Supabase schema (all tables below)
- Auth: Supabase Auth with role-based access (admin / staff / owner)
- Layout system: public layout (480px max), staff layout (900px max)
- PWA manifest + service worker

### Phase 2 — Public Pages
- Home / landing page
- /join — member self-registration form (EN/RU/TH switcher)
- /qr/card/[id] — member QR check-in card
- /promptpay — PromptPay instructions page
- /birthdays — birthday/event booking form
- /shop — public shop page

### Phase 3 — Staff Dashboard
- /dashboard — daily summary
- /admin/members — member list + search
- /admin/payments — PromptPay slip review + approval
- /admin/event-bookings — birthday/event bookings list + edit
- /admin/shop-orders — shop order queue
- /admin/staff — staff account management
- /admin/reports/cash — cash report + CSV export
- /scanner — QR scan check-in page

### Phase 4 — POS Layer (Tablet)
- Staff PIN login screen (full-screen, no browser chrome when installed as PWA)
- Cash sale recording with "who processed it + timestamp" logging
- Local printer bridge integration (POST to http://localhost:3001)
- /admin/pos — simplified POS view for counter staff

### Phase 5 — Polish
- Multi-language EN/RU/TH (flag switcher, JS translations object)
- Offline fallback (service worker caches check-in page + member lookup)
- Stripe payment option (secondary, collapsed by default on forms)
- Stripe webhook endpoint for auto-approval on payment success

---

## SUPABASE DATABASE SCHEMA

Run these SQL migrations in Supabase SQL Editor in order.

### users / auth
Supabase Auth handles users. Add a `profiles` table for roles:

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  role text not null default 'staff', -- 'admin' | 'staff' | 'owner'
  pin text, -- 4-digit PIN hashed with bcrypt, used only on /admin/pos tablet login
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Admins can manage profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

### member_registrations
```sql
create table member_registrations (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  kids_names text,
  kids_count int default 1,
  membership_type varchar(50) not null,
  sessions_remaining int,
  payment_method varchar(20) default 'promptpay', -- 'promptpay' | 'cash'
  amount_paid numeric(10,2),
  slip_image text, -- Supabase Storage path
  slip_status varchar(30) default 'pending_review',
  -- Values: pending_review | cash_pending | approved | rejected
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  slip_notes text,
  notes text,
  registered_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### attendance_logs
```sql
create table attendance_logs (
  id bigserial primary key,
  member_id bigint references member_registrations(id),
  member_name text,
  member_email text,
  check_in_at timestamptz default now(),
  checked_in_by uuid references profiles(id), -- null if self-scan
  notes text
);
```

### event_bookings (birthdays)
```sql
create table event_bookings (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  event_date date not null,
  time_slot varchar(30) not null, -- 'morning' | 'afternoon' | 'evening' | 'weekend'
  hours varchar(50), -- freetext display e.g. "7pm-9pm"
  num_hours numeric(4,1), -- numeric for price calc e.g. 2.0
  num_kids int default 1,
  birthday_child_name text,
  birthday_child_age int,
  payment_method varchar(20) default 'promptpay',
  amount_paid numeric(10,2),
  slip_image text,
  slip_status varchar(30) default 'pending_review',
  -- Values: pending_review | cash_pending | approved | rejected
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  slip_notes text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### shop_orders
```sql
create table shop_orders (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  items jsonb not null, -- [{id, name, qty, size_or_flavor, unit_price}]
  total_amount numeric(10,2),
  payment_method varchar(20) default 'promptpay',
  slip_image text,
  slip_status varchar(30) default 'pending_review',
  slip_notes text,
  notes text,
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  created_at timestamptz default now()
);
```

### cash_sales (new — POS layer)
```sql
create table cash_sales (
  id bigserial primary key,
  sale_type varchar(50), -- 'membership' | 'shop' | 'event' | 'walkin'
  reference_id bigint, -- FK to member_registrations, shop_orders, or event_bookings
  amount numeric(10,2) not null,
  items jsonb, -- snapshot of what was sold
  processed_by uuid references profiles(id) not null,
  processed_at timestamptz default now(),
  drawer_opened boolean default false,
  receipt_printed boolean default false,
  notes text
);
```

### drawer_log (POS audit trail)
```sql
create table drawer_log (
  id bigserial primary key,
  opened_by uuid references profiles(id) not null,
  opened_at timestamptz default now(),
  reason text, -- 'cash_sale' | 'manual_open' | 'no_sale'
  sale_id bigint references cash_sales(id),
  tablet_ip text -- for multi-tablet tracking later
);
```

### settings
```sql
create table settings (
  key varchar(100) primary key,
  value text,
  label text
);

-- Seed base prices (THB)
insert into settings (key, value, label) values
  ('price_climb_unguided', '250', 'Unguided Climb (per session)'),
  ('price_session_group', '350', 'Group Session (per session)'),
  ('price_session_1to1', '600', '1-to-1 Session (per session)'),
  ('price_day_camp', '450', 'Day Camp (per session)'),
  ('price_combo_game_train', '400', 'Combo Game + Train (per session)'),
  ('price_all_day', '500', 'All Day (per session)'),
  ('price_monthly_2hr', '2500', 'Monthly 2hr Pass'),
  ('price_monthly_5hr', '5500', 'Monthly 5hr Pass'),
  -- Group Session Cards
  ('price_sessions_4', '1200', '4-Session Card'),
  ('price_sessions_8', '2200', '8-Session Card'),
  ('price_sessions_16', '4000', '16-Session Card'),
  ('price_sessions_20', '4800', '20-Session Card'),
  -- Day Camp Cards
  ('price_day_camp_4', '1600', '4-Day Camp Card'),
  ('price_day_camp_8', '3000', '8-Day Camp Card'),
  ('price_day_camp_16', '5600', '16-Day Camp Card'),
  ('price_day_camp_20', '6800', '20-Day Camp Card'),
  -- 1-to-1 Cards
  ('price_sessions_1to1_4', '2200', '4x 1-to-1 Card'),
  ('price_sessions_1to1_8', '4200', '8x 1-to-1 Card'),
  ('price_sessions_1to1_16', '8000', '16x 1-to-1 Card'),
  ('price_sessions_1to1_20', '9600', '20x 1-to-1 Card'),
  -- All Day Cards
  ('price_all_day_4', '1800', '4x All Day Card'),
  ('price_all_day_8', '3400', '8x All Day Card'),
  ('price_all_day_16', '6400', '16x All Day Card'),
  ('price_all_day_20', '7800', '20x All Day Card'),
  -- Combo Cards
  ('price_combo_4', '1400', '4x Combo Card'),
  ('price_combo_8', '2600', '8x Combo Card'),
  ('price_combo_16', '4800', '16x Combo Card'),
  ('price_combo_20', '5800', '20x Combo Card'),
  -- Birthday rates (per hour)
  ('birthday_rate_morning', '3000', 'Morning Rate/hr'),
  ('birthday_rate_afternoon', '5000', 'Afternoon Rate/hr'),
  ('birthday_rate_evening', '3000', 'Evening Rate/hr'),
  ('birthday_rate_weekend', '5000', 'Weekend Rate/hr'),
  -- Birthday kids extras
  ('birthday_extra_6_10', '500', 'Extra 6-10 kids'),
  ('birthday_extra_11_15', '1000', 'Extra 11-15 kids'),
  ('birthday_extra_16_20', '1500', 'Extra 16-20 kids');
```

### work_instructions
```sql
create table work_instructions (
  id bigserial primary key,
  topic_name varchar(150) not null,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## BUSINESS LOGIC (CRITICAL — READ ALL OF THIS)

### Membership Pricing Rules
- `getPriceForType(type, kidsCount)` — base price from settings table
- Per-kid types (multiply base x kids_count): `climb_unguided`, `session_group`, `session_1to1`, `day_camp`, `combo_game_train`, `all_day`
- Card types (NOT multiplied — one price covers the card): `sessions_4`, `sessions_8`, `sessions_16`, `sessions_20`, `day_camp_4` ... `combo_20`, `monthly_2hr`, `monthly_5hr`
- ALWAYS use total_price for display and payment defaults, never the raw base price

### Birthday Booking Pricing
- Rates per time slot: morning=3000, afternoon=5000, evening=3000, weekend=5000 THB/hr
- Kids extras (first 5 free): 6-10 kids = +500, 11-15 = +1000, 16-20 = +1500 THB
- amount = (rate x num_hours) + kids_extra
- Double-booking prevention: same event_date + time_slot blocked if existing record has slip_status in ['pending_review', 'cash_pending', 'approved']

### Slip Status Flow
- PromptPay submission → slip_status = 'pending_review'
- Cash submission → slip_status = 'cash_pending'
- Staff approves → slip_status = 'approved'
- Staff rejects → slip_status = 'rejected'

### Role Permissions
- **admin**: full access including delete, edit, settings
- **staff**: operational — register members, scan QR, record payments, manage shop queue, view event bookings
- **owner**: read-only — cash report, slip list, member list (no edits)

### QR Check-In Card
- Public URL: /qr/card/[id]
- Shows: blue "Check-In QR Code / NOT a payment code" banner
- Yellow "Payment Pending" warning if slip_status is not 'approved'
- QR code encodes member ID for scanner page to decode

---

## DESIGN SYSTEM

### Public Pages (max-width 480px, mobile-first)
- Background: blue gradient (#1a56db → #2563eb or similar)
- Headlines: Fredoka One font
- Labels/badges: Bangers font
- Body: Nunito font
- Accent color: #FFE033 (yellow)
- CTA buttons: green (#22c55e or similar)
- Cards: white, rounded-2xl, shadow-lg
- Max-width: 480px centered

### Staff / Admin Pages (max-width 900px)
- White header with dark text
- Standard table layout
- Sidebar or top nav with role-based links
- Max-width: 900px

### Rules
- NEVER use em dashes (—) in any copy or content. Use commas, colons, or rephrase.
- No nested HTML forms. Delete/action buttons must be in separate forms.
- All images: use next/image with proper dimensions
- Currency display: format as "7,000 THB" (Thai baht with comma thousands separator)

---

## SHOP CATALOG (hardcoded)

```typescript
export const SHOP_CATALOG = [
  {
    id: 'tshirt_kids',
    name: 'Kids T-Shirt',
    price: 300,
    options: { label: 'Size', values: ['S', 'M', 'L', 'XL'] }
  },
  {
    id: 'tshirt_adult',
    name: 'Adult T-Shirt',
    price: 300,
    options: { label: 'Size', values: ['S', 'M', 'L', 'XL'] }
  },
  {
    id: 'shake_bake',
    name: 'Shake and Bake',
    price: 200,
    description: 'Includes: 1 Water, 1 Ice Cream Shake, 1 Grilled Cheese Toastie',
    options: { label: 'Flavor', values: ['Vanilla', 'Cookies and Cream', 'Chocolate', 'Strawberry'] }
  }
]
```

---

## MEMBERSHIP TYPES (full list)

```typescript
export const MEMBERSHIP_TYPES = [
  // Single sessions
  { id: 'climb_unguided', label: 'Unguided Climb', perKid: true },
  { id: 'session_group', label: 'Group Session', perKid: true },
  { id: 'session_1to1', label: '1-to-1 Session', perKid: true },
  { id: 'day_camp', label: 'Day Camp', perKid: true },
  { id: 'combo_game_train', label: 'Combo Game + Train', perKid: true },
  { id: 'all_day', label: 'All Day', perKid: true },
  // Monthly
  { id: 'monthly_2hr', label: 'Monthly 2hr Pass', perKid: false },
  { id: 'monthly_5hr', label: 'Monthly 5hr Pass', perKid: false },
  // Group Session Cards
  { id: 'sessions_4', label: '4-Session Card', perKid: false },
  { id: 'sessions_8', label: '8-Session Card', perKid: false },
  { id: 'sessions_16', label: '16-Session Card', perKid: false },
  { id: 'sessions_20', label: '20-Session Card', perKid: false },
  // Day Camp Cards
  { id: 'day_camp_4', label: '4-Day Camp Card', perKid: false },
  { id: 'day_camp_8', label: '8-Day Camp Card', perKid: false },
  { id: 'day_camp_16', label: '16-Day Camp Card', perKid: false },
  { id: 'day_camp_20', label: '20-Day Camp Card', perKid: false },
  // 1-to-1 Cards
  { id: 'sessions_1to1_4', label: '4x 1-to-1 Card', perKid: false },
  { id: 'sessions_1to1_8', label: '8x 1-to-1 Card', perKid: false },
  { id: 'sessions_1to1_16', label: '16x 1-to-1 Card', perKid: false },
  { id: 'sessions_1to1_20', label: '20x 1-to-1 Card', perKid: false },
  // All Day Cards
  { id: 'all_day_4', label: '4x All Day Card', perKid: false },
  { id: 'all_day_8', label: '8x All Day Card', perKid: false },
  { id: 'all_day_16', label: '16x All Day Card', perKid: false },
  { id: 'all_day_20', label: '20x All Day Card', perKid: false },
  // Combo Cards
  { id: 'combo_4', label: '4x Combo Card', perKid: false },
  { id: 'combo_8', label: '8x Combo Card', perKid: false },
  { id: 'combo_16', label: '16x Combo Card', perKid: false },
  { id: 'combo_20', label: '20x Combo Card', perKid: false },
]
```

---

## EMAIL SETUP (Resend)

- From name: "Rick Tew NinjaGym"
- From address: info@ninjagym.com
- Emails to build:
  1. **Registration confirmation** — fires on member signup, shows: name, membership type, total, payment instructions
  2. **Birthday/event booking confirmation** — fires when email is provided, shows: child name/age, date, time slot, hours, kids count, total, payment method. Cash customers get a PromptPay option link.

---

## PWA CONFIGURATION

Add to `next.config.ts`:
```js
// Use next-pwa package
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
})
module.exports = withPWA({ /* next config */ })
```

`public/manifest.json`:
```json
{
  "name": "NinjaGym",
  "short_name": "NinjaGym",
  "description": "NinjaGym Dojo Management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a56db",
  "theme_color": "#1a56db",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Offline strategy**: Cache the /scanner and /qr/card pages so check-in works without internet.

---

## POS / CASH DRAWER INTEGRATION

### IMPORTANT: Why Pure Browser Bluetooth Won't Work
Chrome's Web Bluetooth API only supports Bluetooth Low Energy (BLE). The Xprinter XP-58iiW uses Classic Bluetooth (SPP profile). These are incompatible — a browser tab cannot directly open the cash drawer or print receipts on this printer model. This is a hardware protocol limitation, not a software one.

**The solution**: A tiny local bridge service running on the tablet (in Termux) that the browser calls via a normal HTTP fetch to localhost. The browser talks HTTP, the bridge talks Bluetooth. This is the standard approach for all browser-based POS systems with Classic Bluetooth printers.

### Architecture
```
ninjagym.com (Vercel, Next.js)
    |
    | HTTPS — all business logic, DB writes, auth
    v
Browser on Tablet (Chrome, runs ninjagym.com as PWA)
    |
    | HTTP fetch to localhost:3001 — only for print/drawer
    v
Termux Bridge Service (Node.js, runs locally on tablet)
    |
    | Classic Bluetooth SPP
    v
Xprinter XP-58iiW — prints receipt + opens cash drawer
    |
    | RJ11 cable
    v
Cash Drawer
```

### What the Next.js app does
- All sales, members, payments, logs saved to Supabase (normal HTTPS)
- When a cash sale is confirmed, the browser (not the server) calls the bridge directly

### Browser-side bridge call (client component)
```typescript
// lib/pos/bridge.ts
// Called from client-side React, NOT from a Next.js server route
export async function openDrawerAndPrint(saleData: SaleData): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3001/print-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData),
      signal: AbortSignal.timeout(4000)
    })
    return res.ok
  } catch {
    // Bridge unavailable — sale is already saved in Supabase
    // Show manual fallback UI
    return false
  }
}
```

### Bridge service setup on tablet (one-time, done by Rick — not part of Next.js build)
This is a SEPARATE small Node.js app — NOT part of the Next.js codebase. Set up once on the Loyverse tablet.

Steps (do on the Android tablet):
1. Open Chrome on tablet, go to f-droid.org, install Termux
2. In Termux: `pkg update && pkg install nodejs`
3. `npm install -g pm2`
4. Pair the XP-58iiW in Android Bluetooth settings first
5. Create the bridge folder and files (see server.js below)
6. `pm2 start server.js && pm2 save` — runs on every Termux restart

`printer-bridge/server.js`:
```javascript
const express = require('express')
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer')
const app = express()
app.use(express.json())

// Allow calls from Chrome on the same tablet
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'bluetooth',
  characterSet: 'THAI',
  removeSpecialCharacters: false,
  lineCharacter: '-',
})

app.post('/open-drawer', async (req, res) => {
  try {
    await printer.openCashDrawer()
    await printer.execute()
    console.log('Drawer opened by:', req.body.employee)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/print-receipt', async (req, res) => {
  const { items, total, employee, saleId, memberName } = req.body
  printer.alignCenter()
  printer.println('NINJA GYM')
  printer.println('Receipt #' + saleId)
  printer.println(new Date().toLocaleString('th-TH'))
  if (memberName) printer.println('Member: ' + memberName)
  printer.println('Staff: ' + employee)
  printer.newLine()
  if (items) {
    items.forEach(item => {
      printer.leftRight(`${item.name} x${item.qty}`, `${item.price} THB`)
    })
  }
  printer.newLine()
  printer.println(`TOTAL: ${total} THB`)
  printer.newLine()
  printer.println('Thank you!')
  printer.openCashDrawer()
  printer.cut()
  await printer.execute()
  res.json({ success: true })
})

app.listen(3001, '127.0.0.1', () => console.log('Bridge running'))
```

### POS screen in the app (/admin/pos)
- Full-screen layout optimized for the tablet (landscape or portrait)
- Staff selects their name from a list (or 4-digit PIN — see questions)
- Quick buttons: Register Member, Record Cash Sale, Open Drawer (manual)
- On cash confirmation: save to Supabase THEN call bridge
- If bridge fails: show yellow warning "Printer offline — open drawer manually" but do NOT block the sale
- All sales, drawer opens, and who triggered them logged in `cash_sales` and `drawer_log`

### Phase ordering for POS
Build the full web app first (Phases 1-3). Add POS as Phase 4 once the core is working. The bridge setup on the tablet is done manually by Rick separately from the Claude Code build.

---

## MULTI-LANGUAGE (EN / RU / TH)

Implement as a client-side translations object on public-facing pages (/join, /birthdays, /shop).

```typescript
// lib/i18n/translations.ts
export const translations = {
  en: {
    joinTitle: 'Join NinjaGym',
    nameLabel: 'Your Name',
    // ... ~30 strings
  },
  ru: { /* Russian translations */ },
  th: { /* Thai translations */ }
}
```

Flag switcher: three flag buttons (EN / RU / TH) in the top-right of public pages. Selection stored in localStorage. Default: EN.

---

## FOLDER STRUCTURE

```
app/
  (public)/
    page.tsx                  -- home / landing
    join/page.tsx             -- member registration
    qr/card/[id]/page.tsx     -- member QR card
    promptpay/page.tsx        -- PromptPay instructions
    birthdays/page.tsx        -- birthday booking
    shop/page.tsx             -- shop
    shop/submitted/page.tsx   -- order confirmation
  admin/
    layout.tsx                -- staff/admin layout (900px, role check)
    dashboard/page.tsx        -- daily summary
    members/page.tsx
    payments/page.tsx         -- slip review
    event-bookings/page.tsx
    event-bookings/[id]/edit/page.tsx
    shop-orders/page.tsx
    shop-orders/[id]/edit/page.tsx
    staff/page.tsx
    reports/cash/page.tsx
    pos/page.tsx              -- POS counter screen
  scanner/page.tsx            -- QR scan check-in
  api/
    members/route.ts
    members/[id]/route.ts
    payments/route.ts
    event-bookings/route.ts
    shop-orders/route.ts
    pos/action/route.ts
    qr/scan/route.ts
    email/registration/route.ts
    email/booking/route.ts
components/
  public/
    LanguageSwitcher.tsx
    RegistrationForm.tsx
    BirthdayForm.tsx
    ShopForm.tsx
    MemberQrCard.tsx
  admin/
    SlipApproval.tsx
    EventBookingRow.tsx
    ShopOrderRow.tsx
    CashReport.tsx
    PosScreen.tsx
  ui/
    Button.tsx
    Modal.tsx
    Badge.tsx
    QrScanner.tsx
lib/
  supabase/server.ts          -- createClient + createAdminClient
  supabase/client.ts          -- browser client
  pricing.ts                  -- getPriceForType(), getBirthdayRate()
  email/send.ts               -- Resend email functions
  i18n/translations.ts        -- EN/RU/TH strings
  pos/bridge.ts               -- fetch wrapper for local printer bridge
types/
  index.ts                    -- MemberRegistration, EventBooking, etc.
supabase/
  migrations/
    001_initial_schema.sql
public/
  manifest.json
  icons/
  images/
```

---

## SUPABASE STORAGE

Create two buckets in Supabase Storage:
1. `slips` — PromptPay slip images (public read, authenticated write)
2. `member-photos` — future use

RLS on `slips`: allow anyone to insert (public upload), admins to read all.

---

## STRIPE INTEGRATION

Stripe is included as a secondary payment option (rarely used - PromptPay and cash are primary).

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Implementation:
- Install: `npm install stripe @stripe/stripe-js`
- Add Stripe as a third payment_method option ('stripe') on the registration and shop forms
- Show Stripe option collapsed/secondary - default selection is always PromptPay
- On Stripe payment: create PaymentIntent server-side, collect card client-side with Stripe Elements
- On success: set slip_status = 'approved' automatically (no manual review needed)
- Webhook endpoint: /api/stripe/webhook - listens for payment_intent.succeeded

Do NOT build Stripe in Phase 1-3. Add it in Phase 5 after core app is complete.

## ENV VARIABLES

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=https://ninjagym.com
NEXT_PUBLIC_PRINTER_BRIDGE_URL=http://localhost:3001
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## EXISTING DATA MIGRATION

The current system runs on MySQL at A2 Hosting (ricktew_Gymtest). After the new app is built and tested, migrate data with a one-time script:

```
NOTE: Launch with fresh data - no migration at go-live.
dojo.ninjagym.com stays running on A2 Hosting as read-only reference for historical records.
Staff can look up old members there if needed. New registrations go into the new Supabase app only.

If a full migration is needed later, the tables to map are:
- member_registrations → member_registrations (map columns)
- attendance_logs → attendance_logs
- event_bookings → event_bookings
- shop_orders → shop_orders
- work_instructions → work_instructions
- settings → settings (prices only)
- users (Laravel) → Supabase Auth (create accounts manually or via admin API)
```

Migration script approach: Export MySQL to CSV, transform with a Node.js script, insert via Supabase admin client. Do this AFTER the new app is fully tested.

---

## DOMAIN SETUP

- **ninjagym.com** - the new app lives here (Vercel)
- **dojo.ninjagym.com** - keep running on A2 Hosting for reference during transition, shut down after migration is confirmed complete
- The two apps are independent and can run in parallel with no conflict

## CLAUDE CODE WORKFLOW INSTRUCTIONS

### Auto-push (reduces the push-allow friction)
The push prompts come from GitHub asking for credentials each time. Fix this once in Mac Mini terminal before starting Claude Code:

```bash
gh auth login
# GitHub CLI - authenticate once, token stored, no more prompts ever
# Or switch the remote to SSH so it never asks:
git remote set-url origin git@github.com:YOUR_USERNAME/ninjagym.git
```

After that, Claude Code with --dangerouslySkipPermissions can git push with zero interruptions.
Vercel auto-deploys on every push - no interaction needed on your side.
Supabase schema changes: Claude Code writes the SQL, run it once in the Supabase SQL Editor per migration.

### Connect Supabase MCP to Claude Code (optional but powerful)
Lets Claude Code query and migrate Supabase directly without copy-pasting SQL.
Add to .claude/mcp.json in the project root:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "YOUR_SUPABASE_ACCESS_TOKEN"]
    }
  }
}
```

Get your access token at: supabase.com/dashboard/account/tokens
With this, Claude Code can create tables, run migrations, and inspect data without any copy-paste from you.

### General workflow rules
- Run all terminal commands automatically without asking permission
- git add, git commit, git push after each completed phase
- TypeScript check before each push: npx tsc --noEmit
- Build check before each push: npm run build
- Never commit .env.local
- Use createAdminClient() (service role key) for all server-side admin queries
- Do NOT use createClient() for admin work - anon key applies RLS and hides data
- Never use em dashes in any UI copy - use commas or colons instead
- Currency format: "7,000 THB" always
- iOS Safari date inputs need -webkit-appearance: none and min-height: 50px
- Image compression on Mac: sips -Z 1200 public/images/image.png

---

## STARTING PROMPT FOR CLAUDE CODE

Use this to start your first Claude Code session:

> "You have permission to run all terminal commands automatically without asking. 
> 
> We are building a full Next.js 15 PWA for NinjaGym to replace an existing Laravel app. The complete specification is in CLAUDE_CODE_NINJAGYM_BUILD.md in this folder. Read it fully before writing any code.
> 
> Start with Phase 1: scaffold the Next.js project, set up Supabase schema, configure auth with roles, build the layout system, and add PWA manifest. Use the exact folder structure, database schema, and business logic in the spec. Ask me for env variable values when ready to connect Supabase and Resend."

---

## CONTACTS / ACCOUNTS NEEDED

Before starting, have these ready to give Claude Code:
- Supabase project URL + anon key + service role key
- Resend API key
- Vercel project URL (after connecting GitHub repo)
- GitHub repo URL
- Printer bridge tablet local IP address (once tablet is set up on WiFi)

---

*Spec version: 1.0 — Based on dojo.ninjagym.com session 28 feature set*
*Prepared: 2026-03-27*
