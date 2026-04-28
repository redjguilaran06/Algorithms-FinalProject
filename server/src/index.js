import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

dotenv.config();

const app = express();
const PORT = 5001;

const yahooFinance = new YahooFinance();
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

