import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number } | null> {
  const ALPHA_VANTAGE_KEY = Deno.env.get('ALPHA_VANTAGE_KEY');

  // 1. Try Alpha Vantage first (Premium)
  if (ALPHA_VANTAGE_KEY) {
    try {
      // Map .NS symbols to Alpha Vantage format (no change usually needed, or use BSE: for some)
      // Alpha Vantage often takes SYMBOL directly or SYMBOL.BSE
      const cleanSymbol = symbol.replace('.NS', '.BSE');
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${ALPHA_VANTAGE_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const price = parseFloat(quote['05. price']);
        const changeStr = quote['10. change percent']?.replace('%', '');
        const change = parseFloat(changeStr);

        if (!isNaN(price)) {
          console.log(`[Alpha Vantage] Price for ${symbol}: $${price} (${change}%)`);
          // Alpha Vantage global quote doesn't explicitly give currency code in this endpoint sometimes, 
          // but usually it's correct context. For BSE/NS it's INR.
          const isInr = symbol.includes('.NS') || symbol.includes('.BSE');
          return { price, change: isNaN(change) ? 0 : change, currency: isInr ? 'INR' : 'USD' };
        }
      }
    } catch (e) {
      console.error('[Alpha Vantage] verification failed:', e);
    }
  }

  try {
    // 2. Fallback to Yahoo Finance (Reliable but non-premium)
    const sources = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
    ];

    for (const url of sources) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) continue;

        const data = await response.json();
        const quote = data.chart?.result?.[0]?.meta;
        const prices = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

        if (quote && prices && prices.length > 1) {
          const currentPrice = quote.regularMarketPrice || prices[prices.length - 1];
          const previousClose = quote.previousClose || prices[prices.length - 2];
          const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

          if (currentPrice > 0 && !isNaN(currentPrice)) {
            console.log(`[Yahoo Finance] Price for ${symbol}: $${currentPrice.toFixed(2)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
            return { price: currentPrice, change };
          }
        }
      } catch (sourceError) {
        console.log(`Failed to fetch from ${url}:`, sourceError instanceof Error ? sourceError.message : 'Unknown error');
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching live price:', error);
    return null;
  }
}

async function verifyPastPredictions(supabase: any, symbol: string, currentPrice: number) {
  try {
    // Get unverified predictions older than 4 hours (reduced for more frequent updates)
    const fourHoursAgo = new Date();
    fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

    const { data: predictions } = await supabase
      .from('prediction_history')
      .select('*')
      .eq('symbol', symbol)
      .is('was_accurate', null)
      .lt('created_at', fourHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (!predictions || predictions.length === 0) {
      console.log(`No past predictions to verify for ${symbol}`);
      return;
    }

    console.log(`Verifying ${predictions.length} past predictions for ${symbol} with current price: $${currentPrice}`);

    for (const pred of predictions) {
      const priceAtPrediction = pred.price_at_prediction;
      if (!priceAtPrediction || priceAtPrediction <= 0) {
        console.log(`Skipping prediction ${pred.id} - invalid price: ${priceAtPrediction}`);
        continue;
      }

      // Calculate actual price change
      const priceChange = ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;
      let actualOutcome: 'bullish' | 'bearish' | 'neutral';

      // More realistic outcome determination based on actual market movement
      if (priceChange > 1.5) actualOutcome = 'bullish';
      else if (priceChange < -1.5) actualOutcome = 'bearish';
      else actualOutcome = 'neutral';

      // Improved accuracy logic with more realistic thresholds
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

      console.log(`Prediction ${pred.id}: ${pred.prediction} vs actual ${actualOutcome} (${priceChange.toFixed(2)}%) -> ${wasAccurate ? 'Accurate' : 'Inaccurate'}`);

      await supabase
        .from('prediction_history')
        .update({
          actual_outcome: actualOutcome,
          price_at_verification: currentPrice,
          price_change_percent: priceChange,
          was_accurate: wasAccurate,
          verified_at: new Date().toISOString()
        })
        .eq('id', pred.id);

      console.log(`Updated prediction ${pred.id} with verification results`);
    }
  } catch (error) {
    console.error('Error verifying past predictions:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, includeHistory } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating sentiment prediction for ${symbol}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch live price
    const livePrice = await fetchLivePrice(symbol);
    console.log(`Live price for ${symbol}:`, livePrice);

    // Verify past predictions if we have current price
    if (livePrice) {
      await verifyPastPredictions(supabase, symbol, livePrice.price);
    }

    // Fetch historical sentiment data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('sentiment_compound, sentiment_label, published, title')
      .eq('symbol', symbol)
      .gte('published', thirtyDaysAgo.toISOString())
      .not('sentiment_compound', 'is', null)
      .order('published', { ascending: true });

    if (fetchError) {
      console.error('Error fetching articles:', fetchError);
      throw fetchError;
    }

    // Calculate historical sentiment stats
    const sentimentData = articles || [];
    const avgSentiment = sentimentData.length > 0
      ? sentimentData.reduce((sum, a) => sum + (a.sentiment_compound || 0), 0) / sentimentData.length
      : 0;

    const posCount = sentimentData.filter(a => a.sentiment_label === 'positive').length;
    const negCount = sentimentData.filter(a => a.sentiment_label === 'negative').length;
    const neuCount = sentimentData.filter(a => a.sentiment_label === 'neutral').length;

    // Recent trend (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentArticles = sentimentData.filter(a => new Date(a.published) >= sevenDaysAgo);
    const olderArticles = sentimentData.filter(a => {
      const date = new Date(a.published);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    });

    const recentAvg = recentArticles.length > 0
      ? recentArticles.reduce((sum, a) => sum + (a.sentiment_compound || 0), 0) / recentArticles.length
      : 0;
    const olderAvg = olderArticles.length > 0
      ? olderArticles.reduce((sum, a) => sum + (a.sentiment_compound || 0), 0) / olderArticles.length
      : 0;

    const trend = recentAvg - olderAvg;

    // Fetch prediction history for accuracy stats
    const { data: historyData } = await supabase
      .from('prediction_history')
      .select('*')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(50);

    const accuracyStats = calculateAccuracyStats(historyData || []);

    // Use AI for prediction
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let prediction;

    if (!OPENAI_API_KEY) {
      console.log("Using algorithmic prediction (no OpenAI key)");
      prediction = generateAlgorithmicPrediction(symbol, avgSentiment, trend, posCount, negCount, neuCount, sentimentData.length);
    } else {
      const recentHeadlines = recentArticles.slice(-5).map(a => a.title).join('; ');

      const prompt = `Analyze this stock sentiment data and predict future sentiment for ${symbol}:

Historical Data (30 days):
- Total articles analyzed: ${sentimentData.length}
- Average sentiment score: ${avgSentiment.toFixed(3)} (range: -1 to 1)
- Distribution: ${posCount} positive, ${neuCount} neutral, ${negCount} negative
- Recent trend: ${trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable'} (change: ${trend.toFixed(3)})
- Recent headlines: ${recentHeadlines || 'No recent headlines'}
${livePrice ? `- Current price: $${livePrice.price.toFixed(2)} (${livePrice.change > 0 ? '+' : ''}${livePrice.change.toFixed(2)}%)` : ''}
${accuracyStats.totalPredictions > 0 ? `- Historical accuracy: ${accuracyStats.accuracyRate.toFixed(1)}% (${accuracyStats.totalPredictions} predictions)` : ''}

Provide a JSON response with ONLY this structure (no markdown, no explanation):
{
  "prediction": "bullish" | "bearish" | "neutral",
  "confidence": 0.0-1.0,
  "shortTermOutlook": "1-2 sentence outlook for next 7 days",
  "mediumTermOutlook": "1-2 sentence outlook for next 30 days",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "riskLevel": "low" | "medium" | "high",
  "sentimentMomentum": "accelerating" | "decelerating" | "stable"
}`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000
          }),
        });

        if (!response.ok) {
          console.error("AI API error:", response.status);
          prediction = generateAlgorithmicPrediction(symbol, avgSentiment, trend, posCount, negCount, neuCount, sentimentData.length);
        } else {
          const data = await response.json();
          const content = data.choices[0].message.content;

          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              prediction = { ...JSON.parse(jsonMatch[0]), source: 'ai' };
            } else {
              prediction = { ...JSON.parse(content), source: 'ai' };
            }
          } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            prediction = generateAlgorithmicPrediction(symbol, avgSentiment, trend, posCount, negCount, neuCount, sentimentData.length);
          }
        }
      } catch (aiError) {
        console.error("AI prediction failed:", aiError);
        prediction = generateAlgorithmicPrediction(symbol, avgSentiment, trend, posCount, negCount, neuCount, sentimentData.length);
      }
    }

    let dbError = null;
    try {
      const { error } = await supabase
        .from('prediction_history')
        .insert({
          id: crypto.randomUUID(),
          symbol,
          prediction: prediction.prediction,
          confidence: prediction.confidence,
          risk_level: prediction.riskLevel,
          sentiment_momentum: prediction.sentimentMomentum,
          avg_sentiment: avgSentiment,
          articles_analyzed: sentimentData.length,
          price_at_prediction: livePrice?.price || null,
          source: prediction.source || 'algorithmic',
        });

      if (error) throw error;
      console.log('Prediction stored in history');
    } catch (storeError: any) {
      console.error('Failed to store prediction:', storeError);
      dbError = storeError.message || JSON.stringify(storeError);
    }

    const result = {
      symbol,
      ...prediction,
      historicalData: {
        totalArticles: sentimentData.length,
        avgSentiment,
        posCount,
        negCount,
        neuCount,
        trend,
      },
      livePrice: livePrice || null,
      accuracyStats,
      predictionHistory: includeHistory ? (historyData || []).slice(0, 20) : [],
      generatedAt: new Date().toISOString(),
      source: prediction.source || 'algorithmic',
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in predict-sentiment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateAccuracyStats(history: any[]) {
  const verified = history.filter(p => p.was_accurate !== null);
  const accurate = verified.filter(p => p.was_accurate === true);

  const byType = {
    bullish: { total: 0, correct: 0 },
    bearish: { total: 0, correct: 0 },
    neutral: { total: 0, correct: 0 },
  };

  verified.forEach(p => {
    const type = p.prediction as keyof typeof byType;
    if (byType[type]) {
      byType[type].total++;
      if (p.was_accurate) byType[type].correct++;
    }
  });

  return {
    totalPredictions: history.length,
    verifiedPredictions: verified.length,
    accuratePredictions: accurate.length,
    accuracyRate: verified.length > 0 ? (accurate.length / verified.length) * 100 : 0,
    byType,
    avgConfidence: history.length > 0
      ? history.reduce((sum, p) => sum + (p.confidence || 0), 0) / history.length * 100
      : 0,
  };
}

function generateAlgorithmicPrediction(
  symbol: string,
  avgSentiment: number,
  trend: number,
  posCount: number,
  negCount: number,
  neuCount: number,
  totalArticles: number
) {
  let prediction: 'bullish' | 'bearish' | 'neutral';
  let confidence: number;
  let riskLevel: 'low' | 'medium' | 'high';
  let momentum: 'accelerating' | 'decelerating' | 'stable';

  const sentimentStrength = Math.abs(avgSentiment);
  const trendStrength = Math.abs(trend);

  if (avgSentiment > 0.15 && trend >= 0) {
    prediction = 'bullish';
    confidence = Math.min(0.85, 0.5 + sentimentStrength + trendStrength * 0.5);
  } else if (avgSentiment < -0.15 && trend <= 0) {
    prediction = 'bearish';
    confidence = Math.min(0.85, 0.5 + sentimentStrength + trendStrength * 0.5);
  } else if (avgSentiment > 0.05) {
    prediction = 'bullish';
    confidence = Math.min(0.65, 0.4 + sentimentStrength);
  } else if (avgSentiment < -0.05) {
    prediction = 'bearish';
    confidence = Math.min(0.65, 0.4 + sentimentStrength);
  } else {
    prediction = 'neutral';
    confidence = 0.5 + (1 - sentimentStrength) * 0.3;
  }

  const volatility = posCount > 0 && negCount > 0 ? Math.abs(posCount - negCount) / (posCount + negCount) : 0.5;
  if (volatility < 0.3) {
    riskLevel = 'high';
  } else if (volatility < 0.6) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  if (trendStrength > 0.1) {
    momentum = trend > 0 ? 'accelerating' : 'decelerating';
  } else {
    momentum = 'stable';
  }

  const keyFactors = [];
  if (posCount > negCount * 1.5) keyFactors.push('Strong positive news coverage');
  if (negCount > posCount * 1.5) keyFactors.push('Elevated negative sentiment');
  if (trend > 0.05) keyFactors.push('Improving sentiment trend');
  if (trend < -0.05) keyFactors.push('Declining sentiment momentum');
  if (totalArticles > 20) keyFactors.push('High media attention');
  if (totalArticles < 5) keyFactors.push('Limited news coverage');
  if (keyFactors.length === 0) keyFactors.push('Mixed market signals');

  return {
    prediction,
    confidence: Math.round(confidence * 100) / 100,
    shortTermOutlook: prediction === 'bullish'
      ? `Positive momentum expected to continue over the next week with ${Math.round(confidence * 100)}% confidence.`
      : prediction === 'bearish'
        ? `Caution advised for the short term as negative sentiment persists.`
        : `Market sentiment remains mixed; expect consolidation in the near term.`,
    mediumTermOutlook: prediction === 'bullish'
      ? `If current positive trend continues, expect sustained upward pressure over the coming month.`
      : prediction === 'bearish'
        ? `Extended weakness possible unless sentiment shifts significantly.`
        : `Watch for catalyst events that could break the current neutral pattern.`,
    keyFactors: keyFactors.slice(0, 3),
    riskLevel,
    sentimentMomentum: momentum,
    source: 'algorithmic',
  };
}
