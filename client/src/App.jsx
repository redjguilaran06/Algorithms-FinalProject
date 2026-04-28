import { useEffect, useState } from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function App() {
  const [movingAverageType, setMovingAverageType] = useState("SMA");
  const [period, setPeriod] = useState(14);
  const [symbol, setSymbol] = useState("");
  const [stockData, setStockData] = useState([]);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch("http://localhost:5001/api/test");
        const data = await response.json();
        console.log("API test response:", data);
      } catch (error) {
        console.error("API test failed:", error);
      }
    };

    checkApi();
  }, []);

  const handleApply = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/stock/${symbol}`);
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      const result = await response.json();
      
      if (Array.isArray(result)) {
        const formattedData = [...result].reverse();
        setStockData(formattedData);
      } else if (result && Array.isArray(result.data)) {
        const formattedData = [...result.data].reverse();
        setStockData(formattedData);
      } else {
        console.warn("Unexpected stock data format", result);
        setStockData([]);
      }

      console.log(result);
      console.log("Apply clicked", {
        movingAverageType,
        symbol: String(symbol),
        period: Number(period),
      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  };

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <h1>Trend Analyzer</h1>
      </header>

      <main className="dashboard-main">
        <section className="chart-panel">
          <h2>Chart Area</h2>
            {stockData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={stockData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#8884d8"
                    dot={false}
                    name="Price"
                    />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="chart-placeholder">Chart will display here</div>}
        </section>

        <section className="controls-panel">
          <h2>Controls</h2>


            <div className="control-group">
            <label htmlFor="stock-company"> Search for a Company by Symbol </label>
            <input 
              id="stock-company"
              type="text"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}/>
          </div>

          <div className="control-group">
            <label htmlFor="moving-average-type">Moving Average Type</label>
            <select
              id="moving-average-type"
              value={movingAverageType}
              onChange={(event) => setMovingAverageType(event.target.value)}
            >
              <option value="SMA">Simple (SMA)</option>
              <option value="EMA">Exponential (EMA)</option>
              <option value="WMA">Weighted (WMA)</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="period">Period</label>
            <input
              id="period"
              type="number"
              min="1"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </div>

          <button type="button" className="apply-button" onClick={handleApply}>
            Apply
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;