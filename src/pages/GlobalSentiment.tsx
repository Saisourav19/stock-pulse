import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Globe, TrendingUp, TrendingDown, Loader2, RefreshCw, Newspaper, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';

interface RegionSentiment {
  region: string;
  positive: string;
  neutral: string;
  negative: string;
  total: number;
}

interface Headline {
  headline: string;
  region: string;
  source: string;
  sentiment: string;
}

const COLORS = {
  Positive: '#22c55e',
  Neutral: '#eab308',
  Negative: '#ef4444'
};

const GRADIENT_COLORS = {
  Positive: ['#22c55e', '#16a34a'],
  Neutral: ['#eab308', '#ca8a04'],
  Negative: ['#ef4444', '#dc2626']
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
            <span className="font-medium">{entry.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function GlobalSentiment() {
  const [loading, setLoading] = useState(true);
  const [regionData, setRegionData] = useState<RegionSentiment[]>([]);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchGlobalSentiment();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchGlobalSentiment, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchGlobalSentiment = async () => {
    try {
      if (!loading) setLoading(false); // Don't show loading on refresh
      const { data, error } = await supabase.functions.invoke('global-sentiment', {
        body: { region: null }
      });

      if (error) throw error;

      if (data.success) {
        setRegionData(data.data);
        setHeadlines(data.headlines);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching global sentiment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPieData = (region: RegionSentiment) => [
    { name: 'Positive', value: parseFloat(region.positive), fill: COLORS.Positive },
    { name: 'Neutral', value: parseFloat(region.neutral), fill: COLORS.Neutral },
    { name: 'Negative', value: parseFloat(region.negative), fill: COLORS.Negative }
  ];

  const getBarData = () => {
    return regionData.map(region => ({
      region: region.region,
      positive: parseFloat(region.positive),
      neutral: parseFloat(region.neutral),
      negative: parseFloat(region.negative)
    }));
  };

  const getRegionHeadlines = (region: string) => {
    return headlines.filter(h => h.region === region).slice(0, 8);
  };

  const getDominantSentiment = (region: RegionSentiment) => {
    const pos = parseFloat(region.positive);
    const neu = parseFloat(region.neutral);
    const neg = parseFloat(region.negative);
    if (pos > neg && pos > 30) return { sentiment: 'Bullish', color: 'text-green-500', icon: TrendingUp };
    if (neg > pos && neg > 30) return { sentiment: 'Bearish', color: 'text-red-500', icon: TrendingDown };
    return { sentiment: 'Neutral', color: 'text-yellow-500', icon: Minus };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
            <Globe className="h-8 w-8 text-white animate-float" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Loading Global Sentiment</p>
          <p className="text-sm text-muted-foreground">Analyzing market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center glow">
            <Globe className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Global Market Sentiment</h1>
            <p className="text-muted-foreground">Real-time analysis across major markets</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchGlobalSentiment} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {regionData.map((region, idx) => {
          const dominant = getDominantSentiment(region);
          const DominantIcon = dominant.icon;
          return (
            <Card key={region.region} className="hover-lift overflow-hidden" style={{ animationDelay: `${idx * 100}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">{region.region}</span>
                  <Badge variant="outline" className={dominant.color}>
                    <DominantIcon className="h-3 w-3 mr-1" />
                    {dominant.sentiment}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-500">Positive</span>
                    <span className="font-medium">{region.positive}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${region.positive}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-500">Negative</span>
                    <span className="font-medium">{region.negative}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                      style={{ width: `${region.negative}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  {region.total} articles analyzed
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Chart */}
      <Card className="hover-lift">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Regional Sentiment Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={getBarData()} barCategoryGap="20%">
                <defs>
                  <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#ca8a04" />
                  </linearGradient>
                  <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="positive" fill="url(#positiveGradient)" name="Positive %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="neutral" fill="url(#neutralGradient)" name="Neutral %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="negative" fill="url(#negativeGradient)" name="Negative %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Regional Details */}
      <Tabs defaultValue={regionData[0]?.region} onValueChange={setSelectedRegion} className="space-y-4">
        <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
          {regionData.map(region => (
            <TabsTrigger 
              key={region.region} 
              value={region.region}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {region.region}
            </TabsTrigger>
          ))}
        </TabsList>

        {regionData.map(region => (
          <TabsContent key={region.region} value={region.region} className="space-y-4 animate-fade-in">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <Card className="hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{region.region} Sentiment Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <defs>
                          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.2"/>
                          </filter>
                        </defs>
                        <Pie
                          data={getPieData(region)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          filter="url(#shadow)"
                        >
                          {getPieData(region).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Headlines */}
              <Card className="hover-lift">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Newspaper className="h-5 w-5 text-primary" />
                    Recent Headlines ({region.total})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
                  {getRegionHeadlines(region.region).map((headline, idx) => (
                    <div 
                      key={idx} 
                      className="group p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm flex-1 line-clamp-2">{headline.headline}</p>
                        <div className={`flex-shrink-0 p-1.5 rounded-full ${
                          headline.sentiment === 'Positive' ? 'bg-green-500/10 text-green-500' :
                          headline.sentiment === 'Negative' ? 'bg-red-500/10 text-red-500' :
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {headline.sentiment === 'Positive' ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : headline.sentiment === 'Negative' ? (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{headline.source}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Import missing component
import { BarChart3 } from 'lucide-react';
