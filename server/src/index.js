import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";
import { smaNaive, smaOptimized } from "./algorithms/sma.js";
import { ema } from "./algorithms/ema.js";
import { wma } from "./algorithms/wma.js";
import { fetchWeatherApi } from "openmeteo";

dotenv.config();

const app = express();
const PORT = 5001;

const yahooFinance = new YahooFinance({ suppressNotices: ["ripHistorical"] });
app.use(express.json()).use(cors());

app.get("/api/test", (_request, response) => {
  response.json({ message: "API is working" });
});

app.get("/api/stock/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { start, end, interval } = req.query;

    if (!symbol || !symbol.trim()) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const period1 = new Date(start);
    const period2 = new Date(end);


    console.log(`Fetching ${symbol}: Start: ${start}, End: ${end}, Interval: ${interval}`);
    const [result, quote] = await Promise.all([
      yahooFinance.historical(symbol.trim().toUpperCase(), {
      period1,
      period2,
      interval: interval,
    }),
      yahooFinance.quote(symbol),
  ]);

    if (!Array.isArray(result) || result.length === 0) {
      return res.status(404).json({ error: "No stock data found" });
    }

    const dataArray = result
      .filter((entry) => entry?.date)
      .map((entry) => ({
        date: new Date(entry.date).toISOString(),
        open: entry.open ?? null,
        high: entry.high ?? null,
        low: entry.low ?? null,
        close: entry.close ?? null,
        volume: entry.volume ?? null,
      }));
  
    res.json({
      currency: quote?.currency ?? "USD",
      data: dataArray,
    });

  } catch (error) {
    console.error("Historical data error:", error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

app.post("/api/compute-ma", (req, res) => {
  try {
    const { prices, maType, period } = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: "Prices array is required" });
    }

    if (!maType || !["SMA", "EMA", "WMA"].includes(maType)) {
      return res.status(400).json({ error: "Invalid MA type. Must be SMA, EMA, or WMA" });
    }

    if (!Number.isInteger(period) || period <= 0) {
      return res.status(400).json({ error: "Period must be a positive integer" });
    }

    let maValues;
    
    if (maType === "SMA") {
      maValues = smaOptimized(prices, period);
    } else if (maType === "EMA") {
      maValues = ema(prices, period);
    } else if (maType === "WMA") {
      maValues = wma(prices, period);
    }

    res.json({
      maType,
      period,
      values: maValues,
    });
  } catch (error) {
    console.error("MA computation error:", error);
    res.status(500).json({ error: "Failed to compute moving average" });
  }
});

app.get("/api/weather/:location", async (req, res) => {
  try {
    const { location } = req.params;
    const { interval } = req.query;
    let { start, end } = req.query;

    if (!location || !location.trim()) {
      return res.status(400).json({ error: "Location is required" });
    }

    if (!end) end = new Date().toISOString().split("T")[0];
    if (!start) {
      const d = new Date(end);
      d.setDate(d.getDate() - 90);
      start = d.toISOString().split("T")[0];
    }

    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: "City not found" });
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    console.log(`Found ${name}, ${country} at ${latitude}, ${longitude}`);

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const dataResp = await fetch(url);
    const dataJson = await dataResp.json();

    if (!dataJson || !dataJson.daily || !Array.isArray(dataJson.daily.time)) {
      return res.status(500).json({ error: "Failed to fetch historical weather data" });
    }

    const times = dataJson.daily.time || [];
    const tmax = dataJson.daily.temperature_2m_max || [];
    const tmin = dataJson.daily.temperature_2m_min || [];

    const daily = times.map((dt, i) => {
      const max = Number.isFinite(Number(tmax[i])) ? Number(tmax[i]) : null;
      const min = Number.isFinite(Number(tmin[i])) ? Number(tmin[i]) : null;
      const avg = max !== null && min !== null ? (max + min) / 2 : max ?? min ?? null;
      const prevAvg = i > 0
        ? (() => {
            const prevMax = Number.isFinite(Number(tmax[i - 1])) ? Number(tmax[i - 1]) : null;
            const prevMin = Number.isFinite(Number(tmin[i - 1])) ? Number(tmin[i - 1]) : null;
            return prevMax !== null && prevMin !== null ? (prevMax + prevMin) / 2 : prevMax ?? prevMin ?? avg;
          })()
        : avg;
      const high = max ?? avg;
      const low = min ?? avg;
      return {
        date: new Date(dt).toISOString(),
        open: prevAvg,
        high,
        low,
        close: avg,
        temperature: avg,
      };
    });

    let out = daily;

    if (interval === "1wk" || interval === "1mo") {
      out = aggregateWeatherData(daily, interval);
    }

    res.json(out);

  } catch (error) {
    console.error("Weather data error:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

function aggregateWeatherData(data, interval) {
  const groups = {};

  data.forEach((entry) => {
    const d = new Date(entry.date);
    let key;
    
    if (interval === "1wk") {
      const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${weekNum}`;
    } else {
      key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    }

    if (!groups[key]) {
      groups[key] = {
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        latestDate: entry.date,
      };
    }
    groups[key].high = Math.max(groups[key].high, entry.high);
    groups[key].low = Math.min(groups[key].low, entry.low);
    groups[key].close = entry.close;
    groups[key].latestDate = entry.date;
  });

  return Object.values(groups).map((g) => ({
    date: new Date(g.latestDate).toISOString(),
    open: g.open,
    high: g.high,
    low: g.low,
    close: g.close,
    temperature: g.close,
  }));
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

