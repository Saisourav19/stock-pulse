import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // Increased limit
const RATE_WINDOW = 60000; // 1 minute in ms

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT) {
    return true;
  }

  entry.count++;
  return false;
}

// Alpha Vantage Helper
async function fetchAlphaVantage(symbol: string, apiKey: string) {
  try {
    // Map .NS symbols to Alpha Vantage format (no change usually needed, or use BSE: for some)
    // Alpha Vantage often takes SYMBOL directly or SYMBOL.BSE
    const cleanSymbol = symbol.replace('.NS', '.BSE'); // Just an example, AV is good with most
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data['Global Quote']) {
      const quote = data['Global Quote'];
      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

      return {
        price,
        change,
        changePercent,
        source: 'Alpha Vantage'
      };
    }
  } catch (error) {
    console.error('Alpha Vantage Error:', error);
  }
  return null;
}

// Yahoo Finance Helper (Fallback)
async function fetchYahooFinance(symbol: string) {
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(yahooUrl);
    const data = await response.json();

    if (data.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators.quote[0];

      const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      const changeAmount = currentPrice - previousClose;
      const changePercent = (changeAmount / previousClose) * 100;

      return {
        price: currentPrice,
        change: changeAmount,
        changePercent,
        meta,
        source: 'Yahoo Finance'
      };
    }
  } catch (error) {
    console.error('Yahoo Finance Error:', error);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { symbol } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching price for ${symbol}`);

    let result = null;
    let metaData = {};
    let currency = 'USD';
    let source = '';

    // 1. Try Alpha Vantage if key exists
    const alphaKey = Deno.env.get('ALPHA_VANTAGE_KEY');
    if (alphaKey) {
      console.log('Attempting fetch with Alpha Vantage...');
      const alphaData = await fetchAlphaVantage(symbol, alphaKey);
      if (alphaData && alphaData.price) {
        result = alphaData;
        source = 'Alpha Vantage';
        currency = 'USD'; // AV usually returns global quote, often USD for US stocks
        // Note: For .NS, AV might return INR, but we assume default for now or check metadata if available
      }
    }

    // 2. Fallback to Yahoo Finance
    if (!result) {
      console.log('Falling back to Yahoo Finance...');
      const yahooData = await fetchYahooFinance(symbol);
      if (yahooData) {
        result = yahooData;
        source = 'Yahoo Finance';
        metaData = yahooData.meta;
        currency = yahooData.meta.currency || 'USD';
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Stock not found in any provider' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get USD/INR exchange rate (helper)
    const forexResponse = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/INR=X?interval=1d&range=1d');
    const forexData = await forexResponse.json();
    const usdToInr = forexData.chart?.result?.[0]?.meta?.regularMarketPrice || 83;

    let priceUSD = result.price;
    let priceINR = result.price * usdToInr;

    if (currency === 'INR') {
      priceUSD = result.price / usdToInr;
      priceINR = result.price;
    }

    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: insertError } = await supabase
      .from('price_snapshots')
      .insert({
        symbol,
        price: result.price,
        change_amount: result.change,
        change_percent: result.changePercent,
        currency,
        metadata: {
          name: (metaData as any).longName || (metaData as any).shortName || symbol,
          priceUSD,
          priceINR,
          exchangeRate: usdToInr,
          source // Track which provider was used
        },
      });

    if (insertError) {
      console.error('Error inserting price:', insertError);
    }

    return new Response(
      JSON.stringify({
        symbol,
        price: result.price,
        change_amount: result.change,
        change_percent: result.changePercent,
        currency,
        priceUSD,
        priceINR,
        name: (metaData as any).longName || symbol,
        source
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching stock price:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});