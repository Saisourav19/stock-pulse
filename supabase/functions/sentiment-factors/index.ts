import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FactorData {
  name: string;
  score: number;
  impact: string;
  articles: number;
}

// Fetch market data from Yahoo Finance (keeping this as it provides good real-time data)
async function fetchMarketData(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
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
      const change = previousClose ? currentPrice - previousClose : 0;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;

      return { price: currentPrice, change, changePercent };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return null;
  }
}

async function getAIAnalysis(
  symbol: string,
  marketData: any,
  articles: any[]
): Promise<FactorData[]> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // Default structure if AI fails
  const defaultFactors = [
    { name: 'Global Markets', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Industry Trends', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Economic Indicators', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Social Media', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Analyst Views', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Foreign Investment', score: 50, impact: 'Waiting for analysis...', articles: 0 },
    { name: 'Corporate Earnings', score: 50, impact: 'Waiting for analysis...', articles: 0 }
  ];

  if (!OPENAI_API_KEY) {
    console.log("No OpenAI key found, using default factors");
    return defaultFactors;
  }

  try {
    const articleSummaries = articles.slice(0, 10).map(a => `- ${a.title}`).join('\n');
    const marketSummary = JSON.stringify(marketData, null, 2);

    const prompt = `Analyze the sentiment factors for stock ${symbol} based on this real data:
    
    Market Data:
    ${marketSummary}
    
    Recent News:
    ${articleSummaries}

    Task: Generate scores (0-100), impact summaries (1 short sentence), and article relevance counts for these 7 categories:
    1. Global Markets (US/Asian market influence)
    2. Industry Trends (Sector performance)
    3. Economic Indicators (Macro factors)
    4. Social Media (Retail sentiment)
    5. Analyst Views (Ratings/Targets)
    6. Foreign Investment (FII/DII flows)
    7. Corporate Earnings (Financial performance)

    Return STRICT JSON array:
    [
      { "name": "Global Markets", "score": 65, "impact": "Positive cues from US markets", "articles": 2 },
      ...
    ]`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Fast and efficient
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2, // Low temperature for consistent JSON
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      return defaultFactors;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Handle cases where AI returns object with key instead of array
    const factors = Array.isArray(parsed) ? parsed : (parsed.factors || parsed.data || defaultFactors);

    return factors.map((f: any) => ({
      name: f.name,
      score: Math.max(0, Math.min(100, f.score)),
      impact: f.impact,
      articles: f.articles || 0
    }));

  } catch (error) {
    console.error("AI Analysis failed:", error);
    return defaultFactors;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    // Updated: Now using OpenAI API key from Supabase secrets
    console.log(`Analyzing sentiment factors for ${symbol}...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch Real Market Data
    const [nifty, sensex, global] = await Promise.all([
      fetchMarketData('^NSEI'),
      fetchMarketData('^BSESN'),
      fetchMarketData('^GSPC') // S&P 500
    ]);

    // 2. Fetch Real News from DB - Get ALL articles for overall market sentiment
    const { data: articles } = await supabase
      .from('articles')
      .select('title, summary, sentiment_label')
      .order('published', { ascending: false })
      .limit(50); // Increased from 10 to 50 for better market overview

    // 3. AI Analysis
    const factors = await getAIAnalysis(
      'Indian Market', // Using generic market name instead of specific symbol
      { nifty, sensex, global },
      articles || []
    );

    console.log('Factors generated:', factors.length);

    // Calculate averages
    const totalArticles = factors.reduce((sum, f) => sum + Math.max(f.articles, 1), 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.score * Math.max(f.articles, 1)), 0);
    const averageScore = Math.round(weightedScore / totalArticles) || 50;

    const overallSentiment = averageScore > 58 ? 'Bullish' : averageScore < 45 ? 'Bearish' : 'Neutral';

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          factors,
          overall: {
            score: averageScore,
            sentiment: overallSentiment,
            totalArticles: (articles?.length || 0)
          },
          lastUpdated: new Date().toISOString()
        }
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
