-- Create price_alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  target_price numeric NOT NULL,
  condition_type text NOT NULL CHECK (condition_type IN ('above', 'below')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  triggered_at timestamptz,
  user_id text,
  email text
);

-- Enable RLS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public read access for price alerts" ON public.price_alerts
  FOR SELECT USING (true);

-- Create policy for anonymous inserts
CREATE POLICY "Allow anonymous inserts for price alerts" ON public.price_alerts
  FOR INSERT WITH CHECK (true);

-- Create policy for users to update their own alerts
CREATE POLICY "Users can update own alerts" ON public.price_alerts
  FOR UPDATE USING (true);

-- Create policy for users to delete their own alerts
CREATE POLICY "Users can delete own alerts" ON public.price_alerts
  FOR DELETE USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON public.price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created ON public.price_alerts(created_at);
