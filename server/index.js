import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket server attached to HTTP server
const wss = new WebSocketServer({ noServer: true });

// Store WebSocket connections by channel
const channels = new Map();

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  if (url.startsWith('/ws/')) {
    const channelName = url.split('/').pop();
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, channelName);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request, channelName) => {
  if (!channels.has(channelName)) {
    channels.set(channelName, new Set());
  }
  channels.get(channelName).add(ws);
  
  console.log(`Client connected to channel: ${channelName}`);
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.action === 'subscribe') {
      console.log(`Client subscribed to ${data.event} in channel ${channelName}`);
    } else if (data.action === 'unsubscribe') {
      console.log(`Client unsubscribed from channel ${channelName}`);
    }
  });
  
  ws.on('close', () => {
    channels.get(channelName)?.delete(ws);
    if (channels.get(channelName)?.size === 0) {
      channels.delete(channelName);
    }
    console.log(`Client disconnected from channel: ${channelName}`);
  });
});

// Function to broadcast to a channel
function broadcastToChannel(channelName, event, data) {
  const channelConnections = channels.get(channelName);
  if (channelConnections) {
    const message = JSON.stringify({ event, data });
    channelConnections.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Mock data for testing
const mockStockData = {
  'AAPL': { price: 189.50, change: 2.30, changePercent: 1.23 },
  'GOOGL': { price: 142.80, change: -0.50, changePercent: -0.35 },
  'MSFT': { price: 378.90, change: 5.10, changePercent: 1.36 }
};

const mockSentimentData = {
  'AAPL': { sentiment: 'positive', score: 0.75, confidence: 0.82 },
  'GOOGL': { sentiment: 'neutral', score: 0.52, confidence: 0.71 },
  'MSFT': { sentiment: 'positive', score: 0.68, confidence: 0.78 }
};

// API Routes for all the Supabase functions
app.post('/api/functions/sentiment-factors', async (req, res) => {
  const { symbol } = req.body;
  console.log('Sentiment factors request:', symbol);
  
  // Mock response with correct structure
  const responseData = {
    success: true,
    data: {
      factors: [
        { name: 'news_sentiment', score: 75, impact: 'Positive news coverage driving market optimism', articles: 45 },
        { name: 'social_media', score: 68, impact: 'Mixed social sentiment with bullish trends', articles: 120 },
        { name: 'technical_indicators', score: 82, impact: 'Strong technical signals supporting upward movement', articles: 30 },
        { name: 'market_conditions', score: 45, impact: 'Challenging macro environment affecting sentiment', articles: 25 },
        { name: 'foreign_investment', score: 71, impact: 'Increased foreign inflows boosting confidence', articles: 15 },
        { name: 'corporate_earnings', score: 88, impact: 'Better than expected earnings results', articles: 35 }
      ],
      overall: {
        score: 72,
        sentiment: 'Bullish',
        totalArticles: 270
      }
    }
  };
  
  res.json(responseData);
});

app.post('/api/functions/predict-sentiment', async (req, res) => {
  const { symbol, timeframe, includeHistory } = req.body;
  console.log('Predict sentiment request:', symbol, timeframe, includeHistory);
  
  // Mock response with proper structure
  const responseData = {
    symbol: symbol || 'AAPL',
    prediction: 'bullish',
    confidence: 0.78,
    riskLevel: 'low',
    sentimentMomentum: 'increasing',
    shortTermOutlook: 'positive',
    mediumTermOutlook: 'bullish',
    keyFactors: ['strong earnings', 'positive news flow', 'technical breakout'],
    livePrice: { price: 189.50, change: 2.30 },
    accuracyStats: {
      totalPredictions: 150,
      verifiedPredictions: 120,
      accuratePredictions: 92,
      accuracyRate: 0.767,
      avgConfidence: 0.75,
      byType: {
        bullish: { total: 60, correct: 48 },
        bearish: { total: 45, correct: 32 },
        neutral: { total: 45, correct: 35 }
      }
    },
    predictionHistory: includeHistory ? [
      {
        id: '1',
        prediction: 'bullish',
        confidence: 0.82,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        was_accurate: true,
        actual_outcome: 'bullish',
        price_at_prediction: 185.20,
        price_change_percent: 2.3
      },
      {
        id: '2',
        prediction: 'neutral',
        confidence: 0.65,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        was_accurate: true,
        actual_outcome: 'neutral',
        price_at_prediction: 183.50,
        price_change_percent: 0.9
      }
    ] : [],
    generatedAt: new Date().toISOString(),
    source: 'AI Model'
  };
  
  res.json(responseData);
});

app.post('/api/functions/market-correlation', async (req, res) => {
  const { symbols } = req.body;
  console.log('Market correlation request:', symbols);
  
  // Mock response
  res.json({
    correlations: [
      { symbol1: 'AAPL', symbol2: 'MSFT', correlation: 0.73 },
      { symbol1: 'AAPL', symbol2: 'GOOGL', correlation: 0.65 },
      { symbol1: 'MSFT', symbol2: 'GOOGL', correlation: 0.71 }
    ]
  });
});

app.post('/api/functions/global-sentiment', async (req, res) => {
  console.log('Global sentiment request');
  
  // Mock response
  res.json({
    overall_sentiment: 'positive',
    score: 0.62,
    regions: {
      'US': { sentiment: 'positive', score: 0.68 },
      'EU': { sentiment: 'neutral', score: 0.52 },
      'ASIA': { sentiment: 'positive', score: 0.71 }
    }
  });
});

app.post('/api/functions/company-sentiment', async (req, res) => {
  const { company } = req.body;
  console.log('Company sentiment request:', company);
  
  // Mock response
  res.json({
    company: company,
    sentiment: 'positive',
    score: 0.74,
    articles: [
      { title: 'Strong Q3 Earnings', sentiment: 'positive', source: 'Reuters' },
      { title: 'New Product Launch', sentiment: 'positive', source: 'TechCrunch' },
      { title: 'Market Share Gains', sentiment: 'positive', source: 'WSJ' }
    ]
  });
});

app.post('/api/functions/stock-worker', async (req, res) => {
  const { action, symbols } = req.body;
  console.log('Stock worker request:', action, symbols);
  
  // Mock response
  res.json({
    status: 'completed',
    processed: symbols?.length || 0,
    results: symbols?.map(symbol => ({
      symbol,
      price: mockStockData[symbol]?.price || Math.random() * 200,
      sentiment: mockSentimentData[symbol]?.sentiment || 'neutral'
    })) || []
  });
});

app.post('/api/functions/live-data-fetcher', async (req, res) => {
  const { symbols } = req.body;
  console.log('Live data fetcher request:', symbols);
  
  // Mock response
  res.json({
    data: symbols?.map(symbol => ({
      symbol,
      price: mockStockData[symbol]?.price || Math.random() * 200,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString()
    })) || []
  });
});

app.post('/api/functions/real-time-predictor', async (req, res) => {
  const { symbol } = req.body;
  console.log('Real-time predictor request:', symbol);
  
  // Mock response
  res.json({
    symbol,
    prediction: 'bullish',
    confidence: 0.81,
    timeframe: '1h',
    signals: ['RSI oversold', 'Volume spike', 'Price support']
  });
});

app.post('/api/functions/advanced-sentiment', async (req, res) => {
  const { symbol, analysis_type } = req.body;
  console.log('Advanced sentiment request:', symbol, analysis_type);
  
  // Mock response
  res.json({
    symbol,
    analysis_type,
    sentiment_score: 0.73,
    emotional_tone: 'optimistic',
    key_topics: ['earnings', 'innovation', 'market leadership'],
    confidence: 0.79
  });
});

app.post('/api/functions/auto-update', async (req, res) => {
  console.log('Auto update request');
  
  // Mock response
  res.json({
    status: 'success',
    updated_symbols: ['AAPL', 'GOOGL', 'MSFT'],
    last_update: new Date().toISOString()
  });
});

app.post('/api/functions/batch-verify', async (req, res) => {
  const { predictions } = req.body;
  console.log('Batch verify request:', predictions?.length, 'predictions');
  
  // Mock response with proper structure
  const mockPredictions = predictions || [
    { id: '1', prediction: 'bullish', confidence: 0.82 },
    { id: '2', prediction: 'bearish', confidence: 0.75 },
    { id: '3', prediction: 'neutral', confidence: 0.68 }
  ];
  
  const responseData = {
    verified: mockPredictions.length,
    accuracy: 0.76,
    results: mockPredictions.map(pred => ({
      ...pred,
      actual: Math.random() > 0.5 ? 'positive' : 'negative',
      correct: Math.random() > 0.3,
      price_at_prediction: 180 + Math.random() * 20,
      price_change_percent: (Math.random() - 0.5) * 5,
      was_accurate: Math.random() > 0.3
    }))
  };
  
  res.json(responseData);
});

// Database-like endpoints for CRUD operations
app.get('/api/price_alerts', async (req, res) => {
  res.json([]);
});

app.post('/api/price_alerts', async (req, res) => {
  const alert = req.body;
  console.log('Create price alert:', alert);
  res.json({ id: Date.now(), ...alert });
});

app.put('/api/price_alerts', async (req, res) => {
  const { data, match } = req.body;
  console.log('Update price alert:', match, data);
  res.json({ ...match, ...data });
});

app.delete('/api/price_alerts', async (req, res) => {
  console.log('Delete price alert:', req.body);
  res.json({ success: true });
});

// Start server
server.listen(PORT, () => {
  console.log(`Stock Pulse API server running on port ${PORT}`);
  console.log(`WebSocket server integrated with HTTP server`);
});

// Simulate real-time data updates
setInterval(() => {
  // Broadcast random price updates
  const symbols = Object.keys(mockStockData);
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  const priceChange = (Math.random() - 0.5) * 2;
  
  mockStockData[randomSymbol].price += priceChange;
  mockStockData[randomSymbol].change = priceChange;
  mockStockData[randomSymbol].changePercent = (priceChange / mockStockData[randomSymbol].price) * 100;
  
  broadcastToChannel('price_updates', 'price_change', {
    symbol: randomSymbol,
    ...mockStockData[randomSymbol]
  });
}, 5000);
