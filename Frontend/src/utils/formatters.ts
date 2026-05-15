/**
 * Formats a number into a compact string (K, M, etc.)
 */
export const formatCompactNumber = (num: number): string => {
  if (num === null || num === undefined) return '0';
  
  const formatter = Intl.NumberFormat('en', { notation: 'compact' });
  return formatter.format(num);
};

/**
 * Formats a currency value with a symbol
 */
export const formatCurrency = (num: number, symbol: string = 'DT', compact: boolean = false): string => {
  if (num === null || num === undefined) return `0.00 ${symbol}`;
  
  if (compact && Math.abs(num) >= 1000) {
    const formatter = Intl.NumberFormat('en', { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${formatter.format(num)} ${symbol}`;
  }

  return `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
};

/**
 * Global settings for the app (can be moved to a context later if needed)
 * For now, we'll use localStorage to persist the currency symbol
 */
export const getCurrencySymbol = (): string => {
  return localStorage.getItem('stokly_currency') || 'DT';
};

export const setCurrencySymbol = (symbol: string): void => {
  localStorage.setItem('stokly_currency', symbol);
};
