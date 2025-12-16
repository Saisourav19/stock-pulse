import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api-client';
import {
  Target, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle,
  Clock, BarChart3, Search, Loader2, RefreshCw, Percent, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface PredictionResult {
  symbol: string;
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  riskLevel: string;
  sentimentMomentum: string;
  shortTermOutlook: string;
  mediumTermOutlook: string;
  keyFactors: string[];
  livePrice: { price: number; change: number; currency?: string } | null;
  accuracyStats: {
    totalPredictions: number;
    verifiedPredictions: number;
    accuratePredictions: number;
    accuracyRate: number;
    avgConfidence: number;
    byType: {
      bullish: { total: number; correct: number };
      bearish: { total: number; correct: number };
      neutral: { total: number; correct: number };
    };
  };
  predictionHistory: Array<{
    id: string;
    prediction: string;
    confidence: number;
    created_at: string;
    was_accurate: boolean | null;
    actual_outcome: string | null;
    price_at_prediction: number | null;
    price_change_percent: number | null;
  }>;
  generatedAt: string;
  source: string;
}

const COLORS = {
  accurate: '#10b981',
  pending: '#f59e0b',
  inaccurate: '#ef4444'
};

// Add CSS animation keyframes
const slideInAnimation = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground capitalize">{entry.name}:</span>
            </div>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PredictionAccuracy() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchAllHistory();
    triggerAutoVerification();

    // Set up real-time subscription for prediction_history table
    const channel = supabase
      .channel('prediction-accuracy-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_history'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Refresh the entire history to ensure consistency
          fetchAllHistory();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds for pending verifications
    const refreshInterval = setInterval(() => {
      fetchAllHistory();
      // Try to trigger verification every 5 minutes (counter check or just let it be handled by backend logic)
      if (new Date().getMinutes() % 5 === 0) {
        triggerAutoVerification();
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, []);

  const fetchAllHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('prediction_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setAllHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const triggerAutoVerification = async () => {
    try {
      console.log('Triggering automatic verification...');
      const { error } = await supabase.functions.invoke('verify-predictions', {
        body: { force: true }
      });
      if (error) console.error('Auto-verification failed:', error);
      else {
        console.log('Auto-verification complete');
        fetchAllHistory();
      }
    } catch (err) {
      console.error('Error in auto-verification:', err);
    }
  };

  const handleBatchVerify = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('verify-predictions', {
        body: { force: true }
      });

      if (error) throw error;

      console.log('Batch verification result:', data);
      // Refresh history after batch verification
      fetchAllHistory();
    } catch (error) {
      console.error('Error during batch verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (query?: string) => {
    const symbol = (query || searchQuery).trim().toUpperCase();
    if (!symbol) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('predict-sentiment', {
        body: { symbol, includeHistory: true }
      });

      if (error) throw error;
      setResult(data);
      fetchAllHistory(); // Refresh history after new prediction
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStats = () => {
    const verified = allHistory.filter(p => p.was_accurate !== null);
    const accurate = verified.filter(p => !!p.was_accurate);
    const inaccurate = verified.filter(p => p.was_accurate === false);

    console.log(`Detailed stats: Total=${allHistory.length}, Verified=${verified.length}, Accurate=${accurate.length}, Inaccurate=${inaccurate.length}`);
    console.log('Sample verified prediction:', verified[0]);

    return {
      total: allHistory.length,
      verified: verified.length,
      accurate: accurate.length,
      inaccurate: inaccurate.length,
      pending: allHistory.filter(p => p.was_accurate === null).length,
      accuracy: verified.length > 0 ? Math.round((accurate.length / verified.length) * 100 * 10) / 10 : 0
    };
  };

  const getTypeBreakdown = () => {
    const types = { bullish: { total: 0, correct: 0 }, bearish: { total: 0, correct: 0 }, neutral: { total: 0, correct: 0 } };

    allHistory.forEach(p => {
      const type = p.prediction as keyof typeof types;
      if (types[type]) {
        types[type].total++;
        if (p.was_accurate) types[type].correct++;
      }
    });

    return Object.entries(types).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      total: data.total,
      correct: data.correct,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
    }));
  };

  const getPieData = () => {
    const stats = getOverallStats();
    return [
      { name: 'Accurate', value: stats.accurate, color: COLORS.accurate },
      { name: 'Pending', value: stats.pending, color: COLORS.pending },
      { name: 'Inaccurate', value: stats.verified - stats.accurate, color: COLORS.inaccurate }
    ].filter(d => d.value > 0);
  };

  const stats = getOverallStats();
  const typeBreakdown = getTypeBreakdown();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center glow">
          <Target className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Prediction Accuracy</h1>
          <p className="text-muted-foreground">Track sentiment prediction performance</p>
        </div>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="hover-lift">
          <CardContent className="p-4 text-center">
            <Activity className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Predictions</div>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-3xl font-bold text-green-500">{stats.accurate}</div>
            <div className="text-sm text-muted-foreground">Accurate</div>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <div className="text-3xl font-bold text-red-500">{stats.verified - stats.accurate}</div>
            <div className="text-sm text-muted-foreground">Inaccurate</div>
          </CardContent>
        </Card>
        <Card className="hover-lift">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="hover-lift bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 text-center">
            <Percent className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-3xl font-bold text-primary">{stats.accuracy.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Accuracy Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Make Prediction */}
      <Card className="hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Make New Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Enter stock ticker (e.g., AAPL, RELIANCE.NS, TSLA)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePredict()}
              className="flex-1 h-12"
            />
            <Button
              onClick={() => handlePredict()}
              disabled={loading}
              className="gradient-primary text-white gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
              Generate Prediction
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Quick:</span>
            {['AAPL', 'MSFT', 'TSLA', 'RELIANCE.NS', 'TCS.NS'].map((ticker) => (
              <Badge
                key={ticker}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => {
                  setSearchQuery(ticker);
                  handlePredict(ticker);
                }}
              >
                {ticker}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Prediction Result */}
      {result && (
        <Card className="hover-lift animate-fade-in overflow-hidden">
          <div className={`h-1 ${result.prediction === 'bullish' ? 'bg-green-500' : result.prediction === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'}`} />
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {result.prediction === 'bullish' ? (
                  <TrendingUp className="h-6 w-6 text-green-500" />
                ) : result.prediction === 'bearish' ? (
                  <TrendingDown className="h-6 w-6 text-red-500" />
                ) : (
                  <Minus className="h-6 w-6 text-yellow-500" />
                )}
                <span>{result.symbol} Prediction</span>
              </div>
              <Badge className={
                result.prediction === 'bullish' ? 'bg-green-500/10 text-green-500' :
                  result.prediction === 'bearish' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
              }>
                {result.prediction.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{(result.confidence * 100).toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground">Confidence</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold capitalize">{result.riskLevel}</div>
                <div className="text-sm text-muted-foreground">Risk Level</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold capitalize">{result.sentimentMomentum}</div>
                <div className="text-sm text-muted-foreground">Momentum</div>
              </div>
              {result.livePrice && (
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className={`text-2xl font-bold ${result.livePrice.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {result.livePrice.currency === 'INR' ? '₹' : '$'}{result.livePrice.price.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result.livePrice.change >= 0 ? '+' : ''}{result.livePrice.change.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/20">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Short-term Outlook</div>
                <p className="text-sm">{result.shortTermOutlook}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/20">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Medium-term Outlook</div>
                <p className="text-sm">{result.mediumTermOutlook}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Key Factors:</span>
              {result.keyFactors.map((factor, idx) => (
                <Badge key={idx} variant="outline">{factor}</Badge>
              ))}
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Generated at {new Date(result.generatedAt).toLocaleString()} • Source: {result.source}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Type Breakdown Chart */}
        <Card className="hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Accuracy by Prediction Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={typeBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="total" fill="#8b5cf6" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="correct" fill="#22c55e" name="Correct" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="hover-lift border-0 shadow-lg bg-gradient-to-br from-background to-muted/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary animate-pulse" />
              Prediction Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Chart */}
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={getPieData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      animationBegin={0}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {getPieData().map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity duration-200"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend and Stats */}
              <div className="flex-1 space-y-4">
                <div className="space-y-3">
                  {getPieData().map((item, index) => {
                    const percentage = ((item.value / getPieData().reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1);
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                        style={{
                          animation: `slideIn 0.5s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full shadow-sm transition-transform duration-200 hover:scale-125"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium capitalize">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-lg transition-colors duration-200 hover:text-primary">{item.value}</div>
                          <div className="text-sm text-muted-foreground">{percentage}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Summary */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Predictions</span>
                    <span className="font-semibold text-lg transition-colors duration-200 hover:text-primary">
                      {getPieData().reduce((sum, d) => sum + d.value, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prediction History Table */}
      <Card className="hover-lift">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Prediction History
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBatchVerify} disabled={loading}>
              <Target className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
              Verify All
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAllHistory} disabled={loadingHistory}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading history...</p>
            </div>
          ) : allHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No predictions yet. Make your first prediction above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Symbol</th>
                    <th className="text-left py-3 px-2">Prediction</th>
                    <th className="text-left py-3 px-2">Confidence</th>
                    <th className="text-left py-3 px-2">Price at Pred.</th>
                    <th className="text-left py-3 px-2">Outcome</th>
                    <th className="text-left py-3 px-2">Change</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allHistory.map((pred) => (
                    <tr key={pred.id} className="border-b border-muted/30 hover:bg-muted/10">
                      <td className="py-3 px-2 font-medium">{pred.symbol}</td>
                      <td className="py-3 px-2">
                        <Badge className={
                          pred.prediction === 'bullish' ? 'bg-green-500/10 text-green-500' :
                            pred.prediction === 'bearish' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                        }>
                          {pred.prediction}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">{(pred.confidence * 100).toFixed(0)}%</td>
                      <td className="py-3 px-2">
                        {pred.price_at_prediction ? `${pred.symbol.endsWith('.NS') ? '₹' : '$'}${Number(pred.price_at_prediction).toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3 px-2">
                        {pred.actual_outcome ? (
                          <Badge variant="outline" className={
                            pred.actual_outcome === 'bullish' ? 'border-green-500 text-green-500' :
                              pred.actual_outcome === 'bearish' ? 'border-red-500 text-red-500' : 'border-yellow-500 text-yellow-500'
                          }>
                            {pred.actual_outcome}
                          </Badge>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-2">
                        {pred.price_change_percent !== null ? (
                          <span className={pred.price_change_percent >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {pred.price_change_percent >= 0 ? '+' : ''}{Number(pred.price_change_percent).toFixed(2)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-2">
                        {pred.was_accurate === null ? (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        ) : pred.was_accurate ? (
                          <Badge className="bg-green-500/10 text-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Accurate
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-500">
                            <XCircle className="h-3 w-3 mr-1" /> Inaccurate
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {pred.created_at ? new Date(pred.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : <span className="text-muted-foreground italic">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
