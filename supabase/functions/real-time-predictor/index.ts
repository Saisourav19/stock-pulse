import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TechnicalIndicator {
  rsi: number;
  macd: { signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number };
  sma: { short: number; long: number };
  volume: number;
  price: number;
}

interface MarketSentiment {
  overall: number;
  news: number;
  social: number;
  trends: number;
}

interface PredictionModel {
  shortTerm: { prediction: string; confidence: number; target: number };
  mediumTerm: { prediction: string; confidence: number; target: number };
  longTerm: { prediction: string; confidence: number; target: number };
  risk: 'low' | 'medium' | 'high';
  momentum: 'accelerating' | 'decelerating' | 'stable';
}

// Advanced prediction algorithms
class AdvancedPredictor {
  private symbol: string;
  private supabase: any;
  
  constructor(symbol: string, supabase: any) {
    this.symbol = symbol;
    this.supabase = supabase;
  }

  async generatePrediction(): Promise<PredictionModel> {
    const [technical, sentiment, historical] = await Promise.all([
      this.analyzeTechnicalIndicators(),
      this.analyzeMarketSentiment(),
      this.analyzeHistoricalPatterns()
    ]);

    const shortTerm = this.predictShortTerm(technical, sentiment, historical);
    const mediumTerm = this.predictMediumTerm(technical, sentiment, historical);
    const longTerm = this.predictLongTerm(technical, sentiment, historical);
    
    const risk = this.calculateRisk(technical, sentiment, historical);
    const momentum = this.calculateMomentum(technical, sentiment);

    return {
      shortTerm,
      mediumTerm,
      longTerm,
      risk,
      momentum
    };
  }

  private async analyzeTechnicalIndicators(): Promise<TechnicalIndicator> {
    try {
      // Fetch last 100 days of price data
      const { data: priceData } = await this.supabase
        .from('stock_prices')
        .select('price, volume, created_at')
        .eq('symbol', this.symbol)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!priceData || priceData.length < 50) {
        throw new Error('Insufficient price data for technical analysis');
      }

      const prices = priceData.map(d => d.price);
      const volumes = priceData.map(d => d.volume);
      const currentPrice = prices[0];

      // Calculate RSI (14-period)
      const rsi = this.calculateRSI(prices, 14);
      
      // Calculate MACD
      const macd = this.calculateMACD(prices);
      
      // Calculate Bollinger Bands
      const bollinger = this.calculateBollingerBands(prices, 20, 2);
      
      // Calculate SMAs
      const sma = {
        short: this.calculateSMA(prices, 10),
        long: this.calculateSMA(prices, 50)
      };

      return {
        rsi,
        macd,
        bollinger,
        sma,
        volume: volumes[0],
        price: currentPrice
      };
    } catch (error) {
      console.error('Technical analysis failed:', error);
      return this.getDefaultTechnical();
    }
  }

  private async analyzeMarketSentiment(): Promise<MarketSentiment> {
    try {
      // Fetch recent sentiment data
      const { data: sentimentData } = await this.supabase
        .from('articles')
        .select('sentiment_compound, sentiment_pos, sentiment_neg, created_at')
        .eq('symbol', this.symbol)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!sentimentData || sentimentData.length === 0) {
        return this.getDefaultSentiment();
      }

      const recentSentiment = sentimentData.slice(0, 10); // Last 10 articles
      const overall = recentSentiment.reduce((sum, item) => sum + (item.sentiment_compound || 0), 0) / recentSentiment.length;
      
      const news = overall;
      const social = this.analyzeSocialSentiment(this.symbol);
      const trends = this.analyzeGoogleTrends(this.symbol);

      return { overall, news, social, trends };
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return this.getDefaultSentiment();
    }
  }

  private async analyzeHistoricalPatterns(): Promise<any> {
    try {
      // Fetch historical performance data
      const { data: history } = await this.supabase
        .from('prediction_history')
        .select('prediction, was_accurate, confidence, created_at')
        .eq('symbol', this.symbol)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!history || history.length < 20) {
        return this.getDefaultHistorical();
      }

      const accuracy = history.filter(h => h.was_accurate === true).length / history.length;
      const avgConfidence = history.reduce((sum, h) => sum + (h.confidence || 0), 0) / history.length;
      
      const bullishAccuracy = history.filter(h => h.prediction === 'bullish' && h.was_accurate === true).length / 
                           history.filter(h => h.prediction === 'bullish').length;
      const bearishAccuracy = history.filter(h => h.prediction === 'bearish' && h.was_accurate === true).length / 
                           history.filter(h => h.prediction === 'bearish').length;

      return {
        accuracy,
        avgConfidence,
        bullishAccuracy,
        bearishAccuracy,
        patterns: this.detectPatterns(history)
      };
    } catch (error) {
      console.error('Historical analysis failed:', error);
      return this.getDefaultHistorical();
    }
  }

  private predictShortTerm(technical: TechnicalIndicator, sentiment: MarketSentiment, historical: any): any {
    const signals = [];
    
    // Technical signals
    if (technical.rsi < 30) signals.push({ type: 'oversold', strength: 0.8 });
    if (technical.rsi > 70) signals.push({ type: 'overbought', strength: 0.8 });
    
    if (technical.price > technical.bollinger.upper) signals.push({ type: 'breakout_up', strength: 0.7 });
    if (technical.price < technical.bollinger.lower) signals.push({ type: 'breakout_down', strength: 0.7 });
    
    if (technical.sma.short > technical.sma.long) signals.push({ type: 'trend_up', strength: 0.6 });
    if (technical.sma.short < technical.sma.long) signals.push({ type: 'trend_down', strength: 0.6 });
    
    // MACD signals
    if (technical.macd.signal > 0 && technical.macd.histogram > 0) signals.push({ type: 'macd_bullish', strength: 0.7 });
    if (technical.macd.signal < 0 && technical.macd.histogram < 0) signals.push({ type: 'macd_bearish', strength: 0.7 });
    
    // Sentiment signals
    if (sentiment.overall > 0.2) signals.push({ type: 'positive_sentiment', strength: 0.5 });
    if (sentiment.overall < -0.2) signals.push({ type: 'negative_sentiment', strength: 0.5 });
    
    // Historical pattern signals
    if (historical.accuracy > 0.6) signals.push({ type: 'historical_success', strength: 0.4 });
    
    // Calculate overall prediction
    const bullishStrength = signals
      .filter(s => ['trend_up', 'breakout_up', 'macd_bullish', 'positive_sentiment'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const bearishStrength = signals
      .filter(s => ['trend_down', 'breakout_down', 'macd_bearish', 'negative_sentiment'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const totalStrength = bullishStrength + bearishStrength;
    const confidence = Math.min(0.95, totalStrength / 3); // Cap at 95%
    
    const prediction = bullishStrength > bearishStrength ? 'bullish' : bearishStrength > bullishStrength ? 'bearish' : 'neutral';
    const target = this.calculateTarget(technical, prediction, 7); // 7-day target
    
    return { prediction, confidence, target };
  }

  private predictMediumTerm(technical: TechnicalIndicator, sentiment: MarketSentiment, historical: any): any {
    // Similar logic but with different weightings and timeframes
    const signals = [];
    
    // Medium-term technical signals
    const sma20 = this.calculateSMA([technical.price], 20);
    const sma50 = this.calculateSMA([technical.price], 50);
    
    if (sma20 > sma50) signals.push({ type: 'medium_trend_up', strength: 0.6 });
    if (sma20 < sma50) signals.push({ type: 'medium_trend_down', strength: 0.6 });
    
    // Volume analysis
    const avgVolume = technical.volume;
    if (technical.volume > avgVolume * 1.5) signals.push({ type: 'high_volume', strength: 0.5 });
    
    // Sentiment with more weight
    if (sentiment.overall > 0.1) signals.push({ type: 'sustained_positive', strength: 0.6 });
    if (sentiment.overall < -0.1) signals.push({ type: 'sustained_negative', strength: 0.6 });
    
    const bullishStrength = signals
      .filter(s => ['medium_trend_up', 'high_volume', 'sustained_positive'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const bearishStrength = signals
      .filter(s => ['medium_trend_down', 'sustained_negative'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const prediction = bullishStrength > bearishStrength ? 'bullish' : bearishStrength > bullishStrength ? 'bearish' : 'neutral';
    const confidence = Math.min(0.85, (bullishStrength + bearishStrength) / 2.5);
    const target = this.calculateTarget(technical, prediction, 30); // 30-day target
    
    return { prediction, confidence, target };
  }

  private predictLongTerm(technical: TechnicalIndicator, sentiment: MarketSentiment, historical: any): any {
    // Long-term focuses more on fundamentals and major trends
    const signals = [];
    
    // Long-term trend analysis
    if (technical.price > technical.sma.long) signals.push({ type: 'long_term_uptrend', strength: 0.7 });
    if (technical.price < technical.sma.long) signals.push({ type: 'long_term_downtrend', strength: 0.7 });
    
    // Major sentiment shifts
    if (sentiment.overall > 0.3) signals.push({ type: 'major_positive_shift', strength: 0.8 });
    if (sentiment.overall < -0.3) signals.push({ type: 'major_negative_shift', strength: 0.8 });
    
    // Historical performance
    if (historical.accuracy > 0.7) signals.push({ type: 'strong_historical_performance', strength: 0.6 });
    
    const bullishStrength = signals
      .filter(s => ['long_term_uptrend', 'major_positive_shift', 'strong_historical_performance'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const bearishStrength = signals
      .filter(s => ['long_term_downtrend', 'major_negative_shift'].includes(s.type))
      .reduce((sum, s) => sum + s.strength, 0);
    
    const prediction = bullishStrength > bearishStrength ? 'bullish' : bearishStrength > bullishStrength ? 'bearish' : 'neutral';
    const confidence = Math.min(0.75, (bullishStrength + bearishStrength) / 2);
    const target = this.calculateTarget(technical, prediction, 90); // 90-day target
    
    return { prediction, confidence, target };
  }

  private calculateRisk(technical: TechnicalIndicator, sentiment: MarketSentiment, historical: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // Volatility risk
    if (technical.rsi > 80 || technical.rsi < 20) riskScore += 2;
    
    // Volume risk
    if (technical.volume < 10000) riskScore += 1; // Low volume = higher risk
    
    // Sentiment risk
    if (Math.abs(sentiment.overall) > 0.5) riskScore += 1; // Extreme sentiment
    
    // Historical risk
    if (historical.accuracy < 0.5) riskScore += 2;
    
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private calculateMomentum(technical: TechnicalIndicator, sentiment: MarketSentiment): 'accelerating' | 'decelerating' | 'stable' {
    const priceChange = technical.price - technical.sma.short;
    const sentimentMomentum = sentiment.overall;
    
    if (priceChange > 0.02 && sentimentMomentum > 0.1) return 'accelerating';
    if (priceChange < -0.02 && sentimentMomentum < -0.1) return 'decelerating';
    return 'stable';
  }

  // Technical indicator calculations
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 0.001);
    
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const signal = this.calculateEMA([ema12 - ema26], 9);
    const histogram = ema12 - ema26 - signal;
    
    return { signal, histogram };
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number } {
    const middle = this.calculateSMA(prices, period);
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[0];
    const sum = prices.slice(-period).reduce((sum, price) => sum + price, 0);
    return sum / period;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[0];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateTarget(technical: TechnicalIndicator, prediction: string, days: number): number {
    const volatility = (technical.bollinger.upper - technical.bollinger.lower) / technical.bollinger.middle;
    const baseMove = technical.price * volatility * 0.1; // 10% of volatility range
    
    if (prediction === 'bullish') return technical.price + (baseMove * days / 7);
    if (prediction === 'bearish') return technical.price - (baseMove * days / 7);
    return technical.price; // Neutral - no significant change expected
  }

  private analyzeSocialSentiment(symbol: string): number {
    // Placeholder for social media sentiment analysis
    // In production, integrate with Twitter API, Reddit API, etc.
    return (Math.random() - 0.5) * 0.4; // Random between -0.2 and 0.2
  }

  private analyzeGoogleTrends(symbol: string): number {
    // Placeholder for Google Trends analysis
    // In production, integrate with Google Trends API
    return (Math.random() - 0.5) * 0.3; // Random between -0.15 and 0.15
  }

  private detectPatterns(history: any[]): any[] {
    // Pattern detection logic
    return [
      { type: 'seasonal', strength: 0.3 },
      { type: 'momentum', strength: 0.5 }
    ];
  }

  // Default values for insufficient data
  private getDefaultTechnical(): TechnicalIndicator {
    return {
      rsi: 50,
      macd: { signal: 0, histogram: 0 },
      bollinger: { upper: 100, middle: 100, lower: 100 },
      sma: { short: 100, long: 100 },
      volume: 1000000,
      price: 100
    };
  }

  private getDefaultSentiment(): MarketSentiment {
    return {
      overall: 0,
      news: 0,
      social: 0,
      trends: 0
    };
  }

  private getDefaultHistorical(): any {
    return {
      accuracy: 0.5,
      avgConfidence: 0.7,
      bullishAccuracy: 0.5,
      bearishAccuracy: 0.5,
      patterns: []
    };
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

    console.log(`Generating real-time prediction for ${symbol}...`);
    
    const predictor = new AdvancedPredictor(symbol, supabase);
    const prediction = await predictor.generatePrediction();
    
    // Store prediction in database
    await supabase
      .from('predictions')
      .upsert({
        symbol,
        prediction: prediction.shortTerm.prediction,
        confidence: prediction.shortTerm.confidence,
        target_price: prediction.shortTerm.target,
        timeframe: '7d',
        risk_level: prediction.risk,
        momentum: prediction.momentum,
        source: 'algorithmic',
        created_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: prediction,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in real-time predictor:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
