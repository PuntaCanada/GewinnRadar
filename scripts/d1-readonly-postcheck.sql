-- READ-ONLY check after applying ALL five migrations to ONLY gewinnradar-familie.
-- Expected: 16 application tables, 1 append-only evidence trigger; all live tables empty.
SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;
PRAGMA foreign_key_check;
SELECT 'users' AS table_name, count(*) AS rows FROM users
UNION ALL SELECT 'games', count(*) FROM games
UNION ALL SELECT 'favorites', count(*) FROM favorites
UNION ALL SELECT 'participations', count(*) FROM participations
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'login_tokens', count(*) FROM login_tokens
UNION ALL SELECT 'email_log', count(*) FROM email_log
UNION ALL SELECT 'research_candidates', count(*) FROM research_candidates
UNION ALL SELECT 'source_evidence_history', count(*) FROM source_evidence_history
UNION ALL SELECT 'form_verifications', count(*) FROM form_verifications
UNION ALL SELECT 'reminder_windows', count(*) FROM reminder_windows;
