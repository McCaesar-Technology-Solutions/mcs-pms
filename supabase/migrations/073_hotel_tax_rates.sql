-- Per-hotel editable GRA tax rates + tourism levy.
-- Null rate columns = use system defaults (dual-run safe; no behavior change until set).
-- Invoice tax_snapshot freezes rates at issue so historical PDFs/GRA stay stable.

-- ---------------------------------------------------------------------------
-- Hotels: optional rate overrides (fractions 0–1)
-- ---------------------------------------------------------------------------
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS tax_nhil_rate numeric(8, 6)
    CHECK (tax_nhil_rate IS NULL OR (tax_nhil_rate >= 0 AND tax_nhil_rate <= 1)),
  ADD COLUMN IF NOT EXISTS tax_getfund_rate numeric(8, 6)
    CHECK (tax_getfund_rate IS NULL OR (tax_getfund_rate >= 0 AND tax_getfund_rate <= 1)),
  ADD COLUMN IF NOT EXISTS tax_vat_rate numeric(8, 6)
    CHECK (tax_vat_rate IS NULL OR (tax_vat_rate >= 0 AND tax_vat_rate <= 1)),
  ADD COLUMN IF NOT EXISTS tax_elevy_rate numeric(8, 6)
    CHECK (tax_elevy_rate IS NULL OR (tax_elevy_rate >= 0 AND tax_elevy_rate <= 1)),
  ADD COLUMN IF NOT EXISTS tax_covid_rate numeric(8, 6)
    CHECK (tax_covid_rate IS NULL OR (tax_covid_rate >= 0 AND tax_covid_rate <= 1)),
  ADD COLUMN IF NOT EXISTS tax_tourism_levy_rate numeric(8, 6)
    CHECK (tax_tourism_levy_rate IS NULL OR (tax_tourism_levy_rate >= 0 AND tax_tourism_levy_rate <= 1));

COMMENT ON COLUMN hotels.tax_nhil_rate IS 'NHIL fraction (e.g. 0.025). Null = system default.';
COMMENT ON COLUMN hotels.tax_getfund_rate IS 'GETFund fraction. Null = system default.';
COMMENT ON COLUMN hotels.tax_vat_rate IS 'VAT fraction. Null = system default.';
COMMENT ON COLUMN hotels.tax_elevy_rate IS 'E-Levy fraction. Null = system default (0).';
COMMENT ON COLUMN hotels.tax_covid_rate IS 'COVID levy fraction. Null = env/system default.';
COMMENT ON COLUMN hotels.tax_tourism_levy_rate IS
  'Tourism levy fraction on taxable base (not in NHIL/GETFund/VAT base). Null = off (0).';

-- ---------------------------------------------------------------------------
-- Invoices: tourism amount + rate snapshot
-- ---------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tourism_levy_amount numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (tourism_levy_amount >= 0),
  ADD COLUMN IF NOT EXISTS tax_snapshot jsonb;

COMMENT ON COLUMN invoices.tourism_levy_amount IS 'Tourism levy GHS at issue (snapshot).';
COMMENT ON COLUMN invoices.tax_snapshot IS
  'Frozen rates at issue: { nhil, getfund, covid, vat, elevy, tourism } as fractions.';
