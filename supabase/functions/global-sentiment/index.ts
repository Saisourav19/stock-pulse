import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsSource {
  name: string;
  url: string;
  region: string;
}

const NEWS_SOURCES: NewsSource[] = [
  { name: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets', region: 'India' },
  { name: 'MoneyControl', url: 'https://www.moneycontrol.com/news/business/markets/', region: 'India' },
  { name: 'Financial Express', url: 'https://www.financialexpress.com/market/', region: 'India' },
  { name: 'Business Standard', url: 'https://www.business-standard.com/markets', region: 'India' },
  { name: 'Financial Times', url: 'https://www.ft.com/markets', region: 'Europe' },
  { name: 'Reuters Europe', url: 'https://www.reuters.com/world/europe/', region: 'Europe' },
  { name: 'Bloomberg Europe', url: 'https://www.bloomberg.com/europe', region: 'Europe' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/Business/Markets', region: 'Japan' },
  { name: 'Reuters Japan', url: 'https://www.reuters.com/world/asia-pacific/', region: 'Japan' },
  { name: 'Reuters', url: 'https://www.reuters.com/markets/', region: 'US' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/', region: 'US' },
  { name: 'MarketWatch', url: 'https://www.marketwatch.com/', region: 'US' },
  { name: 'CNBC', url: 'https://www.cnbc.com/', region: 'US' },
  { name: 'Financial Post', url: 'https://financialpost.com/', region: 'Canada' },
  { name: 'The Globe and Mail', url: 'https://www.theglobeandmail.com/business/', region: 'Canada' },
  { name: 'Australian Financial Review', url: 'https://www.afr.com/', region: 'Australia' },
  { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/business', region: 'Australia' },
  { name: 'South China Morning Post', url: 'https://www.scmp.com/business/markets', region: 'China' },
  { name: 'Caixin Global', url: 'https://www.caixinglobal.com/', region: 'China' },
  { name: 'Financial News', url: 'https://www.ft.com/companies', region: 'UK' },
  { name: 'London Stock Exchange', url: 'https://www.londonstockexchange.com/', region: 'UK' },
  { name: 'Bloomberg', url: 'https://www.bloomberg.com/markets', region: 'Global' },
  { name: 'Wall Street Journal', url: 'https://www.wsj.com/markets', region: 'Global' },
  { name: 'Investing.com', url: 'https://www.investing.com/', region: 'Global' },
];

// Sentiment analysis using keyword matching
function analyzeSentiment(text: string): { score: number; label: string } {
  const positiveWords = [
    'rise', 'gain', 'up', 'surge', 'profit', 'growth', 'bullish', 'strong', 'positive', 
    'rally', 'boost', 'improve', 'success', 'record', 'high', 'upgrade', 'buy', 'optimistic',
    'outperform', 'beat', 'momentum', 'breakthrough', 'expansion', 'recovery', 'soar'
  ];
  const negativeWords = [
    'fall', 'loss', 'down', 'drop', 'decline', 'bearish', 'weak', 'negative', 'crash', 
    'plunge', 'concern', 'worry', 'fear', 'miss', 'cut', 'downgrade', 'sell', 'risk',
    'slump', 'tumble', 'slide', 'sink', 'recession', 'crisis', 'warning'
  ];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score += 1;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score -= 1;
  });
  
  const label = score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral';
  return { score, label };
}

async function scrapeHeadlines(source: NewsSource): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const headlines: string[] = [];
    
    // Extract headlines using regex patterns
    const headlinePatterns = [
      /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi,
      /<a[^>]*class="[^"]*(?:title|headline|story)[^"]*"[^>]*>([^<]+)<\/a>/gi,
      /<a[^>]*>[\s]*<span[^>]*>([^<]{20,150})<\/span>[\s]*<\/a>/gi,
      /title["\s]*[=:]["\s]*["']([^"']{20,150})["']/gi,
    ];
    
    for (const pattern of headlinePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const text = match[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&[^;]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (text.length >= 20 && text.length <= 200 && !headlines.includes(text)) {
          // Filter out navigation/menu items
          const skipWords = ['menu', 'login', 'signup', 'subscribe', 'cookie', 'privacy', 'terms'];
          const isNavItem = skipWords.some(w => text.toLowerCase().includes(w));
          if (!isNavItem) {
            headlines.push(text);
          }
        }
      }
    }
    
    console.log(`${source.name}: Found ${headlines.length} headlines`);
    return headlines.slice(0, 25);
  } catch (error: unknown) {
    console.error(`Error scraping ${source.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { region } = await req.json();
    
    const sources = region 
      ? NEWS_SOURCES.filter(s => s.region === region)
      : NEWS_SOURCES;
    
    const allHeadlines: Array<{ headline: string; region: string; source: string; sentiment: string }> = [];
    
    // Scrape headlines from all sources in parallel
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const headlines = await scrapeHeadlines(source);
        return { source, headlines };
      })
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.headlines.length > 0) {
        const { source, headlines } = result.value;
        for (const headline of headlines) {
          const sentiment = analyzeSentiment(headline);
          allHeadlines.push({
            headline,
            region: source.region,
            source: source.name,
            sentiment: sentiment.label
          });
        }
      }
    }
    
    console.log(`Total headlines collected: ${allHeadlines.length}`);
    
    // Aggregate by region
    const regionStats: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {};
    
    allHeadlines.forEach(item => {
      if (!regionStats[item.region]) {
        regionStats[item.region] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      
      regionStats[item.region].total++;
      if (item.sentiment === 'Positive') regionStats[item.region].positive++;
      else if (item.sentiment === 'Negative') regionStats[item.region].negative++;
      else regionStats[item.region].neutral++;
    });
    
    // Calculate percentages
    const results_data = Object.entries(regionStats).map(([region, stats]) => ({
      region,
      positive: stats.total > 0 ? (stats.positive / stats.total * 100).toFixed(1) : '0.0',
      neutral: stats.total > 0 ? (stats.neutral / stats.total * 100).toFixed(1) : '0.0',
      negative: stats.total > 0 ? (stats.negative / stats.total * 100).toFixed(1) : '0.0',
      total: stats.total
    }));

    return new Response(
      JSON.stringify({ 
        success: true,
        data: results_data,
        headlines: allHeadlines,
        lastUpdated: new Date().toISOString()
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
