BEGIN;

-- When the user accepted the "educational purposes only, not financial
-- advice" disclaimer. Optional: existing users are asked on next visit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamp;

COMMIT;
