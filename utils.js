// ============================================================
// SPENDWISE — Utility Helpers
// ============================================================

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * Sanitize string for safe DOM rendering
 * @param {string} str
 * @returns {string}
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format currency using Intl.NumberFormat
 * @param {number} amount
 * @param {string} currencySymbol
 * @returns {string}
 */
export function formatCurrency(amount, currencySymbol = '₹') {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${currencySymbol}${formatted}`;
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string YYYY-MM-DD
 * @param {object} opts
 * @returns {string}
 */
export function formatDate(dateStr, opts = {}) {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const defaultOpts = { weekday: 'short', month: 'short', day: 'numeric', ...opts };
  return date.toLocaleDateString('en-US', defaultOpts);
}

/**
 * Format a full month name + year
 * @param {number} year
 * @param {number} month (0-indexed)
 * @returns {string}
 */
export function formatMonthYear(year, month) {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
export function getToday() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get ISO datetime string
 * @returns {string}
 */
export function getNow() {
  return new Date().toISOString();
}

/**
 * Validate a transaction object
 * @param {object} txn
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTransaction(txn) {
  const errors = [];
  if (!txn.type || !['expense', 'income'].includes(txn.type)) {
    errors.push('Type must be "expense" or "income".');
  }
  const amount = parseFloat(txn.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Amount must be greater than 0.');
  }
  if (!txn.category || txn.category.trim() === '') {
    errors.push('Category is required.');
  }
  if (!txn.date || isNaN(new Date(txn.date + 'T00:00:00').getTime())) {
    errors.push('A valid date is required.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Days in a given month
 * @param {number} year
 * @param {number} month (0-indexed)
 * @returns {number}
 */
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Group transactions by day
 * @param {Array} transactions
 * @returns {Map<string, Array>} date string -> txns
 */
export function groupByDay(transactions) {
  const map = new Map();
  for (const txn of transactions) {
    const key = txn.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(txn);
  }
  return map;
}

/**
 * Default expense categories
 */
export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health',
  'Education',
  'Travel',
  'Groceries',
  'Rent',
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Other',
];

/**
 * Category icon mapping (emoji for simplicity)
 */
export const CATEGORY_ICONS = {
  'Food & Dining': '🍽️',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Bills & Utilities': '💡',
  'Health': '💊',
  'Education': '📚',
  'Travel': '✈️',
  'Groceries': '🛒',
  'Rent': '🏠',
  'Salary': '💰',
  'Freelance': '💻',
  'Investment': '📈',
  'Gift': '🎁',
  'Other': '📌',
};

/**
 * Category color mapping for charts
 */
export const CATEGORY_COLORS = [
  '#6C5CE7', '#FF6B6B', '#54A0FF', '#00C48C',
  '#FFAB00', '#FF9FF3', '#48DBFB', '#FF6348',
  '#1DD1A1', '#F368E0', '#EE5A24', '#A3CB38',
  '#0984E3', '#FDA7DF', '#636E72',
];

/**
 * Payment methods
 */
export const PAYMENT_METHODS = [
  'Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet', 'Other'
];

/**
 * Convert transactions to CSV string
 * @param {Array} transactions
 * @param {string} currencySymbol
 * @returns {string}
 */
export function transactionsToCSV(transactions, currencySymbol = '₹') {
  const headers = ['Date', 'Type', 'Category', 'Amount', 'Payment Method', 'Note'];
  const rows = transactions.map(t => [
    t.date,
    t.type,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
    `"${(t.note || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Trigger a file download
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Debounce a function
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
