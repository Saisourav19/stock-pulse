// Test database connection
import { createClient } from '@supabase/supabase-js';

const newConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_publishable_mMPHkcWNgMFP69ndJQ-HMw_7cqZeH6d'
};

async function testConnection() {
  console.log('=== Testing New Database Connection ===');
  const supabase = createClient(newConfig.url, newConfig.key);
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('articles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('Connection FAILED:', error.message);
      console.log('Error details:', error);
    } else {
      console.log('Connection SUCCESS');
      console.log('Data accessible:', data);
    }
    
    // Test with service key
    console.log('\n=== Testing with Service Key ===');
    const serviceConfig = {
      url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
      key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
    };
    
    const serviceDB = createClient(serviceConfig.url, serviceConfig.key);
    const { data: serviceData, error: serviceError } = await serviceDB
      .from('articles')
      .select('count')
      .limit(1);
    
    if (serviceError) {
      console.log('Service key FAILED:', serviceError.message);
    } else {
      console.log('Service key SUCCESS');
      console.log('Service data accessible:', serviceData);
    }
    
  } catch (err) {
    console.log('Connection error:', err.message);
  }
}

testConnection().catch(console.error);
