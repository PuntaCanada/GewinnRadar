-- Research candidates are never automatically joined into verified games.
CREATE TABLE IF NOT EXISTS research_candidates (
 id TEXT PRIMARY KEY,
 year INTEGER NOT NULL CHECK(year BETWEEN 2026 AND 2100),
 canonical_key TEXT NOT NULL UNIQUE,
 organizer TEXT NOT NULL,
 title TEXT NOT NULL,
 prize TEXT NOT NULL,
 url TEXT NOT NULL,
 terms_url TEXT NOT NULL,
 source_url TEXT NOT NULL,
 starts_on TEXT NOT NULL,
 ends_on TEXT NOT NULL,
 cadence TEXT NOT NULL CHECK(cadence IN ('daily','specific_dates','single','social_posts')),
 eligible_dates TEXT,
 required_data TEXT NOT NULL,
 privacy_tier TEXT NOT NULL CHECK(privacy_tier IN ('low','medium','higher','blocked')),
 review_note TEXT NOT NULL,
 research_state TEXT NOT NULL DEFAULT 'candidate' CHECK(research_state IN ('candidate','excluded')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_research_dates ON research_candidates(research_state,starts_on,ends_on);
CREATE TABLE IF NOT EXISTS research_import_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT NOT NULL REFERENCES users(id),
 imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 accepted INTEGER NOT NULL,
 duplicates INTEGER NOT NULL,
 excluded INTEGER NOT NULL,
 note TEXT NOT NULL
);
