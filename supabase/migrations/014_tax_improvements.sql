-- =============================================================================
-- 014_tax_improvements.sql
-- Three targeted improvements from the tax audit:
--
-- (a) B2B customer fields on cash_sales so a proper tax invoice is issued
--     to a company buyer without losing the walk-in notes field.
-- (b) Updated trg_cash_sale_to_tax_invoice uses the new fields.
-- (c) next_wht_cert_number() generates sequential certificate numbers so
--     WHT certificates no longer need to be tracked manually.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (a) B2B customer fields on cash_sales
-- ---------------------------------------------------------------------------

ALTER TABLE public.cash_sales
  ADD COLUMN IF NOT EXISTS customer_name   TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT;

-- ---------------------------------------------------------------------------
-- (b) Updated trigger: prefers customer_name over notes for tax invoice
-- ---------------------------------------------------------------------------

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
    customer_name, customer_tax_id,
    before_vat_amount, vat_rate, vat_amount, total_amount,
    description, payment_method, cash_sale_id, status, created_by
  ) VALUES (
    v_company_id, v_period_id,
    public.next_invoice_number(v_company_id, v_date),
    'sale', v_date,
    -- Use explicit company name when a B2B sale, else fall back to notes / walk-in
    COALESCE(NEW.customer_name, NEW.notes, 'Walk-in Customer'),
    NEW.customer_tax_id,
    v_base, 7.00, v_vat, NEW.amount,
    COALESCE(NEW.sale_type, 'POS Sale'), 'cash',
    NEW.id, 'issued', NEW.staff_name
  );
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- (c) WHT certificate auto-numbering: NJ-WHT-YYYY-MM-NNNN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_wht_cert_number(
  p_company_id UUID,
  p_year       INTEGER,
  p_month      INTEGER
) RETURNS TEXT
LANGUAGE plpgsql AS $function$
DECLARE
  v_ym  TEXT;
  v_seq INT;
BEGIN
  v_ym := TO_CHAR(make_date(p_year, p_month, 1), 'YYYY-MM');

  SELECT COALESCE(MAX(
    CASE
      WHEN certificate_number ~ '^NJ-WHT-[0-9]{4}-[0-9]{2}-[0-9]+$'
      THEN CAST(SPLIT_PART(certificate_number, '-', 5) AS INT)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM public.withholding_tax_records
  WHERE company_id = p_company_id
    AND TO_CHAR(payment_date, 'YYYY-MM') = v_ym;

  RETURN 'NJ-WHT-' || v_ym || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$function$;
