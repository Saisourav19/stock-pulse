// Custom API Client to replace Supabase
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://your-real-server.com/api';
    this.apiKey = import.meta.env.VITE_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || `HTTP error! status: ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  // Replace supabase.functions.invoke()
  async invokeFunction<T = any>(functionName: string, payload?: any): Promise<{ data: T | null; error: string | null }> {
    // DIRECT SUPABASE EDGE FUNCTION CALL
    // Bypassing localhost:3001 to use the deployed cloud functions directly
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `${supabaseUrl}/functions/v1/${functionName}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify(payload || {}),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: data.error || `Error ${response.status}` };
      }
      return { data: data, error: null };
    } catch (e: any) {
      console.error(`Edge Function ${functionName} failed:`, e);
      return { data: null, error: e.message };
    }
  }

  // Replace supabase.from() for basic CRUD operations
  async from<T>(table: string) {
    return {
      select: async (columns = '*') => {
        return this.request<T[]>(`/${table}?select=${columns}`);
      },
      insert: async (data: Partial<T>) => {
        return this.request<T>(`/${table}`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      update: async (data: Partial<T>, match: any) => {
        return this.request<T>(`/${table}`, {
          method: 'PUT',
          body: JSON.stringify({ data, match }),
        });
      },
      delete: async (match: any) => {
        return this.request<any>(`/${table}`, {
          method: 'DELETE',
          body: JSON.stringify(match),
        });
      },
    };
  }

  // WebSocket connection for real-time updates
  createChannel(channelName: string) {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/${channelName}`);

    return {
      on: (event: string, callback: (payload: any) => void) => {
        if (event === 'postgres_changes') {
          // Handle Supabase-style event names
          ws.addEventListener('message', (messageEvent) => {
            const payload = JSON.parse(messageEvent.data);
            callback(payload);
          });
        } else {
          ws.addEventListener(event, callback);
        }
      },
      subscribe: (event: string, callback: (payload: any) => void) => {
        ws.send(JSON.stringify({ action: 'subscribe', event }));
        ws.addEventListener('message', (messageEvent) => {
          const payload = JSON.parse(messageEvent.data);
          if (payload.event === event) {
            callback(payload);
          }
        });
      },
      unsubscribe: () => {
        ws.send(JSON.stringify({ action: 'unsubscribe' }));
        ws.close();
      },
    };
  }

  // Method to remove channels (for compatibility)
  removeChannel(channel: any) {
    channel.unsubscribe();
  }

  // Alias for createChannel (Supabase compatibility)
  channel(channelName: string) {
    return this.createChannel(channelName);
  }
}

export const apiClient = new ApiClient();

// Export as supabase for easy migration
export const supabase = apiClient;
