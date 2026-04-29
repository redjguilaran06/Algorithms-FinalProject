import { useEffect, useMemo, useState, useRef } from "react";
import Chart from "react-apexcharts";

const MA_COLORS = ["#F0B90B", "#2BD9FE", "#3B82F6", "#22C55E", "#F97316"];
const SIGNAL_COLORS = {
  golden: "#16A34A",
  death: "#DC2626",
};

const buildMaConfig = (id) => ({ id, type: "SMA", period: 14 });

const isValidNumber = (value) => Number.isFinite(value);

const extendTrailingValues = (values, targetLength) => {
  if (!Array.isArray(values)) return values;

  const result = [...values];
  let lastValue = null;

  for (let i = 0; i < result.length; i += 1) {
    if (isValidNumber(result[i])) {
      lastValue = result[i];
    } else if (lastValue !== null) {
      result[i] = lastValue;
    }
  }

  if (lastValue !== null) {
    for (let i = result.length; i < targetLength; i += 1) {
      result.push(lastValue);
    }
  }

  return result;
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

const getActiveChartValue = (entry, mode) => {
  if (mode === "weather") {
    return Number(entry?.close ?? entry?.temperature ?? null);
  }

  if (mode === "earthquake") {
    return Number(entry?.close ?? entry?.magnitude ?? null);
  }

  return Number(entry?.close ?? null);
};

const buildCandlestickData = (data, mode) => {
  return data.map((entry) => ({
    x: new Date(entry.date).getTime(),
    y:
      mode === "weather"
        ? [
            Number(entry.open ?? entry.temperature),
            Number(entry.high ?? entry.temperature),
            Number(entry.low ?? entry.temperature),
            Number(entry.close ?? entry.temperature),
          ]
        : [
            Number(entry.open),
            Number(entry.high),
            Number(entry.low),
            Number(entry.close),
          ],
  }));
};

const getCandlestickColumnWidth = (mode, interval) => {
  if (mode !== "weather") {
    return "60%";
  }

  if (interval === "1d") {
    return "55%";
  }

  if (interval === "1wk") {
    return "72%";
  }

  if (interval === "1mo") {
    return "88%";
  }

  return "72%";
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
  const [weatherLocation, setWeatherLocation] = useState("");
  const [weatherData, setWeatherData] = useState([]);
  const [earthquakeLocation, setEarthquakeLocation] = useState("");
  const [earthquakeData, setEarthquakeData] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stockCurrency, setStockCurrency] = useState(null);
  const [stockSuggestions, setStockSuggestions] = useState([]);
  const [showStockSuggestions, setShowStockSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [earthquakeSuggestions, setEarthquakeSuggestions] = useState([]);
  const [showEarthquakeSuggestions, setShowEarthquakeSuggestions] =
    useState(false);

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

  useEffect(() => {
    const activeData =
      headerDropdown === "stock"
        ? stockData
        : headerDropdown === "weather"
          ? weatherData
          : headerDropdown === "earthquake"
            ? earthquakeData
            : [];
    if (maSeries.length > 0 && activeData.length > 0) {
      handleApply();
    }
  }, [maConfigs, headerDropdown, stockData, weatherData, earthquakeData]);

  const searchTimeout = useRef(null);

  const handleSymbolChange = (e) => {
    const value = e.target.value.toUpperCase();
    setSymbol(value);

    clearTimeout(searchTimeout.current);
    if (value.trim().length < 1) {
      setStockSuggestions([]);
      setShowStockSuggestions(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://localhost:5001/api/stock/search/${value.trim()}`,
        );
        const data = await response.json();
        setStockSuggestions(Array.isArray(data) ? data : []);
        setShowStockSuggestions(true);
      } catch {
        setStockSuggestions([]);
      }
    }, 300);
  };

  const handleSuggestionClick = (suggestion) => {
    setSymbol(suggestion.symbol);
    setStockSuggestions([]);
    setShowStockSuggestions(false);
    fetchStockData({ symbol: suggestion.symbol });
  };

  const locationSearchTimeout = useRef(null);

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setWeatherLocation(value);

    clearTimeout(locationSearchTimeout.current);
    if (value.trim().length < 1) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    locationSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://localhost:5001/api/weather/search/${encodeURIComponent(value.trim())}`,
        );
        const data = await response.json();
        setLocationSuggestions(Array.isArray(data) ? data : []);
        setShowLocationSuggestions(true);
      } catch {
        setLocationSuggestions([]);
      }
    }, 300);
  };

  const handleLocationSuggestionClick = (suggestion) => {
    setWeatherLocation(suggestion.name);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
    fetchWeatherData({ location: suggestion.name });
  };

  const earthquakeSearchTimeout = useRef(null);

  const handleEarthquakeLocationChange = (e) => {
    const value = e.target.value;
    setEarthquakeLocation(value);

    clearTimeout(earthquakeSearchTimeout.current);
    if (value.trim().length < 1) {
      setEarthquakeSuggestions([]);
      setShowEarthquakeSuggestions(false);
      return;
    }

    earthquakeSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `http://localhost:5001/api/earthquake/search/${encodeURIComponent(value.trim())}`,
        );
        const data = await response.json();
        setEarthquakeSuggestions(Array.isArray(data) ? data : []);
        setShowEarthquakeSuggestions(true);
      } catch {
        setEarthquakeSuggestions([]);
      }
    }, 300);
  };

  const handleEarthquakeSuggestionClick = (suggestion) => {
    setEarthquakeLocation(suggestion.name);
    setEarthquakeSuggestions([]);
    setShowEarthquakeSuggestions(false);
    fetchEarthquakeData({ location: suggestion.name });
  };

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
        `http://localhost:5001/api/stock/${nextSymbol.trim()}?start=${nextStart}&end=${nextEnd}&interval=${nextInterval}`,
      );
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        throw new Error(
          errorResult.error || `Server responded ${response.status}`,
        );
      }
      const result = await response.json();

      const stockRows = Array.isArray(result) ? result : result?.data;
      if (Array.isArray(stockRows)) {
        const cleaned = [...stockRows]
          .reverse()
          .filter(
            (entry) => entry?.close !== null && entry?.close !== undefined,
          );
        setStockData(cleaned);
        setStockCurrency(result?.currency ?? "USD");
      } else {
        console.warn("Unexpected stock data format", result);
        setStockData([]);
        setStockCurrency(result?.currency ?? "USD");
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

  const fetchWeatherData = async (overrides = {}) => {
    const nextLocation = overrides.location ?? weatherLocation;
    const nextStart = overrides.startDate ?? startDate;
    const nextEnd = overrides.endDate ?? endDate;
    const nextTimeInterval = overrides.timeInterval ?? timeInterval;

    if (!nextLocation.trim()) {
      setErrorMessage("Location is required");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const response = await fetch(
        `http://localhost:5001/api/weather/${encodeURIComponent(nextLocation.trim())}?start=${nextStart}&end=${nextEnd}&interval=${nextTimeInterval}`,
      );
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({}));
        throw new Error(
          errorResult.error || `Server responded ${response.status}`,
        );
      }
      const result = await response.json();

      if (Array.isArray(result)) {
        const cleaned = [...result].filter(
          (entry) =>
            entry?.date !== undefined && entry?.temperature !== undefined,
        );
        setWeatherData(cleaned);
      } else {
        console.warn("Unexpected weather data format", result);
        setWeatherData([]);
      }

      setMaSeries([]);
      setCrossovers([]);
      setTrendInfo(null);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      setErrorMessage(error.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  const fetchEarthquakeData = async (overrides = {}) => {
    const nextLocation = overrides.location ?? earthquakeLocation;
    const nextStart = overrides.startDate ?? startDate;
    const nextEnd = overrides.endDate ?? endDate;
    const nextInterval = overrides.interval ?? timeInterval;

    try {
      const params = new URLSearchParams({
        start: nextStart,
        end: nextEnd,
        interval: nextInterval,
      });

      if (nextLocation.trim()) params.append("location", nextLocation.trim());

      const response = await fetch(
        `http://localhost:5001/api/earthquake?${params.toString()}`,
      );
      const result = await response.json();

      if (Array.isArray(result.data)) {
        setEarthquakeData(result.data);
      }
    } catch (error) {
      setErrorMessage("Failed to fetch earthquake data");
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

    if (headerDropdown === "weather") {
      if (weatherLocation.trim()) {
        fetchWeatherData({
          timeInterval: nextInterval,
          location: weatherLocation,
        });
      }
      return;
    }

    if (headerDropdown === "earthquake") {
      fetchEarthquakeData({ interval: nextInterval });
    }

    if (symbol.trim()) {
      fetchStockData({ interval: nextInterval });
    }
  };

  const handleLocationKeyPress = (event) => {
    if (event.key === "Enter" && weatherLocation.trim()) {
      fetchWeatherData({ location: weatherLocation });
    }
  };

  const handleEarthquakeLocationKeyPress = (event) => {
    if (event.key === "Enter") {
      fetchEarthquakeData({ location: earthquakeLocation });
    }
  };

  const updateMaConfig = (id, patch) => {
    setMaConfigs((prev) =>
      prev.map((config) =>
        config.id === id ? { ...config, ...patch } : config,
      ),
    );
  };

  const addMaConfig = () => {
    setMaConfigs((prev) => {
      const nextId = prev.length
        ? Math.max(...prev.map((item) => item.id)) + 1
        : 1;
      return [...prev, buildMaConfig(nextId)];
    });
  };

  const removeMaConfig = (id) => {
    setMaConfigs((prev) => prev.filter((config) => config.id !== id));
  };

  const handleApply = async () => {
    try {
      const activeData =
        headerDropdown === "stock"
          ? stockData
          : headerDropdown === "weather"
            ? weatherData
            : headerDropdown === "earthquake"
              ? earthquakeData
              : [];

      if (!activeData || activeData.length === 0) {
        setErrorMessage("Please fetch data first for the selected mode");
        return;
      }

      const prices = activeData.map((d) =>
        getActiveChartValue(d, headerDropdown),
      );

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
            throw new Error(
              errorResult.error || `Server responded ${response.status}`,
            );
          }

          const result = await response.json();
          return {
            id: config.id,
            type: result.maType,
            period: result.period,
            values: result.values,
          };
        }),
      );

      setMaSeries(computed);
      const dates = activeData.map((d) => d.date);
      let nextCrossovers = [];

      if (computed.length >= 2) {
        const first = computed[0];
        const second = computed[1];
        const shortSeries = first.period <= second.period ? first : second;
        const longSeries = first.period <= second.period ? second : first;
        nextCrossovers = calculateCrossovers(
          shortSeries.values,
          longSeries.values,
          dates,
          prices,
        );
      }

      setCrossovers(nextCrossovers);

      const trendResponse = await fetch(
        "http://localhost:5001/api/classify-trend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prices,
            maArrays: computed.map((entry) => entry.values),
            periods: computed.map((entry) => entry.period),
            crossovers: nextCrossovers,
            mode: headerDropdown,
          }),
        },
      );

      if (!trendResponse.ok) {
        const errorResult = await trendResponse.json().catch(() => ({}));
        throw new Error(
          errorResult.error || `Server responded ${trendResponse.status}`,
        );
      }

      const trendResult = await trendResponse.json();
      setTrendInfo(trendResult);
    } catch (error) {
      console.error("Error computing MA:", error);
      setErrorMessage(error.message || "Failed to compute moving average");
    } finally {
      setLoading(false);
    }
  };

  const priceSeries = useMemo(() => {
    const activeData =
      headerDropdown === "stock"
        ? stockData
        : headerDropdown === "weather"
          ? weatherData
          : headerDropdown === "earthquake"
            ? earthquakeData
            : [];

    if (!activeData.length) return [];

    if (graphType === "candlestick") {
      return [
        {
          name: "Candles",
          type: "candlestick",
          data: buildCandlestickData(activeData, headerDropdown),
        },
      ];
    }

    return [
      {
        name:
          headerDropdown === "stock"
            ? "Price"
            : headerDropdown === "weather"
              ? "Temperature"
              : headerDropdown === "earthquake"
                ? "Magnitude"
                : "Value",
        type: "line",
        data: activeData.map((d) => ({
          x: new Date(d.date).getTime(),
          y: getActiveChartValue(d, headerDropdown),
        })),
      },
    ];
  }, [stockData, weatherData, earthquakeData, graphType, headerDropdown]);

  const maLineSeries = useMemo(() => {
    const sourceData =
      headerDropdown === "stock"
        ? stockData
        : headerDropdown === "weather"
          ? weatherData
          : headerDropdown === "earthquake"
            ? earthquakeData
            : [];

    if (!maSeries.length || !sourceData.length) return [];
    return maSeries.map((series) => ({
      name: `${series.type} (${series.period})`,
      type: "line",
      data: extendTrailingValues(series.values, sourceData.length)
        .slice(0, sourceData.length)
        .map((val, idx) => ({
          x: new Date(sourceData[idx].date).getTime(),
          y: val,
        })),
    }));
  }, [maSeries, stockData, weatherData, earthquakeData, headerDropdown]);

  const goldenCrossPoints = useMemo(
    () =>
      crossovers
        .filter((item) => item.type === "GOLDEN_CROSS")
        .map((item) => ({
          x: item.date ? new Date(item.date).getTime() : item.index,
          y: item.value,
        })),
    [crossovers],
  );

  const deathCrossPoints = useMemo(
    () =>
      crossovers
        .filter((item) => item.type === "DEATH_CROSS")
        .map((item) => ({
          x: item.date ? new Date(item.date).getTime() : item.index,
          y: item.value,
        })),
    [crossovers],
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
      } else if (index === 0 && graphType === "candlestick") {
        widths.push(0);
      } else {
        widths.push(2);
      }
    });
    return widths;
  }, [series, graphType]);

  const trendReasonCopy = {
    price_vs_ma: "Based on price vs MA position",
    latest_crossover: "Based on latest Golden/Death Cross",
    no_crossover_price_vs_fastest_ma: "No cross yet - using fastest MA",
    no_crossover_no_valid_ma: "No cross yet - insufficient MA data",
    insufficient_data: "Not enough data to classify",
    ma_zero_division: "Not enough data to classify",
    no_valid_ma_values: "Not enough data to classify",
  };

  const trendLabel = trendInfo?.trend ?? "CONSOLIDATION";
  const trendLabelDisplay =
    trendLabel === "UPTREND"
      ? "▲ Uptrend"
      : trendLabel === "DOWNTREND"
        ? "▼ Downtrend"
        : "→ Consolidation";
  const trendMeta = trendInfo?.trend_reason
    ? trendReasonCopy[trendInfo.trend_reason] || "Not enough data to classify"
    : "Not enough data to classify";
  const showDisagreement = Boolean(
    trendInfo?.trend_detail?.length > 1 && trendInfo?.trend_agree === false,
  );

  const formatChartValue = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return value;
    }

    if (headerDropdown === "weather") {
      return `${num.toFixed(2)}°C`;
    }

    if (headerDropdown === "earthquake") {
      return `M ${num.toFixed(1)}`;
    }

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: stockCurrency || "USD",
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `$${num.toFixed(2)}`;
    }
  };

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-mark" aria-hidden="true">
            B
          </div>
          <div className="header-copy">
            <p className="header-eyebrow">Moving Average Algorithm </p>
            <h1>TrendView</h1>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot" aria-hidden="true" />
        </div>
      </header>

      <main className="dashboard-main">
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <h2>Chart Area</h2>
              <p className="chart-subtitle">
                Hover crossover markers to see Golden/Death Cross.
              </p>
            </div>
            <div className={`trend-card trend-${trendLabel.toLowerCase()}`}>
              <span className="trend-title">Current Trend</span>
              <span className="trend-value">{trendLabelDisplay}</span>
              <span className="trend-meta">{trendMeta}</span>
              {showDisagreement ? (
                <span className="trend-warning">⚠ MAs disagree</span>
              ) : null}
            </div>
          </div>

          {errorMessage ? (
            <div className="chart-placeholder">{errorMessage}</div>
          ) : null}
          {!errorMessage &&
            (() => {
              const activeData =
                headerDropdown === "stock"
                  ? stockData
                  : headerDropdown === "weather"
                    ? weatherData
                    : headerDropdown === "earthquake"
                      ? earthquakeData
                      : [];

              if (!activeData || activeData.length === 0) {
                return (
                  <div className="chart-placeholder">
                    Chart will display here
                  </div>
                );
              }

              return (
                <div className="chart-wrapper">
                  {loading ? (
                    <div className="chart-overlay">Loading...</div>
                  ) : null}
                  <Chart
                    options={{
                      chart: {
                        id: "data-chart",
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
                        labels: { style: { colors: "#94a3b8" } },
                      },
                      stroke: { curve: "smooth", width: strokeWidths },
                      tooltip: {
                        theme: "dark",
                        x: { format: "yyyy-MM-dd" },
                        shared: true,
                        y: { formatter: (value) => formatChartValue(value) },
                      },
                      yaxis: {
                        decimalsInFloat: 2,
                        labels: {
                          style: { colors: "#94a3b8" },
                          formatter: (value) => formatChartValue(value),
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
                          wick: { useFillColor: true },
                        },
                        bar: {
                          columnWidth: getCandlestickColumnWidth(
                            headerDropdown,
                            timeInterval,
                          ),
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
              );
            })()}
        </section>

        <section className="controls-panel">
          <div className="controls-header">
            <h2>Controls</h2>
            <select
              className="control-dropdown"
              value={headerDropdown}
              onChange={(event) => setHeaderDropdown(event.target.value)}
            >
              <option value="stock">Stocks</option>
              <option value="weather">Weather</option>
              <option value="earthquake">Earthquakes</option>
            </select>
          </div>

          <div className="control-group">
            {headerDropdown === "stock" ? (
              <>
                <label htmlFor="stock-company">Search for a Company</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="stock-company"
                    type="text"
                    value={symbol}
                    onChange={handleSymbolChange}
                    onKeyPress={handleSymbolKeyPress}
                    onBlur={() =>
                      setTimeout(() => setShowStockSuggestions(false), 150)
                    }
                    placeholder="Search by symbol or company name"
                  />
                  {showStockSuggestions && stockSuggestions.length > 0 && (
                    <ul className="suggestions-list">
                      {stockSuggestions.map((s) => (
                        <li
                          key={s.symbol}
                          className="suggestion-item"
                          onMouseDown={() => handleSuggestionClick(s)}
                        >
                          <span className="suggestion-symbol">{s.symbol}</span>
                          <span className="suggestion-name">{s.name}</span>
                          {s.exchange && (
                            <span className="suggestion-exchange">
                              {s.exchange}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : headerDropdown === "weather" ? (
              <>
                <label htmlFor="weather-location">Search Location</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="weather-location"
                    type="text"
                    value={weatherLocation}
                    onChange={handleLocationChange}
                    onKeyPress={handleLocationKeyPress}
                    onBlur={() =>
                      setTimeout(() => setShowLocationSuggestions(false), 150)
                    }
                    placeholder="Search by city"
                  />
                  {showLocationSuggestions &&
                    locationSuggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {locationSuggestions.map((s, index) => (
                          <li
                            key={index}
                            className="suggestion-item"
                            onMouseDown={() => handleLocationSuggestionClick(s)}
                          >
                            <span className="suggestion-symbol">{s.name}</span>
                            <span className="suggestion-name">
                              {s.region ?? s.country}
                            </span>
                            <span className="suggestion-exchange">
                              {s.countryCode}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              </>
            ) : headerDropdown === "earthquake" ? (
              <>
                <label htmlFor="earthquake-location">
                  Search Location (optional)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="earthquake-location"
                    type="text"
                    value={earthquakeLocation}
                    onChange={handleEarthquakeLocationChange}
                    onKeyPress={handleEarthquakeLocationKeyPress}
                    onBlur={() =>
                      setTimeout(() => setShowEarthquakeSuggestions(false), 150)
                    }
                    placeholder="Search by city, or leave empty for global"
                  />
                  {showEarthquakeSuggestions &&
                    earthquakeSuggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {earthquakeSuggestions.map((s, index) => (
                          <li
                            key={index}
                            className="suggestion-item"
                            onMouseDown={() =>
                              handleEarthquakeSuggestionClick(s)
                            }
                          >
                            <span className="suggestion-symbol">{s.name}</span>
                            <span className="suggestion-name">
                              {s.region ?? s.country}
                            </span>
                            <span className="suggestion-exchange">
                              {s.countryCode}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              </>
            ) : (
              <>
                <label>Mode</label>
                <div className="control-note">
                  Select a mode from the dropdown
                </div>
              </>
            )}
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
            <select
              id="time-interval"
              value={timeInterval}
              onChange={handleIntervalChange}
            >
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
                onChange={(event) =>
                  updateMaConfig(config.id, { type: event.target.value })
                }
              >
                <option value="SMA">SMA</option>
                <option value="EMA">EMA</option>
                <option value="WMA">WMA</option>
              </select>
              <input
                type="number"
                min="2"
                value={config.period}
                onChange={(event) =>
                  updateMaConfig(config.id, { period: event.target.value })
                }
              />
              <button
                type="button"
                className="ma-remove"
                onClick={() => removeMaConfig(config.id)}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="apply-button" onClick={handleApply}>
            Apply
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
