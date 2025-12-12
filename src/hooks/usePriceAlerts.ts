import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_value: number;
  is_active: boolean;
}

export const usePriceAlerts = (symbol: string | null) => {
  const alertsRef = useRef<Alert[]>([]);
  const lastPriceRef = useRef<number | null>(null);
  const triggeredAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!symbol) return;

    // Fetch alerts for this symbol
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("price_alerts")
        .select("*")
        .eq("symbol", symbol)
        .eq("is_active", true);

      if (data) {
        alertsRef.current = data;
      }
    };

    fetchAlerts();

    // Subscribe to price updates
    const channel = supabase
      .channel(`price_alerts_${symbol}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_snapshots",
          filter: `symbol=eq.${symbol}`,
        },
        (payload) => {
          const newData = payload.new as any;
          checkAlerts(newData.price, newData.change_percent || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [symbol]);

  const checkAlerts = async (currentPrice: number, changePercent: number) => {
    for (const alert of alertsRef.current) {
      // Skip if already triggered
      if (triggeredAlertsRef.current.has(alert.id)) continue;

      let triggered = false;
      let message = "";

      switch (alert.alert_type) {
        case "price_above":
          if (currentPrice >= alert.target_value) {
            triggered = true;
            message = `${alert.symbol} is now above ${alert.target_value.toFixed(2)}!`;
          }
          break;
        case "price_below":
          if (currentPrice <= alert.target_value) {
            triggered = true;
            message = `${alert.symbol} is now below ${alert.target_value.toFixed(2)}!`;
          }
          break;
        case "percent_change_up":
          if (changePercent >= alert.target_value) {
            triggered = true;
            message = `${alert.symbol} is up ${changePercent.toFixed(2)}%!`;
          }
          break;
        case "percent_change_down":
          if (changePercent <= -alert.target_value) {
            triggered = true;
            message = `${alert.symbol} is down ${Math.abs(changePercent).toFixed(2)}%!`;
          }
          break;
      }

      if (triggered) {
        // Mark alert as triggered
        triggeredAlertsRef.current.add(alert.id);

        // Update alert in database
        await supabase
          .from("price_alerts")
          .update({ triggered_at: new Date().toISOString() })
          .eq("id", alert.id);

        // Show notification
        toast({
          title: "🔔 Price Alert Triggered!",
          description: message,
          duration: 10000,
        });

        // Request browser notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Price Alert", {
            body: message,
            icon: "/favicon.ico",
          });
        }
      }
    }
  };

  return null;
};
