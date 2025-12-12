// Transfer missing data from existing to new database
import { createClient } from '@supabase/supabase-js';

const existingConfig = {
  url: 'https://jvbgdhqmliqqasoxfrex.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2YmdkaHFtbGlxcWFzb3hmcmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODcyNjcsImV4cCI6MjA3OTE2MzI2N30.RM_q_TxAS2Q3rDRdIqVDua1UbqNRaqe0kDHbC5e_vrs'
};

const newConfig = {
  url: 'https://lhjostjgzsoixpbjzlnq.supabase.co',
  key: 'sb_secret_Y_Gk7DZYsRWGVHdkW8OPrg_5n5qKptr'
};

async function transferMissingData() {
  console.log('=== Transferring Missing Data ===');
  
  const existingDB = createClient(existingConfig.url, existingConfig.key);
  const newDB = createClient(newConfig.url, newConfig.key);
  
  try {
    // 1. Transfer missing articles
    console.log('\n--- Transferring Articles ---');
    
    // Get existing article IDs to avoid duplicates
    const { data: existingArticles } = await newDB
      .from('articles')
      .select('id');
    
    const existingIds = new Set(existingArticles?.map(a => a.id) || []);
    
    // Get all articles from existing DB
    const { data: allArticles } = await existingDB
      .from('articles')
      .select('*')
      .order('published', { ascending: false });
    
    // Filter only missing articles
    const missingArticles = allArticles?.filter(article => !existingIds.has(article.id)) || [];
    
    console.log(`Found ${missingArticles.length} missing articles`);
    
    if (missingArticles.length > 0) {
      // Transfer in batches of 50
      const batchSize = 50;
      for (let i = 0; i < missingArticles.length; i += batchSize) {
        const batch = missingArticles.slice(i, i + batchSize);
        const { error } = await newDB
          .from('articles')
          .upsert(batch);
        
        if (error) {
          console.log(`Error transferring batch ${i/batchSize + 1}:`, error.message);
        } else {
          console.log(`Transferred batch ${i/batchSize + 1}/${Math.ceil(missingArticles.length/batchSize)}`);
        }
      }
    }
    
    // 2. Transfer missing price snapshots
    console.log('\n--- Transferring Price Snapshots ---');
    
    const { data: existingSnapshots } = await newDB
      .from('price_snapshots')
      .select('id');
    
    const existingSnapshotIds = new Set(existingSnapshots?.map(s => s.id) || []);
    
    const { data: allSnapshots } = await existingDB
      .from('price_snapshots')
      .select('*')
      .order('timestamp', { ascending: false });
    
    const missingSnapshots = allSnapshots?.filter(snapshot => !existingSnapshotIds.has(snapshot.id)) || [];
    
    console.log(`Found ${missingSnapshots.length} missing price snapshots`);
    
    if (missingSnapshots.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < missingSnapshots.length; i += batchSize) {
        const batch = missingSnapshots.slice(i, i + batchSize);
        const { error } = await newDB
          .from('price_snapshots')
          .upsert(batch);
        
        if (error) {
          console.log(`Error transferring snapshot batch ${i/batchSize + 1}:`, error.message);
        } else {
          console.log(`Transferred snapshot batch ${i/batchSize + 1}/${Math.ceil(missingSnapshots.length/batchSize)}`);
        }
      }
    }
    
    // 3. Transfer missing prediction history
    console.log('\n--- Transferring Prediction History ---');
    
    const { data: existingPredictions } = await newDB
      .from('prediction_history')
      .select('id');
    
    const existingPredictionIds = new Set(existingPredictions?.map(p => p.id) || []);
    
    const { data: allPredictions } = await existingDB
      .from('prediction_history')
      .select('*')
      .order('created_at', { ascending: false });
    
    const missingPredictions = allPredictions?.filter(prediction => !existingPredictionIds.has(prediction.id)) || [];
    
    console.log(`Found ${missingPredictions.length} missing predictions`);
    
    if (missingPredictions.length > 0) {
      const { error } = await newDB
        .from('prediction_history')
        .upsert(missingPredictions);
      
      if (error) {
        console.log('Error transferring predictions:', error.message);
      } else {
        console.log('Transferred all missing predictions');
      }
    }
    
    console.log('\n=== Transfer Complete ===');
    
  } catch (error) {
    console.error('Transfer failed:', error);
  }
}

transferMissingData().catch(console.error);
