SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'login_tokens', COUNT(*) FROM login_tokens
UNION ALL SELECT 'games', COUNT(*) FROM games
UNION ALL SELECT 'email_log', COUNT(*) FROM email_log;
