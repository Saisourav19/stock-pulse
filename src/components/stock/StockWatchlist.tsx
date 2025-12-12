import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, TrendingDown, List, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StockData {
  symbol: string;
  price: number;
  change_percent: number;
  currency: string;
  name?: string;
}

interface StockWatchlistProps {
  symbols: string[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
}

export const StockWatchlist = ({
  symbols,
  selectedSymbol,
  onSelectSymbol,
  onRemoveSymbol,
}: StockWatchlistProps) => {
  const [stockData, setStockData] = useState<Record<string, StockData>>({});

  useEffect(() => {
    const fetchPrices = async () => {
      for (const symbol of symbols) {
        try {
          const { data, error } = await supabase
            .from("price_snapshots")
            .select("*")
            .eq("symbol", symbol)
            .order("timestamp", { ascending: false })
            .limit(1)
            .single();

          if (data && !error) {
            setStockData((prev) => ({
              ...prev,
              [symbol]: {
                symbol: data.symbol,
                price: data.price,
                change_percent: data.change_percent || 0,
                currency: data.currency || "USD",
                name: (data.metadata as any)?.name || symbol,
              },
            }));
          }
        } catch (error) {
          console.error(`Error fetching price for ${symbol}:`, error);
        }
      }
    };

    fetchPrices();

    const channel = supabase
      .channel("price_updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "price_snapshots" },
        (payload) => {
          const newData = payload.new as any;
          if (symbols.includes(newData.symbol)) {
            setStockData((prev) => ({
              ...prev,
              [newData.symbol]: {
                symbol: newData.symbol,
                price: newData.price,
                change_percent: newData.change_percent || 0,
                currency: newData.currency || "USD",
                name: newData.metadata?.name || newData.symbol,
              },
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [symbols]);

  if (symbols.length === 0) {
    return (
      <Card className="hover-lift">
        <CardContent className="py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <List className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No stocks in watchlist</p>
          <p className="text-sm text-muted-foreground mt-1">Add a symbol to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-lift">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <List className="h-5 w-5 text-primary" />
          Your Watchlist
          <Badge variant="secondary" className="ml-auto">{symbols.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {symbols.map((symbol) => {
          const data = stockData[symbol];
          const isSelected = selectedSymbol === symbol;
          const isPositive = data?.change_percent >= 0;

          return (
            <div
              key={symbol}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-all duration-200 border",
                isSelected 
                  ? "bg-primary/10 border-primary/30 shadow-sm" 
                  : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border"
              )}
              onClick={() => onSelectSymbol(symbol)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{symbol}</h3>
                    {data?.change_percent !== undefined && (
                      <div className={cn(
                        "p-1 rounded-full",
                        isPositive ? "bg-green-500/10" : "bg-red-500/10"
                      )}>
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {data ? (
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold">
                        {data.currency === "INR" ? "₹" : "$"}{data.price.toFixed(2)}
                      </span>
                      <span className={cn(
                        "text-sm font-medium",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}>
                        {isPositive ? "+" : ""}{data.change_percent.toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSymbol(symbol);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
