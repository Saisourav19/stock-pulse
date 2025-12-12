// Database comparison script
import { createClient } from '@supabase/supabase-js';

// Existing database from .env
const existingConfig = {
  url: 'https://jvbgdhqmliqqasoxfrex.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2YmdkaHFtbGlxcWFzb3hmcmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODcyNjcsImV4cCI6MjA3OTE2MzI2N30.RM_q_TxAS2Q3rDRdIqVDua1UbqNRaqe0kDHbC5e_vrs'
};

// New database (need key from user)
const newConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
};

async function getDatabaseInfo(config, name) {
  console.log(`\n=== Checking ${name} Database ===`);
  const supabase = createClient(config.url, config.key);
  
  try {
    // Check key tables directly
    const keyTables = ['articles', 'price_snapshots', 'prediction_history', 'sentiment_factors'];
    const tableInfo = {};
    const availableTables = [];
    
    for (const tableName of keyTables) {
      try {
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          tableInfo[tableName] = count;
          availableTables.push(tableName);
          console.log(`${tableName}: ${count} records`);
          
          // Get sample data for articles table
          if (tableName === 'articles' && count > 0) {
            const { data: sampleArticles, error: sampleError } = await supabase
              .from(tableName)
              .select('symbol, sentiment_label, published')
              .limit(5);
            
            if (!sampleError && sampleArticles) {
              console.log(`Sample articles:`);
              sampleArticles.forEach(article => {
                console.log(`  - ${article.symbol}: ${article.sentiment_label || 'No sentiment'} (${article.published})`);
              });
            }
            
            // Get unique symbols
            const { data: symbols, error: symbolsError } = await supabase
              .from(tableName)
              .select('symbol')
              .neq('symbol', null);
            
            if (!symbolsError && symbols) {
              const uniqueSymbols = [...new Set(symbols.map(s => s.symbol))];
              console.log(`Unique symbols: ${uniqueSymbols.length} (${uniqueSymbols.slice(0, 10).join(', ')}${uniqueSymbols.length > 10 ? '...' : ''})`);
            }
          }
        } else {
          console.log(`${tableName}: Table not found or no access`);
        }
      } catch (err) {
        console.log(`${tableName}: Error - ${err.message}`);
      }
    }
    
    return {
      name,
      url: config.url,
      tables: availableTables,
      tableInfo
    };
    
  } catch (err) {
    console.log(`Error connecting to ${name}:`, err.message);
    return null;
  }
}

async function compareDatabases() {
  console.log('Starting database comparison...\n');
  
  // Check existing database
  const existingDB = await getDatabaseInfo(existingConfig, 'Existing');
  
  // Check new database (will fail without proper key)
  console.log('\n=== NOTE ===');
  console.log('To check the new database, you need to:');
  console.log('1. Get the anon/service key for: https://lhjostjgzsoixpbjzlnq.supabase.co');
  console.log('2. Update the newConfig.key in this script');
  console.log('3. Run the script again\n');
  
  const newDB = await getDatabaseInfo(newConfig, 'New');
  
  if (existingDB && newDB) {
    console.log('\n=== COMPARISON RESULTS ===');
    
    // Compare tables
    const existingTables = new Set(existingDB.tables);
    const newTables = new Set(newDB.tables);
    
    const commonTables = [...existingTables].filter(table => newTables.has(table));
    const missingInNew = [...existingTables].filter(table => !newTables.has(table));
    const extraInNew = [...newTables].filter(table => !existingTables.has(table));
    
    console.log(`Common tables: ${commonTables.join(', ')}`);
    console.log(`Missing in new: ${missingInNew.join(', ')}`);
    console.log(`Extra in new: ${extraInNew.join(', ')}`);
    
    // Compare data counts
    console.log('\nData Comparison:');
    for (const tableName of Object.keys(existingDB.tableInfo)) {
      const existingCount = existingDB.tableInfo[tableName];
      const newCount = newDB.tableInfo[tableName];
      
      if (newCount !== undefined) {
        const difference = newCount - existingCount;
        console.log(`${tableName}: Existing=${existingCount}, New=${newCount} (${difference >= 0 ? '+' : ''}${difference})`);
      } else {
        console.log(`${tableName}: Existing=${existingCount}, New=Not found`);
      }
    }
  }
}

// Run the comparison
compareDatabases().catch(console.error);
