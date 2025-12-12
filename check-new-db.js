// Simple database status check
import { createClient } from '@supabase/supabase-js';

const newConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
};

async function checkDatabaseStatus() {
  console.log('=== Checking New Database Status ===');
  const supabase = createClient(newConfig.url, newConfig.key);
  
  const tables = ['articles', 'articals', 'prediction', 'prediction_history', 'price_snapshots', 'sentiment_factors', 'news_articles'];
  
  for (const tableName of tables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${tableName}: ERROR - ${error.message}`);
      } else {
        console.log(`${tableName}: ${count} records`);
        
        if (tableName === 'articles' && count > 0) {
          const { data: sample } = await supabase
            .from(tableName)
            .select('symbol, sentiment_label')
            .limit(3);
          console.log(`  Sample: ${sample.map(s => `${s.symbol} (${s.sentiment_label})`).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`${tableName}: FAILED - ${err.message}`);
    }
  }
}

checkDatabaseStatus().catch(console.error);
