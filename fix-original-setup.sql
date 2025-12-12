-- Fix for original Supabase Edge Functions setup

-- Create prediction_history table if it doesn't exist
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

-- Enable RLS and create policies for Edge Functions
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;

-- Edge Functions need service role access
DROP POLICY IF EXISTS "Edge Functions full access" ON prediction_history;
CREATE POLICY "Edge Functions full access" ON prediction_history
  FOR ALL USING (auth.role() = 'service_role');

-- Create index
CREATE INDEX IF NOT EXISTS idx_prediction_history_symbol_created ON prediction_history(symbol, created_at DESC);
