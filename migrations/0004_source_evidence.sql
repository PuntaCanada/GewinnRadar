-- Append-only observations; never grants approval or changes games/research_candidates.
CREATE TABLE IF NOT EXISTS source_evidence_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 candidate_id TEXT NOT NULL REFERENCES research_candidates(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_url TEXT NOT NULL,
 observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 evidence_kind TEXT NOT NULL CHECK(evidence_kind IN ('original_2026_page_seen','terms_checked','privacy_checked','form_checked','recheck_needed','excluded')),
 finding TEXT NOT NULL CHECK(length(finding) BETWEEN 20 AND 1500),
 verdict TEXT NOT NULL CHECK(verdict IN ('source_only','pending','excluded','needs_review')),
 source_year INTEGER NOT NULL CHECK(source_year BETWEEN 2026 AND 2100)
);
CREATE INDEX IF NOT EXISTS idx_source_evidence_history_candidate ON source_evidence_history(candidate_id,observed_at DESC);
CREATE TRIGGER IF NOT EXISTS prevent_source_evidence_update BEFORE UPDATE ON source_evidence_history BEGIN SELECT RAISE(ABORT,'append only'); END;
-- No DELETE trigger: foreign-key cascades must permit erasure of administrator account data.
-- The authenticated API intentionally offers no DELETE or UPDATE route for evidence.
