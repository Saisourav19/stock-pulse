import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simplified fetch for Node
function fetchYahooPrice(symbol) {
    return new Promise((resolve) => {
        // Robust URLs
        const urls = [
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
            `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
        ];

        // Attempt sequential fetch
        const tryFetch = (index) => {
            if (index >= urls.length) {
                resolve(null);
                return;
            }

            const url = urls[index];
            https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            const quote = json.chart?.result?.[0]?.meta;
                            const prices = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

                            if (quote && prices) {
                                const currentPrice = quote.regularMarketPrice || prices[prices.length - 1];
                                if (currentPrice) {
                                    resolve(currentPrice);
                                    return;
                                }
                            }
                        } catch (e) { }
                    }
                    // Try next url
                    tryFetch(index + 1);
                });
            }).on('error', () => tryFetch(index + 1));
        };

        tryFetch(0);
    });
}

async function verifyAllNow() {
    console.log('Fetching all pending predictions...');

    // Fetch ALL pending, ignoring time
    const { data: predictions, error } = await supabase
        .from('prediction_history')
        .select('*')
        .is('was_accurate', null);

    if (error) {
        console.error('Database error:', error);
        return;
    }

    console.log(`Found ${predictions.length} pending predictions.`);

    for (const pred of predictions) {
        console.log(`Checking ${pred.symbol} (Pred: ${pred.prediction} @ ${pred.price_at_prediction})...`);
        const currentPrice = await fetchYahooPrice(pred.symbol);

        if (!currentPrice) {
            console.log(`  -> Could not fetch price for ${pred.symbol}`);
            continue;
        }

        const priceAtPrediction = pred.price_at_prediction;
        if (!priceAtPrediction) continue;

        const priceChange = ((currentPrice - priceAtPrediction) / priceAtPrediction) * 100;
        let actualOutcome = 'neutral';
        if (priceChange > 1.0) actualOutcome = 'bullish'; // Relaxed threshold
        else if (priceChange < -1.0) actualOutcome = 'bearish';

        let wasAccurate = false;
        if (pred.prediction === actualOutcome) wasAccurate = true;
        // Close call logic
        else if (pred.prediction === 'bullish' && priceChange > 0.5) wasAccurate = true;
        else if (pred.prediction === 'bearish' && priceChange < -0.5) wasAccurate = true;
        else if (pred.prediction === 'neutral' && Math.abs(priceChange) < 1.5) wasAccurate = true;

        console.log(`  -> Current: ${currentPrice} (${priceChange.toFixed(2)}%) -> Outcome: ${actualOutcome}. Accurate? ${wasAccurate}`);

        await supabase
            .from('prediction_history')
            .update({
                actual_outcome: actualOutcome,
                price_at_verification: currentPrice,
                price_change_percent: priceChange,
                was_accurate: wasAccurate,
                verified_at: new Date().toISOString()
            })
            .eq('id', pred.id);
    }
    console.log('Recalculation complete.');
}

verifyAllNow();
