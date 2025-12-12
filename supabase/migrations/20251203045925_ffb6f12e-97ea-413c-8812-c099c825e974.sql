-- Create table to store prediction history and track accuracy
CREATE TABLE public.prediction_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  prediction TEXT NOT NULL CHECK (prediction IN ('bullish', 'bearish', 'neutral')),
  confidence DECIMAL(5,4) NOT NULL,
  risk_level TEXT NOT NULL,
  sentiment_momentum TEXT NOT NULL,
  avg_sentiment DECIMAL(8,5),
  articles_analyzed INTEGER DEFAULT 0,
  actual_outcome TEXT CHECK (actual_outcome IN ('bullish', 'bearish', 'neutral', NULL)),
  price_at_prediction DECIMAL(12,2),
  price_at_verification DECIMAL(12,2),
  price_change_percent DECIMAL(8,4),
  was_accurate BOOLEAN,
  prediction_type TEXT DEFAULT 'short_term',
  source TEXT DEFAULT 'algorithmic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view prediction history" 
ON public.prediction_history 
FOR SELECT 
USING (true);

-- Create policy for service role insert/update
CREATE POLICY "Service role can manage predictions" 
ON public.prediction_history 
FOR ALL 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_prediction_history_symbol ON public.prediction_history(symbol);
CREATE INDEX idx_prediction_history_created_at ON public.prediction_history(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_history;