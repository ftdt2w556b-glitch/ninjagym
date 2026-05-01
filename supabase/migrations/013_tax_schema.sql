-- =============================================================================
-- 013_tax_schema.sql
-- Thai tax compliance schema: tables, helper functions, RPCs, and triggers.
--
-- This migration captures the live schema that was built directly in the
-- Supabase dashboard without migration files. Run once on a fresh DB; it is
-- safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout).
--
-- Dependency order:
--   companies -> tax_periods -> tax_invoices / expense_invoices
--   expense_invoices -> withholding_tax_records
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companies (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT          NOT NULL,
  name_thai           TEXT,
  tax_id              TEXT          NOT NULL,
  branch_code         TEXT          NOT NULL DEFAULT '00000',
  branch_name         TEXT          NOT NULL DEFAULT 'Head Office',
  address             TEXT          NOT NULL,
  district            TEXT,
  province            TEXT,
  postal_code         TEXT,
  phone               TEXT,
  website             TEXT,
  vat_registered_date DATE,
  fiscal_year_end     TEXT          NOT NULL DEFAULT '12-31',
  is_vat_registered   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_periods (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL,
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  pp30_status     TEXT        DEFAULT 'open',
  pp30_filed_at   TIMESTAMPTZ,
  pp30_file_url   TEXT,
  pnd3_status     TEXT        DEFAULT 'open',
  pnd53_status    TEXT        DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, year, month)
);

CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id                     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id             UUID        NOT NULL REFERENCES public.companies(id),
  tax_period_id          UUID        REFERENCES public.tax_periods(id),
  invoice_number         TEXT        NOT NULL,
  type                   TEXT        NOT NULL DEFAULT 'sale',
  issue_date             DATE        NOT NULL,
  customer_name          TEXT        NOT NULL,
  customer_tax_id        TEXT,
  customer_address       TEXT,
  customer_branch        TEXT        DEFAULT '00000',
  before_vat_amount      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  vat_rate               NUMERIC(5,2)  NOT NULL DEFAULT 7.00,
  vat_amount             NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_amount           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  description            TEXT,
  payment_method         TEXT,
  cash_sale_id           INTEGER     REFERENCES public.cash_sales(id),
  member_registration_id INTEGER     REFERENCES public.member_registrations(id),
  status                 TEXT        NOT NULL DEFAULT 'issued',
  attachment_url         TEXT,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_invoices (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id          UUID          NOT NULL REFERENCES public.companies(id),
  tax_period_id       UUID          REFERENCES public.tax_periods(id),
  supplier_name       TEXT          NOT NULL,
  supplier_tax_id     TEXT,
  supplier_address    TEXT,
  supplier_branch     TEXT          DEFAULT '00000',
  supplier_invoice_no TEXT,
  issue_date          DATE          NOT NULL,
  received_date       DATE,
  category            TEXT          NOT NULL DEFAULT 'operating',
  before_vat_amount   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  vat_rate            NUMERIC(5,2)  NOT NULL DEFAULT 7.00,
  vat_amount          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  is_vat_claimable    BOOLEAN       NOT NULL DEFAULT TRUE,
  description         TEXT,
  payment_method      TEXT,
  payment_date        DATE,
  wht_deducted        BOOLEAN       NOT NULL DEFAULT FALSE,
  wht_amount          NUMERIC(15,2),
  status              TEXT          NOT NULL DEFAULT 'received',
  attachment_url      TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withholding_tax_records (
  id                       UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id               UUID          NOT NULL REFERENCES public.companies(id),
  tax_period_id            UUID          REFERENCES public.tax_periods(id),
  pnd_type                 TEXT          NOT NULL,
  payee_name               TEXT          NOT NULL,
  payee_tax_id             TEXT          NOT NULL,
  payee_address            TEXT,
  payee_branch             TEXT          DEFAULT '00000',
  income_type_code         TEXT          NOT NULL DEFAULT '1',
  income_type_description  TEXT,
  payment_date             DATE          NOT NULL,
  payment_amount           NUMERIC(15,2) NOT NULL,
  wht_rate                 NUMERIC(5,2)  NOT NULL,
  wht_amount               NUMERIC(15,2) NOT NULL,
  net_payment              NUMERIC(15,2) NOT NULL,
  certificate_number       TEXT,
  expense_invoice_id       UUID          REFERENCES public.expense_invoices(id),
  filed                    BOOLEAN       NOT NULL DEFAULT FALSE,
  filed_at                 TIMESTAMPTZ,
  notes                    TEXT,
  created_by               TEXT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  condition_code           TEXT          NOT NULL DEFAULT '1',
  payee_title_code         TEXT          DEFAULT '04'
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES (pkeys created above; only non-pk indexes below)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expense_invoices_company
  ON public.expense_invoices (company_id, issue_date);

CREATE INDEX IF NOT EXISTS idx_expense_invoices_date
  ON public.expense_invoices (issue_date);

CREATE INDEX IF NOT EXISTS idx_expense_invoices_supplier
  ON public.expense_invoices (supplier_tax_id);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_cash_sale
  ON public.tax_invoices (cash_sale_id);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_company_date
  ON public.tax_invoices (company_id, issue_date);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_issue_date
  ON public.tax_invoices (issue_date);

CREATE INDEX IF NOT EXISTS idx_tax_invoices_member_reg
  ON public.tax_invoices (member_registration_id);

CREATE INDEX IF NOT EXISTS idx_wht_company_period
  ON public.withholding_tax_records (company_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_wht_payee_tax_id
  ON public.withholding_tax_records (payee_tax_id);

CREATE INDEX IF NOT EXISTS idx_wht_pnd_type
  ON public.withholding_tax_records (pnd_type, payment_date);

-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Finds or creates a tax_period row for a given company/year/month.
CREATE OR REPLACE FUNCTION public.ensure_tax_period(
  p_company_id UUID,
  p_year       INTEGER,
  p_month      INTEGER
) RETURNS UUID
LANGUAGE plpgsql AS $function$
DECLARE
  v_id    UUID;
  v_start DATE;
  v_end   DATE;
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  INSERT INTO public.tax_periods (company_id, year, month, period_start, period_end)
  VALUES (p_company_id, p_year, p_month, v_start, v_end)
  ON CONFLICT (company_id, year, month) DO NOTHING;
  SELECT id INTO v_id
  FROM public.tax_periods
  WHERE company_id = p_company_id AND year = p_year AND month = p_month;
  RETURN v_id;
END;
$function$;

-- Generates the next sequential invoice number for a company+month.
-- Format: NJ-YYYY-MM-NNNN
CREATE OR REPLACE FUNCTION public.next_invoice_number(
  p_company_id UUID,
  p_issue_date DATE
) RETURNS TEXT
LANGUAGE plpgsql AS $function$
DECLARE
  v_ym  TEXT;
  v_seq INT;
BEGIN
  v_ym := TO_CHAR(p_issue_date, 'YYYY-MM');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 4) AS INT)), 0) + 1
  INTO   v_seq
  FROM   public.tax_invoices
  WHERE  company_id = p_company_id
    AND  TO_CHAR(issue_date, 'YYYY-MM') = v_ym;
  RETURN 'NJ-' || v_ym || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. REPORTING RPCs
-- ---------------------------------------------------------------------------

-- PP.30 monthly VAT report: output VAT, input VAT, and net payable.
CREATE OR REPLACE FUNCTION public.get_monthly_vat_report(
  p_company_id UUID,
  p_year       INTEGER,
  p_month      INTEGER
) RETURNS TABLE(
  section       TEXT,
  line_no       INTEGER,
  description   TEXT,
  invoice_count BIGINT,
  base_amount   NUMERIC,
  vat_amount    NUMERIC
)
LANGUAGE plpgsql AS $function$
DECLARE
  v_start DATE := make_date(p_year, p_month, 1);
  v_end   DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
  -- OUTPUT VAT: standard-rated sales
  RETURN QUERY
  SELECT
    'OUTPUT'::TEXT,
    1,
    'Sales (7% VAT)'::TEXT,
    COUNT(*),
    ROUND(SUM(ti.before_vat_amount), 2),
    ROUND(SUM(ti.vat_amount), 2)
  FROM public.tax_invoices ti
  WHERE ti.company_id = p_company_id
    AND ti.issue_date BETWEEN v_start AND v_end
    AND ti.type = 'sale'
    AND ti.vat_rate = 7
    AND ti.status NOT IN ('cancelled', 'void');

  -- OUTPUT VAT: zero-rated sales
  RETURN QUERY
  SELECT 'OUTPUT'::TEXT, 2, 'Zero-rated Sales (0%)'::TEXT,
    COUNT(*), ROUND(SUM(ti.before_vat_amount), 2), 0.00::NUMERIC
  FROM public.tax_invoices ti
  WHERE ti.company_id = p_company_id
    AND ti.issue_date BETWEEN v_start AND v_end
    AND ti.type = 'sale' AND ti.vat_rate = 0
    AND ti.status NOT IN ('cancelled', 'void');

  -- INPUT VAT: claimable expense invoices
  RETURN QUERY
  SELECT 'INPUT'::TEXT, 3, 'Purchases with Input VAT (7%)'::TEXT,
    COUNT(*), ROUND(SUM(ei.before_vat_amount), 2), ROUND(SUM(ei.vat_amount), 2)
  FROM public.expense_invoices ei
  WHERE ei.company_id = p_company_id
    AND ei.issue_date BETWEEN v_start AND v_end
    AND ei.is_vat_claimable = TRUE
    AND ei.status != 'cancelled';

  -- NET: output minus input
  RETURN QUERY
  SELECT 'NET'::TEXT, 4, 'Net VAT Payable (Output minus Input)'::TEXT,
    NULL::BIGINT,
    NULL::NUMERIC,
    ROUND(
      COALESCE((
        SELECT SUM(ti2.vat_amount) FROM public.tax_invoices ti2
        WHERE ti2.company_id = p_company_id
          AND ti2.issue_date BETWEEN v_start AND v_end
          AND ti2.type = 'sale'
          AND ti2.status NOT IN ('cancelled', 'void')
      ), 0)
      -
      COALESCE((
        SELECT SUM(ei2.vat_amount) FROM public.expense_invoices ei2
        WHERE ei2.company_id = p_company_id
          AND ei2.issue_date BETWEEN v_start AND v_end
          AND ei2.is_vat_claimable = TRUE
          AND ei2.status != 'cancelled'
      ), 0)
    , 2);
END;
$function$;

-- PND3/53 WHT export: generates tab-delimited text for RD Prep import.
-- Dates are in Buddhist Era (BE = CE + 543) as required by RD Prep.
CREATE OR REPLACE FUNCTION public.generate_pnd_txt(
  p_pnd_type   TEXT,
  p_company_id UUID,
  p_year       INTEGER,
  p_month      INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER AS $function$
DECLARE
  v_start     DATE := make_date(p_year, p_month, 1);
  v_end       DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_company   RECORD;
  v_result    TEXT := '';
  v_lines     TEXT := '';
  v_total_wht NUMERIC := 0;
  v_count     INT := 0;
  rec         RECORD;
BEGIN
  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;

  -- Detail lines: one row per payee payment.
  -- Column order matches RD Prep import spec:
  -- TaxID | TitleCode | Name | IncomeType | PayDateBE | Amount | WHTRate% | WHTAmount | CertNo | ConditionCode
  FOR rec IN
    SELECT
      w.payee_tax_id,
      COALESCE(w.payee_title_code, '04')                              AS title_code,
      w.payee_name,
      w.income_type_code,
      TO_CHAR(w.payment_date, 'DD/MM/') ||
        (EXTRACT(YEAR FROM w.payment_date)::INT + 543)::TEXT          AS payment_date_be,
      w.payment_amount,
      w.wht_rate,
      w.wht_amount,
      COALESCE(w.certificate_number, '')                              AS cert_no,
      COALESCE(w.condition_code, '1')                                 AS condition_code
    FROM public.withholding_tax_records w
    WHERE w.company_id = p_company_id
      AND w.pnd_type   = p_pnd_type
      AND w.payment_date BETWEEN v_start AND v_end
    ORDER BY w.payment_date, w.payee_name
  LOOP
    v_lines := v_lines ||
      rec.payee_tax_id         || E'\t' ||
      rec.title_code           || E'\t' ||
      rec.payee_name           || E'\t' ||
      rec.income_type_code     || E'\t' ||
      rec.payment_date_be      || E'\t' ||
      rec.payment_amount::TEXT || E'\t' ||
      rec.wht_rate::TEXT       || E'\t' ||
      rec.wht_amount::TEXT     || E'\t' ||
      rec.cert_no              || E'\t' ||
      rec.condition_code       || E'\n';
    v_total_wht := v_total_wht + rec.wht_amount;
    v_count     := v_count + 1;
  END LOOP;

  v_result :=
    '## NinjaGym WHT Export - ' || UPPER(p_pnd_type)               || E'\n' ||
    '## Company    : ' || v_company.name                            || E'\n' ||
    '## Tax ID     : ' || v_company.tax_id                         || E'\n' ||
    '## Period     : ' || TO_CHAR(v_start, 'YYYY-MM') ||
      ' (BE ' || (p_year + 543)::TEXT || '-' || LPAD(p_month::TEXT, 2, '0') || ')' || E'\n' ||
    '## Records    : ' || v_count::TEXT                            || E'\n' ||
    '## Total WHT  : ' || v_total_wht::TEXT                        || E'\n' ||
    '## Generated  : ' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') || E'\n' ||
    '##'                                                            || E'\n' ||
    '## NOTE: Dates are in Buddhist Era (BE = CE + 543). Required by RD Prep.' || E'\n' ||
    '## NOTE: Verify column order against your version of RD Prep before first submission.' || E'\n' ||
    '## COLUMNS: TaxID | TitleCode | Name | IncomeType | PayDateBE(DD/MM/YYYY) | Amount | WHTRate% | WHTAmount | CertNo | ConditionCode(1=deducted,2=paid_on_behalf)' || E'\n' ||
    E'\n' ||
    v_lines;

  RETURN v_result;
END;
$function$;

-- CIT51/CIT50 summary: revenue, expenses, estimated net profit, estimated CIT.
-- p_half: 'h1' (Jan-Jun), 'h2' (Jul-Dec), or 'annual' (full year).
CREATE OR REPLACE FUNCTION public.get_cit_summary(
  p_company_id UUID,
  p_year       INTEGER,
  p_half       TEXT DEFAULT 'annual'
) RETURNS TABLE(label TEXT, amount NUMERIC)
LANGUAGE plpgsql AS $function$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  v_start := CASE p_half
    WHEN 'h1'  THEN make_date(p_year, 1, 1)
    WHEN 'h2'  THEN make_date(p_year, 7, 1)
    ELSE             make_date(p_year, 1, 1)
  END;
  v_end := CASE p_half
    WHEN 'h1'  THEN make_date(p_year, 6, 30)
    WHEN 'h2'  THEN make_date(p_year, 12, 31)
    ELSE             make_date(p_year, 12, 31)
  END;

  RETURN QUERY
  SELECT 'Total Revenue'::TEXT,
    ROUND(COALESCE(SUM(ti.total_amount), 0), 2)
  FROM public.tax_invoices ti
  WHERE ti.company_id = p_company_id
    AND ti.issue_date BETWEEN v_start AND v_end
    AND ti.type = 'sale'
    AND ti.status NOT IN ('cancelled', 'void');

  RETURN QUERY
  SELECT 'Total Revenue (ex-VAT)'::TEXT,
    ROUND(COALESCE(SUM(ti.before_vat_amount), 0), 2)
  FROM public.tax_invoices ti
  WHERE ti.company_id = p_company_id
    AND ti.issue_date BETWEEN v_start AND v_end
    AND ti.type = 'sale'
    AND ti.status NOT IN ('cancelled', 'void');

  RETURN QUERY
  SELECT 'Total Expenses'::TEXT,
    ROUND(COALESCE(SUM(ei.before_vat_amount), 0), 2)
  FROM public.expense_invoices ei
  WHERE ei.company_id = p_company_id
    AND ei.issue_date BETWEEN v_start AND v_end
    AND ei.status != 'cancelled';

  RETURN QUERY
  SELECT 'Estimated Net Profit'::TEXT,
    ROUND(
      COALESCE((
        SELECT SUM(ti2.before_vat_amount) FROM public.tax_invoices ti2
        WHERE ti2.company_id = p_company_id
          AND ti2.issue_date BETWEEN v_start AND v_end
          AND ti2.type = 'sale'
          AND ti2.status NOT IN ('cancelled', 'void')
      ), 0)
      -
      COALESCE((
        SELECT SUM(ei2.before_vat_amount) FROM public.expense_invoices ei2
        WHERE ei2.company_id = p_company_id
          AND ei2.issue_date BETWEEN v_start AND v_end
          AND ei2.status != 'cancelled'
      ), 0)
    , 2);

  -- CIT at standard 20% rate (SME rate of 15% on first 3M THB may apply; adjust manually)
  RETURN QUERY
  SELECT 'Estimated CIT (20%)'::TEXT,
    ROUND(
      GREATEST(0,
        COALESCE((
          SELECT SUM(ti3.before_vat_amount) FROM public.tax_invoices ti3
          WHERE ti3.company_id = p_company_id
            AND ti3.issue_date BETWEEN v_start AND v_end
            AND ti3.type = 'sale'
            AND ti3.status NOT IN ('cancelled', 'void')
        ), 0)
        -
        COALESCE((
          SELECT SUM(ei3.before_vat_amount) FROM public.expense_invoices ei3
          WHERE ei3.company_id = p_company_id
            AND ei3.issue_date BETWEEN v_start AND v_end
            AND ei3.status != 'cancelled'
        ), 0)
      ) * 0.20
    , 2);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Fires AFTER INSERT on cash_sales.
-- Creates a tax invoice for every cash POS sale automatically.
CREATE OR REPLACE FUNCTION public.trg_cash_sale_to_tax_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql AS $function$
DECLARE
  v_company_id UUID;
  v_base       NUMERIC;
  v_vat        NUMERIC;
  v_period_id  UUID;
  v_date       DATE;
BEGIN
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  v_date      := NEW.processed_at::DATE;
  v_base      := ROUND(NEW.amount / 1.07, 2);
  v_vat       := NEW.amount - v_base;
  v_period_id := public.ensure_tax_period(
    v_company_id,
    EXTRACT(YEAR  FROM v_date)::INT,
    EXTRACT(MONTH FROM v_date)::INT
  );
  INSERT INTO public.tax_invoices (
    company_id, tax_period_id, invoice_number, type, issue_date,
    customer_name, before_vat_amount, vat_rate, vat_amount, total_amount,
    description, payment_method, cash_sale_id, status, created_by
  ) VALUES (
    v_company_id, v_period_id,
    public.next_invoice_number(v_company_id, v_date),
    'sale', v_date,
    COALESCE(NEW.notes, 'Walk-in Customer'),
    v_base, 7.00, v_vat, NEW.amount,
    COALESCE(NEW.sale_type, 'POS Sale'), 'cash',
    NEW.id, 'issued', NEW.staff_name
  );
  RETURN NEW;
END;
$function$;

-- Fires AFTER UPDATE on member_registrations.
-- Creates a tax invoice when a PromptPay slip is approved.
-- Skips: cash payments (handled by cash_sales trigger), self-registrations.
CREATE OR REPLACE FUNCTION public.trg_member_reg_to_tax_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql AS $function$
DECLARE
  v_company_id UUID;
  v_base       NUMERIC;
  v_vat        NUMERIC;
  v_period_id  UUID;
  v_date       DATE;
BEGIN
  IF NEW.slip_status = 'approved'
     AND (OLD.slip_status IS DISTINCT FROM 'approved')
     AND (NEW.amount_paid IS NOT NULL AND NEW.amount_paid > 0)
     AND NEW.payment_method NOT IN ('cash', 'self_register')
  THEN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
    v_date      := COALESCE(NEW.slip_reviewed_at::DATE, NOW()::DATE);
    v_base      := ROUND(NEW.amount_paid / 1.07, 2);
    v_vat       := NEW.amount_paid - v_base;
    v_period_id := public.ensure_tax_period(
      v_company_id,
      EXTRACT(YEAR  FROM v_date)::INT,
      EXTRACT(MONTH FROM v_date)::INT
    );
    INSERT INTO public.tax_invoices (
      company_id, tax_period_id, invoice_number, type, issue_date,
      customer_name, before_vat_amount, vat_rate, vat_amount, total_amount,
      description, payment_method, member_registration_id, status
    ) VALUES (
      v_company_id, v_period_id,
      public.next_invoice_number(v_company_id, v_date),
      'sale', v_date, NEW.name,
      v_base, 7.00, v_vat, NEW.amount_paid,
      NEW.membership_type, NEW.payment_method,
      NEW.id, 'issued'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. TRIGGERS
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_cash_sale_to_tax_invoice ON public.cash_sales;
CREATE TRIGGER trg_cash_sale_to_tax_invoice
  AFTER INSERT ON public.cash_sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_cash_sale_to_tax_invoice();

DROP TRIGGER IF EXISTS trg_member_reg_to_tax_invoice ON public.member_registrations;
CREATE TRIGGER trg_member_reg_to_tax_invoice
  AFTER UPDATE ON public.member_registrations
  FOR EACH ROW EXECUTE FUNCTION public.trg_member_reg_to_tax_invoice();
