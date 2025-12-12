import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdvancedSentimentResult {
  overall: {
    score: number;
    confidence: number;
    label: 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative';
  };
  dimensions: {
    emotional: number;
    factual: number;
    speculative: number;
    technical: number;
  };
  sources: {
    news: { score: number; weight: number; articles: number };
    social: { score: number; weight: number; mentions: number };
    analyst: { score: number; weight: number; reports: number };
  };
  trends: {
    direction: 'improving' | 'declining' | 'stable';
    velocity: number;
    acceleration: number;
  };
  topics: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
}

class AdvancedSentimentAnalyzer {
  private symbol: string;
  private supabase: any;
  
  constructor(symbol: string, supabase: any) {
    this.symbol = symbol;
    this.supabase = supabase;
  }

  async analyze(): Promise<AdvancedSentimentResult> {
    console.log(`Starting advanced sentiment analysis for ${this.symbol}...`);
    
    const [newsSentiment, socialSentiment, analystSentiment] = await Promise.all([
      this.analyzeNewsSentiment(),
      this.analyzeSocialSentiment(),
      this.analyzeAnalystSentiment()
    ]);

    const overall = this.calculateOverallSentiment(newsSentiment, socialSentiment, analystSentiment);
    const dimensions = await this.analyzeDimensions();
    const sources = {
      news: { ...newsSentiment, weight: 0.5 },
      social: { ...socialSentiment, weight: 0.3 },
      analyst: { ...analystSentiment, weight: 0.2 }
    };
    const trends = await this.analyzeTrends();
    const topics = await this.extractTopics();

    return {
      overall,
      dimensions,
      sources,
      trends,
      topics
    };
  }

  private async analyzeNewsSentiment(): Promise<{ score: number; articles: number }> {
    try {
      const { data: articles } = await this.supabase
        .from('articles')
        .select('title, content, sentiment_compound, published_at')
        .eq('symbol', this.symbol)
        .order('published_at', { ascending: false })
        .limit(50);

      if (!articles || articles.length === 0) {
        return { score: 0, articles: 0 };
      }

      // Weight recent articles more heavily
      const now = new Date();
      const weightedScores = articles.map(article => {
        const age = (now.getTime() - new Date(article.published_at).getTime()) / (1000 * 60 * 60); // hours
        const weight = Math.exp(-age / 24); // Decay factor: older articles have less weight
        return (article.sentiment_compound || 0) * weight;
      });

      const avgScore = weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length;
      
      return { score: avgScore, articles: articles.length };
    } catch (error) {
      console.error('News sentiment analysis failed:', error);
      return { score: 0, articles: 0 };
    }
  }

  private async analyzeSocialSentiment(): Promise<{ score: number; mentions: number }> {
    try {
      // In production, integrate with Twitter API, Reddit API, StockTwits, etc.
      // For now, we'll simulate with some basic logic
      
      const mentions = Math.floor(Math.random() * 100) + 20; // Simulated mentions
      const score = (Math.random() - 0.5) * 0.8; // Random between -0.4 and 0.4
      
      // Add some logic based on stock performance
      const { data: stockData } = await this.supabase
        .from('stock_prices')
        .select('change_percent')
        .eq('symbol', this.symbol)
        .order('created_at', { ascending: false })
        .limit(1);

      if (stockData && stockData.length > 0) {
        const changePercent = stockData[0].change_percent || 0;
        // Social sentiment often follows price movements
        const priceInfluence = changePercent * 0.3;
        return { score: score + priceInfluence, mentions };
      }

      return { score, mentions };
    } catch (error) {
      console.error('Social sentiment analysis failed:', error);
      return { score: 0, mentions: 0 };
    }
  }

  private async analyzeAnalystSentiment(): Promise<{ score: number; reports: number }> {
    try {
      // In production, integrate with:
      // - Bloomberg Terminal API
      // - Refinitiv Eikon API
      // - FactSet API
      // - Zacks Investment Research
      // - Morningstar API
      
      // For now, simulate analyst ratings
      const reports = Math.floor(Math.random() * 10) + 1;
      
      // Simulate analyst ratings based on recent performance
      const { data: performance } = await this.supabase
        .from('stock_prices')
        .select('price, change_percent')
        .eq('symbol', this.symbol)
        .order('created_at', { ascending: false })
        .limit(30);

      let score = 0;
      if (performance && performance.length > 0) {
        const avgChange = performance.reduce((sum, p) => sum + (p.change_percent || 0), 0) / performance.length;
        
        if (avgChange > 2) score = 0.6; // Strong buy
        else if (avgChange > 0.5) score = 0.3; // Buy
        else if (avgChange > -0.5) score = 0.1; // Hold
        else if (avgChange > -2) score = -0.2; // Sell
        else score = -0.5; // Strong sell
      }

      return { score, reports };
    } catch (error) {
      console.error('Analyst sentiment analysis failed:', error);
      return { score: 0, reports: 0 };
    }
  }

  private calculateOverallSentiment(
    news: { score: number; articles: number },
    social: { score: number; mentions: number },
    analyst: { score: number; reports: number }
  ) {
    const weights = { news: 0.5, social: 0.3, analyst: 0.2 };
    
    const weightedScore = 
      (news.score * weights.news) + 
      (social.score * weights.social) + 
      (analyst.score * weights.analyst);

    const confidence = this.calculateConfidence(news.articles, social.mentions, analyst.reports);
    const label = this.getLabel(weightedScore);

    return {
      score: weightedScore,
      confidence,
      label
    };
  }

  private calculateConfidence(newsCount: number, socialMentions: number, analystReports: number): number {
    const maxNews = 50;
    const maxSocial = 1000;
    const maxAnalyst = 20;

    const newsConfidence = Math.min(newsCount / maxNews, 1) * 0.5;
    const socialConfidence = Math.min(socialMentions / maxSocial, 1) * 0.3;
    const analystConfidence = Math.min(analystReports / maxAnalyst, 1) * 0.2;

    return newsConfidence + socialConfidence + analystConfidence;
  }

  private getLabel(score: number): 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative' {
    if (score > 0.3) return 'strong_positive';
    if (score > 0.1) return 'positive';
    if (score > -0.1) return 'neutral';
    if (score > -0.3) return 'negative';
    return 'strong_negative';
  }

  private async analyzeDimensions(): Promise<{ emotional: number; factual: number; speculative: number; technical: number }> {
    try {
      const { data: articles } = await this.supabase
        .from('articles')
        .select('title, content')
        .eq('symbol', this.symbol)
        .limit(20);

      if (!articles || articles.length === 0) {
        return { emotional: 0.25, factual: 0.25, speculative: 0.25, technical: 0.25 };
      }

      let emotional = 0, factual = 0, speculative = 0, technical = 0;

      for (const article of articles) {
        const text = `${article.title} ${article.content}`.toLowerCase();
        
        // Emotional indicators
        const emotionalWords = ['fear', 'greed', 'excited', 'worried', 'panic', 'euphoria', 'optimistic', 'pessimistic'];
        emotional += emotionalWords.filter(word => text.includes(word)).length;
        
        // Factual indicators
        const factualWords = ['reported', 'announced', 'stated', 'confirmed', 'according', 'data', 'results'];
        factual += factualWords.filter(word => text.includes(word)).length;
        
        // Speculative indicators
        const speculativeWords = ['might', 'could', 'potential', 'expected', 'forecast', 'prediction', 'rumor'];
        speculative += speculativeWords.filter(word => text.includes(word)).length;
        
        // Technical indicators
        const technicalWords = ['resistance', 'support', 'rsi', 'macd', 'volume', 'trend', 'breakout', 'correction'];
        technical += technicalWords.filter(word => text.includes(word)).length;
      }

      const total = emotional + factual + speculative + technical;
      if (total === 0) {
        return { emotional: 0.25, factual: 0.25, speculative: 0.25, technical: 0.25 };
      }

      return {
        emotional: emotional / total,
        factual: factual / total,
        speculative: speculative / total,
        technical: technical / total
      };
    } catch (error) {
      console.error('Dimension analysis failed:', error);
      return { emotional: 0.25, factual: 0.25, speculative: 0.25, technical: 0.25 };
    }
  }

  private async analyzeTrends(): Promise<{ direction: 'improving' | 'declining' | 'stable'; velocity: number; acceleration: number }> {
    try {
      // Get sentiment over time
      const { data: sentimentHistory } = await this.supabase
        .from('articles')
        .select('sentiment_compound, published_at')
        .eq('symbol', this.symbol)
        .order('published_at', { ascending: false })
        .limit(100);

      if (!sentimentHistory || sentimentHistory.length < 10) {
        return { direction: 'stable', velocity: 0, acceleration: 0 };
      }

      // Group by day and calculate daily averages
      const dailySentiments = this.groupByDay(sentimentHistory);
      
      if (dailySentiments.length < 3) {
        return { direction: 'stable', velocity: 0, acceleration: 0 };
      }

      // Calculate velocity (rate of change)
      const recent = dailySentiments.slice(0, 3);
      const older = dailySentiments.slice(3, 6);
      
      const recentAvg = recent.reduce((sum, d) => sum + d.sentiment, 0) / recent.length;
      const olderAvg = older.reduce((sum, d) => sum + d.sentiment, 0) / older.length;
      
      const velocity = recentAvg - olderAvg;

      // Calculate acceleration (change in velocity)
      const oldest = dailySentiments.slice(6, 9);
      if (oldest.length > 0) {
        const oldestAvg = oldest.reduce((sum, d) => sum + d.sentiment, 0) / oldest.length;
        const olderVelocity = olderAvg - oldestAvg;
        const acceleration = velocity - olderVelocity;

        let direction: 'improving' | 'declining' | 'stable' = 'stable';
        if (velocity > 0.05) direction = 'improving';
        else if (velocity < -0.05) direction = 'declining';

        return { direction, velocity, acceleration };
      }

      return { direction: 'stable', velocity, acceleration: 0 };
    } catch (error) {
      console.error('Trend analysis failed:', error);
      return { direction: 'stable', velocity: 0, acceleration: 0 };
    }
  }

  private groupByDay(articles: any[]): Array<{ date: string; sentiment: number }> {
    const grouped = new Map<string, number[]>();
    
    for (const article of articles) {
      const date = new Date(article.published_at).toISOString().split('T')[0];
      const sentiment = article.sentiment_compound || 0;
      
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(sentiment);
    }

    return Array.from(grouped.entries())
      .map(([date, sentiments]) => ({
        date,
        sentiment: sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private async extractTopics(): Promise<{ positive: string[]; negative: string[]; neutral: string[] }> {
    try {
      const { data: articles } = await this.supabase
        .from('articles')
        .select('title, content, sentiment_compound')
        .eq('symbol', this.symbol)
        .limit(30);

      if (!articles || articles.length === 0) {
        return { positive: [], negative: [], neutral: [] };
      }

      const positive: string[] = [];
      const negative: string[] = [];
      const neutral: string[] = [];

      for (const article of articles) {
        const text = `${article.title} ${article.content}`;
        const sentiment = article.sentiment_compound || 0;
        
        // Extract key phrases/topics
        const topics = this.extractKeyPhrases(text);
        
        const targetArray = sentiment > 0.1 ? positive : sentiment < -0.1 ? negative : neutral;
        targetArray.push(...topics);
      }

      // Remove duplicates and limit to top 5
      return {
        positive: [...new Set(positive)].slice(0, 5),
        negative: [...new Set(negative)].slice(0, 5),
        neutral: [...new Set(neutral)].slice(0, 5)
      };
    } catch (error) {
      console.error('Topic extraction failed:', error);
      return { positive: [], negative: [], neutral: [] };
    }
  }

  private extractKeyPhrases(text: string): string[] {
    // Simple keyword extraction - in production, use NLP libraries
    const keywords = [
      'earnings', 'revenue', 'profit', 'loss', 'growth', 'decline', 'merger', 'acquisition',
      'dividend', 'stock split', 'buyback', 'debt', 'cash flow', 'market share', 'competition',
      'regulation', 'lawsuit', 'patent', 'innovation', 'expansion', 'layoffs', 'hiring',
      'partnership', 'contract', 'launch', 'product', 'service', 'technology', 'research'
    ];

    const found = keywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    return found;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting advanced sentiment analysis for ${symbol}...`);
    
    const analyzer = new AdvancedSentimentAnalyzer(symbol, supabase);
    const result = await analyzer.analyze();
    
    // Store advanced sentiment in market_data table
    await supabase
      .from('market_data')
      .upsert({
        symbol,
        data_type: 'advanced_sentiment',
        data: result,
        created_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in advanced sentiment analysis:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
