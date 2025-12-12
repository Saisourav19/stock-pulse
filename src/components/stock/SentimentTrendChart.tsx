import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfDay, differenceInDays } from "date-fns";

interface Article {
  id: string;
  published: string;
  sentiment_compound: number | null;
  sentiment_pos: number | null;
  sentiment_neu: number | null;
  sentiment_neg: number | null;
  sentiment_label: string | null;
}

interface SentimentTrendChartProps {
  symbol: string;
  articles: Article[];
}

interface ChartDataPoint {
  date: string;
  compound: number;
  positive: number;
  neutral: number;
  negative: number;
  count: number;
}

export const SentimentTrendChart = ({ symbol, articles }: SentimentTrendChartProps) => {
  const chartData = useMemo(() => {
    // Filter articles from the last 6 months with sentiment data
    const sixMonthsAgo = subMonths(new Date(), 6);
    const articlesWithSentiment = articles.filter(
      (article) =>
        article.sentiment_compound !== null &&
        new Date(article.published) >= sixMonthsAgo
    );

    if (articlesWithSentiment.length === 0) {
      return [];
    }

    // Group articles by day
    const groupedByDay = articlesWithSentiment.reduce((acc, article) => {
      const dayKey = format(startOfDay(new Date(article.published)), "yyyy-MM-dd");
      
      if (!acc[dayKey]) {
        acc[dayKey] = {
          date: dayKey,
          compound: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          count: 0,
        };
      }

      acc[dayKey].compound += article.sentiment_compound || 0;
      acc[dayKey].positive += article.sentiment_pos || 0;
      acc[dayKey].neutral += article.sentiment_neu || 0;
      acc[dayKey].negative += article.sentiment_neg || 0;
      acc[dayKey].count += 1;

      return acc;
    }, {} as Record<string, ChartDataPoint>);

    // Calculate averages and sort by date
    const data = Object.values(groupedByDay)
      .map((day) => ({
        date: format(new Date(day.date), "MMM dd"),
        compound: parseFloat((day.compound / day.count).toFixed(2)),
        positive: parseFloat(((day.positive / day.count) * 100).toFixed(1)),
        neutral: parseFloat(((day.neutral / day.count) * 100).toFixed(1)),
        negative: parseFloat(((day.negative / day.count) * 100).toFixed(1)),
        count: day.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return data;
  }, [articles]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Trend (6 Months)</CardTitle>
          <CardDescription>Historical sentiment analysis for {symbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No sentiment data available for the past 6 months
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compound Sentiment Score Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Sentiment Score</CardTitle>
          <CardDescription>
            Average compound sentiment (-1 to +1) over the past 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                domain={[-1, 1]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="compound"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))" }}
                name="Sentiment Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Distribution</CardTitle>
          <CardDescription>
            Positive, neutral, and negative sentiment percentages over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="positive"
                stackId="1"
                stroke="hsl(142, 76%, 36%)"
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.6}
                name="Positive %"
              />
              <Area
                type="monotone"
                dataKey="neutral"
                stackId="1"
                stroke="hsl(45, 93%, 47%)"
                fill="hsl(45, 93%, 47%)"
                fillOpacity={0.6}
                name="Neutral %"
              />
              <Area
                type="monotone"
                dataKey="negative"
                stackId="1"
                stroke="hsl(0, 84%, 60%)"
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.6}
                name="Negative %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
