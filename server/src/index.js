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
    const result = await yahooFinance.historical(symbol.trim().toUpperCase(), {
      period1,
      period2,
      interval: interval,
    });

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
  
    res.json(dataArray);

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
    let { start, end } = req.query;

    if (!location || !location.trim()) {
      return res.status(400).json({ error: "Location is required" });
    }

    // Default to last 90 days if not provided
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

    // Use the Open-Meteo archive API to fetch historical daily temperatures
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const dataResp = await fetch(url);
    const dataJson = await dataResp.json();

    if (!dataJson || !dataJson.daily || !Array.isArray(dataJson.daily.time)) {
      return res.status(500).json({ error: "Failed to fetch historical weather data" });
    }

    const times = dataJson.daily.time || [];
    const tmax = dataJson.daily.temperature_2m_max || [];
    const tmin = dataJson.daily.temperature_2m_min || [];

    const out = times.map((dt, i) => {
      const max = Number.isFinite(Number(tmax[i])) ? Number(tmax[i]) : null;
      const min = Number.isFinite(Number(tmin[i])) ? Number(tmin[i]) : null;
      const temp = max !== null && min !== null ? (max + min) / 2 : max ?? min ?? null;
      return { date: new Date(dt).toISOString(), temperature: temp };
    });

    res.json(out);

  } catch (error) {
    console.error("Weather data error:", error);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

