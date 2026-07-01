DELETE FROM embeddings WHERE result_id NOT LIKE 'result_%';
DELETE FROM analysis_rows WHERE result_id NOT LIKE 'result_%';
DELETE FROM results WHERE id NOT LIKE 'result_%';
SELECT COUNT(*) as remaining FROM results;
