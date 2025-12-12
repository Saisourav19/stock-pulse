-- Create price_alerts table
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

-- Create policies
CREATE POLICY IF NOT EXISTS "Public read access for price alerts" ON public.price_alerts
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow anonymous inserts for price alerts" ON public.price_alerts
  FOR INSERT WITH CHECK (true);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON public.price_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts(is_active);
