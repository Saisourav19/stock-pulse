// Direct table creation using SQL
import { createClient } from '@supabase/supabase-js';

const newConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
};

async function createPriceAlertsTable() {
  console.log('=== Creating price_alerts table ===');
  const supabase = createClient(newConfig.url, newConfig.key);
  
  const createTableSQL = `
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
    
    ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Public read access for price alerts" ON public.price_alerts
      FOR SELECT USING (true);
    
    CREATE POLICY IF NOT EXISTS "Allow anonymous inserts for price alerts" ON public.price_alerts
      FOR INSERT WITH CHECK (true);
    
    CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON public.price_alerts(symbol);
    CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts(is_active);
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.log('Error creating table:', error.message);
      
      // Try alternative approach using individual queries
      console.log('Trying individual queries...');
      
      // Create table
      const { error: tableError } = await supabase
        .from('price_alerts')
        .select('*')
        .limit(1);
      
      if (tableError && tableError.code === 'PGRST116') {
        console.log('Table does not exist, need to create via dashboard');
        console.log('Please create price_alerts table manually in Supabase dashboard');
      } else {
        console.log('Table might already exist');
      }
    } else {
      console.log('Table created successfully');
    }
    
  } catch (err) {
    console.log('Error:', err.message);
  }
}

createPriceAlertsTable().catch(console.error);
