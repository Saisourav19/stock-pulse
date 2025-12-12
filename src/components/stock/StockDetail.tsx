import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SentimentAnalysis } from "./SentimentAnalysis";
import { SentimentTrendChart } from "./SentimentTrendChart";
import { SentimentPrediction } from "./SentimentPrediction";
import { PriceAlerts } from "./PriceAlerts";
import { useStockWorker } from "@/hooks/useStockWorker";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";

interface StockDetailProps {
  symbol: string;
}

interface PriceData {
  price: number;
  change_amount: number;
  change_percent: number;
  currency: string;
  priceINR?: number;
  priceUSD?: number;
}

interface Article {
  id: string;
  title: string;
  link: string;
  published: string;
  summary: string | null;
  source: string;
  sub_source: string | null;
  sentiment_compound: number | null;
  sentiment_label: string | null;
  sentiment_pos: number | null;
  sentiment_neu: number | null;
  sentiment_neg: number | null;
}

export const StockDetail = ({ symbol }: StockDetailProps) => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Start background workers for this symbol
  useStockWorker(symbol);
  usePriceAlerts(symbol);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch latest price
      const { data: priceSnapshot } = await supabase
        .from("price_snapshots")
        .select("*")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (priceSnapshot) {
        const metadata = priceSnapshot.metadata as any;
        setPriceData({
          price: priceSnapshot.price,
          change_amount: priceSnapshot.change_amount || 0,
          change_percent: priceSnapshot.change_percent || 0,
          currency: priceSnapshot.currency || "USD",
          priceINR: metadata?.priceINR,
          priceUSD: metadata?.priceUSD,
        });
      }

      // Fetch articles
      const { data: articlesData } = await supabase
        .from("articles")
        .select("*")
        .eq("symbol", symbol)
        .order("published", { ascending: false })
        .limit(50);

      if (articlesData) {
        setArticles(articlesData);
      }

      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime updates
    const priceChannel = supabase
      .channel(`price_${symbol}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_snapshots",
          filter: `symbol=eq.${symbol}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const metadata = newData.metadata as any;
          setPriceData({
            price: newData.price,
            change_amount: newData.change_amount || 0,
            change_percent: newData.change_percent || 0,
            currency: newData.currency || "USD",
            priceINR: metadata?.priceINR,
            priceUSD: metadata?.priceUSD,
          });
        }
      )
      .subscribe();

    const articlesChannel = supabase
      .channel(`articles_${symbol}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "articles",
          filter: `symbol=eq.${symbol}`,
        },
        (payload) => {
          const newArticle = payload.new as Article;
          setArticles((prev) => [newArticle, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(priceChannel);
      supabase.removeChannel(articlesChannel);
    };
  }, [symbol]);

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  const isPositive = priceData && priceData.change_percent >= 0;

  return (
    <div className="space-y-4">
      {/* Price Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{symbol}</h2>
            {priceData && (
              <>
                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline gap-4">
                    <p className="text-4xl font-bold text-foreground">
                      ${priceData.priceUSD?.toFixed(2) || priceData.price.toFixed(2)}
                    </p>
                    {priceData.priceINR && (
                      <p className="text-2xl text-muted-foreground">
                        ₹{priceData.priceINR.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isPositive ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                    <span
                      className={`text-lg font-semibold ${
                        isPositive ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {priceData.change_amount.toFixed(2)} ({isPositive ? "+" : ""}
                      {priceData.change_percent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Price Alerts */}
      <PriceAlerts symbol={symbol} currentPrice={priceData?.price || 0} />

      {/* Tabs for News and Sentiment */}
      <Card>
        <Tabs defaultValue="news" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
            <TabsTrigger
              value="news"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              News ({articles.length})
            </TabsTrigger>
            <TabsTrigger
              value="sentiment"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Sentiment Analysis
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Sentiment Trends
            </TabsTrigger>
            <TabsTrigger
              value="prediction"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              AI Prediction
            </TabsTrigger>
          </TabsList>

          <TabsContent value="news" className="p-4 space-y-3">
            {articles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No news articles found for {symbol}
              </p>
            ) : (
              articles.map((article) => (
                <Card key={article.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary font-medium line-clamp-2"
                      >
                        {article.title}
                      </a>
                      {article.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {article.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">{article.source}</span>
                        {article.sub_source && <span>• {article.sub_source}</span>}
                        <span>• {new Date(article.published).toLocaleString()}</span>
                        {article.sentiment_label && (
                          <span
                            className={`font-medium ${
                              article.sentiment_label === "positive"
                                ? "text-green-500"
                                : article.sentiment_label === "negative"
                                ? "text-red-500"
                                : "text-yellow-500"
                            }`}
                          >
                            • {article.sentiment_label}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="sentiment" className="p-4">
            <SentimentAnalysis symbol={symbol} articles={articles} />
          </TabsContent>

          <TabsContent value="trends" className="p-4">
            <SentimentTrendChart symbol={symbol} articles={articles} />
          </TabsContent>

          <TabsContent value="prediction" className="p-4">
            <SentimentPrediction symbol={symbol} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};