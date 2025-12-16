import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Target, Loader2, TrendingUp, TrendingDown, RefreshCw, Minus, ArrowUp, ArrowDown, BarChart3, Activity, Globe2, Building2, Wallet, Users, LineChart, Briefcase } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, AreaChart, Area } from 'recharts';

interface Factor {
  name: string;
  score: number;
  impact: string;
  articles: number;
}

interface FactorData {
  factors: Factor[];
  overall: {
    score: number;
    sentiment: string;
    totalArticles: number;
  };
}

interface SentimentFactorsResponse {
  success: boolean;
  data: FactorData;
}

const factorIcons: Record<string, any> = {
  'Global Markets': Globe2,
  'Industry Trends': Building2,
  'Economic Indicators': Wallet,
  'Social Media': Users,
  'Analyst Views': LineChart,
  'Foreign Investment': Briefcase,
  'Corporate Earnings': BarChart3,
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg p-3 shadow-xl border">
        <p className="font-semibold">{payload[0].payload.factor || payload[0].payload.name}</p>
        <p className="text-sm text-muted-foreground">Score: <span className="font-medium text-primary">{payload[0].value}</span></p>
      </div>
    );
  }
  return null;
};

export default function SentimentFactors() {
  const [loading, setLoading] = useState(true);
  const [factorData, setFactorData] = useState<FactorData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchFactors();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchFactors, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchFactors = async (forceRefresh = false) => {
    try {
      if (!loading) setLoading(false);
      console.log('Fetching sentiment factors...', { forceRefresh });

      const { data, error } = await apiClient.invokeFunction<SentimentFactorsResponse>('sentiment-factors', {
        symbol: 'NIFTY', // Changed from AAPL to analyze Indian market
        timestamp: Date.now(),
        forceRefresh
      });

      console.log('Sentiment factors response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (data && data.success) {
        console.log('Factors data received:', data.data);
        setFactorData(data.data);
        setLastUpdated(new Date());

        // Force re-render by updating state
        if (forceRefresh) {
          toast.success('Data refreshed successfully!');
        }
      } else {
        console.error('API returned error:', data);
        toast.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching factors:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch factors');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
            <Target className="h-8 w-8 text-white animate-float" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Analyzing Factors</p>
          <p className="text-sm text-muted-foreground">Calculating sentiment influences...</p>
        </div>
      </div>
    );
  }

  if (!factorData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">No data available</p>
        <Button onClick={() => fetchFactors(true)} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Retry
        </Button>
      </div>
    );
  }

  const radarData = factorData.factors.map(f => ({
    factor: f.name.split(' ')[0],
    fullName: f.name,
    score: f.score
  }));

  const barData = [...factorData.factors].sort((a, b) => b.score - a.score);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Bullish': return 'text-green-500';
      case 'Bearish': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'Bullish': return TrendingUp;
      case 'Bearish': return TrendingDown;
      default: return Minus;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBarColor = (score: number) => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  };

  const SentimentIcon = getSentimentIcon(factorData.overall.sentiment);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center glow">
            <Target className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Indian Market Sentiment Factors</h1>
            <p className="text-muted-foreground">Multi-dimensional analysis of market influences</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={() => fetchFactors(true)} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Force Refresh
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card className="hover-lift overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#scoreGradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(factorData.overall.score / 100) * 352} 352`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-4xl font-bold">{factorData.overall.score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <SentimentIcon className={`h-6 w-6 ${getSentimentColor(factorData.overall.sentiment)}`} />
                  <span className={`text-2xl font-bold ${getSentimentColor(factorData.overall.sentiment)}`}>
                    {factorData.overall.sentiment}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on {factorData.overall.totalArticles} articles and multiple data sources
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="stat-card">
                <div className="text-2xl font-bold text-green-500">
                  {factorData.factors.filter(f => f.score >= 60).length}
                </div>
                <div className="text-xs text-muted-foreground">Bullish Factors</div>
              </div>
              <div className="stat-card">
                <div className="text-2xl font-bold text-yellow-500">
                  {factorData.factors.filter(f => f.score >= 40 && f.score < 60).length}
                </div>
                <div className="text-xs text-muted-foreground">Neutral Factors</div>
              </div>
              <div className="stat-card">
                <div className="text-2xl font-bold text-red-500">
                  {factorData.factors.filter(f => f.score < 40).length}
                </div>
                <div className="text-xs text-muted-foreground">Bearish Factors</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card className="hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Factor Analysis Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <defs>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Sentiment Score"
                    dataKey="score"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#radarGradient)"
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Factor Scores Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={barData} layout="vertical" barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factor Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {factorData.factors.map((factor, idx) => {
          const IconComponent = factorIcons[factor.name] || Activity;
          const isPositive = factor.score >= 60;
          const isNegative = factor.score < 40;

          return (
            <Card
              key={factor.name}
              className="hover-lift group"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl transition-colors ${isPositive ? 'bg-green-500/10 text-green-500' :
                      isNegative ? 'bg-red-500/10 text-red-500' :
                        'bg-yellow-500/10 text-yellow-500'
                    }`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className={getScoreColor(factor.score)}>
                    {factor.score >= 60 ? <ArrowUp className="h-3 w-3 mr-1" /> :
                      factor.score < 40 ? <ArrowDown className="h-3 w-3 mr-1" /> : null}
                    {factor.score}
                  </Badge>
                </div>

                <h3 className="font-semibold mb-2">{factor.name}</h3>

                <div className="mb-3">
                  <Progress
                    value={factor.score}
                    className="h-2"
                  />
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {factor.impact}
                </p>

                <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>{factor.articles} articles</span>
                  <span className={`font-medium ${getScoreColor(factor.score)}`}>
                    {isPositive ? 'Bullish' : isNegative ? 'Bearish' : 'Neutral'}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
