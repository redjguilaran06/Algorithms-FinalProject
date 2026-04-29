import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";

const MA_COLORS = ["#F0B90B", "#2BD9FE", "#3B82F6", "#22C55E", "#F97316"];
const SIGNAL_COLORS = {
  golden: "#16A34A",
  death: "#DC2626",
};

const buildMaConfig = (id) => ({ id, type: "SMA", period: 14 });

const getLastNonNull = (values) => {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null && values[i] !== undefined) {
      return { index: i, value: values[i] };
    }
  }
  return null;
};

const collectLastValid = (values, count) => {
  const collected = [];
  if (!Array.isArray(values)) return collected;
  for (let i = values.length - 1; i >= 0 && collected.length < count; i -= 1) {
    if (values[i] !== null && values[i] !== undefined) {
      collected.push(values[i]);
    }
  }
  return collected.reverse();
};

const classifyTrend = (prices, maValues, threshold = 0.001) => {
  if (!Array.isArray(prices) || !Array.isArray(maValues) || prices.length === 0) {
    return "SIDEWAYS";
  }

  const validValues = collectLastValid(maValues, 10);
  if (validValues.length < 10) return "SIDEWAYS";

  const first = validValues[0];
  const last = validValues[validValues.length - 1];
  if (first === 0) return "SIDEWAYS";

  const slope = (last - first) / first;
  const priceLast = prices[prices.length - 1];
  const maLast = last;

  if (slope > threshold && priceLast > maLast) return "UPTREND";
  if (slope < -threshold && priceLast < maLast) return "DOWNTREND";
  return "SIDEWAYS";
};

const findLastPriceCross = (prices, maValues) => {
  if (!Array.isArray(prices) || !Array.isArray(maValues)) return null;
  for (let i = prices.length - 1; i >= 1; i -= 1) {
    const maNow = maValues[i];
    const maPrev = maValues[i - 1];
    if (maNow === null || maNow === undefined || maPrev === null || maPrev === undefined) {
      continue;
    }
    const priceNow = prices[i];
    const pricePrev = prices[i - 1];
    const crossedUp = pricePrev <= maPrev && priceNow > maNow;
    const crossedDown = pricePrev >= maPrev && priceNow < maNow;
    if (crossedUp || crossedDown) {
      return i;
    }
  }
  return null;
};

const buildTrendInfo = (prices, maValues, dates) => {
  if (!Array.isArray(prices) || !Array.isArray(maValues) || prices.length === 0) {
    return null;
  }

  const trend = classifyTrend(prices, maValues);
  const lastPrice = prices[prices.length - 1];
  const lastMa = getLastNonNull(maValues)?.value ?? null;
  const crossIndex = findLastPriceCross(prices, maValues);

  let percentChange = null;
  let sinceDate = null;
  if (crossIndex !== null) {
    const base = prices[crossIndex];
    if (base) {
      percentChange = ((lastPrice - base) / base) * 100;
    }
    sinceDate = dates?.[crossIndex] ?? null;
  }

  return {
    trend,
    lastPrice,
    lastMa,
    percentChange,
    sinceDate,
  };
};

const calculateCrossovers = (shortMa, longMa, dates, prices) => {
  const results = [];
  if (!Array.isArray(shortMa) || !Array.isArray(longMa)) return results;

  for (let i = 1; i < shortMa.length; i += 1) {
    const shortPrev = shortMa[i - 1];
    const longPrev = longMa[i - 1];
    const shortNow = shortMa[i];
    const longNow = longMa[i];

    if (
      shortPrev === null ||
      longPrev === null ||
      shortNow === null ||
      longNow === null ||
      shortPrev === undefined ||
      longPrev === undefined ||
      shortNow === undefined ||
      longNow === undefined
    ) {
      continue;
    }

    if (shortPrev < longPrev && shortNow >= longNow) {
      results.push({
        index: i,
        date: dates?.[i],
        type: "GOLDEN_CROSS",
        value: shortNow ?? prices?.[i],
      });
    }

    if (shortPrev > longPrev && shortNow <= longNow) {
      results.push({
        index: i,
        date: dates?.[i],
        type: "DEATH_CROSS",
        value: shortNow ?? prices?.[i],
      });
    }
  }

  return results;
};

function App() {
  const [symbol, setSymbol] = useState("");
  const [stockData, setStockData] = useState([]);
  const [maConfigs, setMaConfigs] = useState([buildMaConfig(1)]);
  const [maSeries, setMaSeries] = useState([]);
  const [crossovers, setCrossovers] = useState([]);
  const [trendInfo, setTrendInfo] = useState(null);
  const [graphType, setGraphType] = useState("line");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeInterval, setTimeInterval] = useState("1d");
  const [headerDropdown, setHeaderDropdown] = useState("stock");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

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

  const fetchStockData = async (overrides = {}) => {
    const nextSymbol = overrides.symbol ?? symbol;
    const nextInterval = overrides.interval ?? timeInterval;
    const nextStart = overrides.startDate ?? startDate;
    const nextEnd = overrides.endDate ?? endDate;

    if (!nextSymbol.trim()) {
      setErrorMessage("Symbol is required");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const response = await fetch(
        `http://localhost:5001/api/stock/${nextSymbol.trim()}?start=${nextStart}&end=${nextEnd}&interval=${nextInterval}`
      );
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        throw new Error(errorResult.error || `Server responded ${response.status}`);
      }
      const result = await response.json();

      if (Array.isArray(result)) {
        const cleaned = [...result]
          .reverse()
          .filter((entry) => entry?.close !== null && entry?.close !== undefined);
        setStockData(cleaned);
      } else {
        console.warn("Unexpected stock data format", result);
        setStockData([]);
      }

      setMaSeries([]);
      setCrossovers([]);
      setTrendInfo(null);

      console.log("Stock data fetched", {
        symbol: String(nextSymbol),
        startDate: nextStart,
        endDate: nextEnd,
        timeInterval: String(nextInterval),
      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      setErrorMessage(error.message || "Failed to fetch stock data");
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolKeyPress = (event) => {
    if (event.key === "Enter" && symbol.trim()) {
      fetchStockData({ symbol });
    }
  };

  const handleIntervalChange = (event) => {
    const nextInterval = event.target.value;
    setTimeInterval(nextInterval);
    if (symbol.trim()) {
      fetchStockData({ interval: nextInterval });
    }
  };

  const updateMaConfig = (id, patch) => {
    setMaConfigs((prev) =>
      prev.map((config) => (config.id === id ? { ...config, ...patch } : config))
    );
  };

  const addMaConfig = () => {
    setMaConfigs((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      return [...prev, buildMaConfig(nextId)];
    });
  };

  const removeMaConfig = (id) => {
    setMaConfigs((prev) => (prev.length > 1 ? prev.filter((config) => config.id !== id) : prev));
  };

  const handleApply = async () => {
    try {
      if (stockData.length === 0) {
        setErrorMessage("Please fetch stock data first");
        return;
      }

      const prices = stockData.map((d) => Number(d.close));
      setLoading(true);

      const computed = await Promise.all(
        maConfigs.map(async (config) => {
          const response = await fetch("http://localhost:5001/api/compute-ma", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prices,
              maType: config.type,
              period: Number(config.period),
            }),
          });

          if (!response.ok) {
            const errorResult = await response.json().catch(() => ({}));
            throw new Error(errorResult.error || `Server responded ${response.status}`);
          }

          const result = await response.json();
          return {
            id: config.id,
            type: result.maType,
            period: result.period,
            values: result.values,
          };
        })
      );

      setMaSeries(computed);

      if (computed.length >= 2) {
        const first = computed[0];
        const second = computed[1];
        const shortSeries = first.period <= second.period ? first : second;
        const longSeries = first.period <= second.period ? second : first;
        const dates = stockData.map((d) => d.date);
        setCrossovers(calculateCrossovers(shortSeries.values, longSeries.values, dates, prices));
      } else {
        setCrossovers([]);
      }

      setTrendInfo(buildTrendInfo(prices, computed[0]?.values, stockData.map((d) => d.date)));
    } catch (error) {
      console.error("Error computing MA:", error);
      setErrorMessage(error.message || "Failed to compute moving average");
    } finally {
      setLoading(false);
    }
  };

  const priceSeries = useMemo(() => {
    if (!stockData.length) return [];

    if (graphType === "candlestick") {
      return [
        {
          name: "Candles",
          type: "candlestick",
          data: stockData.map((d) => ({
            x: new Date(d.date).getTime(),
            y: [Number(d.open), Number(d.high), Number(d.low), Number(d.close)],
          })),
        },
      ];
    }

    return [
      {
        name: "Price",
        type: "line",
        data: stockData.map((d) => ({
          x: new Date(d.date).getTime(),
          y: Number(d.close),
        })),
      },
    ];
  }, [stockData, graphType]);

  const maLineSeries = useMemo(() => {
    if (!maSeries.length || !stockData.length) return [];
    return maSeries.map((series) => ({
      name: `${series.type} (${series.period})`,
      type: "line",
      data: series.values.map((val, idx) => ({
        x: new Date(stockData[idx].date).getTime(),
        y: val,
      })),
    }));
  }, [maSeries, stockData]);

  const goldenCrossPoints = useMemo(
    () =>
      crossovers
        .filter((item) => item.type === "GOLDEN_CROSS")
        .map((item) => ({
          x: item.date ? new Date(item.date).getTime() : item.index,
          y: item.value,
        })),
    [crossovers]
  );

  const deathCrossPoints = useMemo(
    () =>
      crossovers
        .filter((item) => item.type === "DEATH_CROSS")
        .map((item) => ({
          x: item.date ? new Date(item.date).getTime() : item.index,
          y: item.value,
        })),
    [crossovers]
  );

  const signalSeries = useMemo(() => {
    const series = [];
    if (goldenCrossPoints.length) {
      series.push({
        name: "Golden Cross",
        type: "scatter",
        data: goldenCrossPoints,
      });
    }
    if (deathCrossPoints.length) {
      series.push({
        name: "Death Cross",
        type: "scatter",
        data: deathCrossPoints,
      });
    }
    return series;
  }, [goldenCrossPoints, deathCrossPoints]);

  const series = [...priceSeries, ...maLineSeries, ...signalSeries];

  const chartColors = useMemo(() => {
    const colors = ["#6B7280"];

    maLineSeries.forEach((_, index) => {
      colors.push(MA_COLORS[index % MA_COLORS.length]);
    });

    if (goldenCrossPoints.length) {
      colors.push(SIGNAL_COLORS.golden);
    }
    if (deathCrossPoints.length) {
      colors.push(SIGNAL_COLORS.death);
    }

    return colors;
  }, [maLineSeries, goldenCrossPoints.length, deathCrossPoints.length]);

  const markerSizes = useMemo(() => {
    const sizes = [];
    series.forEach((item) => {
      sizes.push(item.type === "scatter" ? 6 : 0);
    });
    return sizes;
  }, [series]);

  const strokeWidths = useMemo(() => {
    const widths = [];
    series.forEach((item, index) => {
      if (item.type === "scatter") {
        widths.push(0);
      } else if (index === 0 && graphType === "line") {
        widths.push(2);
      } else {
        widths.push(2);
      }
    });
    return widths;
  }, [series, graphType]);

  const trendLabel = trendInfo?.trend || "SIDEWAYS";
  const trendMeta = trendInfo?.percentChange !== null && trendInfo?.percentChange !== undefined
    ? `${trendInfo.percentChange >= 0 ? "+" : ""}${trendInfo.percentChange.toFixed(2)}% since ${
        trendInfo.sinceDate ? new Date(trendInfo.sinceDate).toLocaleDateString() : "last cross"
      }`
    : "Insufficient MA history";

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-mark" aria-hidden="true">
            B
          </div>
          <div className="header-copy">
            <p className="header-eyebrow">Moving Average Algorithm </p>
            <h1>Trend Analyzer</h1>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot" aria-hidden="true" />
          Live market feed
        </div>
      </header>

      <main className="dashboard-main">
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <h2>Chart Area</h2>
              <p className="chart-subtitle">Hover crossover markers to see Golden/Death Cross.</p>
            </div>
            <div className={`trend-card trend-${trendLabel.toLowerCase()}`}>
              <span className="trend-title">Current Trend</span>
              <span className="trend-value">{trendLabel.replace("_", " ")}</span>
              <span className="trend-meta">{trendMeta}</span>
            </div>
          </div>

          {errorMessage ? <div className="chart-placeholder">{errorMessage}</div> : null}
          {!errorMessage &&
            (stockData.length === 0 ? (
              <div className="chart-placeholder">Chart will display here</div>
            ) : (
              <div className="chart-wrapper">
                {loading ? <div className="chart-overlay">Loading...</div> : null}
                <Chart
                  options={{
                    chart: {
                      id: "stock-chart",
                      toolbar: { show: true },
                      background: "transparent",
                      foreColor: "#d1d5db",
                    },
                    theme: { mode: "dark" },
                    grid: {
                      borderColor: "rgba(148, 163, 184, 0.14)",
                      strokeDashArray: 4,
                      xaxis: { lines: { show: false } },
                      yaxis: { lines: { show: true } },
                    },
                    xaxis: {
                      type: "datetime",
                      axisBorder: { color: "rgba(148, 163, 184, 0.18)" },
                      axisTicks: { color: "rgba(148, 163, 184, 0.18)" },
                      labels: {
                        style: { colors: "#94a3b8" },
                      },
                    },
                    stroke: {
                      curve: "smooth",
                      width: strokeWidths,
                    },
                    tooltip: {
                      theme: "dark",
                      x: { format: "yyyy-MM-dd" },
                      shared: true,
                    },
                    yaxis: {
                      decimalsInFloat: 2,
                      labels: {
                        style: { colors: "#94a3b8" },
                      },
                    },
                    colors: chartColors,
                    markers: {
                      size: markerSizes,
                      strokeWidth: 2,
                      strokeColors: "#0f172a",
                    },
                    plotOptions: {
                      candlestick: {
                        colors: { upward: "#22C55E", downward: "#EF4444" },
                      },
                    },
                    legend: {
                      show: true,
                      position: "top",
                      labels: { colors: "#d1d5db" },
                    },
                  }}
                  series={series}
                  type="line"
                  height={400}
                />
              </div>
            ))}
        </section>

        <section className="controls-panel">
          <div className="controls-header">
            <h2>Controls</h2>
            <select 
              className="control-dropdown"
              value={headerDropdown}
              onChange={(event) => setHeaderDropdown(event.target.value)}
            >
              <option value="stock"> Stocks </option>
              <option value="weather"> Weather </option>
              <option value="traffic"> Traffic </option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="stock-company">Search for a Company by Symbol</label>
            <input
              id="stock-company"
              type="text"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              onKeyPress={handleSymbolKeyPress}
              placeholder="Enter symbol and press Enter"
            />
          </div>

          <div className="date-row">
            <div className="control-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="control-group">
              <label htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="control-group">
            <label htmlFor="time-interval">Time Interval</label>
            <select id="time-interval" value={timeInterval} onChange={handleIntervalChange}>
              <option value="1d">Daily</option>
              <option value="1wk">Weekly</option>
              <option value="1mo">Monthly</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="chart-type">Chart Type</label>
            <div className="toggle-group">
              <button
                type="button"
                onClick={() => setGraphType("line")}
                className={graphType === "line" ? "active" : ""}
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setGraphType("candlestick")}
                className={graphType === "candlestick" ? "active" : ""}
              >
                Candlestick
              </button>
            </div>
          </div>

          <div className="ma-header">
            <div>
              <label>Moving Averages</label>
              <p className="ma-subtitle">Add or remove stacked overlays.</p>
            </div>
            <button type="button" className="ma-add" onClick={addMaConfig}>
              + Add MA
            </button>
          </div>

          {maConfigs.map((config, index) => (
            <div className="ma-row" key={config.id}>
              <div className="ma-index">MA {index + 1}</div>
              <select
                value={config.type}
                onChange={(event) => updateMaConfig(config.id, { type: event.target.value })}
              >
                <option value="SMA">SMA</option>
                <option value="EMA">EMA</option>
                <option value="WMA">WMA</option>
              </select>
              <input
                type="number"
                min="2"
                value={config.period}
                onChange={(event) => updateMaConfig(config.id, { period: event.target.value })}
              />
              <button
                type="button"
                className="ma-remove"
                onClick={() => removeMaConfig(config.id)}
                disabled={maConfigs.length === 1}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="apply-button" onClick={handleApply}>
            Apply MAs
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;