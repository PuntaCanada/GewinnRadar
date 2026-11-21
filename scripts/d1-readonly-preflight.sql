-- READ-ONLY preflight. Safe to paste into Cloudflare D1 Console before changing anything.
-- Confirm you are in database: gewinnradar-familie
-- Expected database UUID: 3a5a20dd-9447-4260-ac44-9b6accc571fb
SELECT name, type FROM sqlite_master WHERE type IN ('table','view','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;
