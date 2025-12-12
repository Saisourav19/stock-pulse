import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useStockWorker = (symbol: string | null) => {
  const workerRef = useRef<{price?: number, newsSentiment?: number}>({});

  useEffect(() => {
    if (!symbol) return;

    const startWorkers = async () => {
      try {
        // Start price worker (runs for 60 seconds)
        if (!workerRef.current.price) {
          supabase.functions.invoke('stock-worker', {
            body: { symbol, action: 'price' }
          }).then(() => {
            workerRef.current.price = undefined;
          });
          workerRef.current.price = Date.now();
        }

        // Start news-sentiment worker (runs once every 60 seconds)
        if (!workerRef.current.newsSentiment || Date.now() - workerRef.current.newsSentiment > 60000) {
          supabase.functions.invoke('stock-worker', {
            body: { symbol, action: 'news-sentiment' }
          }).then(() => {
            workerRef.current.newsSentiment = Date.now();
          });
        }
      } catch (error) {
        console.error('Error starting workers:', error);
      }
    };

    // Start immediately
    startWorkers();

    // Restart price worker every 60 seconds
    const priceInterval = setInterval(startWorkers, 60000);

    return () => {
      clearInterval(priceInterval);
    };
  }, [symbol]);
};