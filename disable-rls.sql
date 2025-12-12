-- Quick fix: Disable RLS for prediction_history table
ALTER TABLE prediction_history DISABLE ROW LEVEL SECURITY;

-- If table doesn't exist, create it first
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_prediction_history_symbol_created ON prediction_history(symbol, created_at DESC);
