import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number } | null> {
  const ALPHA_VANTAGE_KEY = Deno.env.get('ALPHA_VANTAGE_KEY');

  if (ALPHA_VANTAGE_KEY) {
    try {
      console.log(`Verifying ${symbol} with Alpha Vantage...`);
      const cleanSymbol = symbol.replace('.NS', '.BSE');
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${ALPHA_VANTAGE_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const price = parseFloat(quote['05. price']);
        const changeStr = quote['10. change percent']?.replace('%', '');
        const change = parseFloat(changeStr);

        if (!isNaN(price) && !isNaN(change)) {
          console.log(`AV Price for ${symbol}: ${price} (${change}%)`);
          return { price, change };
        }
      }
    } catch (e) {
      console.error('Alpha Vantage verification failed:', e);
    }
  }

  try {
    // Fallback to Yahoo with more robust options
    const sources = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, // No params backup
    ];

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];

    for (const url of sources) {
      try {
        const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        const response = await fetch(url, {
          headers: {
            'User-Agent': randomAgent,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) continue;

        const data = await response.json();
        const quote = data.chart?.result?.[0]?.meta;
        const prices = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

        if (quote && ((prices && prices.length > 0) || quote.regularMarketPrice)) {
          // Robust price extraction
          let currentPrice = quote.regularMarketPrice;

          if (!currentPrice && prices) {
            // Find last valid price
            for (let i = prices.length - 1; i >= 0; i--) {
              if (prices[i]) {
                currentPrice = prices[i];
                break;
              }
            }
          }

          const previousClose = quote.chartPreviousClose || quote.previousClose;
          const change = previousClose && currentPrice ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

          if (currentPrice > 0 && !isNaN(currentPrice)) {
            console.log(`Yahoo Price fetched for ${symbol}: ${currentPrice} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
            return { price: currentPrice, change };
          }
        }
      } catch (sourceError: any) {
        console.log(`Failed to fetch from ${url}:`, sourceError.message);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching live price:', error);
    return null;
  }
}

async function verifyPrediction(prediction: any, currentPrice: number) {
  const priceAtPrediction = prediction.price_at_prediction;
  if (!priceAtPrediction || priceAtPrediction <= 0) {
    console.log(`Skipping prediction ${prediction.id} - invalid price at prediction: ${priceAtPrediction}`);
    return null;
  }

  const priceChange = ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;
  let actualOutcome: 'bullish' | 'bearish' | 'neutral';

  // More nuanced outcome determination
  if (priceChange > 2) actualOutcome = 'bullish';
  else if (priceChange < -2) actualOutcome = 'bearish';
  else actualOutcome = 'neutral';

  // Improved accuracy logic
  let wasAccurate = false;
  if (prediction.prediction === actualOutcome) {
    wasAccurate = true;
  } else if (prediction.prediction === 'neutral' && Math.abs(priceChange) < 3) {
    wasAccurate = true;
  } else if (prediction.prediction === 'bullish' && priceChange > 0.5) {
    wasAccurate = true;
  } else if (prediction.prediction === 'bearish' && priceChange < -0.5) {
    wasAccurate = true;
  }

  return {
    actual_outcome: actualOutcome,
    price_at_verification: currentPrice,
    price_change_percent: priceChange,
    was_accurate: wasAccurate,
    verified_at: new Date().toISOString()
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting prediction verification job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for force flag in request body
    let forceVerify = false;
    try {
      const body = await req.json();
      forceVerify = body.force === true;
    } catch {
      // Body might be empty, which is fine
    }

    let query = supabase
      .from('prediction_history')
      .select('*')
      .is('was_accurate', null)
      .order('created_at', { ascending: false })
      .limit(100);

    // Only apply time filter if not forcing verification
    if (!forceVerify) {
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
      // Include records older than 12h OR with missing created_at
      query = query.or(`created_at.lt.${twelveHoursAgo.toISOString()},created_at.is.null`);
    }

    const { data: predictions, error } = await query;

    if (error) {
      console.error('Error fetching predictions:', error);
      throw error;
    }

    if (!predictions || predictions.length === 0) {
      console.log('No predictions to verify');
      return new Response(
        JSON.stringify({ success: true, message: 'No predictions to verify', verified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${predictions.length} predictions to verify`);

    let verifiedCount = 0;
    let errorCount = 0;

    // Group predictions by symbol to minimize API calls
    const symbolGroups = predictions.reduce((groups: Record<string, any[]>, pred: any) => {
      if (!groups[pred.symbol]) groups[pred.symbol] = [];
      groups[pred.symbol].push(pred);
      return groups;
    }, {} as Record<string, any[]>);

    for (const [symbol, symbolPredictions] of Object.entries(symbolGroups)) {
      try {
        const predictions = symbolPredictions as any[];
        console.log(`Verifying ${predictions.length} predictions for ${symbol}`);

        const livePrice = await fetchLivePrice(symbol);
        if (!livePrice) {
          console.log(`Failed to fetch price for ${symbol}, skipping ${predictions.length} predictions`);
          errorCount += predictions.length;
          continue;
        }

        // Verify each prediction for this symbol
        for (const prediction of predictions) {
          try {
            // Fix missing created_at if null
            if (!prediction.created_at) {
              console.log(`Fixing missing created_at for prediction ${prediction.id}`);
              const now = new Date().toISOString();
              await supabase.from('prediction_history').update({ created_at: now }).eq('id', prediction.id);
              prediction.created_at = now;
            }

            const verification = await verifyPrediction(prediction, livePrice.price);
            if (verification) {
              await supabase
                .from('prediction_history')
                .update(verification)
                .eq('id', prediction.id);

              verifiedCount++;
              console.log(`Verified prediction ${prediction.id}: ${prediction.prediction} -> ${verification.actual_outcome} (${verification.was_accurate ? 'ACCURATE' : 'INACCURATE'})`);
            }
          } catch (predError) {
            console.error(`Error verifying prediction ${prediction.id}:`, predError);
            errorCount++;
          }
        }

        // Add delay between symbols to avoid rate limiting
        if (Object.keys(symbolGroups).indexOf(symbol) < Object.keys(symbolGroups).length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay slightly
        }
      } catch (symbolError: any) {
        console.error(`Error processing symbol ${symbol}:`, symbolError);
        const predictions = symbolPredictions as any[];
        errorCount += predictions.length;
      }
    }

    console.log(`Verification complete: ${verifiedCount} verified, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verified ${verifiedCount} predictions`,
        verified: verifiedCount,
        errors: errorCount,
        total: predictions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verification job:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
