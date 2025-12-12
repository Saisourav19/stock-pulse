import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, TrendingUp, TrendingDown, Minus, BarChart3, LineChart as LineChartIcon, Building2, AlertCircle, Brain, Target, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';
import { SentimentPrediction } from '@/components/stock/SentimentPrediction';

interface Article {
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  sentiment: string;
  sentimentScore: number;
}

interface CompanyData {
  company: string;
  articles?: Article[];
  periodStats: Record<string, { positive: number; neutral: number; negative: number }>;
  trendData: Array<{ week: string; positive: number; neutral: number; negative: number; netSentiment: number }>;
  overall: { positive: number; neutral: number; negative: number; total: number };
}

const PERIOD_LABELS: Record<string, string> = {
  '1d': '1 Day',
  '1w': '1 Week',
  '1m': '1 Month',
  '6m': '6 Months',
  '1y': '1 Year'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg p-3 shadow-xl border">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CompanySearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [noData, setNoData] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery.trim();
    if (!searchTerm) return;

    try {
      setLoading(true);
      setNoData(false);
      const { data, error } = await supabase.functions.invoke('company-sentiment', {
        body: { ticker: searchTerm }
      });

      if (error) throw error;

      if (data.success && data.data) {
        setCompanyData(data.data);
        setShowPredictions(true);
        if (!searchHistory.includes(searchTerm.toUpperCase())) {
          setSearchHistory(prev => [searchTerm.toUpperCase(), ...prev.slice(0, 4)]);
        }
      } else {
        setNoData(true);
        setCompanyData(null);
        setShowPredictions(false);
      }
    } catch (error) {
      console.error('Error searching company:', error);
      setNoData(true);
      setCompanyData(null);
      setShowPredictions(false);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodChartData = () => {
    if (!companyData) return [];
    return Object.entries(companyData.periodStats).map(([period, stats]) => ({
      period: PERIOD_LABELS[period] || period.toUpperCase(),
      positive: stats.positive,
      neutral: stats.neutral,
      negative: stats.negative,
      net: stats.positive - stats.negative
    }));
  };

  const getSentimentPercentages = () => {
    if (!companyData) return null;
    const { positive, neutral, negative, total } = companyData.overall;
    return {
      positive: ((positive / total) * 100).toFixed(1),
      neutral: ((neutral / total) * 100).toFixed(1),
      negative: ((negative / total) * 100).toFixed(1)
    };
  };

  const getOverallSentiment = () => {
    if (!companyData) return { label: 'Neutral', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Minus };
    const { positive, negative } = companyData.overall;
    if (positive > negative * 1.5) return { label: 'Bullish', color: 'text-green-500', bg: 'bg-green-500/10', icon: TrendingUp };
    if (negative > positive * 1.5) return { label: 'Bearish', color: 'text-red-500', bg: 'bg-red-500/10', icon: TrendingDown };
    return { label: 'Neutral', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Minus };
  };

  const sentiment = getOverallSentiment();
  const SentimentIcon = sentiment.icon;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center glow">
          <Search className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Company Sentiment Search</h1>
          <p className="text-muted-foreground">Analyze sentiment trends for any company</p>
        </div>
      </div>

      {/* Search Box */}
      <Card className="hover-lift">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Enter company name or ticker (e.g., AAPL, RELIANCE, TSLA)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <Button 
              onClick={() => handleSearch()} 
              disabled={loading} 
              size="lg"
              className="gradient-primary text-white gap-2"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              Analyze
            </Button>
          </div>
          
          {searchHistory.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Recent:</span>
              {searchHistory.map((term) => (
                <Badge 
                  key={term} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => {
                    setSearchQuery(term);
                    handleSearch(term);
                  }}
                >
                  {term}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Data State */}
      {noData && (
        <Card className="hover-lift border-destructive/20">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Data Unavailable</h3>
            <p className="text-muted-foreground">
              No sentiment data found for "<span className="font-medium">{searchQuery}</span>".
              <br />Try another company name or ticker symbol.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {companyData && (
        <div className="space-y-6 animate-fade-in">
          {/* Overview Card */}
          <Card className="hover-lift overflow-hidden">
            <div className={`h-1 ${sentiment.bg.replace('/10', '')}`} style={{ backgroundColor: sentiment.color.replace('text-', '') === 'green-500' ? '#22c55e' : sentiment.color.replace('text-', '') === 'red-500' ? '#ef4444' : '#eab308' }} />
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${sentiment.bg}`}>
                    <Building2 className={`h-8 w-8 ${sentiment.color}`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{companyData.company}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <SentimentIcon className={`h-5 w-5 ${sentiment.color}`} />
                      <span className={`text-lg font-semibold ${sentiment.color}`}>{sentiment.label}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-500">{getSentimentPercentages()?.positive}%</div>
                      <div className="text-sm text-muted-foreground">Positive</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-500">{getSentimentPercentages()?.neutral}%</div>
                      <div className="text-sm text-muted-foreground">Neutral</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-500">{getSentimentPercentages()?.negative}%</div>
                      <div className="text-sm text-muted-foreground">Negative</div>
                    </div>
                  </div>
                  
                  {!showPredictions && (
                    <Button
                      onClick={() => setShowPredictions(true)}
                      className="gradient-primary text-white gap-2 whitespace-nowrap"
                    >
                      <Brain className="h-4 w-4" />
                      AI Prediction
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground">
                      Based on <span className="font-medium text-foreground">{companyData.overall.total}</span> articles analyzed
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        News Articles - {companyData.company}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {companyData.articles && companyData.articles.length > 0 ? (
                        companyData.articles.map((article, index) => (
                          <Card key={index} className="hover-lift">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-base mb-2 line-clamp-2">{article.title}</h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(article.publishedAt).toLocaleDateString()}
                                    </span>
                                    <span>Source: {article.source}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={article.sentiment === 'Positive' ? 'default' : article.sentiment === 'Negative' ? 'destructive' : 'secondary'}>
                                      {article.sentiment}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Score: {article.sentimentScore.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No articles available
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Period Chart */}
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Sentiment by Time Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getPeriodChartData()} barCategoryGap="15%">
                      <defs>
                        <linearGradient id="positiveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#16a34a" />
                        </linearGradient>
                        <linearGradient id="neutralGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#eab308" />
                          <stop offset="100%" stopColor="#ca8a04" />
                        </linearGradient>
                        <linearGradient id="negativeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="positive" fill="url(#positiveGrad)" name="Positive" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="neutral" fill="url(#neutralGrad)" name="Neutral" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="negative" fill="url(#negativeGrad)" name="Negative" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Trend Chart */}
            <Card className="hover-lift">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-primary" />
                  Sentiment Trend (Weekly)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={companyData.trendData}>
                      <defs>
                        <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} dot={false} name="Positive" />
                      <Line type="monotone" dataKey="neutral" stroke="#eab308" strokeWidth={2} dot={false} name="Neutral" />
                      <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={false} name="Negative" />
                      <Area 
                        type="monotone" 
                        dataKey="netSentiment" 
                        stroke="#8b5cf6" 
                        strokeWidth={3} 
                        fill="url(#netGradient)"
                        name="Net Sentiment" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Predictions Section */}
          {showPredictions && companyData && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">AI Sentiment Prediction</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPredictions(false)}
                >
                  Hide
                </Button>
              </div>
              <SentimentPrediction symbol={companyData.company} />
            </div>
          )}

          {/* Period Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(companyData.periodStats).map(([period, stats], idx) => {
              const net = stats.positive - stats.negative;
              const isPositive = net > 0;
              const isNegative = net < 0;
              
              return (
                <Card key={period} className="hover-lift" style={{ animationDelay: `${idx * 50}ms` }}>
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-muted-foreground mb-2">
                      {PERIOD_LABELS[period] || period}
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${
                      isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {net > 0 ? '+' : ''}{net}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Net Sentiment
                    </div>
                    <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-1 text-xs">
                      <div className="text-green-500">{stats.positive}</div>
                      <div className="text-yellow-500">{stats.neutral}</div>
                      <div className="text-red-500">{stats.negative}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
