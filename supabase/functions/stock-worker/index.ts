import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window (lower for worker as it's resource-intensive)
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

// Allowed actions
const ALLOWED_ACTIONS = ['price', 'news-sentiment'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by IP
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    
    if (isRateLimited(clientIP)) {
      console.log(`Rate limited: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { symbol, action } = await req.json();
    
    if (!symbol || !action) {
      return new Response(
        JSON.stringify({ error: 'Symbol and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate symbol format
    const symbolRegex = /^[A-Za-z0-9.\-]{1,20}$/;
    if (!symbolRegex.test(symbol)) {
      return new Response(
        JSON.stringify({ error: 'Invalid symbol format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate action
    if (!ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const functionUrl = `${supabaseUrl}/functions/v1`;

    console.log(`Starting ${action} worker for ${symbol}`);

    if (action === 'price') {
      // Fetch price every 5 seconds for 60 seconds
      for (let i = 0; i < 12; i++) {
        try {
          const response = await fetch(`${functionUrl}/fetch-stock-price`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({ symbol }),
          });
          
          if (!response.ok) {
            console.error(`Price fetch failed: ${response.status}`);
          } else {
            const data = await response.json();
            console.log(`Price updated for ${symbol}: ${data.price}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error fetching price:`, errorMessage);
        }
        
        if (i < 11) await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else if (action === 'news-sentiment') {
      // Fetch news
      try {
        const newsResponse = await fetch(`${functionUrl}/fetch-stock-news`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ symbol }),
        });
        
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          console.log(`Fetched ${newsData.total} articles, ${newsData.new} new`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error fetching news:`, errorMessage);
      }

      // Analyze sentiment
      try {
        const sentimentResponse = await fetch(`${functionUrl}/analyze-sentiment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ symbol }),
        });
        
        if (sentimentResponse.ok) {
          const sentimentData = await sentimentResponse.json();
          console.log(`Analyzed ${sentimentData.analyzed} articles`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error analyzing sentiment:`, errorMessage);
      }
    }

    return new Response(
      JSON.stringify({ symbol, action, status: 'completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});