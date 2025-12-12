import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Zap, Target, CheckCircle2, XCircle, Clock, DollarSign, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SentimentPredictionProps {
  symbol: string;
}

interface AccuracyStats {
  totalPredictions: number;
  verifiedPredictions: number;
  accuratePredictions: number;
  accuracyRate: number;
  byType: {
    bullish: { total: number; correct: number };
    bearish: { total: number; correct: number };
    neutral: { total: number; correct: number };
  };
  avgConfidence: number;
}

interface PredictionHistoryItem {
  id: string;
  prediction: string;
  confidence: number;
  actual_outcome: string | null;
  was_accurate: boolean | null;
  price_at_prediction: number | null;
  price_at_verification: number | null;
  price_change_percent: number | null;
  created_at: string;
  verified_at: string | null;
}

interface PredictionData {
  symbol: string;
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  shortTermOutlook: string;
  mediumTermOutlook: string;
  keyFactors: string[];
  riskLevel: 'low' | 'medium' | 'high';
  sentimentMomentum: 'accelerating' | 'decelerating' | 'stable';
  historicalData: {
    totalArticles: number;
    avgSentiment: number;
    posCount: number;
    negCount: number;
    neuCount: number;
    trend: number;
  };
  livePrice: { price: number; change: number } | null;
  accuracyStats: AccuracyStats;
  predictionHistory: PredictionHistoryItem[];
  generatedAt: string;
  source: 'ai' | 'algorithmic';
}

export function SentimentPrediction({ symbol }: SentimentPredictionProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('predict-sentiment', {
        body: { symbol, includeHistory: true },
      });

      if (fnError) throw fnError;
      setPrediction(data);
      toast.success('Prediction updated', { description: 'Live data fetched successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch prediction';
      setError(message);
      toast.error('Prediction failed', { description: message });
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (symbol) {
      fetchPrediction();
    }
  }, [symbol, fetchPrediction]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchPrediction, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPrediction]);

  const getPredictionIcon = (pred?: string) => {
    switch (pred || prediction?.prediction) {
      case 'bullish': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'bearish': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getPredictionColor = () => {
    if (!prediction) return 'bg-muted';
    switch (prediction.prediction) {
      case 'bullish': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'bearish': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const getRiskColor = () => {
    if (!prediction) return 'secondary';
    switch (prediction.riskLevel) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
    }
  };

  const getMomentumIcon = () => {
    if (!prediction) return null;
    switch (prediction.sentimentMomentum) {
      case 'accelerating': return <Zap className="h-4 w-4 text-green-500" />;
      case 'decelerating': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading && !prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Fetching Live Data...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Prediction Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchPrediction} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const { accuracyStats, predictionHistory, livePrice } = prediction;

  return (
    <div className="space-y-4">
      {/* Live Price Card */}
      {livePrice && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Live Price</div>
                  <div className="text-2xl font-bold">${livePrice.price.toFixed(2)}</div>
                </div>
              </div>
              <div className={`text-right ${livePrice.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <div className="flex items-center gap-1">
                  {livePrice.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="text-lg font-semibold">
                    {livePrice.change >= 0 ? '+' : ''}{livePrice.change.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Prediction Card */}
      <Card className={`border-2 ${getPredictionColor()}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getPredictionIcon()}
              AI Sentiment Prediction
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? 'default' : 'ghost'}
                size="sm"
                className="text-xs"
              >
                <Activity className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-pulse' : ''}`} />
                {autoRefresh ? 'Live' : 'Auto'}
              </Button>
              <Button onClick={fetchPrediction} variant="ghost" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl font-bold capitalize">{prediction.prediction}</div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <span className="text-xl font-semibold">{Math.round(prediction.confidence * 100)}%</span>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap mb-4">
            <Badge variant={getRiskColor()}>
              Risk: {prediction.riskLevel}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              {getMomentumIcon()}
              {prediction.sentimentMomentum}
            </Badge>
            <Badge variant="outline">
              {prediction.source === 'ai' ? '🤖 AI' : '📊 Algorithmic'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Accuracy Stats Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Prediction Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">
                {accuracyStats.accuracyRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Overall Accuracy</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{accuracyStats.totalPredictions}</div>
              <div className="text-xs text-muted-foreground">Total Predictions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-green-500">{accuracyStats.accuratePredictions}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{accuracyStats.avgConfidence.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Avg Confidence</div>
            </div>
          </div>

          {/* Accuracy by Type */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 rounded bg-green-500/10">
              <div className="font-medium text-green-500">Bullish</div>
              <div className="text-xs text-muted-foreground">
                {accuracyStats.byType.bullish.correct}/{accuracyStats.byType.bullish.total}
                {accuracyStats.byType.bullish.total > 0 && 
                  ` (${((accuracyStats.byType.bullish.correct / accuracyStats.byType.bullish.total) * 100).toFixed(0)}%)`
                }
              </div>
            </div>
            <div className="p-2 rounded bg-red-500/10">
              <div className="font-medium text-red-500">Bearish</div>
              <div className="text-xs text-muted-foreground">
                {accuracyStats.byType.bearish.correct}/{accuracyStats.byType.bearish.total}
                {accuracyStats.byType.bearish.total > 0 && 
                  ` (${((accuracyStats.byType.bearish.correct / accuracyStats.byType.bearish.total) * 100).toFixed(0)}%)`
                }
              </div>
            </div>
            <div className="p-2 rounded bg-yellow-500/10">
              <div className="font-medium text-yellow-500">Neutral</div>
              <div className="text-xs text-muted-foreground">
                {accuracyStats.byType.neutral.correct}/{accuracyStats.byType.neutral.total}
                {accuracyStats.byType.neutral.total > 0 && 
                  ` (${((accuracyStats.byType.neutral.correct / accuracyStats.byType.neutral.total) * 100).toFixed(0)}%)`
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prediction History Table */}
      {predictionHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Prediction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Prediction</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictionHistory.slice(0, 10).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getPredictionIcon(item.prediction)}
                          <span className="capitalize text-sm">{item.prediction}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(item.confidence * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.price_at_prediction ? `$${item.price_at_prediction.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {item.actual_outcome ? (
                          <div className="flex items-center gap-1">
                            {getPredictionIcon(item.actual_outcome)}
                            <span className="capitalize text-sm">{item.actual_outcome}</span>
                            {item.price_change_percent !== null && (
                              <span className={`text-xs ${item.price_change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                ({item.price_change_percent >= 0 ? '+' : ''}{item.price_change_percent.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.was_accurate !== null ? (
                          item.was_accurate ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outlook Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Short-Term Outlook (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{prediction.shortTermOutlook}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium-Term Outlook (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{prediction.mediumTermOutlook}</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Factors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Key Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {prediction.keyFactors.map((factor, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-primary">•</span>
                <span className="text-muted-foreground">{factor}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Historical Data Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Data Summary (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{prediction.historicalData.totalArticles}</div>
              <div className="text-xs text-muted-foreground">Articles Analyzed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{prediction.historicalData.posCount}</div>
              <div className="text-xs text-muted-foreground">Positive</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{prediction.historicalData.negCount}</div>
              <div className="text-xs text-muted-foreground">Negative</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{prediction.historicalData.neuCount}</div>
              <div className="text-xs text-muted-foreground">Neutral</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <div className="text-sm text-muted-foreground">
              Average Sentiment: <span className={prediction.historicalData.avgSentiment > 0 ? 'text-green-500' : prediction.historicalData.avgSentiment < 0 ? 'text-red-500' : 'text-yellow-500'}>
                {prediction.historicalData.avgSentiment.toFixed(3)}
              </span>
              {' | '}
              Trend: <span className={prediction.historicalData.trend > 0 ? 'text-green-500' : prediction.historicalData.trend < 0 ? 'text-red-500' : 'text-yellow-500'}>
                {prediction.historicalData.trend > 0 ? '+' : ''}{prediction.historicalData.trend.toFixed(3)}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground text-center">
            Generated: {new Date(prediction.generatedAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
