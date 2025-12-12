import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch live price for a symbol
async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const quote = data.chart?.result?.[0]?.meta;
    const prices = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    
    if (quote && prices && prices.length > 1) {
      const currentPrice = quote.regularMarketPrice || prices[prices.length - 1];
      const previousClose = quote.previousClose || prices[prices.length - 2];
      const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
      
      if (currentPrice > 0 && !isNaN(currentPrice) && isFinite(currentPrice)) {
        return { price: currentPrice, change };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch verification of all pending predictions...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all pending predictions older than 2 hours
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_history')
      .select('*')
      .is('was_accurate', null)
      .lt('created_at', twoHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching predictions:', fetchError);
      throw fetchError;
    }

    if (!predictions || predictions.length === 0) {
      console.log('No pending predictions to verify');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending predictions to verify',
          verified: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${predictions.length} predictions to verify`);
    
    let verifiedCount = 0;
    const uniqueSymbols = [...new Set(predictions.map((p: any) => p.symbol))];
    
    // Process each unique symbol
    for (const symbol of uniqueSymbols) {
      console.log(`Processing ${symbol}...`);
      
      const livePrice = await fetchLivePrice(symbol);
      if (!livePrice) {
        console.log(`Could not fetch live price for ${symbol}, skipping`);
        continue;
      }
      
      console.log(`Current price for ${symbol}: $${livePrice.price.toFixed(2)} (${livePrice.change > 0 ? '+' : ''}${livePrice.change.toFixed(2)}%)`);
      
      // Update all predictions for this symbol
      const symbolPredictions = predictions.filter((p: any) => p.symbol === symbol);
      
      for (const pred of symbolPredictions) {
        const priceAtPrediction = pred.price_at_prediction;
        if (!priceAtPrediction || priceAtPrediction <= 0) {
          console.log(`Skipping prediction ${pred.id} - invalid price: ${priceAtPrediction}`);
          continue;
        }
        
        const priceChange = ((livePrice.price - priceAtPrediction) / priceAtPrediction) * 100;
        let actualOutcome: 'bullish' | 'bearish' | 'neutral';
        
        if (priceChange > 1.5) actualOutcome = 'bullish';
        else if (priceChange < -1.5) actualOutcome = 'bearish';
        else actualOutcome = 'neutral';
        
        let wasAccurate = false;
        if (pred.prediction === actualOutcome) {
          wasAccurate = true;
        } else if (pred.prediction === 'neutral' && Math.abs(priceChange) < 2) {
          wasAccurate = true;
        } else if (pred.prediction === 'bullish' && priceChange > 0.8) {
          wasAccurate = true;
        } else if (pred.prediction === 'bearish' && priceChange < -0.8) {
          wasAccurate = true;
        }
        
        await supabase
          .from('prediction_history')
          .update({
            actual_outcome: actualOutcome,
            price_at_verification: livePrice.price,
            price_change_percent: priceChange,
            was_accurate: wasAccurate,
            verified_at: new Date().toISOString()
          })
          .eq('id', pred.id);
          
        verifiedCount++;
        console.log(`Updated prediction ${pred.id}: ${pred.prediction} vs ${actualOutcome} (${priceChange.toFixed(2)}%) -> ${wasAccurate ? 'Accurate' : 'Inaccurate'}`);
      }
    }

    console.log(`Batch verification completed. Verified ${verifiedCount} predictions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Batch verification completed successfully',
        verified: verifiedCount,
        total: predictions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in batch verification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
