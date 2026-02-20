// ============================================================
// SPENDWISE — Storage Layer
// Versioned localStorage with safe migrations
// ============================================================

const STORAGE_KEY = 'expenseTracker:data';
const CURRENT_VERSION = 1;

/**
 * Default data structure
 */
function getDefaultData() {
    return {
        version: CURRENT_VERSION,
        settings: {
            currencySymbol: '₹',
            monthlyBudget: 0,
        },
        transactions: [],
    };
}

/**
 * Migrate data from older versions
 * @param {object} data
 * @returns {object}
 */
function migrate(data) {
    let d = { ...data };

    // Future migrations go here:
    // if (d.version < 2) { ... d.version = 2; }

    d.version = CURRENT_VERSION;
    return d;
}

/**
 * Load data from localStorage with defensive error handling
 * @returns {object}
 */
export function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();

        let data = JSON.parse(raw);

        // Basic structural validation
        if (!data || typeof data !== 'object' || !Array.isArray(data.transactions)) {
            console.warn('SpendWise: corrupted data detected, resetting.');
            return getDefaultData();
        }

        // Migrate if needed
        if (data.version < CURRENT_VERSION) {
            data = migrate(data);
            saveData(data);
        }

        // Ensure settings exist
        if (!data.settings || typeof data.settings !== 'object') {
            data.settings = getDefaultData().settings;
        }

        return data;
    } catch (e) {
        console.error('SpendWise: failed to load data, resetting.', e);
        return getDefaultData();
    }
}

/**
 * Save data to localStorage
 * @param {object} data
 */
export function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('SpendWise: failed to save data.', e);
        alert('Failed to save data. Your storage might be full.');
    }
}

/**
 * Get all transactions
 * @returns {Array}
 */
export function getTransactions() {
    return loadData().transactions;
}

/**
 * Get settings
 * @returns {object}
 */
export function getSettings() {
    return loadData().settings;
}

/**
 * Update settings
 * @param {object} newSettings - partial settings to merge
 */
export function updateSettings(newSettings) {
    const data = loadData();
    data.settings = { ...data.settings, ...newSettings };
    saveData(data);
}

/**
 * Add a transaction
 * @param {object} txn
 */
export function addTransaction(txn) {
    const data = loadData();
    data.transactions.push(txn);
    saveData(data);
}

/**
 * Update a transaction by id
 * @param {string} id
 * @param {object} updates
 * @returns {boolean} whether the txn was found and updated
 */
export function updateTransaction(id, updates) {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    data.transactions[idx] = { ...data.transactions[idx], ...updates };
    saveData(data);
    return true;
}

/**
 * Delete a transaction by id
 * @param {string} id
 * @returns {object|null} the deleted transaction or null
 */
export function deleteTransaction(id) {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const [deleted] = data.transactions.splice(idx, 1);
    saveData(data);
    return deleted;
}

/**
 * Restore a deleted transaction
 * @param {object} txn
 */
export function restoreTransaction(txn) {
    addTransaction(txn);
}

/**
 * Reset all data
 */
export function resetAllData() {
    const defaults = getDefaultData();
    saveData(defaults);
    return defaults;
}

/**
 * Import transactions from JSON (validated)
 * @param {string} jsonString
 * @returns {{ success: boolean, imported: number, errors: string[] }}
 */
export function importFromJSON(jsonString) {
    const errors = [];
    let parsed;

    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        return { success: false, imported: 0, errors: ['Invalid JSON format.'] };
    }

    // Accept array or { transactions: [...] }
    let entries = Array.isArray(parsed) ? parsed : parsed?.transactions;
    if (!Array.isArray(entries)) {
        return { success: false, imported: 0, errors: ['Expected an array of transactions or { transactions: [...] }.'] };
    }

    const data = loadData();
    let importedCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const rowErrors = [];

        if (!entry.type || !['expense', 'income'].includes(entry.type)) {
            rowErrors.push('invalid type');
        }
        const amount = parseFloat(entry.amount);
        if (isNaN(amount) || amount <= 0) {
            rowErrors.push('invalid amount');
        }
        if (!entry.category || typeof entry.category !== 'string') {
            rowErrors.push('missing category');
        }
        if (!entry.date || isNaN(new Date(entry.date + 'T00:00:00').getTime())) {
            rowErrors.push('invalid date');
        }

        if (rowErrors.length > 0) {
            errors.push(`Row ${i + 1}: ${rowErrors.join(', ')}`);
            continue;
        }

        data.transactions.push({
            id: entry.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 9)),
            type: entry.type,
            amount: amount,
            category: entry.category,
            date: entry.date,
            note: entry.note || '',
            paymentMethod: entry.paymentMethod || '',
            createdAt: entry.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        importedCount++;
    }

    saveData(data);
    return { success: importedCount > 0, imported: importedCount, errors };
}
