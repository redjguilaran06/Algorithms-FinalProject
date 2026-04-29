export function wma(prices, k) {
  /**
   * Weighted Moving Average (WMA) using linear weights.
   * weights = [1, 2, 3, ..., k] (most recent value has weight k)
   * weightSum = k * (k + 1) / 2
   * Time Complexity: O(n * k)
   * Returns: A full-length array aligned to prices. Use null padding.
   */
  if (!Array.isArray(prices)) {
    throw new TypeError("prices must be an array");
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new TypeError("k must be a positive integer");
  }

  const n = prices.length;
  const result = new Array(n).fill(null);
  if (k > n) return result;

  const weightSum = (k * (k + 1)) / 2;

  for (let i = k - 1; i < n; i += 1) {
    let weighted = 0;
    for (let w = 1; w <= k; w += 1) {
      weighted += prices[i - k + w] * w;
    }
    result[i] = weighted / weightSum;
  }

  return result;
}
