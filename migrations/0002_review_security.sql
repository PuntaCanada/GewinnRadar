-- Apply only to a new isolated GewinnRadar D1 database after 0001_initial.sql.
CREATE TABLE IF NOT EXISTS contest_evidence (
 game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
 reviewer_id TEXT NOT NULL REFERENCES users(id),
 checked_at TEXT NOT NULL,
 note TEXT NOT NULL,
 original_checked INTEGER NOT NULL DEFAULT 0 CHECK(original_checked IN (0,1)),
 terms_checked INTEGER NOT NULL DEFAULT 0 CHECK(terms_checked IN (0,1)),
 privacy_checked INTEGER NOT NULL DEFAULT 0 CHECK(privacy_checked IN (0,1)),
 germany_eligible INTEGER NOT NULL DEFAULT 0 CHECK(germany_eligible IN (0,1)),
 no_mandatory_marketing INTEGER NOT NULL DEFAULT 0 CHECK(no_mandatory_marketing IN (0,1)),
 no_payment_required INTEGER NOT NULL DEFAULT 0 CHECK(no_payment_required IN (0,1)),
 human_verified INTEGER NOT NULL DEFAULT 0 CHECK(human_verified IN (0,1))
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT NOT NULL REFERENCES users(id),
 game_id TEXT NOT NULL REFERENCES games(id),
 action TEXT NOT NULL CHECK(action IN ('approve','reject','review')),
 note TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS login_limits (
 key_hash TEXT NOT NULL,
 bucket TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(key_hash,bucket)
);
