import express from "express";
import initAlphaVantage from "alphavantage";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5001;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

if (!ALPHA_VANTAGE_KEY) {
  throw new Error("Missing ALPHA_VANTAGE_KEY in server/.env");
}

const alpha = initAlphaVantage({ key: ALPHA_VANTAGE_KEY });

app.use(express.json()).use(cors());

app.get("/api/test", (_request, response) => {
  response.json({ message: "API is working" });
});

app.get("/api/stock/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;

    const data = await alpha.data.weekly(symbol, "full");

    const polishedData = alpha.util.polish(data);

    const dataArray = Object.entries(polishedData.data).map(([date, values]) => ({
      date: date.split('T')[0],
      ...values
    }));

    const fiveYearData = dataArray.slice(0, 260)
  
    res.json(fiveYearData);

  } catch (error) {
    console.error("Alpha Vantage error:", error);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

