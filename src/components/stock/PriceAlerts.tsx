import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Allowed alert types
const ALLOWED_ALERT_TYPES = ['price_above', 'price_below', 'percent_change_up', 'percent_change_down'] as const;

// Validation schema for price alerts
const priceAlertSchema = z.object({
  target_value: z.number()
    .positive({ message: "Value must be positive" })
    .max(10000000, { message: "Value must be less than 10,000,000" }),
  alert_type: z.enum(ALLOWED_ALERT_TYPES, { 
    errorMap: () => ({ message: "Invalid alert type" }) 
  }),
});

// Additional validation for percentage alerts
const percentageAlertSchema = priceAlertSchema.extend({
  target_value: z.number()
    .positive({ message: "Percentage must be positive" })
    .max(100, { message: "Percentage must be 100 or less" }),
});

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_value: number;
  is_active: boolean;
  created_at: string;
}

interface PriceAlertsProps {
  symbol: string;
  currentPrice: number;
}

export const PriceAlerts = ({ symbol, currentPrice }: PriceAlertsProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertType, setAlertType] = useState<string>("price_above");
  const [targetValue, setTargetValue] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [symbol]);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("symbol", symbol)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAlerts(data);
    }
  };

  const validateAlert = (type: string, value: number): { success: boolean; error?: string } => {
    try {
      // Use percentage schema for percent-based alerts
      const isPercentage = type.includes('percent');
      const schema = isPercentage ? percentageAlertSchema : priceAlertSchema;
      
      schema.parse({
        target_value: value,
        alert_type: type,
      });
      
      return { success: true };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return { success: false, error: err.errors[0]?.message || "Invalid input" };
      }
      return { success: false, error: "Validation failed" };
    }
  };

  const addAlert = async () => {
    setValidationError(null);
    
    const parsedValue = parseFloat(targetValue);
    
    // Validate with zod schema
    const validation = validateAlert(alertType, parsedValue);
    
    if (!validation.success) {
      setValidationError(validation.error || "Invalid input");
      toast({
        title: "Validation Error",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    // Request notification permission if not already granted
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    const { error } = await supabase.from("price_alerts").insert({
      symbol,
      alert_type: alertType,
      target_value: parseFloat(targetValue),
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add alert",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Alert added",
        description: "You'll be notified when the target is reached",
      });
      setTargetValue("");
      setIsAdding(false);
      fetchAlerts();
    }
  };

  const deleteAlert = async (id: string) => {
    const { error } = await supabase
      .from("price_alerts")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete alert",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Alert deleted",
      });
      fetchAlerts();
    }
  };

  const getAlertLabel = (alert: Alert) => {
    switch (alert.alert_type) {
      case "price_above":
        return `Price rises above ${alert.target_value.toFixed(2)}`;
      case "price_below":
        return `Price drops below ${alert.target_value.toFixed(2)}`;
      case "percent_change_up":
        return `Price increases by ${alert.target_value.toFixed(2)}%`;
      case "percent_change_down":
        return `Price decreases by ${alert.target_value.toFixed(2)}%`;
      default:
        return "";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Price Alerts</h3>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          variant={isAdding ? "outline" : "default"}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Alert
        </Button>
      </div>

      {isAdding && (
        <Card className="p-4 mb-4 bg-muted/50">
          <div className="space-y-3">
            <Select value={alertType} onValueChange={setAlertType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_above">Price rises above</SelectItem>
                <SelectItem value="price_below">Price drops below</SelectItem>
                <SelectItem value="percent_change_up">% increase</SelectItem>
                <SelectItem value="percent_change_down">% decrease</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={alertType.includes("percent") ? "100" : "10000000"}
              placeholder={
                alertType.includes("percent") ? "Enter percentage (1-100)" : "Enter price"
              }
              value={targetValue}
              onChange={(e) => {
                setTargetValue(e.target.value);
                setValidationError(null);
              }}
              className={validationError ? "border-destructive" : ""}
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={addAlert} className="flex-1">
                Add Alert
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No active alerts. Create one to get notified!
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm">{getAlertLabel(alert)}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteAlert(alert.id)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
