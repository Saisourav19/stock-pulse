import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Loader2, RefreshCw, TrendingUp, TrendingDown, ArrowRight, Globe2, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';

interface Correlation {
  market: string;
  country: string;
  correlation: number;
  strength: string;
  direction: string;
  bestCorrelation?: number;
  lag?: number;
  influence?: string;
}

interface MarketData {
  name: string;
  country: string;
  prices: number[];
  dates: string[];
}

const COLORS = ['#8b5cf6', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg p-3 shadow-xl border">
        <p className="font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className={`font-medium ${entry.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {entry.value >= 0 ? '+' : ''}{entry.value}%
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const EnhancedCorrelationTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const isPositive = value >= 0;
    
    return (
      <div className="glass-strong rounded-2xl p-6 shadow-2xl border border-border/30 backdrop-blur-md bg-white/95 min-w-[280px]">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 ${
            isPositive ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-red-600'
          }`}>
            <Globe2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{data.country}</p>
            <p className="text-sm text-gray-600">{data.market}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Correlation:</span>
            <span className={`font-bold text-xl ${
              isPositive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {isPositive ? '+' : ''}{value.toFixed(3)}
            </span>
          </div>
          
          {data.influence && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Influence:</span>
              <Badge variant="secondary" className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-800 border-blue-200">
                {data.influence}
              </Badge>
            </div>
          )}
          
          {data.lag && data.lag > 0 && (
            <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-sm font-medium text-amber-800">Optimal Lag:</span>
              <span className="text-sm font-bold text-amber-900 px-2 py-1 bg-amber-200 rounded">
                {data.lag} days
              </span>
            </div>
          )}
          
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3">
              {isPositive ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-800">Positive correlation</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-red-800">Negative correlation</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function MarketCorrelation() {
  const [loading, setLoading] = useState(true);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchCorrelations();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchCorrelations, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCorrelations = async () => {
    try {
      if (!loading) setLoading(false);
      const { data, error } = await supabase.functions.invoke('market-correlation', {
        body: { period: '1mo' }
      });

      if (error) throw error;

      if (data.success) {
        setCorrelations(data.correlations);
        setMarketData(data.marketData);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching correlations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (marketData.length === 0) return [];

    const nifty = marketData.find(m => m.name.includes('NIFTY'));
    if (!nifty || nifty.dates.length === 0) return [];

    return nifty.dates.map((date, idx) => {
      const dataPoint: any = { date: date.split('-').slice(1).join('/') };
      
      marketData.forEach(market => {
        if (market.prices[idx]) {
          const firstValue = market.prices[0];
          const percentChange = ((market.prices[idx] - firstValue) / firstValue) * 100;
          dataPoint[market.country] = parseFloat(percentChange.toFixed(2));
        }
      });
      
      return dataPoint;
    });
  };

  const getCorrelationColor = (corr: number) => {
    if (corr > 0.8) return '#10b981';
    if (corr > 0.6) return '#22c55e';
    if (corr > 0.4) return '#eab308';
    if (corr > 0.2) return '#f97316';
    return '#ef4444';
  };

  const getStrengthLabel = (corr: Correlation) => {
    const abs = Math.abs(corr.correlation);
    if (abs > 0.8) return { label: 'Very Strong', color: 'text-emerald-500 bg-emerald-500/10' };
    if (abs > 0.6) return { label: 'Strong', color: 'text-green-500 bg-green-500/10' };
    if (abs > 0.4) return { label: 'Moderate', color: 'text-yellow-500 bg-yellow-500/10' };
    if (abs > 0.2) return { label: 'Weak', color: 'text-orange-500 bg-orange-500/10' };
    return { label: 'Very Weak', color: 'text-red-500 bg-red-500/10' };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
            <Activity className="h-8 w-8 text-white animate-float" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium">Calculating Correlations</p>
          <p className="text-sm text-muted-foreground">Analyzing market relationships...</p>
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
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Global Markets Impact on India</h1>
            <p className="text-muted-foreground">Correlation analysis with NIFTY 50</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchCorrelations} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Correlation Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {correlations.map((corr, idx) => {
          const strength = getStrengthLabel(corr);
          return (
            <Card 
              key={corr.market} 
              className="hover-lift overflow-hidden"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div 
                className="h-1" 
                style={{ backgroundColor: getCorrelationColor(corr.correlation) }}
              />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">{corr.country}</span>
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className={`text-3xl font-bold mb-2 ${corr.correlation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(3)}
                </div>
                <Badge className={strength.color}>
                  {strength.label}
                </Badge>
                {corr.influence && (
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{corr.influence}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{corr.market}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enhanced Correlation Bar Chart */}
      <Card className="hover-lift">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Correlation Coefficients with NIFTY 50
          </CardTitle>
          <p className="text-sm text-muted-foreground">Interactive visualization of global market relationships</p>
        </CardHeader>
        <CardContent>
          <div className="chart-container bg-gradient-to-br from-slate-50/50 via-blue-50/30 to-indigo-50/20 rounded-xl p-4 shadow-inner">
            <ResponsiveContainer width="100%" height={450}>
              <BarChart 
                data={correlations} 
                barSize={80} 
                margin={{ top: 40, right: 50, left: 40, bottom: 90 }}
                className="drop-shadow-lg"
              >
                <defs>
                  <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="50%" stopColor="#22c55e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                    <stop offset="50%" stopColor="#ef4444" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="veryStrongGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity={0.2}/>
                  </filter>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  className="opacity-20" 
                  stroke="#94a3b8"
                />
                <XAxis 
                  dataKey="country" 
                  tick={{ fontSize: 13, fontWeight: 500 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#64748b"
                />
                <YAxis 
                  domain={[-1, 1]} 
                  tick={{ fontSize: 12 }}
                  label={{ 
                    value: 'Correlation Coefficient', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 13, fontWeight: 500, fill: '#64748b' }
                  }}
                  stroke="#64748b"
                  axisLine={{ stroke: '#94a3b8' }}
                />
                <Tooltip 
                  content={<EnhancedCorrelationTooltip />} 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar 
                  dataKey="correlation" 
                  radius={[16, 16, 0, 0]}
                  className="transition-all duration-500 ease-out hover:opacity-90"
                  filter="url(#glow)"
                  animationBegin={0}
                  animationDuration={1500}
                  animationEasing="ease-out"
                >
                  {correlations.map((entry, index) => {
                    const abs = Math.abs(entry.correlation);
                    let gradient = 'url(#positiveGradient)';
                    if (entry.correlation < 0) {
                      gradient = 'url(#negativeGradient)';
                    } else if (abs > 0.8) {
                      gradient = 'url(#veryStrongGradient)';
                    }
                    
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={gradient}
                        className="hover:brightness-110 transition-all duration-300 cursor-pointer"
                        style={{
                          animationDelay: `${index * 100}ms`
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Correlation Analysis */}
      <Card className="hover-lift">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Advanced Correlation Analysis with NIFTY 50
          </CardTitle>
          <p className="text-sm text-muted-foreground">Sorted by correlation strength with influence assessment</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {correlations.map((corr, idx) => {
              const strength = getStrengthLabel(corr);
              const isPositive = corr.correlation > 0;
              
              return (
                <div key={corr.market} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{corr.country}</span>
                      <span className="text-sm text-muted-foreground">({corr.market})</span>
                    </div>
                    {corr.influence && (
                      <Badge variant="outline" className="text-xs">
                        {corr.influence}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{corr.correlation.toFixed(3)}
                      </div>
                      <Badge className={strength.color}>
                        {strength.label}
                      </Badge>
                    </div>
                    
                    {corr.lag && corr.lag > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{corr.lag}d lag</span>
                        {corr.bestCorrelation && (
                          <div>Best: {corr.bestCorrelation > 0 ? '+' : ''}{corr.bestCorrelation.toFixed(3)}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Price Movement Chart */}
      <Card className="hover-lift">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Price Movement Comparison (30 Days)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Normalized percentage change from starting value</p>
        </CardHeader>
        <CardContent>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={getChartData()}>
                <defs>
                  {marketData.map((market, idx) => (
                    <linearGradient key={market.country} id={`gradient-${market.country}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {marketData.map((market, idx) => (
                  <Area
                    key={market.country}
                    type="monotone"
                    dataKey={market.country}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    fill={`url(#gradient-${market.country})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insight Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {correlations.map((corr, idx) => {
          const strength = getStrengthLabel(corr);
          const isPositive = corr.correlation > 0;
          
          return (
            <Card key={corr.market} className="hover-lift" style={{ animationDelay: `${idx * 50}ms` }}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {isPositive ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{corr.country}</h3>
                    <p className="text-xs text-muted-foreground">{corr.market}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">NIFTY</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{corr.country}</span>
                  </div>
                  <Badge className={strength.color}>
                    {strength.label}
                  </Badge>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">
                    {corr.influence === 'Dominant Driver' && (
                      <><strong>{corr.country}</strong> is a dominant driver of Indian market movements. {isPositive ? 'Positive trends strongly influence NIFTY performance.' : 'Inverse relationship significantly impacts Indian market direction.'}</>
                    )}
                    {corr.influence === 'Major Influence' && (
                      <><strong>{corr.country}</strong> has major influence on Indian markets. {isPositive ? 'Coordinated movements are common.' : 'Counter-cyclical patterns affect trading strategies.'}</>
                    )}
                    {corr.influence === 'Strong Influence' && (
                      <><strong>{corr.country}</strong> shows strong correlation with NIFTY. {isPositive ? 'Markets generally move together.' : 'Opposite movements provide diversification opportunities.'}</>
                    )}
                    {corr.influence === 'Moderate Impact' && (
                      <><strong>{corr.country}</strong> has moderate impact on Indian markets. {isPositive ? 'Some alignment in market movements.' : 'Partial inverse relationship observed.'}</>
                    )}
                    {corr.influence === 'Notable Correlation' && (
                      <><strong>{corr.country}</strong> shows notable correlation. {isPositive ? 'Occasional coordinated movements.' : 'Some inverse patterns detected.'}</>
                    )}
                    {(!corr.influence || corr.influence === 'Limited Impact') && (
                      <><strong>{corr.country}</strong> has limited direct impact on NIFTY. {isPositive ? 'Weak positive correlation observed.' : 'Minimal inverse relationship.'}</>
                    )}
                    {corr.lag && corr.lag > 0 && (
                      <span className="block mt-2 text-xs">Note: {corr.lag}-day lag effect detected for optimal correlation.</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
