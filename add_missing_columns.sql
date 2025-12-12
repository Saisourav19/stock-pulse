
ALTER TABLE prediction_history 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'algorithmic',
ADD COLUMN IF NOT EXISTS avg_sentiment DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS articles_analyzed INTEGER;

-- Ensure service role has access (redundant check)
GRANT ALL ON prediction_history TO service_role;
