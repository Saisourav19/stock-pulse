import { useState } from "react";
import { StockWatchlist } from "@/components/stock/StockWatchlist";
import { StockDetail } from "@/components/stock/StockDetail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, TrendingUp, BarChart3, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'RELIANCE.NS', name: 'Reliance' },
  { symbol: 'TCS.NS', name: 'TCS' },
];

const Index = () => {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAddSymbol = async (symbol?: string) => {
    const sym = (symbol || searchSymbol.trim()).toUpperCase();
    
    if (!sym) {
      toast({
        title: "Error",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }

    if (watchedSymbols.includes(sym)) {
      setSelectedSymbol(sym);
      toast({
        title: "Already watching",
        description: `${sym} is already in your watchlist`,
      });
      return;
    }

    setWatchedSymbols([...watchedSymbols, sym]);
    setSelectedSymbol(sym);
    setSearchSymbol("");
    
    toast({
      title: "Symbol added",
      description: `Now tracking ${sym}`,
    });
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchedSymbols(watchedSymbols.filter((s) => s !== symbol));
    if (selectedSymbol === symbol) {
      setSelectedSymbol(null);
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center glow">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Stock Watchlist & Analysis</h1>
            <p className="text-muted-foreground">Track stocks and analyze sentiment in real-time</p>
          </div>
        </div>

        {/* Search Card */}
        <Card className="hover-lift">
          <CardContent className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleAddSymbol(); }} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter stock symbol (e.g., AAPL, TCS.NS, RELIANCE.NS)"
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <Button type="submit" size="lg" className="gradient-primary text-white gap-2">
                <Plus className="h-5 w-5" />
                Add to Watchlist
              </Button>
            </form>
            
            {/* Popular Symbols */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Popular:</span>
              {POPULAR_SYMBOLS.map((item) => (
                <Badge 
                  key={item.symbol}
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                  onClick={() => handleAddSymbol(item.symbol)}
                >
                  {item.symbol}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist */}
        <div className="lg:col-span-1">
          <StockWatchlist
            symbols={watchedSymbols}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={handleSelectSymbol}
            onRemoveSymbol={handleRemoveSymbol}
          />
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedSymbol ? (
            <div className="animate-fade-in">
              <StockDetail symbol={selectedSymbol} />
            </div>
          ) : (
            <Card className="hover-lift h-full min-h-[500px]">
              <CardContent className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="relative mb-6">
                  <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center">
                    <TrendingUp className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full gradient-primary flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">No Stock Selected</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Add a stock to your watchlist or select one to view detailed sentiment analysis, 
                  price data, and AI-powered predictions.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {POPULAR_SYMBOLS.slice(0, 3).map((item) => (
                    <Button 
                      key={item.symbol}
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                      onClick={() => handleAddSymbol(item.symbol)}
                    >
                      {item.name}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
