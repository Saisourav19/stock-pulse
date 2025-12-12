import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced sentiment keywords
const POSITIVE_WORDS = [
  'profit', 'gain', 'surge', 'rally', 'bullish', 'positive', 'growth', 'increase',
  'rise', 'up', 'strong', 'beat', 'exceed', 'outperform', 'success', 'breakthrough',
  'innovation', 'expansion', 'record', 'high', 'boost', 'upgrade', 'optimistic',
  'soar', 'climb', 'advance', 'improve', 'winner', 'milestone', 'achieve'
];

const NEGATIVE_WORDS = [
  'loss', 'fall', 'drop', 'decline', 'bearish', 'negative', 'decrease', 'down',
  'weak', 'miss', 'underperform', 'failure', 'concern', 'risk', 'low', 'downgrade',
  'pessimistic', 'crash', 'plunge', 'slump', 'crisis', 'debt', 'lawsuit', 'fraud',
  'warning', 'threat', 'struggle', 'worsen', 'tumble', 'sink', 'suffer'
];

function analyzeKeywordSentiment(text: string) {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\W+/);
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of words) {
    if (POSITIVE_WORDS.includes(word)) positiveCount++;
    if (NEGATIVE_WORDS.includes(word)) negativeCount++;
  }
  
  const total = positiveCount + negativeCount;
  
  if (total === 0) {
    return {
      pos: 0.0,
      neu: 1.0,
      neg: 0.0,
      compound: 0.0,
    };
  }
  
  const pos = positiveCount / total;
  const neg = negativeCount / total;
  const neu = Math.max(0, 1 - (pos + neg));
  
  // Calculate compound score (-1 to 1)
  const compound = (positiveCount - negativeCount) / Math.max(total, 1);
  
  return {
    pos: Math.max(0, Math.min(1, pos)),
    neu: Math.max(0, Math.min(1, neu)),
    neg: Math.max(0, Math.min(1, neg)),
    compound: Math.max(-1, Math.min(1, compound)),
  };
}

async function analyzeWithAI(articles: any[]): Promise<Map<string, any>> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.log("No OpenAI key, using keyword-based sentiment");
    return new Map();
  }

  try {
    // Batch analyze up to 10 articles at a time with AI
    const batch = articles.slice(0, 10);
    const articlesText = batch.map((a, i) => `${i}. "${a.title}" - ${a.summary || ''}`).join('\n\n');
    
    const prompt = `Analyze sentiment for these financial news articles. For each article number, return sentiment as "positive", "neutral", or "negative" and a confidence score 0-1.

Articles:
${articlesText}

Return ONLY valid JSON array:
[{"index": 0, "sentiment": "positive", "confidence": 0.8}, ...]`;

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
      console.log("AI sentiment analysis failed, using keyword fallback");
      return new Map();
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse AI response
    let results = [];
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[([\s\S]*?)\]/);
    if (jsonMatch) {
      results = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } else {
      results = JSON.parse(content);
    }

    // Map results to article IDs
    const sentimentMap = new Map();
    results.forEach((result: any) => {
      if (result.index !== undefined && batch[result.index]) {
        const article = batch[result.index];
        
        const sentimentScores: Record<string, any> = {
          positive: { pos: 0.8, neu: 0.15, neg: 0.05, compound: 0.7 },
          neutral: { pos: 0.3, neu: 0.6, neg: 0.1, compound: 0.0 },
          negative: { pos: 0.05, neu: 0.15, neg: 0.8, compound: -0.7 },
        };

        const scores = sentimentScores[result.sentiment?.toLowerCase()] || sentimentScores.neutral;
        sentimentMap.set(article.id, {
          ...scores,
          label: result.sentiment?.toLowerCase() || 'neutral',
        });
      }
    });

    console.log(`AI analyzed ${sentimentMap.size} articles`);
    return sentimentMap;
  } catch (error) {
    console.log("AI analysis error:", error instanceof Error ? error.message : 'Unknown');
    return new Map();
  }
}

function getSentimentLabel(compound: number): string {
  if (compound >= 0.05) return 'positive';
  if (compound <= -0.05) return 'negative';
  return 'neutral';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing sentiment for ${symbol}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch articles without sentiment
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('symbol', symbol)
      .is('sentiment_compound', null)
      .limit(100);

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ symbol, analyzed: 0, message: 'No articles to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${articles.length} articles`);

    // Try AI analysis first for better accuracy
    const aiSentiments = await analyzeWithAI(articles);

    // Analyze each article
    const updates = [];
    for (const article of articles) {
      let sentiment;
      let label;

      // Use AI sentiment if available, otherwise fallback to keywords
      if (aiSentiments.has(article.id)) {
        const aiResult = aiSentiments.get(article.id);
        sentiment = {
          pos: aiResult.pos,
          neu: aiResult.neu,
          neg: aiResult.neg,
          compound: aiResult.compound,
        };
        label = aiResult.label;
      } else {
        // Fallback to keyword-based sentiment
        const text = `${article.title} ${article.summary || ''}`;
        sentiment = analyzeKeywordSentiment(text);
        label = getSentimentLabel(sentiment.compound);
      }

      updates.push(
        supabase
          .from('articles')
          .update({
            sentiment_pos: sentiment.pos,
            sentiment_neu: sentiment.neu,
            sentiment_neg: sentiment.neg,
            sentiment_compound: sentiment.compound,
            sentiment_label: label,
          })
          .eq('id', article.id)
      );
    }

    // Execute all updates
    await Promise.all(updates);

    console.log(`Successfully analyzed ${articles.length} articles (${aiSentiments.size} with AI, ${articles.length - aiSentiments.size} with keywords)`);

    return new Response(
      JSON.stringify({
        symbol,
        analyzed: articles.length,
        method: aiSentiments.size > 0 ? 'ai+keywords' : 'keywords',
        message: `Analyzed ${articles.length} articles`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
