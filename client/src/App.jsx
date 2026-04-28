import { useEffect, useState } from "react";
import Chart from "react-apexcharts";

function App() {
  const [movingAverageType, setMovingAverageType] = useState("SMA");
  const [period, setPeriod] = useState(14);
  const [symbol, setSymbol] = useState("");
  const [stockData, setStockData] = useState([]);
  const [graphType, setGraphType] = useState("line");
  const [errorMessage, setErrorMessage] = useState("");
  const [timeInterval, setTimeInterval] = useState("1d");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])

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
      setErrorMessage("");
      const response = await fetch(`http://localhost:5001/api/stock/${symbol}?start=${startDate}&end=${endDate}&interval=${timeInterval}`);
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        throw new Error(errorResult.error || `Server responded ${response.status}`);
      }
      const result = await response.json();

      if (Array.isArray(result)) {
        setStockData([...result].reverse());
      } else {
        console.warn("Unexpected stock data format", result);
        setStockData([]);
      }

      console.log(result);
      console.log("Apply clicked", {
        movingAverageType,
        symbol: String(symbol),
        period: Number(period),
        startDate: startDate,
        endDate: endDate,
        timeInterval: String(timeInterval),

      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      setErrorMessage(error.message || "Failed to fetch stock data");
    }
  };

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <h1>Trend Analyzer</h1>
      </header>

      <main className="dashboard-main">
        <section className="chart-panel">
          <h2> Chart Area </h2>
          {errorMessage ? <div className="chart-placeholder">{errorMessage}</div> : null}
          {!errorMessage &&
            (stockData.length === 0 ? (
              <div className="chart-placeholder">Chart will display here</div>
            ) : graphType === "line" ? (
              <Chart
                options={{
                  chart: { id: "stock-chart", toolbar: { show: true } },
                  xaxis: { type: "datetime" },
                  stroke: { curve: "smooth" },
                  tooltip: { x: { format: "yyyy-MM-dd" } },
                  yaxis: { decimalsInFloat: 2 },
                }}
                series={[
                  {
                    name: "Price",
                    data: stockData.map((d) => ({
                      x: new Date(d.date).getTime(),
                      y: Number(d.close),
                    })),
                  },
                ]}
                type="line"
                height={400}
              />
            ) : graphType === "candlestick" ? (
              <Chart
                options={{
                  chart: { id: "stock-candles", toolbar: { show: true } },
                  xaxis: { type: "datetime" },
                  tooltip: { x: { format: "yyyy-MM-dd" } },
                  plotOptions: {
                    candlestick: {
                      colors: { upward: "#26a69a", downward: "#ef5350" },
                    },
                  },
                }}
                series={[
                  {
                    name: "Candles",
                    data: stockData.map((d) => ({
                      x: new Date(d.date).getTime(),
                      y: [Number(d.open), Number(d.high), Number(d.low), Number(d.close)],
                    })),
                  },
                ]}
                type="candlestick"
                height={400}
              />
            ) : (
              <div className="chart-placeholder">Chart will display here</div>
            ))}
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
          
          <div className="date-row">
            <div className="control-group">
              <label htmlFor="start-date"> Start Date </label>
              <input
                id="start-date"
                type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}/>
            </div>
            
              <div className="control-group">
              <label htmlFor="end-date"> End Date </label>
              <input
                id="end-date"
                type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}/>
            </div>
           </div>

            <div className="control-group">
            <label htmlFor="time-interval"> Time Interval </label>
            <select
              id="time-interval"
              value={timeInterval}
                onChange={(event) => setTimeInterval(event.target.value)}
              >
                <option value="1d"> Daily </option>
                <option value="1wk"> Weekly </option>
                <option value="1mo"> Monthly </option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="chart-type"> Chart Type </label>
            <div className="toggle-group">
              <button onClick={() => setGraphType("line")} className={graphType === "line" ? "active" : ""}>Line</button>
              <button onClick={() => setGraphType("candlestick")} className={graphType === "candlestick" ? "active" : ""}>Candlestick</button>
            </div>
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