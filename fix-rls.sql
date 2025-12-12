-- Fix RLS policies for public access (temporary fix)

-- Disable RLS temporarily for testing
ALTER TABLE prediction_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts DISABLE ROW LEVEL SECURITY;

-- Or create public policies if you want RLS enabled
DROP POLICY IF EXISTS "Users can view their own prediction history" ON prediction_history;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON prediction_history;

CREATE POLICY "Enable public read access" ON prediction_history
  FOR SELECT USING (true);

CREATE POLICY "Enable public insert access" ON prediction_history  
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable public update access" ON prediction_history
  FOR UPDATE USING (true);

-- Enable RLS again
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
