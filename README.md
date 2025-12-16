# Stock Pulse - Real-Time Stock Market Sentiment Analysis

A comprehensive stock market analysis platform that provides real-time sentiment predictions using live data from premium sources.

## 🔥 Key Features

- **Real-Time Stock Prices**: Live price data from Yahoo Finance and Alpha Vantage
- **AI-Powered Predictions**: Sentiment analysis using GPT-4 or algorithmic models
- **Automated Verification**: Predictions are automatically verified after 12 hours
- **News Aggregation**: Fetches news from 13+ real sources (Reuters, Bloomberg, Google News, etc.)
- **Prediction Accuracy Tracking**: Historical performance metrics with detailed verification

## 📊 Data Sources (100% REAL)

### Stock Prices
- **Primary**: [Yahoo Finance API](https://finance.yahoo.com)
- **Premium**: [Alpha Vantage](https://www.alphavantage.co/) (with API key)
- **Verification**: Live price fetching with multiple fallback sources

### News Sources (13+ RSS Feeds)
- Google News Finance & Business
- Yahoo Finance
- Reuters Markets & Business
- MarketWatch
- CNBC Markets
- Bloomberg Markets
- Financial Times
- The Economic Times
- MoneyControl
- Business Standard
- Seeking Alpha

### AI Analysis
- **Primary**: OpenAI GPT-4 (with API key)
- **Fallback**: Advanced algorithmic analysis based on sentiment trends and price momentum

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **APIs**: OpenAI, Yahoo Finance, Alpha Vantage (optional)

## 📁 Project Structure

```
stock-pulse/
├── src/                          # Frontend React application
│   ├── pages/                    # Main application pages
│   │   ├── PredictionAccuracy.tsx  # Prediction history & accuracy tracking
│   │   └── Index.tsx             # Dashboard & sentiment analysis
│   └── components/               # Reusable UI components
├── supabase/functions/           # Backend Edge Functions
│   ├── predict-sentiment/        # Generate predictions with AI/algorithm
│   ├── verify-predictions/       # Verify predictions after 12 hours
│   ├── auto-update/              # Background prediction updates
│   └── fetch-stock-news/         # Fetch news from 13+ real sources
└── server/                       # Development server configuration
```

## 🚀 Key Functions

### Data Fetching (`verify-predictions/index.ts`)
```typescript
// Real Yahoo Finance integration with multiple fallbacks
const sources = [
  `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
  `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`
];
```

### News Aggregation (`fetch-stock-news/index.ts`)
```typescript
// 13+ Real RSS Feeds
const NEWS_SOURCES = [
  { name: 'Google News Finance', url: 'https://news.google.com/rss/...' },
  { name: 'Reuters Markets', url: 'https://www.reutersagency.com/feed/...' },
  { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/...' },
  // ... 10+ more real sources
];
```

### Prediction Generation (`predict-sentiment/index.ts`)
- Fetches live price from Yahoo Finance/Alpha Vantage
- Analyzes historical sentiment from real news articles
- Uses GPT-4 or algorithmic models for predictions
- Stores predictions with timestamp for later verification

### Automated Verification
- Runs every 12 hours after prediction creation
- Fetches current live price
- Compares with prediction price to calculate accuracy
- Updates prediction status (Accurate/Inaccurate)

## 🔐 Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional API Keys (for premium features)
OPENAI_API_KEY=your_openai_key           # For GPT-4 predictions
ALPHA_VANTAGE_KEY=your_alpha_vantage_key # For premium stock data
NEWS_API_KEY=your_news_api_key           # Alternative news source
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## 🎯 How It Works

1. **User enters stock symbol** (e.g., AAPL, TSLA, RELIANCE.NS)
2. **System fetches live price** from Yahoo Finance or Alpha Vantage
3. **Fetches recent news** from 13+ real sources via RSS
4. **Analyzes sentiment** using GPT-4 or algorithmic model
5. **Generates prediction** (Bullish/Bearish/Neutral) with confidence score
6. **Stores prediction** with current price and timestamp
7. **After 12 hours**: Automatically verifies prediction accuracy
8. **Updates status**: Marks as Accurate/Inaccurate based on actual price movement

## ✅ Data Authenticity Verification

**All data sources are REAL and LIVE:**

- ✅ Stock prices: Direct API calls to Yahoo Finance/Alpha Vantage
- ✅ News articles: RSS feeds from major financial publications
- ✅ Predictions: AI-generated or algorithm-based (no random/dummy data)
- ✅ Verification: Mathematical comparison of predicted vs actual prices

**No mock/dummy data is used in production.**

## 📈 Prediction Accuracy Logic

```typescript
// Real verification logic (verify-predictions/index.ts)
const priceChange = ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;

let actualOutcome: 'bullish' | 'bearish' | 'neutral';
if (priceChange > 1.5) actualOutcome = 'bullish';
else if (priceChange < -1.5) actualOutcome = 'bearish';
else actualOutcome = 'neutral';

// Compare with prediction
const wasAccurate = (prediction === actualOutcome) || 
                   (prediction === 'bullish' && priceChange > 0.8) ||
                   (prediction === 'bearish' && priceChange < -0.8);
```

## 🔄 Recent Updates

- ✅ Fixed prediction date display issues
- ✅ Improved Yahoo Finance fetching with fallback URLs
- ✅ Enhanced verification reliability (12-hour automatic updates)
- ✅ Added user-agent rotation to prevent rate limiting
- ✅ Fixed timestamp handling for predictions

## 📝 License

MIT License

## 👨‍💻 Developer

**Saisourav19** - [GitHub](https://github.com/Saisourav19)

---

**Note**: This project uses REAL financial data and AI for predictions. All prices, news, and predictions are based on live market data from reputable sources.