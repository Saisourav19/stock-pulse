import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiveStockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

interface LiveNewsItem {
  id: string;
  symbol: string;
  title: string;
  content: string;
  source: string;
  publishedAt: string;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    compound: number;
  };
}

// Multiple API sources for redundancy
const STOCK_APIS = {
  yahoo: {
    url: (symbol: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  alphaVantage: {
    url: (symbol: string, apiKey: string) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`,
    headers: {}
  },
  finnhub: {
    url: (symbol: string, apiKey: string) => `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
    headers: {}
  }
};

const NEWS_APIS = {
  newsAPI: {
    url: (apiKey: string, query: string) => `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${apiKey}`,
    headers: {}
  },
  finnhub: {
    url: (symbol: string, apiKey: string) => `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${apiKey}`,
    headers: {}
  },
  rss: {
    urls: [
      'https://feeds.bloomberg.com/markets/news.xml',
      'https://feeds.reuters.com/reuters/topNews',
      'https://feeds.finance.yahoo.com/rss/2.0/headline',
      'https://www.moneycontrol.com/rss/marketreports.xml',
      'https://feeds.businesswire.com/rss/home'
    ],
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }
};

async function fetchLiveStockPrice(symbol: string): Promise<LiveStockData | null> {
  const results = [];
  
  // Try Yahoo Finance first (free and reliable)
  try {
    const response = await fetch(STOCK_APIS.yahoo.url(symbol), {
      headers: STOCK_APIS.yahoo.headers,
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const result = data.chart?.result?.[0];
      const quote = result?.meta;
      const currentPrice = quote?.regularMarketPrice || quote?.currentPrice;
      
      if (currentPrice && currentPrice > 0) {
        const previousClose = quote?.previousClose || quote?.regularMarketPreviousClose;
        const change = currentPrice - (previousClose || currentPrice);
        const changePercent = previousClose ? (change / previousClose) * 100 : 0;
        
        results.push({
          symbol,
          price: currentPrice,
          change,
          changePercent,
          volume: quote?.regularMarketVolume || 0,
          marketCap: quote?.marketCap || 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.log(`Yahoo Finance failed for ${symbol}:`, error.message);
  }
  
  // Try Alpha Vantage if available
  const alphaVantageKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (alphaVantageKey && results.length === 0) {
    try {
      const response = await fetch(STOCK_APIS.alphaVantage.url(symbol, alphaVantageKey), {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const quote = data['Global Quote'];
        
        if (quote && quote['05. price']) {
          const price = parseFloat(quote['05. price']);
          const change = parseFloat(quote['09. change']);
          const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
          
          results.push({
            symbol,
            price,
            change,
            changePercent,
            volume: parseInt(quote['06. volume']) || 0,
            marketCap: 0,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.log(`Alpha Vantage failed for ${symbol}:`, error.message);
    }
  }
  
  // Return the best result or null
  return results.length > 0 ? results[0] : null;
}

async function fetchLiveNews(symbol: string, companyName: string): Promise<LiveNewsItem[]> {
  const newsItems: LiveNewsItem[] = [];
  
  // Try NewsAPI
  const newsAPIKey = Deno.env.get('NEWS_API_KEY');
  if (newsAPIKey) {
    try {
      const queries = [symbol, companyName, `${symbol} stock`, `${companyName} news`];
      
      for (const query of queries) {
        const response = await fetch(NEWS_APIS.newsAPI.url(newsAPIKey, query), {
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const data = await response.json();
          const articles = data.articles || [];
          
          for (const article of articles) {
            if (article.title && article.description) {
              const content = `${article.title} ${article.description}`;
              const sentiment = await analyzeSentiment(content);
              
              newsItems.push({
                id: `newsapi-${Date.now()}-${Math.random()}`,
                symbol,
                title: article.title,
                content: article.description,
                source: article.source?.name || 'NewsAPI',
                publishedAt: article.publishedAt,
                sentiment
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(`NewsAPI failed for ${symbol}:`, error.message);
    }
  }
  
  // Try Finnhub
  const finnhubKey = Deno.env.get('FINNHUB_API_KEY');
  if (finnhubKey) {
    try {
      const response = await fetch(NEWS_APIS.finnhub.url(symbol, finnhubKey), {
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const articles = await response.json();
        
        for (const article of articles) {
          if (article.headline && article.summary) {
            const content = `${article.headline} ${article.summary}`;
            const sentiment = await analyzeSentiment(content);
            
            newsItems.push({
              id: `finnhub-${article.id}`,
              symbol,
              title: article.headline,
              content: article.summary,
              source: 'Finnhub',
              publishedAt: new Date(article.datetime * 1000).toISOString(),
              sentiment
            });
          }
        }
      }
    } catch (error) {
      console.log(`Finnhub news failed for ${symbol}:`, error.message);
    }
  }
  
  // Try RSS feeds (free)
  try {
    for (const rssUrl of NEWS_APIS.rss.urls) {
      const response = await fetch(rssUrl, {
        headers: NEWS_APIS.rss.headers,
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const rssText = await response.text();
        const articles = parseRSS(rssText, symbol, companyName);
        
        for (const article of articles) {
          const sentiment = await analyzeSentiment(article.content);
          
          newsItems.push({
            id: `rss-${Date.now()}-${Math.random()}`,
            symbol,
            title: article.title,
            content: article.content,
            source: article.source,
            publishedAt: article.publishedAt,
            sentiment
          });
        }
      }
    }
  } catch (error) {
    console.log(`RSS feeds failed for ${symbol}:`, error.message);
  }
  
  // Remove duplicates and sort by date
  const uniqueNews = newsItems.filter((item, index, self) =>
    index === self.findIndex((t) => t.title === item.title)
  ).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  
  return uniqueNews.slice(0, 50); // Limit to 50 most recent
}

async function analyzeSentiment(text: string): Promise<{ positive: number; negative: number; neutral: number; compound: number }> {
  // Simple sentiment analysis - in production, use a proper NLP service
  const positiveWords = ['good', 'great', 'excellent', 'positive', 'growth', 'profit', 'gain', 'bullish', 'rise', 'up', 'strong'];
  const negativeWords = ['bad', 'poor', 'negative', 'loss', 'decline', 'fall', 'bearish', 'down', 'weak', 'drop'];
  
  const words = text.toLowerCase().split(/\s+/);
  let positive = 0;
  let negative = 0;
  
  for (const word of words) {
    if (positiveWords.some(pw => word.includes(pw))) positive++;
    if (negativeWords.some(nw => word.includes(nw))) negative++;
  }
  
  const total = positive + negative;
  const neutral = Math.max(0, words.length - total);
  const compound = total > 0 ? (positive - negative) / total : 0;
  
  return {
    positive: total > 0 ? positive / total : 0.33,
    negative: total > 0 ? negative / total : 0.33,
    neutral: total > 0 ? neutral / words.length : 0.34,
    compound
  };
}

function parseRSS(rssText: string, symbol: string, companyName: string): any[] {
  // Simple RSS parsing - in production, use a proper RSS parser
  const articles = [];
  const itemMatches = rssText.match(/<item>(.*?)<\/item>/gs) || [];
  
  for (const item of itemMatches) {
    const titleMatch = item.match(/<title>(.*?)<\/title>/);
    const descMatch = item.match(/<description>(.*?)<\/description>/);
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/) || item.match(/<dc:date>(.*?)<\/dc:date>/);
    
    if (titleMatch && descMatch) {
      const title = titleMatch[1].replace(/<[^>]*>/g, '');
      const description = descMatch[1].replace(/<[^>]*>/g, '');
      
      // Check if article is relevant to the symbol/company
      const content = `${title} ${description}`.toLowerCase();
      if (content.includes(symbol.toLowerCase()) || content.includes(companyName.toLowerCase())) {
        articles.push({
          title,
          content: description,
          publishedAt: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
          source: 'RSS'
        });
      }
    }
  }
  
  return articles;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbols, includeNews = true } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'Symbols array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = [];
    
    for (const symbolData of symbols) {
      const symbol = typeof symbolData === 'string' ? symbolData : symbolData.symbol;
      const companyName = typeof symbolData === 'object' ? symbolData.companyName : symbol;
      
      console.log(`Fetching live data for ${symbol}...`);
      
      // Fetch stock price
      const stockData = await fetchLiveStockPrice(symbol);
      
      // Fetch news if requested
      let newsData: LiveNewsItem[] = [];
      if (includeNews) {
        newsData = await fetchLiveNews(symbol, companyName);
      }
      
      const result = {
        symbol,
        companyName,
        stockData,
        newsData,
        timestamp: new Date().toISOString()
      };
      
      results.push(result);
      
      // Store in database
      if (stockData) {
        await supabase
          .from('stock_prices')
          .upsert({
            symbol,
            price: stockData.price,
            change: stockData.change,
            change_percent: stockData.changePercent,
            volume: stockData.volume,
            market_cap: stockData.marketCap,
            created_at: stockData.timestamp
          });
      }
      
      if (newsData.length > 0) {
        for (const news of newsData) {
          await supabase
            .from('articles')
            .upsert({
              id: news.id,
              symbol,
              title: news.title,
              content: news.content,
              source: news.source,
              published_at: news.publishedAt,
              sentiment_pos: news.sentiment.positive,
              sentiment_neg: news.sentiment.negative,
              sentiment_neu: news.sentiment.neutral,
              sentiment_compound: news.sentiment.compound,
              created_at: new Date().toISOString()
            });
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: results,
        processed: results.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in live data fetcher:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
