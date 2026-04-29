export function smaNaive(prices, k) {
  /**
   * Naive SMA - Recalculates the entire sum of the window at each step.
   * Time Complexity: O(n * k)
   * Space Complexity: O(n)
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

  for (let i = k - 1; i < n; i += 1) {
    let sum = 0;
    for (let j = i - k + 1; j <= i; j += 1) {
      sum += prices[j];
    }
    result[i] = sum / k;
  }

  return result;
}

export function smaOptimized(prices, k) {
  /**
   * Optimized SMA - Uses a sliding window with a running sum.
   * Time Complexity: O(n)
   * Space Complexity: O(n)
   * Key: Maintain windowSum, add incoming price, subtract outgoing price.
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

  let windowSum = 0;
  for (let i = 0; i < n; i += 1) {
    windowSum += prices[i];

    if (i >= k) {
      windowSum -= prices[i - k];
    }

    if (i >= k - 1) {
      result[i] = windowSum / k;
    }
  }

  return result;
}
