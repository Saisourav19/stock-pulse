import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketData {
  symbol: string;
  name: string;
  prices: number[];
  dates: string[];
}

const INDICES = [
  { symbol: '^NSEI', name: 'NIFTY 50', country: 'India' },
  { symbol: '^GSPC', name: 'S&P 500', country: 'US' },
  { symbol: '^FTSE', name: 'FTSE 100', country: 'UK' },
  { symbol: '^GDAXI', name: 'DAX', country: 'Germany' },
  { symbol: '^N225', name: 'Nikkei 225', country: 'Japan' },
  { symbol: '000001.SS', name: 'SSE Composite', country: 'China' },
  { symbol: '^HSI', name: 'Hang Seng', country: 'Hong Kong' },
  { symbol: '^AXJO', name: 'ASX 200', country: 'Australia' },
  { symbol: '^GSPTSE', name: 'TSX', country: 'Canada' },
  { symbol: '^MXX', name: 'IPC', country: 'Mexico' },
  { symbol: '^BVSP', name: 'Bovespa', country: 'Brazil' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', country: 'Eurozone' },
];

async function fetchYahooFinanceData(symbol: string, period: string = '1mo'): Promise<MarketData | null> {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (30 * 24 * 60 * 60); // 30 days
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.timestamp || !result.indicators.quote[0].close) {
      return null;
    }
    
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    
    const prices: number[] = [];
    const dates: string[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null) {
        prices.push(closes[i]);
        dates.push(new Date(timestamps[i] * 1000).toISOString().split('T')[0]);
      }
    }
    
    return {
      symbol,
      name: result.meta.longName || symbol,
      prices,
      dates
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);
  
  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xSlice[i] - meanX;
    const yDiff = ySlice[i] - meanY;
    numerator += xDiff * yDiff;
    sumXSquared += xDiff * xDiff;
    sumYSquared += yDiff * yDiff;
  }
  
  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  return denominator === 0 ? 0 : numerator / denominator;
}

function interpretCorrelation(correlation: number): string {
  const abs = Math.abs(correlation);
  if (abs > 0.8) return 'Very Strong';
  if (abs > 0.6) return 'Strong';
  if (abs > 0.4) return 'Moderate';
  if (abs > 0.2) return 'Weak';
  return 'Very Weak';
}

function calculateCorrelationWithLag(x: number[], y: number[], lag: number = 0): number {
  const n = Math.min(x.length, y.length) - lag;
  if (n < 2) return 0;
  
  const xSlice = x.slice(lag, lag + n);
  const ySlice = y.slice(0, n);
  
  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xSlice[i] - meanX;
    const yDiff = ySlice[i] - meanY;
    numerator += xDiff * yDiff;
    sumXSquared += xDiff * xDiff;
    sumYSquared += yDiff * yDiff;
  }
  
  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  return denominator === 0 ? 0 : numerator / denominator;
}

function findBestLag(x: number[], y: number[], maxLag: number = 5): { correlation: number; lag: number } {
  let bestCorrelation = calculateCorrelation(x, y);
  let bestLag = 0;
  
  for (let lag = 1; lag <= maxLag; lag++) {
    const correlation = calculateCorrelationWithLag(x, y, lag);
    if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  return { correlation: bestCorrelation, lag: bestLag };
}

function calculateInfluence(correlation: number, country: string): string {
  const abs = Math.abs(correlation);
  const isMajorEconomy = ['US', 'China', 'Japan', 'Germany', 'UK'].includes(country);
  
  if (abs > 0.7) {
    return isMajorEconomy ? 'Dominant Driver' : 'Strong Influence';
  } else if (abs > 0.5) {
    return isMajorEconomy ? 'Major Influence' : 'Moderate Impact';
  } else if (abs > 0.3) {
    return 'Notable Correlation';
  } else {
    return 'Limited Impact';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { period = '1mo' } = await req.json().catch(() => ({}));
    
    // Fetch all market data
    const marketDataPromises = INDICES.map(index => fetchYahooFinanceData(index.symbol, period));
    const marketDataResults = await Promise.all(marketDataPromises);
    
    const marketData = marketDataResults
      .map((data, i) => ({ ...INDICES[i], data }))
      .filter(item => item.data !== null);
    
    if (marketData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No market data available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Find NIFTY data
    const niftyData = marketData.find(m => m.symbol === '^NSEI');
    
    if (!niftyData || !niftyData.data) {
      return new Response(
        JSON.stringify({ success: false, error: 'NIFTY data unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Calculate correlations with NIFTY
    const correlations = marketData
      .filter(m => m.symbol !== '^NSEI' && m.data)
      .map(market => {
        const { correlation: bestCorrelation, lag } = findBestLag(niftyData.data!.prices, market.data!.prices);
        const currentCorrelation = calculateCorrelation(niftyData.data!.prices, market.data!.prices);
        
        return {
          market: market.name,
          country: market.country,
          symbol: market.symbol,
          correlation: parseFloat(currentCorrelation.toFixed(3)),
          bestCorrelation: parseFloat(bestCorrelation.toFixed(3)),
          lag,
          strength: interpretCorrelation(currentCorrelation),
          direction: currentCorrelation > 0 ? 'Positive' : 'Negative',
          influence: calculateInfluence(currentCorrelation, market.country)
        };
      })
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    
    return new Response(
      JSON.stringify({
        success: true,
        baseMarket: 'NIFTY 50',
        correlations,
        marketData: marketData.map(m => ({
          name: m.name,
          country: m.country,
          symbol: m.symbol,
          prices: m.data?.prices || [],
          dates: m.data?.dates || []
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
