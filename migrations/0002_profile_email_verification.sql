BEGIN;

-- Replace the existing non-unique index with a case-insensitive unique index.
DROP INDEX IF EXISTS users_email_lower_idx;
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- Keep email-change verification separate from login-code authentication.
-- One pending email change per account.
CREATE TABLE pending_email_changes (
    user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email text NOT NULL,
    code_digest text NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);

COMMIT;
