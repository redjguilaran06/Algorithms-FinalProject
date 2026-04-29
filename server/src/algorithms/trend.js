const CONSOLIDATION_BAND = 0.005;

const extractValid = (values) => {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => Number.isFinite(value));
};

const buildConsolidation = (reason) => ({
  consensus: "CONSOLIDATION",
  reason,
  allAgree: true,
  perMa: [],
});

const resolveGapTrend = (gap, invertSignal) => {
  if (invertSignal) {
    return gap > CONSOLIDATION_BAND
      ? "DOWNTREND"
      : gap < -CONSOLIDATION_BAND
        ? "UPTREND"
        : "CONSOLIDATION";
  }

  return gap > CONSOLIDATION_BAND
    ? "UPTREND"
    : gap < -CONSOLIDATION_BAND
      ? "DOWNTREND"
      : "CONSOLIDATION";
};

const resolveCrossoverTrend = (type, invertSignal) => {
  if (invertSignal) {
    return type === "GOLDEN_CROSS" ? "DOWNTREND" : "UPTREND";
  }

  return type === "GOLDEN_CROSS" ? "UPTREND" : "DOWNTREND";
};

/**
 * Classify market trend based on prices, moving averages, and crossovers.
 * @param {number[]} prices - Closing prices aligned with MA arrays.
 * @param {(number|null)[][]} maArrays - MA values in user order.
 * @param {number[]} periods - MA periods aligned with maArrays.
 * @param {Array<{ index: number, date: string, type: "GOLDEN_CROSS"|"DEATH_CROSS" }>} crossovers
 *   - Detected crossover events (oldest to newest).
 * @param {string} mode - Active data mode (stock or weather).
 * @returns {{
 *   consensus: "UPTREND"|"DOWNTREND"|"CONSOLIDATION",
 *   reason: "price_vs_ma"|"latest_crossover"|"no_crossover_price_vs_fastest_ma"|"no_crossover_no_valid_ma"|"insufficient_data"|"ma_zero_division"|"no_valid_ma_values",
 *   allAgree: boolean,
 *   perMa: Array<{
 *     index: number,
 *     period: number,
 *     maLast: number|null,
 *     gap: number,
 *     state: "UPTREND"|"DOWNTREND"|"CONSOLIDATION"
 *   }>
 * }}
 */
export function classifyTrend(prices, maArrays, periods, crossovers, mode = "stock") {
  const invertSignal = mode !== "weather";
  if (!Array.isArray(prices) || prices.length < 2 || !Array.isArray(maArrays) || maArrays.length === 0) {
    return buildConsolidation("insufficient_data");
  }

  if (maArrays.length === 1) {
    const valid = extractValid(maArrays[0]);
    if (valid.length === 0) {
      return buildConsolidation("no_valid_ma_values");
    }

    const maLast = valid[valid.length - 1];
    const priceLast = prices[prices.length - 1];
    if (maLast === 0) {
      return buildConsolidation("ma_zero_division");
    }

    const gap = (priceLast - maLast) / maLast;
    const consensus = resolveGapTrend(gap, invertSignal);

    return {
      consensus,
      reason: "price_vs_ma",
      allAgree: true,
      perMa: [
        {
          index: 0,
          period: periods?.[0],
          maLast,
          gap: Number((gap * 100).toFixed(2)),
          state: consensus,
        },
      ],
    };
  }

  let consensus = "CONSOLIDATION";
  let reason = "no_crossover_no_valid_ma";

  if (Array.isArray(crossovers) && crossovers.length > 0) {
    const latestCross = crossovers[crossovers.length - 1];
    consensus = resolveCrossoverTrend(latestCross.type, invertSignal);
    reason = "latest_crossover";
  } else {
    const periodList = Array.isArray(periods) ? periods : [];
    const numericPeriods = periodList.filter((value) => Number.isFinite(value));
    const fastestPeriod = numericPeriods.length ? Math.min(...numericPeriods) : null;
    const fastestIndex = fastestPeriod !== null
      ? periodList.indexOf(fastestPeriod)
      : 0;
    const valid = extractValid(maArrays[fastestIndex] ?? []);
    const maLast = valid[valid.length - 1] ?? null;

    if (maLast === null || maLast === 0) {
      consensus = "CONSOLIDATION";
      reason = "no_crossover_no_valid_ma";
    } else {
      const priceLast = prices[prices.length - 1];
      const gap = (priceLast - maLast) / maLast;
      consensus = resolveGapTrend(gap, invertSignal);
      reason = "no_crossover_price_vs_fastest_ma";
    }
  }

  const priceLast = prices[prices.length - 1];
  const perMa = maArrays.map((ma, index) => {
    const valid = extractValid(ma);
    const maLast = valid[valid.length - 1] ?? null;

    if (maLast === null || maLast === 0) {
      return {
        index,
        period: periods?.[index],
        maLast,
        gap: 0,
        state: "CONSOLIDATION",
      };
    }

    const gap = (priceLast - maLast) / maLast;
    const state = resolveGapTrend(gap, invertSignal);

    return {
      index,
      period: periods?.[index],
      maLast,
      gap: Number((gap * 100).toFixed(2)),
      state,
    };
  });

  const allAgree =
    perMa.every((item) => item.state === "UPTREND") ||
    perMa.every((item) => item.state === "DOWNTREND") ||
    perMa.every((item) => item.state === "CONSOLIDATION");

  return {
    consensus,
    reason,
    allAgree,
    perMa,
  };
}
