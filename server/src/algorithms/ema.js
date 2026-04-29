export function ema(prices, k) {
  /**
   * Exponential Moving Average (EMA).
   * Formula: alpha = 2 / (k + 1)
   * EMA(t) = price(t) * alpha + EMA(t-1) * (1 - alpha)
   * Seed: The first EMA value = the first price.
   * Time Complexity: O(n)
   * Returns: A full-length array aligned to prices. No null padding.
   */
  if (!Array.isArray(prices)) {
    throw new TypeError("prices must be an array");
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new TypeError("k must be a positive integer");
  }

  const n = prices.length;
  if (n === 0) return [];

  const alpha = 2 / (k + 1);
  const result = new Array(n);

  let emaValue = prices[0];
  result[0] = emaValue;

  for (let i = 1; i < n; i += 1) {
    emaValue = prices[i] * alpha + emaValue * (1 - alpha);
    result[i] = emaValue;
  }

  return result;
}
