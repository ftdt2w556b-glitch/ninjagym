-- Track how much cash the customer tendered and how much change was given
-- per POS cash sale, for accurate drawer reconciliation.

ALTER TABLE cash_sales
  ADD COLUMN IF NOT EXISTS amount_tendered numeric(10,2),
  ADD COLUMN IF NOT EXISTS change_given    numeric(10,2);
