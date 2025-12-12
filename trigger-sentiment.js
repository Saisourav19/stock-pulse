// Manual script to trigger sentiment analysis for RELIANCE.NS
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jvbgdhqmliqqasoxfrex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2YmdkaHFtbGlxcWFzb3hmcmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODcyNjcsImV4cCI6MjA3OTE2MzI2N30.RM_q_TxAS2Q3rDRdIqVDua1UbqNRaqe0kDHbC5e_vrs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerSentimentAnalysis() {
  console.log('Triggering sentiment analysis for RELIANCE.NS...');
  
  try {
    // Call the fetch-stock-news function
    const { data, error } = await supabase.functions.invoke('fetch-stock-news', {
      body: { symbol: 'RELIANCE.NS' }
    });
    
    if (error) {
      console.error('Error triggering news fetch:', error);
      return;
    }
    
    console.log('News fetch triggered:', data);
    
    // Wait a bit then check for articles
    setTimeout(async () => {
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .eq('symbol', 'RELIANCE.NS')
        .order('published', { ascending: false })
        .limit(10);
      
      if (articlesError) {
        console.error('Error fetching articles:', articlesError);
        return;
      }
      
      console.log(`Found ${articles.length} articles for RELIANCE.NS`);
      articles.forEach(article => {
        console.log(`- ${article.title} (${article.sentiment_label || 'No sentiment'})`);
      });
    }, 5000);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

triggerSentimentAnalysis();
