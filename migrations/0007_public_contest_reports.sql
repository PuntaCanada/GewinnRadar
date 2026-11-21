-- PREPARATION ONLY: DO NOT APPLY TO PRODUCTION WITHOUT SEPARATE APPROVAL.
-- Reports contain no IP, browser fingerprint, email, or CAPTCHA token.
CREATE TABLE IF NOT EXISTS public_contest_reports (
 id TEXT PRIMARY KEY,
 contest_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('suspected_fraud','broken_link','terms_or_privacy','request_review')),
 details TEXT NOT NULL CHECK(length(details) BETWEEN 15 AND 600),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','investigating','substantiated','unsubstantiated','closed')),
 submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_reports_state_time ON public_contest_reports(state,submitted_at);
CREATE INDEX IF NOT EXISTS idx_public_reports_contest_time ON public_contest_reports(contest_id,submitted_at);
