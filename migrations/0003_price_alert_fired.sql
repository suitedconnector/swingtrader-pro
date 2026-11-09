BEGIN;

-- Record when a price alert fired and the price that triggered it
-- (the day's high for a breakout, the day's low for a breakdown).
-- Both columns are optional, so existing alerts are unchanged.
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS fired_at timestamp;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS fired_price numeric(10, 2);

COMMIT;
