-- No production DB is created or modified by this migration in GitHub.
-- Every reminder must be individually, manually approved for one calendar day.
CREATE TABLE IF NOT EXISTS form_verifications (
 game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
 reviewer_id TEXT NOT NULL REFERENCES users(id),
 checked_at TEXT NOT NULL,
 form_url TEXT NOT NULL,
 privacy_url TEXT NOT NULL,
 required_fields TEXT NOT NULL,
 form_observed INTEGER NOT NULL DEFAULT 0 CHECK(form_observed IN (0,1)),
 correct_year INTEGER NOT NULL DEFAULT 0 CHECK(correct_year IN (0,1)),
 german_residents INTEGER NOT NULL DEFAULT 0 CHECK(german_residents IN (0,1)),
 no_marketing_required INTEGER NOT NULL DEFAULT 0 CHECK(no_marketing_required IN (0,1)),
 no_purchase_required INTEGER NOT NULL DEFAULT 0 CHECK(no_purchase_required IN (0,1)),
 no_account_or_app_obligation INTEGER NOT NULL DEFAULT 0 CHECK(no_account_or_app_obligation IN (0,1)),
 no_unresolved_deadline_conflict INTEGER NOT NULL DEFAULT 0 CHECK(no_unresolved_deadline_conflict IN (0,1)),
 notes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_windows (
 game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 start_utc TEXT NOT NULL,
 end_utc TEXT NOT NULL,
 review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','approved','rejected')),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 original_source TEXT NOT NULL,
 note TEXT NOT NULL,
 PRIMARY KEY(game_id,day),
 CHECK(day LIKE '2026-__-__'),
 CHECK(end_utc>start_utc)
);
CREATE INDEX IF NOT EXISTS idx_reminder_windows_lookup ON reminder_windows(day,review_state,start_utc,end_utc);
