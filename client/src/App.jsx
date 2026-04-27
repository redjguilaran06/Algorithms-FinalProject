import { useEffect, useState } from "react";

function App() {
  const [movingAverageType, setMovingAverageType] = useState("SMA");
  const [period, setPeriod] = useState(14);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch("/api/test");
        const data = await response.json();
        console.log("API test response:", data);
      } catch (error) {
        console.error("API test failed:", error);
      }
    };

    // Confirm frontend and backend connectivity when the app loads.
    checkApi();
  }, []);

  const handleApply = () => {
    console.log("Apply clicked", {
      movingAverageType,
      period: Number(period),
    });
  };

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <h1>Trend Analyzer</h1>
      </header>

      <main className="dashboard-main">
        <section className="chart-panel">
          <h2>Chart Area</h2>
          <div className="chart-placeholder">Chart will display here</div>
        </section>

        <section className="controls-panel">
          <h2>Controls</h2>

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