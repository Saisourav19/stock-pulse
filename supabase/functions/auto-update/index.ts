import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch live price for a symbol
async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number; currency?: string } | null> {
  const ALPHA_VANTAGE_KEY = Deno.env.get('ALPHA_VANTAGE_KEY');

  if (ALPHA_VANTAGE_KEY) {
    try {
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
    const sources = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
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
          let currentPrice = quote.regularMarketPrice;

          if (!currentPrice && prices) {
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
            return { price: currentPrice, change };
          }
        }
      } catch (sourceError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

// Fetch recent news articles for sentiment analysis
async function fetchNewsArticles(symbol: string): Promise<any[]> {
  try {
    // For now, return empty array - this would integrate with a news API
    // In production, you'd use NewsAPI, Alpha Vantage, or similar
    console.log(`Fetching news for ${symbol} (placeholder implementation)`);
    return [];
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

// Generate prediction based on sentiment and price data
function generatePrediction(symbol: string, avgSentiment: number, trend: number, priceChange: number) {
  let prediction: 'bullish' | 'bearish' | 'neutral';
  let confidence: number;
  let riskLevel: 'low' | 'medium' | 'high';

  // Simple algorithmic prediction based on multiple factors
  const combinedScore = avgSentiment + (trend * 0.5) + (priceChange * 0.3);

  if (combinedScore > 0.8) {
    prediction = 'bullish';
    confidence = Math.min(0.9, 0.6 + combinedScore * 0.2);
    riskLevel = 'low';
  } else if (combinedScore < -0.8) {
    prediction = 'bearish';
    confidence = Math.min(0.9, 0.6 + Math.abs(combinedScore) * 0.2);
    riskLevel = 'high';
  } else {
    prediction = 'neutral';
    confidence = 0.5 + Math.abs(combinedScore) * 0.3;
    riskLevel = 'medium';
  }

  return {
    prediction,
    confidence,
    riskLevel,
    sentimentMomentum: trend > 0.1 ? 'accelerating' : trend < -0.1 ? 'decelerating' : 'stable',
    shortTermOutlook: `Expected ${prediction} sentiment in the short term based on current trends`,
    mediumTermOutlook: `Medium-term outlook suggests ${prediction} conditions`,
    keyFactors: [
      `Current sentiment: ${avgSentiment.toFixed(3)}`,
      `Price trend: ${trend > 0 ? 'positive' : trend < 0 ? 'negative' : 'neutral'}`,
      `Recent price change: ${priceChange.toFixed(2)}%`
    ],
    source: 'algorithmic'
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting automatic data update...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active symbols to update
    const { data: activeSymbols, error: symbolsError } = await supabase
      .from('prediction_history')
      .select('symbol')
      .neq('symbol', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (symbolsError) {
      console.error('Error fetching active symbols:', symbolsError);
      throw symbolsError;
    }

    if (!activeSymbols || activeSymbols.length === 0) {
      console.log('No active symbols found for update');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active symbols to update',
          updated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniqueSymbols = [...new Set(activeSymbols.map((item: any) => item.symbol))];
    console.log(`Updating ${uniqueSymbols.length} unique symbols: ${uniqueSymbols.join(', ')}`);

    let updatedCount = 0;

    for (const symbol of uniqueSymbols as string[]) {
      try {
        console.log(`Processing ${symbol}...`);

        // Fetch current price
        const livePrice = await fetchLivePrice(symbol);
        if (!livePrice) {
          console.log(`Could not fetch live price for ${symbol}, skipping`);
          continue;
        }

        // Fetch recent articles (placeholder)
        const articles = await fetchNewsArticles(symbol);

        // Calculate sentiment (simplified)
        const avgSentiment = articles.length > 0
          ? articles.reduce((sum: number, article: any) => sum + article.sentiment_score, 0) / articles.length
          : 0;

        const trend = livePrice.change / 100; // Convert percentage to decimal
        const priceChange = livePrice.change;

        // Generate new prediction
        const prediction = generatePrediction(symbol, avgSentiment, trend, priceChange);

        // Store prediction in database
        const { error: insertError } = await supabase
          .from('prediction_history')
          .insert({
            symbol,
            prediction: prediction.prediction,
            confidence: prediction.confidence,
            risk_level: prediction.riskLevel,
            sentiment_momentum: prediction.sentimentMomentum,
            avg_sentiment: avgSentiment,
            articles_analyzed: articles.length,
            price_at_prediction: livePrice.price,
            source: prediction.source,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error inserting prediction for ${symbol}:`, insertError);
          continue;
        }

        // Verify old predictions for this symbol
        const twelveHoursAgo = new Date();
        twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

        const { data: oldPredictions } = await supabase
          .from('prediction_history')
          .select('*')
          .eq('symbol', symbol)
          .is('was_accurate', null)
          .or(`created_at.lt.${twelveHoursAgo.toISOString()},created_at.is.null`)
          .order('created_at', { ascending: false })
          .limit(5);

        if (oldPredictions) {
          for (const pred of oldPredictions) {
            const priceAtPrediction = pred.price_at_prediction;
            if (!priceAtPrediction || priceAtPrediction <= 0) continue;

            const oldPriceChange = ((livePrice.price - priceAtPrediction) / priceAtPrediction) * 100;
            let actualOutcome: 'bullish' | 'bearish' | 'neutral';

            if (oldPriceChange > 1.5) actualOutcome = 'bullish';
            else if (oldPriceChange < -1.5) actualOutcome = 'bearish';
            else actualOutcome = 'neutral';

            let wasAccurate = false;
            if (pred.prediction === actualOutcome) {
              wasAccurate = true;
            } else if (pred.prediction === 'neutral' && Math.abs(oldPriceChange) < 2) {
              wasAccurate = true;
            } else if (pred.prediction === 'bullish' && oldPriceChange > 0.8) {
              wasAccurate = true;
            } else if (pred.prediction === 'bearish' && oldPriceChange < -0.8) {
              wasAccurate = true;
            }

            await supabase
              .from('prediction_history')
              .update({
                actual_outcome: actualOutcome,
                price_at_verification: livePrice.price,
                price_change_percent: oldPriceChange,
                was_accurate: wasAccurate,
                verified_at: new Date().toISOString()
              })
              .eq('id', pred.id);
          }
        }

        updatedCount++;
        console.log(`Successfully updated ${symbol}: ${prediction.prediction} (${(prediction.confidence * 100).toFixed(0)}% confidence)`);

      } catch (symbolError) {
        console.error(`Error processing ${symbol}:`, symbolError);
        continue;
      }
    }

    console.log(`Auto-update completed. Updated ${updatedCount} symbols`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Automatic data update completed successfully',
        updated: updatedCount,
        total: uniqueSymbols.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in automatic update:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
