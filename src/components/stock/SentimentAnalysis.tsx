import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Article {
  id: string;
  title: string;
  source: string;
  sub_source: string | null;
  sentiment_compound: number | null;
  sentiment_label: string | null;
  sentiment_pos: number | null;
  sentiment_neu: number | null;
  sentiment_neg: number | null;
}

interface SentimentAnalysisProps {
  symbol: string;
  articles: Article[];
}

interface SentimentAggregate {
  count: number;
  avg_compound: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
}

interface SourceAggregate extends SentimentAggregate {
  articles: Article[];
  sub_sources: Record<string, SentimentAggregate & { articles: Article[] }>;
}

export const SentimentAnalysis = ({ symbol, articles }: SentimentAnalysisProps) => {
  const sentimentData = useMemo(() => {
    const articlesWithSentiment = articles.filter(
      (a) => a.sentiment_compound !== null
    );

    if (articlesWithSentiment.length === 0) {
      return null;
    }

    // Overall aggregate
    const overall: SentimentAggregate = {
      count: articlesWithSentiment.length,
      avg_compound: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      positive_pct: 0,
      neutral_pct: 0,
      negative_pct: 0,
    };

    let totalCompound = 0;
    articlesWithSentiment.forEach((a) => {
      totalCompound += a.sentiment_compound!;
      if (a.sentiment_label === "positive") overall.positive++;
      else if (a.sentiment_label === "negative") overall.negative++;
      else overall.neutral++;
    });

    overall.avg_compound = totalCompound / overall.count;
    overall.positive_pct = (overall.positive / overall.count) * 100;
    overall.neutral_pct = (overall.neutral / overall.count) * 100;
    overall.negative_pct = (overall.negative / overall.count) * 100;

    // Per-source aggregate
    const perSource: Record<string, SourceAggregate> = {};

    articlesWithSentiment.forEach((article) => {
      const source = article.source;
      if (!perSource[source]) {
        perSource[source] = {
          count: 0,
          avg_compound: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          positive_pct: 0,
          neutral_pct: 0,
          negative_pct: 0,
          articles: [],
          sub_sources: {},
        };
      }

      perSource[source].count++;
      perSource[source].articles.push(article);

      if (article.sentiment_label === "positive") perSource[source].positive++;
      else if (article.sentiment_label === "negative") perSource[source].negative++;
      else perSource[source].neutral++;

      // Sub-source
      if (article.sub_source) {
        const subSource = article.sub_source;
        if (!perSource[source].sub_sources[subSource]) {
          perSource[source].sub_sources[subSource] = {
            count: 0,
            avg_compound: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            positive_pct: 0,
            neutral_pct: 0,
            negative_pct: 0,
            articles: [],
          };
        }

        perSource[source].sub_sources[subSource].count++;
        perSource[source].sub_sources[subSource].articles.push(article);

        if (article.sentiment_label === "positive")
          perSource[source].sub_sources[subSource].positive++;
        else if (article.sentiment_label === "negative")
          perSource[source].sub_sources[subSource].negative++;
        else perSource[source].sub_sources[subSource].neutral++;
      }
    });

    // Calculate averages and percentages
    Object.values(perSource).forEach((sourceData) => {
      let sourceCompound = 0;
      sourceData.articles.forEach((a) => (sourceCompound += a.sentiment_compound!));
      sourceData.avg_compound = sourceCompound / sourceData.count;
      sourceData.positive_pct = (sourceData.positive / sourceData.count) * 100;
      sourceData.neutral_pct = (sourceData.neutral / sourceData.count) * 100;
      sourceData.negative_pct = (sourceData.negative / sourceData.count) * 100;

      Object.values(sourceData.sub_sources).forEach((subData) => {
        let subCompound = 0;
        subData.articles.forEach((a) => (subCompound += a.sentiment_compound!));
        subData.avg_compound = subCompound / subData.count;
        subData.positive_pct = (subData.positive / subData.count) * 100;
        subData.neutral_pct = (subData.neutral / subData.count) * 100;
        subData.negative_pct = (subData.negative / subData.count) * 100;
      });
    });

    return { overall, perSource };
  }, [articles]);

  if (!sentimentData) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No sentiment data available for {symbol}
      </div>
    );
  }

  const getSentimentColor = (compound: number) => {
    if (compound >= 0.05) return "text-green-500";
    if (compound <= -0.05) return "text-red-500";
    return "text-yellow-500";
  };

  const getSentimentLabel = (compound: number) => {
    if (compound >= 0.05) return "Positive";
    if (compound <= -0.05) return "Negative";
    return "Neutral";
  };

  return (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Average Sentiment Score</span>
              <span
                className={`text-lg font-bold ${getSentimentColor(
                  sentimentData.overall.avg_compound
                )}`}
              >
                {sentimentData.overall.avg_compound.toFixed(4)} -{" "}
                {getSentimentLabel(sentimentData.overall.avg_compound)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Positive</span>
                <span className="text-sm font-medium text-green-500">
                  {sentimentData.overall.positive} (
                  {sentimentData.overall.positive_pct.toFixed(2)}%)
                </span>
              </div>
              <Progress
                value={sentimentData.overall.positive_pct}
                className="h-2 bg-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Neutral</span>
                <span className="text-sm font-medium text-yellow-500">
                  {sentimentData.overall.neutral} (
                  {sentimentData.overall.neutral_pct.toFixed(2)}%)
                </span>
              </div>
              <Progress
                value={sentimentData.overall.neutral_pct}
                className="h-2 bg-secondary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Negative</span>
                <span className="text-sm font-medium text-red-500">
                  {sentimentData.overall.negative} (
                  {sentimentData.overall.negative_pct.toFixed(2)}%)
                </span>
              </div>
              <Progress
                value={sentimentData.overall.negative_pct}
                className="h-2 bg-secondary"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Based on {sentimentData.overall.count} articles
          </p>
        </div>
      </Card>

      {/* Per-Source Sentiment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sentiment by Source</h3>
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(sentimentData.perSource).map(([source, data]) => (
            <AccordionItem key={source} value={source}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium">{source}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {data.count} articles
                    </span>
                    <span
                      className={`text-sm font-bold ${getSentimentColor(
                        data.avg_compound
                      )}`}
                    >
                      {data.avg_compound.toFixed(4)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-500">
                        Positive: {data.positive} ({data.positive_pct.toFixed(2)}%)
                      </span>
                      <span className="text-yellow-500">
                        Neutral: {data.neutral} ({data.neutral_pct.toFixed(2)}%)
                      </span>
                      <span className="text-red-500">
                        Negative: {data.negative} ({data.negative_pct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* Sub-sources */}
                  {Object.keys(data.sub_sources).length > 0 && (
                    <div className="pl-4 border-l-2 border-border space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Sub-sources:
                      </p>
                      {Object.entries(data.sub_sources).map(([subSource, subData]) => (
                        <div key={subSource} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{subSource}</span>
                            <span
                              className={`text-sm font-bold ${getSentimentColor(
                                subData.avg_compound
                              )}`}
                            >
                              {subData.avg_compound.toFixed(4)} ({subData.count} articles)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="text-green-500">
                              +{subData.positive} ({subData.positive_pct.toFixed(1)}%)
                            </span>
                            <span className="text-yellow-500">
                              ={subData.neutral} ({subData.neutral_pct.toFixed(1)}%)
                            </span>
                            <span className="text-red-500">
                              -{subData.negative} ({subData.negative_pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
};