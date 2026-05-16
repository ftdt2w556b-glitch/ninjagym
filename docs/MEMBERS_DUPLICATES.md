# Member duplicate cleanup — May 2026

Reference of the duplicate scan run on `member_registrations` (parent rows only,
top-ups excluded). Captured the state right before cleanup so we have a record
of what was merged into what.

## Rules applied

1. **Never delete a row with `sessions_remaining > 0`** — those sessions are
   already paid for and belong to a real member's card.
2. **Never delete a row that has rows referencing it** (top-ups, attendance,
   tax invoices, perks, loyalty, pending check-ins) without repointing those
   references to the survivor first.
3. **Default survivor is the LATEST (largest) ID** — that's the one the parent
   most recently used and likely has on file.
4. **Override default when the OLDER row has clearly more data** (many
   top-ups, attendance, perks) — that row is the live family card.

## Operations performed

For each group, "KEEP" is the survivor. Anything pointing at the deleted IDs
got repointed at the survivor first.

### Pure deletes (zero references anywhere)

| Group | Kept | Deleted | Why safe |
|---|---|---|---|
| Jana Ludwig (Yuriy) | 1324 | 1357 | 1357 had no top-ups / attendance / anything |
| Ksenia Raditsa (Leo, lisa) | 154 | 575 | 154 is heavy family with 24 top-ups, 4 attendance, 1 perk |
| Rinrada Rakdee (Ploy Sai) | 1074 | 1305 | 1074 still has 3 sessions remaining + attendance |
| Aisha kanchula (Austin) | 1168 | 1167 | Same minute submits, neither had any usage |
| MEENA promwan (Fatal Akhtar) | 93 | 383 | 93 is heavy with 5 top-ups + attendance |
| Erika crocco (Blu and Nami) | 914 | 913 | Two-minute apart, 914 already had a top-up |
| Janaya (Journaay) | 268 | 463 | 268 has 2 top-ups, 463 had nothing |
| Sonia (Maya and Indira) | 473 | 263 | 473 already had a top-up |

### Merge then delete (top-ups / attendance moved to survivor)

| Group | Kept | Merged-then-deleted | Moved |
|---|---|---|---|
| Haim rav (Alon asaf) | 688 | 660, 732 | 1 + 2 top-ups → 688 |
| Aricha (Nikolai, Thea) | 243 | 248 | 1 top-up → 243 |
| Natsiporn (Matthew) | 499 | 183 | 1 top-up → 499 |
| Vered rein (Gabi) | 1205 | 793 | 1 top-up → 1205 |
| Charlotte (Tommy & Ezra) | 223 | 225 | 1 top-up → 223 (223 has both kids) |
| Morgane Léger | 1075 | 854 | 1 top-up → 1075 |
| adam weiss (Blu, nami) | 626 | 561 | 1 top-up → 626 (626 has both kids) |
| Kirill (Platon) | 580 | 302 | 1 top-up → 580 |
| Omer Keshet (Arya, Beeri) | 1266 | 345 | 1 top-up → 1266 (full name) |
| Maciejewska (Gucio) | 237 | 347 | 2 top-ups → 237 (original spelling) |
| Milana → Shkolnikov (Ray) | 606 | 448 | 1 top-up → 606 (newer surname) |
| Maiko Irvine (Kaito, Zenny) | 978 | 533 | 2 top-ups → 978 (has phone) |
| Nicola Stapleford | 1289 | 1292 | 1 top-up → 1289 (1289 has all 3 kids) |
| Leyla Mayko (Ryan, Jamie) | 1349 | 166 | 1 attendance + 2 loyalty → 1349 (1349 has correct spelling) |

## Follow-up merges (post-flag review)

| Group | Kept | Merged-then-deleted | Moved + extras |
|---|---|---|---|
| Chelsea Sweeney (Carter Hargreaves) | 117 (PIN 9846) | 26 (PIN 8836) | 3 top-ups + 1 attendance + 1 loyalty → 117. **Plus 5 session_group attendance entries (6/12/18/24/30 days ago) added to credit perk-rank progress** lost in the merge. All five carry `notes = "Perk credit from duplicate merge (#26 → #117)"` for audit. Net perk-day count went from 1 → 6. |

## NOT touched — flagged for human review

These groups look like duplicates by phone or email, but the underlying data
suggests they're legitimately separate or need a family decision:

| Group | IDs | Why flagged |
|---|---|---|
| Sasiphan Setthawaisayaphong | 1249 (Tonmai), 1260 (Airak) | Different kids, same parent — should probably be parent + top-up structure, but each kid has separate registration. Owner call: merge into one family card with both kids, or leave separate? |
| Olga | 763 (Robert, session), 1348 (Robert + Ruby, birthday) | NOT a duplicate — 1348 is a birthday booking, 763 is the regular session card. Leave both. |
| Anupama | 530 (Ohm), 542 (Bhanu) | Same parent, two kids registered separately. Could merge into family card. |
| zegnay | 563 (Isaac), 598 (Adam) | Same family email, two kids. Same merge question. |
| Ekaterina / Kate | 49 (Alisa, Aaron, Lipa — 10-pack bulk + tax invoice), 555 (Alisa, Eugene) | Different program packages, different kid lists, 49 has a tax invoice and 5 attendance. Likely intentional. |
| Chelsea Sweeney | 26 (session, 3 top-ups, attended), 117 (day_camp, attended) | Different programs (sessions vs day camp), both have attendance history. Leave both. |
| Artjom / Thomas Kart | 438 (Jom), 1284 (Nikita) | Same email but completely different parent names and kids. Could be 2 parents sharing one email account, or one parent registering 2 kids with name variants. Confirm with the family. |
| Berty / Halim / Guerabis | 504, 505, 507 (phone 0991295801) | 3 distinct surnames sharing one phone — probably staff registered 3 different families on a borrowed phone. Leave alone. |
| Sumittee / Kim Kim | 1087, 1353 (phone 0951380838) | 2 different families/kids on same phone — likely a typed-wrong-phone collision, not a real duplicate. Leave alone. |

## Prevention (next step)

To stop this from happening again, the `/join` form should soft-check by
phone/email as the parent types and warn them:

> *"We already have a member with this email — open My Membership instead."*

Plus a hard block on POST `/api/members` when phone + kids match an existing
approved row.

This is queued as a follow-up; nothing changed in the app code today.
