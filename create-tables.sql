-- Create necessary tables for Stock Pulse application

-- Prediction History Table
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
  user_id UUID REFERENCES auth.users(id),
  factors JSONB,
  risk_level TEXT,
  sentiment_momentum TEXT
);

-- Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  target_price DECIMAL(10,2) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triggered_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id)
);

-- Stock Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(symbol, user_id)
);

-- Market Sentiment Table
CREATE TABLE IF NOT EXISTS market_sentiment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  sentiment_score DECIMAL(3,2) NOT NULL,
  sentiment_label TEXT NOT NULL,
  confidence DECIMAL(3,2),
  articles_analyzed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  factors JSONB
);

-- Enable Row Level Security
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_sentiment ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own prediction history" ON prediction_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions" ON prediction_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions" ON prediction_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own price alerts" ON price_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own price alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own watchlist" ON watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own watchlist" ON watchlist
  FOR ALL USING (auth.uid() = user_id);

-- Market sentiment is public read-only
CREATE POLICY "Everyone can view market sentiment" ON market_sentiment
  FOR SELECT USING (true);

-- Create Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prediction_history_symbol_created ON prediction_history(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_market_sentiment_symbol ON market_sentiment(symbol, created_at DESC);
