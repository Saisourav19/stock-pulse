import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Article {
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  sentiment: string;
  sentimentScore: number;
}

// Sentiment analysis
function analyzeSentiment(text: string): { score: number; label: string } {
  const positiveWords = [
    'rise', 'gain', 'up', 'surge', 'profit', 'growth', 'bullish', 'strong', 'positive', 
    'rally', 'boost', 'improve', 'success', 'outperform', 'beat', 'record', 'high',
    'upgrade', 'buy', 'optimistic', 'momentum', 'breakthrough', 'expansion', 'dividend'
  ];
  const negativeWords = [
    'fall', 'loss', 'down', 'drop', 'decline', 'bearish', 'weak', 'negative', 'crash', 
    'plunge', 'concern', 'worry', 'fear', 'miss', 'cut', 'downgrade', 'sell', 'risk',
    'layoff', 'lawsuit', 'investigation', 'debt', 'default', 'recession'
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
  return { score: Math.max(-1, Math.min(1, score / 3)), label };
}

async function fetchGoogleNews(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Google News RSS feed
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' stock')}&hl=en&gl=US&ceid=US:en`;
    const response = await fetch(rssUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const xml = await response.text();
      
      // Parse RSS items
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
      const sourceRegex = /<source[^>]*>(.*?)<\/source>/;
      
      let match;
      while ((match = itemRegex.exec(xml)) !== null && articles.length < 30) {
        const item = match[1];
        
        const titleMatch = titleRegex.exec(item);
        const pubDateMatch = pubDateRegex.exec(item);
        const sourceMatch = sourceRegex.exec(item);
        
        if (titleMatch) {
          const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();
          const source = sourceMatch ? sourceMatch[1].replace(/<[^>]*>/g, '').trim() : 'Google News';
          
          if (title.length > 15) {
            const sentiment = analyzeSentiment(title);
            articles.push({
              title,
              summary: `News about ${query}`,
              publishedAt: pubDate,
              source,
              sentiment: sentiment.label,
              sentimentScore: sentiment.score
            });
          }
        }
      }
    }
    
    console.log(`Google News: Found ${articles.length} articles for ${query}`);
  } catch (error: unknown) {
    console.error('Google News error:', error instanceof Error ? error.message : String(error));
  }
  
  return articles;
}

async function fetchMoneyControlNews(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const url = `https://www.moneycontrol.com/news/tags/${encodeURIComponent(query.toLowerCase().replace(/[^a-z0-9]/g, '-'))}.html`;
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const html = await response.text();
      
      // Extract headlines
      const patterns = [
        /<h2[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/h2>/gi,
        /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi,
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && articles.length < 15) {
          const title = match[1].trim();
          if (title.length > 20 && title.length < 200) {
            const sentiment = analyzeSentiment(title);
            articles.push({
              title,
              summary: 'MoneyControl News',
              publishedAt: new Date().toISOString(),
              source: 'MoneyControl',
              sentiment: sentiment.label,
              sentimentScore: sentiment.score
            });
          }
        }
      }
    }
    
    console.log(`MoneyControl: Found ${articles.length} articles for ${query}`);
  } catch (error: unknown) {
    console.error('MoneyControl error:', error instanceof Error ? error.message : String(error));
  }
  
  return articles;
}

async function fetchEconomicTimesNews(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const url = `https://economictimes.indiatimes.com/topic/${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const html = await response.text();
      
      const patterns = [
        /<h[2-4][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/h[2-4]>/gi,
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && articles.length < 15) {
          const title = match[1].trim();
          if (title.length > 20 && title.length < 200) {
            const sentiment = analyzeSentiment(title);
            articles.push({
              title,
              summary: 'Economic Times',
              publishedAt: new Date().toISOString(),
              source: 'Economic Times',
              sentiment: sentiment.label,
              sentimentScore: sentiment.score
            });
          }
        }
      }
    }
    
    console.log(`Economic Times: Found ${articles.length} articles for ${query}`);
  } catch (error: unknown) {
    console.error('Economic Times error:', error instanceof Error ? error.message : String(error));
  }
  
  return articles;
}

function aggregateSentimentByPeriod(articles: Article[]) {
  const now = new Date();
  const periods = { '1d': 1, '1w': 7, '1m': 30, '6m': 180, '1y': 365 };
  
  const results: Record<string, { positive: number; neutral: number; negative: number }> = {};
  
  Object.entries(periods).forEach(([period, days]) => {
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filteredArticles = articles.filter(a => new Date(a.publishedAt) >= cutoffDate);
    
    results[period] = {
      positive: filteredArticles.filter(a => a.sentiment === 'Positive').length,
      neutral: filteredArticles.filter(a => a.sentiment === 'Neutral').length,
      negative: filteredArticles.filter(a => a.sentiment === 'Negative').length
    };
  });
  
  return results;
}

function calculateSentimentTrend(articles: Article[]) {
  const weeklyData: Record<string, { positive: number; neutral: number; negative: number }> = {};
  
  articles.forEach(article => {
    const date = new Date(article.publishedAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { positive: 0, neutral: 0, negative: 0 };
    }
    
    if (article.sentiment === 'Positive') weeklyData[weekKey].positive++;
    else if (article.sentiment === 'Negative') weeklyData[weekKey].negative++;
    else weeklyData[weekKey].neutral++;
  });
  
  return Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, stats]) => ({
      week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...stats,
      netSentiment: stats.positive - stats.negative
    }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { company, ticker } = await req.json();
    
    if (!company && !ticker) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name or ticker required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const searchQuery = ticker || company;
    console.log(`Fetching news for: ${searchQuery}`);
    
    // Fetch from multiple sources in parallel
    const [googleArticles, mcArticles, etArticles] = await Promise.all([
      fetchGoogleNews(searchQuery),
      fetchMoneyControlNews(searchQuery),
      fetchEconomicTimesNews(searchQuery)
    ]);
    
    // Combine and deduplicate
    const allArticles = [...googleArticles, ...mcArticles, ...etArticles];
    const uniqueArticles = allArticles.filter((article, index, self) =>
      index === self.findIndex(a => a.title.toLowerCase() === article.title.toLowerCase())
    );
    
    // Sort by date
    uniqueArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    
    console.log(`Total unique articles: ${uniqueArticles.length}`);
    
    if (uniqueArticles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: null,
          message: 'No news data available for this company' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const periodStats = aggregateSentimentByPeriod(uniqueArticles);
    const trendData = calculateSentimentTrend(uniqueArticles);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          company: searchQuery,
          articles: uniqueArticles.slice(0, 50),
          periodStats,
          trendData,
          overall: {
            positive: uniqueArticles.filter(a => a.sentiment === 'Positive').length,
            neutral: uniqueArticles.filter(a => a.sentiment === 'Neutral').length,
            negative: uniqueArticles.filter(a => a.sentiment === 'Negative').length,
            total: uniqueArticles.length
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
