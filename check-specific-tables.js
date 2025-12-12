// Check specific tables with both keys
import { createClient } from '@supabase/supabase-js';

const publicConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_publishable_mMPHkcWNgMFP69ndJQ-HMw_7cqZeH6d'
};

const serviceConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
};

async function checkSpecificTables() {
  console.log('=== Checking Specific Tables ===');
  
  const publicDB = createClient(publicConfig.url, publicConfig.key);
  const serviceDB = createClient(serviceConfig.url, serviceConfig.key);
  
  const tables = ['price_snapshots', 'price_alerts'];
  
  for (const tableName of tables) {
    console.log(`\n--- ${tableName} ---`);
    
    // Check with public key
    try {
      const { count: publicCount, error: publicError } = await publicDB
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (publicError) {
        console.log(`Public key: ERROR - ${publicError.message}`);
      } else {
        console.log(`Public key: ${publicCount} records`);
      }
    } catch (err) {
      console.log(`Public key: FAILED - ${err.message}`);
    }
    
    // Check with service key
    try {
      const { count: serviceCount, error: serviceError } = await serviceDB
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (serviceError) {
        console.log(`Service key: ERROR - ${serviceError.message}`);
      } else {
        console.log(`Service key: ${serviceCount} records`);
      }
    } catch (err) {
      console.log(`Service key: FAILED - ${err.message}`);
    }
  }
}

checkSpecificTables().catch(console.error);
