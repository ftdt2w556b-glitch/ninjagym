@AGENTS.md

## How staff actually use the app

- **PIN codes, not QR scanning.** The URL paths (`/qr/card/[id]`) and some component names (e.g. `ScannerClient`) still say "QR" for historical reasons, but in the dojo staff look members up by their 4-digit PIN. There is no physical QR scanner on site. Don't suggest scan-based UX; suggest PIN entry / PIN lookup.
- **Bangkok front desk on a tablet.** UI must work touch-first on a tablet POS, not a desktop.
- **Cash + PromptPay parity.** Anything touching sales, payments, transactions, or the sales/reports page MUST be verified against both flows. Cash flows through `cash_sales` (with `reference_id` → `member_registrations`); PromptPay flows through `member_registrations` directly. See dev rule in user MEMORY.

## Pending feature ideas (not built yet — wait for go-ahead)

### Member notes (per account, parent-visible)
Surface a short stream of staff notes at the bottom of the parent's QR card so parents see real touchpoints from each session.

- **Scope:** per-account (member_registrations.id, not per-kid). Staff free-types the kid's name in the note body if relevant.
- **Tone:** parent-visible only. Negative / behavioural ("tattle-tale") notes stay in-person — never written here. The point is to encourage staff to find positive observations and keep the parent app feeling alive.
- **Likely shape:** new `member_notes` table (`id`, `member_id`, `body`, `created_by`, `created_at`); `GET`/`POST /api/members/[id]/notes`; display block on `QrCardClient`; add-note form on the admin member page (`app/admin/members/[id]/page.tsx`). Append-only for v1.
- **Why parked:** user wants to think about framing and the surface area before building. Wait for the user to ping this before implementing.
- **Related:** the late-pickup / overtime feature (also parked) may attach into this notes channel rather than become a separate billing feature.
