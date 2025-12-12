-- Test what tables exist and fix access

-- First, check if table exists with different name variations
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%prediction%';

-- If table doesn't exist, create it with a simple structure
CREATE TABLE IF NOT EXISTS prediction_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  prediction TEXT NOT NULL CHECK (prediction IN ('bullish', 'bearish', 'neutral')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  was_accurate BOOLEAN,
  actual_outcome TEXT,
  price_at_prediction DECIMAL(10,2),
  price_change_percent DECIMAL(5,2),
  factors JSONB,
  risk_level TEXT,
  sentiment_momentum TEXT
);

-- Disable RLS completely for testing
ALTER TABLE prediction_history DISABLE ROW LEVEL SECURITY;

-- Grant public access
GRANT ALL ON prediction_history TO anon;
GRANT ALL ON prediction_history TO authenticated;

-- Create index
CREATE INDEX IF NOT EXISTS idx_prediction_history_created ON prediction_history(created_at DESC);
