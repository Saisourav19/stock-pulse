import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Activity, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateStatus {
  lastUpdate: string | null;
  updateCount: number;
  isActive: boolean;
}

export function RealtimeUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({
    lastUpdate: null,
    updateCount: 0,
    isActive: false
  });
  const [loading, setLoading] = useState(false);

  // Trigger automatic update
  const triggerAutoUpdate = async () => {
    setLoading(true);
    setStatus(prev => ({ ...prev, isActive: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('auto-update');
      
      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success(`Auto-update completed! Updated ${data.updated} symbols`);
        setStatus(prev => ({
          ...prev,
          lastUpdate: new Date().toISOString(),
          updateCount: prev.updateCount + 1,
          isActive: false
        }));
      } else {
        throw new Error(data.error || 'Auto-update failed');
      }
    } catch (error) {
      console.error('Auto-update error:', error);
      toast.error(error instanceof Error ? error.message : 'Auto-update failed');
      setStatus(prev => ({ ...prev, isActive: false }));
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for prediction changes
  useEffect(() => {
    const subscription = supabase
      .channel('prediction_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_history'
        },
        (payload) => {
          console.log('Database change detected:', payload);
          toast.info('New prediction data detected');
          setStatus(prev => ({
            ...prev,
            lastUpdate: new Date().toISOString(),
            updateCount: prev.updateCount + 1
          }));
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  // Auto-trigger update every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      triggerAutoUpdate();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" />
          Real-time Data Updater
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`h-4 w-4 ${status.isActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">
              Status: {status.isActive ? 'Updating...' : 'Idle'}
            </span>
          </div>
          <Badge variant={status.isActive ? 'default' : 'secondary'}>
            {status.updateCount} updates
          </Badge>
        </div>

        {status.lastUpdate && (
          <div className="text-xs text-muted-foreground">
            Last update: {new Date(status.lastUpdate).toLocaleString()}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={triggerAutoUpdate} 
            disabled={loading || status.isActive}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Updating...' : 'Update Now'}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <strong>Auto-update features:</strong>
          <ul className="mt-1 space-y-1">
            <li>• Fetches live market prices every 5 minutes</li>
            <li>• Generates new predictions automatically</li>
            <li>• Verifies old predictions with real data</li>
            <li>• Real-time database change monitoring</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
