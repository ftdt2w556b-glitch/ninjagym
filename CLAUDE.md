@AGENTS.md

## How staff actually use the app

- **PIN codes, not QR scanning.** The URL paths (`/qr/card/[id]`) and some component names (e.g. `ScannerClient`) still say "QR" for historical reasons, but in the dojo staff look members up by their 4-digit PIN. There is no physical QR scanner on site. Don't suggest scan-based UX; suggest PIN entry / PIN lookup.
- **Bangkok front desk on a tablet.** UI must work touch-first on a tablet POS, not a desktop.
- **Cash + PromptPay parity.** Anything touching sales, payments, transactions, or the sales/reports page MUST be verified against both flows. Cash flows through `cash_sales` (with `reference_id` → `member_registrations`); PromptPay flows through `member_registrations` directly. See dev rule in user MEMORY.

## Security model (current state)

- **PIN brute force is rate-limited.** `/api/scanner/lookup` tracks failed attempts per IP in `lookup_attempts`. 8 wrong PINs within 10 min → 30-min lockout. Success clears the counter.
- **Belt perks are once-per-cycle, re-earnable.** Stored in `member_perks_redeemed (family_id, perk_type, redeemed_at, pending_id)`. The Nth redemption requires `uniqueCheckInDays >= belt.min × N`. Thresholds live in `BELTS` (`QrCardClient.tsx`) and are mirrored in `PERK_BASE_THRESHOLD` (`/api/members/[id]/redeem-perk`). **Keep those two in sync.**
- **Slip duplicate detection.** `slip_hash` (SHA-256) on `member_registrations`, `event_bookings`, `shop_orders`. Computed by `lib/slip-hash.ts` at every upload site. Admin payments page flags exact-byte re-uploads with an amber pill.
- **Slip image retention.** Daily Vercel Cron at 02:00 Bangkok hits `/api/cron/cleanup-slips`, deletes storage objects older than `settings.slip_retention_days` (default 180), nulls `slip_image` on the row. Financial record (amount, hash, dates) is preserved indefinitely. Cron is gated by `CRON_SECRET` env var.
- **Realtime is staff-only.** `pending_checkins.SELECT` policy requires an authenticated staff session. The only realtime broadcast still firing for anon clients is nothing. Parents poll instead, via:
  - `GET /api/checkin/pending-status?id=&token=` (one pending row)
  - `GET /api/members/[id]/topup-status?token=` (cash + PromptPay top-up flow)
- **Parent-facing token endpoints (token = signed `cardToken`):**
  - `POST /api/members/[id]/redeem-perk` — perk request
  - `PATCH /api/members/[id]/notify-prefs` — toggle email notifications
  - `GET /api/checkin/pending-status` — poll pending status
  - `GET /api/members/[id]/topup-status` — poll top-up status
  - The admin `PATCH /api/members/[id]` is staff-only — don't route parent updates there (it'll silently 401 and the toggle won't save).
- **`membership_type` is canonical-id-only on writes.** Use `resolveMembershipType()` in `lib/pricing.ts` before writing to `pending_checkins.membership_type` or `attendance_logs.membership_type`. Older clients sometimes sent a label string here, which breaks the Timers tab and report grouping.
- **`attendance_logs.kids_names` must be populated on every check-in path.** Three writers: `/api/checkin` (admin), `/api/checkin/handle` (parent QR), `/api/pos/action` (cash POS auto-checkin). All three resolve top-ups → parent for kids name lookup.

## Open security TODOs (deferred, no urgency)

- **Captcha on `/join`** — cosmetic; only matters if junk member rows become a real problem.
- **Rate limit on `/api/checkin/request`** — token-holder spam; low risk, defer until seen.
- **Bump PIN to 6 digits** — bigger keyspace; defer until brute-force lock fires for real users.

## Pending feature ideas (not built yet — wait for go-ahead)

### Member notes (per account, parent-visible)
Surface a short stream of staff notes at the bottom of the parent's QR card so parents see real touchpoints from each session.

- **Scope:** per-account (member_registrations.id, not per-kid). Staff free-types the kid's name in the note body if relevant.
- **Tone:** parent-visible only. Negative / behavioural ("tattle-tale") notes stay in-person — never written here. The point is to encourage staff to find positive observations and keep the parent app feeling alive.
- **Likely shape:** new `member_notes` table (`id`, `member_id`, `body`, `created_by`, `created_at`); `GET`/`POST /api/members/[id]/notes`; display block on `QrCardClient`; add-note form on the admin member page (`app/admin/members/[id]/page.tsx`). Append-only for v1.
- **Why parked:** user wants to think about framing and the surface area before building. Wait for the user to ping this before implementing.
- **Related:** the late-pickup / overtime feature (also parked) may attach into this notes channel rather than become a separate billing feature.
