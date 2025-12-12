import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveDataConfig {
  symbols: Array<{ symbol: string; companyName: string }>;
  updateInterval?: number; // in milliseconds
  includeNews?: boolean;
  enablePredictions?: boolean;
}

interface LiveDataState {
  stockData: Record<string, any>;
  newsData: Record<string, any[]>;
  predictionData: Record<string, any>;
  sentimentData: Record<string, any>;
  lastUpdate: string;
  isLive: boolean;
  error: string | null;
}

export function useLiveData(config: LiveDataConfig) {
  const [state, setState] = useState<LiveDataState>({
    stockData: {},
    newsData: {},
    predictionData: {},
    sentimentData: {},
    lastUpdate: new Date().toISOString(),
    isLive: false,
    error: null
  });

  const {
    symbols,
    updateInterval = 30000, // 30 seconds default
    includeNews = true,
    enablePredictions = true
  } = config;

  // Fetch live stock prices and news
  const fetchLiveData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, isLive: true }));

      // Fetch live data
      const { data, error } = await supabase.functions.invoke('live-data-fetcher', {
        body: {
          symbols: symbols.map(s => ({ symbol: s.symbol, companyName: s.companyName })),
          includeNews
        }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const newStockData: Record<string, any> = {};
        const newNewsData: Record<string, any[]> = {};

        data.data.forEach((item: any) => {
          if (item.stockData) {
            newStockData[item.symbol] = item.stockData;
          }
          if (item.newsData && item.newsData.length > 0) {
            newNewsData[item.symbol] = item.newsData;
          }
        });

        setState(prev => ({
          ...prev,
          stockData: { ...prev.stockData, ...newStockData },
          newsData: { ...prev.newsData, ...newNewsData },
          lastUpdate: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error fetching live data:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch live data',
        isLive: false
      }));
    }
  }, [symbols, includeNews]);

  // Fetch predictions
  const fetchPredictions = useCallback(async () => {
    if (!enablePredictions) return;

    try {
      const newPredictionData: Record<string, any> = {};

      for (const { symbol } of symbols) {
        const { data, error } = await supabase.functions.invoke('real-time-predictor', {
          body: { symbol }
        });

        if (!error && data?.success && data?.data) {
          newPredictionData[symbol] = data.data;
        }
      }

      setState(prev => ({
        ...prev,
        predictionData: { ...prev.predictionData, ...newPredictionData }
      }));
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
  }, [symbols, enablePredictions]);

  // Fetch advanced sentiment
  const fetchSentiment = useCallback(async () => {
    try {
      const newSentimentData: Record<string, any> = {};

      for (const { symbol } of symbols) {
        const { data, error } = await supabase.functions.invoke('advanced-sentiment', {
          body: { symbol }
        });

        if (!error && data?.success && data?.data) {
          newSentimentData[symbol] = data.data;
        }
      }

      setState(prev => ({
        ...prev,
        sentimentData: { ...prev.sentimentData, ...newSentimentData }
      }));
    } catch (error) {
      console.error('Error fetching sentiment:', error);
    }
  }, [symbols]);

  // Initial data fetch
  useEffect(() => {
    fetchLiveData();
    fetchPredictions();
    fetchSentiment();
  }, [fetchLiveData, fetchPredictions, fetchSentiment]);

  // Set up live updates
  useEffect(() => {
    if (!updateInterval || updateInterval <= 0) return;

    const stockInterval = setInterval(() => {
      fetchLiveData();
    }, updateInterval);

    const predictionInterval = setInterval(() => {
      fetchPredictions();
    }, updateInterval * 2); // Predictions update less frequently

    const sentimentInterval = setInterval(() => {
      fetchSentiment();
    }, updateInterval * 3); // Sentiment updates even less frequently

    return () => {
      clearInterval(stockInterval);
      clearInterval(predictionInterval);
      clearInterval(sentimentInterval);
    };
  }, [updateInterval, fetchLiveData, fetchPredictions, fetchSentiment]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchLiveData();
    fetchPredictions();
    fetchSentiment();
  }, [fetchLiveData, fetchPredictions, fetchSentiment]);

  // Get specific symbol data
  const getSymbolData = useCallback((symbol: string) => ({
    stock: state.stockData[symbol],
    news: state.newsData[symbol] || [],
    prediction: state.predictionData[symbol],
    sentiment: state.sentimentData[symbol]
  }), [state]);

  // Check if data is fresh (updated within last 2 minutes)
  const isDataFresh = useCallback(() => {
    const lastUpdate = new Date(state.lastUpdate);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return lastUpdate > twoMinutesAgo;
  }, [state.lastUpdate]);

  return {
    ...state,
    refresh,
    getSymbolData,
    isDataFresh,
    fetchLiveData,
    fetchPredictions,
    fetchSentiment
  };
}

// Hook for single symbol live data
export function useSymbolLiveData(symbol: string, companyName: string, options?: {
  updateInterval?: number;
  includeNews?: boolean;
  enablePredictions?: boolean;
}) {
  const liveData = useLiveData({
    symbols: [{ symbol, companyName }],
    ...options
  });

  const symbolData = liveData.getSymbolData(symbol);

  return {
    ...symbolData,
    isLoading: !symbolData.stock && !liveData.error,
    lastUpdate: liveData.lastUpdate,
    isLive: liveData.isLive,
    error: liveData.error,
    refresh: liveData.refresh,
    isDataFresh: liveData.isDataFresh
  };
}
