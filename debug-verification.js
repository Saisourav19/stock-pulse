
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env manually
const envPath = path.resolve(__dirname, '.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.join('=').trim().replace(/"/g, '');
        }
    });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchLivePrice(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
        console.log(`Fetching price for ${symbol} from ${url}`);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) {
            console.error(`Yahoo API returned ${response.status}`);
            return null;
        }

        const data = await response.json();
        const quote = data.chart?.result?.[0]?.meta;
        const prices = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

        if (quote && prices && prices.length > 0) {
            const currentPrice = quote.regularMarketPrice || prices[prices.length - 1];
            console.log(`> Price found: ${currentPrice}`);
            return currentPrice;
        }
    } catch (e) {
        console.error(`> Error fetching price: ${e.message}`);
    }
    return null;
}

async function verify() {
    console.log('--- Starting Local Verification Debug ---');
    console.log(`Connected to: ${SUPABASE_URL}`);

    // Get pending predictions - Logic to handle both NULL dates and recent ones
    // We basically just want ALL pending ones for debug
    const { data: predictions, error } = await supabase
        .from('prediction_history')
        .select('*')
        .is('was_accurate', null)
        .limit(20);

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log(`Found ${predictions.length} pending predictions.`);

    for (const pred of predictions) {
        console.log(`\nVerifying ${pred.symbol} (ID: ${pred.id}, Date: ${pred.created_at || 'NULL'})`);
        console.log(`Predicted: ${pred.prediction}, Entry Price: ${pred.price_at_prediction}`);

        if (!pred.price_at_prediction) {
            console.log('> SKIPPING: No price_at_prediction set.');
            continue;
        }

        const currentPrice = await fetchLivePrice(pred.symbol);
        if (!currentPrice) {
            console.log('> SKIPPED: Could not fetch live price.');
            continue;
        }

        const priceChange = ((currentPrice - pred.price_at_prediction) / pred.price_at_prediction) * 100;
        console.log(`> Price Change: ${priceChange.toFixed(2)}%`);

        let actualOutcome = 'neutral';
        if (priceChange > 1.5) actualOutcome = 'bullish';
        else if (priceChange < -1.5) actualOutcome = 'bearish';

        let wasAccurate = false;
        if (pred.prediction === actualOutcome) wasAccurate = true;
        else if (pred.prediction === 'neutral' && Math.abs(priceChange) < 2) wasAccurate = true; // Added nuance
        else if (pred.prediction === 'bullish' && priceChange > 0.5) wasAccurate = true; // Added leniency

        console.log(`> Outcome: ${actualOutcome}. Accurate? ${wasAccurate}`);

        const { error: updateError } = await supabase
            .from('prediction_history')
            .update({
                actual_outcome: actualOutcome,
                price_at_verification: currentPrice,
                price_change_percent: priceChange,
                was_accurate: wasAccurate,
                verified_at: new Date().toISOString()
            })
            .eq('id', pred.id);

        if (updateError) {
            console.error('> UPDATE FAILED:', updateError);
        } else {
            console.log('> UPDATE SUCCESSFUL');
        }
    }
    console.log('\n--- Done ---');
}

verify();
