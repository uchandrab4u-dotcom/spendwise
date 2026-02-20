// ============================================================
// SPENDWISE — Main Application Controller
// ============================================================

import {
    generateId, sanitize, formatCurrency, formatDate,
    formatMonthYear, getToday, getNow, validateTransaction,
    daysInMonth, groupByDay, DEFAULT_CATEGORIES, CATEGORY_ICONS,
    CATEGORY_COLORS, PAYMENT_METHODS, transactionsToCSV,
    downloadFile, debounce,
} from './utils.js';

import {
    loadData, saveData, getTransactions, getSettings,
    updateSettings, addTransaction, updateTransaction,
    deleteTransaction, restoreTransaction, resetAllData,
    importFromJSON,
} from './storage.js';

// ── State ──
let state = {
    currentView: 'dashboard',
    selectedMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),
    filterType: '',
    filterCategory: '',
    filterDateFrom: '',
    filterDateTo: '',
    searchQuery: '',
    sortBy: 'date-desc',
    editingTxnId: null,
    filterOpen: false,
};

let undoTimeout = null;
let undoTxn = null;

// ── DOM refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModal();
    initTransactionForm();
    initFilters();
    initSettings();
    initDataTools();
    render();
});

// ============================================================
// NAVIGATION
// ============================================================
function initNavigation() {
    $$('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.currentView = tab.dataset.view;
            $$('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $$('.view-panel').forEach(v => v.classList.remove('active'));
            $(`#view-${state.currentView}`).classList.add('active');
            render();
        });
    });
}

// ============================================================
// MODAL
// ============================================================
function initModal() {
    // Open modal
    const openBtns = $$('[data-open-modal]');
    openBtns.forEach(btn => btn.addEventListener('click', () => openAddModal()));

    // Close modal
    $('#modal-backdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    $('#modal-close-btn').addEventListener('click', closeModal);

    // Esc key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($('#modal-backdrop').classList.contains('open')) closeModal();
            if ($('#confirm-backdrop').classList.contains('open')) closeConfirmModal();
        }
    });
}

function openAddModal() {
    state.editingTxnId = null;
    $('#modal-title').textContent = 'Add Transaction';
    resetForm();
    $('#modal-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first interactive
    setTimeout(() => $('#txn-type-expense').focus(), 100);
}

function openEditModal(txnId) {
    const txns = getTransactions();
    const txn = txns.find(t => t.id === txnId);
    if (!txn) return;

    state.editingTxnId = txnId;
    $('#modal-title').textContent = 'Edit Transaction';

    // Fill form
    const expenseTab = $('#txn-type-expense');
    const incomeTab = $('#txn-type-income');
    if (txn.type === 'expense') {
        expenseTab.classList.add('active', 'expense-active');
        expenseTab.classList.remove('income-active');
        incomeTab.classList.remove('active', 'income-active', 'expense-active');
    } else {
        incomeTab.classList.add('active', 'income-active');
        incomeTab.classList.remove('expense-active');
        expenseTab.classList.remove('active', 'expense-active', 'income-active');
    }
    $('#txn-type-input').value = txn.type;
    // Populate correct category options for this type BEFORE setting value
    updateCategoryOptions(txn.type);
    $('#txn-amount').value = txn.amount;
    $('#txn-category').value = txn.category;
    $('#txn-date').value = txn.date;
    $('#txn-note').value = txn.note || '';
    $('#txn-payment').value = txn.paymentMethod || '';
    // Clear any previous errors
    $$('.form-error').forEach(el => el.textContent = '');
    $$('.input.error, .select.error').forEach(el => el.classList.remove('error'));

    $('#modal-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    $('#modal-backdrop').classList.remove('open');
    document.body.style.overflow = '';
    state.editingTxnId = null;
    resetForm();
}

function resetForm() {
    $('#txn-form').reset();
    $('#txn-date').value = getToday();
    $('#txn-type-input').value = 'expense';
    const expenseTab = $('#txn-type-expense');
    const incomeTab = $('#txn-type-income');
    expenseTab.classList.add('active', 'expense-active');
    expenseTab.classList.remove('income-active');
    incomeTab.classList.remove('active', 'income-active', 'expense-active');
    $$('.form-error').forEach(el => el.textContent = '');
    $$('.input.error, .select.error').forEach(el => el.classList.remove('error'));
}

// ============================================================
// FORM
// ============================================================
function initTransactionForm() {
    // Type tabs
    const expenseTab = $('#txn-type-expense');
    const incomeTab = $('#txn-type-income');
    const typeInput = $('#txn-type-input');

    expenseTab.addEventListener('click', () => {
        typeInput.value = 'expense';
        expenseTab.classList.add('active', 'expense-active');
        expenseTab.classList.remove('income-active');
        incomeTab.classList.remove('active', 'income-active', 'expense-active');
        updateCategoryOptions('expense');
    });

    incomeTab.addEventListener('click', () => {
        typeInput.value = 'income';
        incomeTab.classList.add('active', 'income-active');
        incomeTab.classList.remove('expense-active');
        expenseTab.classList.remove('active', 'expense-active', 'income-active');
        updateCategoryOptions('income');
    });

    // Populate categories
    updateCategoryOptions('expense');

    // Populate payment methods
    const paySelect = $('#txn-payment');
    PAYMENT_METHODS.forEach(pm => {
        const opt = document.createElement('option');
        opt.value = pm;
        opt.textContent = pm;
        paySelect.appendChild(opt);
    });

    // Set default date
    $('#txn-date').value = getToday();

    // Submit
    $('#txn-form').addEventListener('submit', handleFormSubmit);
}

function updateCategoryOptions(type) {
    const select = $('#txn-category');
    const current = select.value;
    select.innerHTML = '<option value="">Select category</option>';

    const expenseCategories = DEFAULT_CATEGORIES.filter(c =>
        !['Salary', 'Freelance', 'Investment'].includes(c)
    );
    const incomeCategories = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];

    const cats = type === 'income' ? incomeCategories : expenseCategories;
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });

    // Restore selection if still valid
    if (cats.includes(current)) select.value = current;
}

function handleFormSubmit(e) {
    e.preventDefault();

    const txnData = {
        type: $('#txn-type-input').value,
        amount: parseFloat($('#txn-amount').value),
        category: $('#txn-category').value,
        date: $('#txn-date').value,
        note: $('#txn-note').value.trim(),
        paymentMethod: $('#txn-payment').value,
    };

    const { valid, errors } = validateTransaction(txnData);

    // Clear previous errors
    $$('.form-error').forEach(el => el.textContent = '');
    $$('.input.error, .select.error').forEach(el => el.classList.remove('error'));

    if (!valid) {
        // Show first error
        const errorEl = $('#form-error-msg');
        errorEl.textContent = errors[0];
        // Highlight fields
        if (errors.some(e => e.includes('Amount'))) $('#txn-amount').classList.add('error');
        if (errors.some(e => e.includes('Category'))) $('#txn-category').classList.add('error');
        if (errors.some(e => e.includes('date'))) $('#txn-date').classList.add('error');
        return;
    }

    const now = getNow();

    if (state.editingTxnId) {
        updateTransaction(state.editingTxnId, {
            ...txnData,
            updatedAt: now,
        });
    } else {
        addTransaction({
            ...txnData,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        });
    }

    closeModal();
    render();
}

// ============================================================
// DELETE + UNDO
// ============================================================
function handleDelete(txnId) {
    const deleted = deleteTransaction(txnId);
    if (!deleted) return;

    // Clear previous undo
    if (undoTimeout) {
        clearTimeout(undoTimeout);
        undoTxn = null;
    }

    undoTxn = deleted;
    showToast('Transaction deleted', () => {
        if (undoTxn) {
            restoreTransaction(undoTxn);
            undoTxn = null;
            hideToast();
            render();
        }
    });

    undoTimeout = setTimeout(() => {
        undoTxn = null;
        hideToast();
    }, 5000);

    render();
}

function showToast(message, onUndo) {
    const container = $('#toast-container');
    container.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
    <span>${sanitize(message)}</span>
    <button class="btn btn--primary" id="undo-btn" aria-label="Undo delete">Undo</button>
  `;
    container.appendChild(toast);
    toast.querySelector('#undo-btn').addEventListener('click', onUndo);
}

function hideToast() {
    $('#toast-container').innerHTML = '';
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function initFilters() {
    // Toggle filter panel
    $('#filter-toggle-btn').addEventListener('click', () => {
        state.filterOpen = !state.filterOpen;
        $('#filter-panel').classList.toggle('open', state.filterOpen);
        $('#filter-toggle-btn').classList.toggle('active', state.filterOpen);
    });

    // Search
    $('#search-input').addEventListener('input', debounce((e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderTransactions();
    }, 250));

    // Filter inputs
    $('#filter-type').addEventListener('change', (e) => {
        state.filterType = e.target.value;
        renderTransactions();
    });
    $('#filter-category').addEventListener('change', (e) => {
        state.filterCategory = e.target.value;
        renderTransactions();
    });
    $('#filter-date-from').addEventListener('change', (e) => {
        state.filterDateFrom = e.target.value;
        renderTransactions();
    });
    $('#filter-date-to').addEventListener('change', (e) => {
        state.filterDateTo = e.target.value;
        renderTransactions();
    });

    // Clear filters
    $('#clear-filters-btn').addEventListener('click', () => {
        state.filterType = '';
        state.filterCategory = '';
        state.filterDateFrom = '';
        state.filterDateTo = '';
        state.searchQuery = '';
        $('#filter-type').value = '';
        $('#filter-category').value = '';
        $('#filter-date-from').value = '';
        $('#filter-date-to').value = '';
        $('#search-input').value = '';
        renderTransactions();
    });

    // Sort
    $('#sort-select').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderTransactions();
    });

    // Populate filter category options
    populateFilterCategories();
}

function populateFilterCategories() {
    const select = $('#filter-category');
    select.innerHTML = '<option value="">All</option>';
    DEFAULT_CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

function getFilteredTransactions() {
    let txns = getTransactions();

    // Filter by month/year for transaction view (show all, but allow date range)
    if (state.filterDateFrom) {
        txns = txns.filter(t => t.date >= state.filterDateFrom);
    }
    if (state.filterDateTo) {
        txns = txns.filter(t => t.date <= state.filterDateTo);
    }
    if (state.filterType) {
        txns = txns.filter(t => t.type === state.filterType);
    }
    if (state.filterCategory) {
        txns = txns.filter(t => t.category === state.filterCategory);
    }
    if (state.searchQuery) {
        txns = txns.filter(t =>
            (t.note || '').toLowerCase().includes(state.searchQuery) ||
            (t.category || '').toLowerCase().includes(state.searchQuery)
        );
    }

    // Sort
    txns.sort((a, b) => {
        switch (state.sortBy) {
            case 'date-asc': return a.date.localeCompare(b.date);
            case 'amount-desc': return b.amount - a.amount;
            case 'amount-asc': return a.amount - b.amount;
            case 'date-desc':
            default: return b.date.localeCompare(a.date);
        }
    });

    return txns;
}

// ============================================================
// SETTINGS
// ============================================================
function initSettings() {
    const settings = getSettings();

    // Currency
    const currencyInput = $('#currency-input');
    currencyInput.value = settings.currencySymbol || '₹';
    currencyInput.addEventListener('change', (e) => {
        updateSettings({ currencySymbol: e.target.value || '₹' });
        render();
    });

    // Budget
    const budgetInput = $('#budget-input');
    budgetInput.value = settings.monthlyBudget || '';
    budgetInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 0;
        updateSettings({ monthlyBudget: val });
        render();
    });
}

function initDataTools() {
    // Export CSV
    $('#export-csv-btn').addEventListener('click', () => {
        const txns = getTransactions();
        if (txns.length === 0) {
            alert('No transactions to export.');
            return;
        }
        const settings = getSettings();
        const csv = transactionsToCSV(txns, settings.currencySymbol);
        downloadFile(csv, `spendwise-export-${getToday()}.csv`, 'text/csv');
    });

    // Import JSON
    $('#import-json-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = importFromJSON(ev.target.result);
                if (result.success) {
                    let msg = `Successfully imported ${result.imported} transaction(s).`;
                    if (result.errors.length > 0) {
                        msg += `\n\nSkipped entries:\n${result.errors.join('\n')}`;
                    }
                    alert(msg);
                    render();
                } else {
                    alert('Import failed:\n' + result.errors.join('\n'));
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // Reset data
    $('#reset-data-btn').addEventListener('click', () => {
        openConfirmModal(
            'Reset All Data',
            'This will permanently delete all transactions and settings. This cannot be undone.',
            () => {
                resetAllData();
                // Reset settings UI
                $('#currency-input').value = '₹';
                $('#budget-input').value = '';
                closeConfirmModal();
                render();
            }
        );
    });
}

// ============================================================
// CONFIRM MODAL
// ============================================================
function openConfirmModal(title, message, onConfirm) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    const confirmBtn = $('#confirm-yes-btn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.id = 'confirm-yes-btn';
    newBtn.addEventListener('click', onConfirm);
    $('#confirm-no-btn').addEventListener('click', closeConfirmModal);
    $('#confirm-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
    $('#confirm-backdrop').classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================================
// RENDER
// ============================================================
function render() {
    if (state.currentView === 'dashboard') {
        renderDashboard();
    } else if (state.currentView === 'transactions') {
        renderTransactions();
    }
    // Settings is static, no re-render needed
}

// ── Dashboard ──
function renderDashboard() {
    const settings = getSettings();
    const symbol = settings.currencySymbol || '₹';
    const txns = getTransactions();

    // Filter by selected month
    const monthTxns = txns.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getMonth() === state.selectedMonth && d.getFullYear() === state.selectedYear;
    });

    // Summaries
    const totalIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;

    $('#summary-income').textContent = formatCurrency(totalIncome, symbol);
    $('#summary-expense').textContent = formatCurrency(totalExpense, symbol);
    $('#summary-net').textContent = (net >= 0 ? '+' : '-') + formatCurrency(Math.abs(net), symbol);

    // Month selector
    $('#month-label').textContent = formatMonthYear(state.selectedYear, state.selectedMonth);

    // Budget
    renderBudget(totalExpense, settings, symbol);

    // Category breakdown
    renderCategoryBreakdown(monthTxns, symbol);

    // Trend chart
    renderTrendChart(monthTxns, symbol);
}

function renderBudget(totalExpense, settings, symbol) {
    const budget = settings.monthlyBudget || 0;
    const budgetInfo = $('#budget-info');
    const budgetBar = $('#budget-bar');
    const budgetWarning = $('#budget-warning');

    if (budget <= 0) {
        $('#budget-spent').textContent = `${formatCurrency(totalExpense, symbol)} spent`;
        budgetBar.style.width = '0%';
        budgetBar.className = 'budget-bar';
        budgetWarning.textContent = '';
        budgetWarning.className = 'budget-warning-text';
        $('#budget-total').textContent = 'No budget set';
        return;
    }

    const pct = Math.min((totalExpense / budget) * 100, 100);
    budgetBar.style.width = pct + '%';

    $('#budget-spent').textContent = `${formatCurrency(totalExpense, symbol)} of ${formatCurrency(budget, symbol)}`;
    $('#budget-total').textContent = `${Math.round(pct)}%`;

    budgetBar.className = 'budget-bar';
    budgetWarning.className = 'budget-warning-text';
    budgetWarning.textContent = '';

    if (totalExpense >= budget) {
        budgetBar.classList.add('danger');
        budgetWarning.classList.add('danger');
        budgetWarning.textContent = '⚠ You have exceeded your monthly budget!';
    } else if (totalExpense >= budget * 0.8) {
        budgetBar.classList.add('warning');
        budgetWarning.classList.add('warning');
        budgetWarning.textContent = `⚠ You've used ${Math.round(pct)}% of your budget.`;
    }
}

function renderCategoryBreakdown(monthTxns, symbol) {
    const container = $('#category-breakdown');
    const expenses = monthTxns.filter(t => t.type === 'expense');

    if (expenses.length === 0) {
        container.innerHTML = '<p class="text-muted" style="padding: var(--sp-4) 0; text-align: center;">No expenses this month</p>';
        return;
    }

    // Aggregate
    const catMap = {};
    let total = 0;
    for (const t of expenses) {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        total += t.amount;
    }

    // Sort desc, top 5 + other
    let sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    let display = sorted.slice(0, 5);
    const othersTotal = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (othersTotal > 0) display.push(['Other', othersTotal]);

    let html = '';
    display.forEach(([cat, amount], i) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
        html += `
      <li class="category-row">
        <span class="category-dot" style="background:${color}"></span>
        <span class="category-name">${sanitize(cat)}</span>
        <span class="category-amount">${formatCurrency(amount, symbol)}</span>
        <span class="category-pct">${pct}%</span>
      </li>`;
    });

    container.innerHTML = html;
}

function renderTrendChart(monthTxns, symbol) {
    const container = $('#trend-chart');
    const days = daysInMonth(state.selectedYear, state.selectedMonth);
    const expenses = monthTxns.filter(t => t.type === 'expense');

    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: var(--sp-6) 0;"><p class="text-muted">No expense data to chart</p></div>';
        return;
    }

    // Daily totals
    const dailyTotals = new Array(days).fill(0);
    for (const t of expenses) {
        const day = new Date(t.date + 'T00:00:00').getDate();
        dailyTotals[day - 1] += t.amount;
    }

    // Cumulative
    const cumulative = [];
    let running = 0;
    for (let i = 0; i < days; i++) {
        running += dailyTotals[i];
        cumulative.push(running);
    }

    const maxVal = Math.max(...cumulative, 1);

    // SVG dimensions
    const svgW = 600;
    const svgH = 160;
    const padL = 10;
    const padR = 10;
    const padT = 10;
    const padB = 25;

    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    // Build path
    const points = cumulative.map((val, i) => {
        const x = padL + (i / (days - 1 || 1)) * plotW;
        const y = padT + plotH - (val / maxVal) * plotH;
        return `${x},${y}`;
    });

    const linePath = points.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(' ');
    const areaPath = linePath + ` L${padL + plotW},${padT + plotH} L${padL},${padT + plotH} Z`;

    // X-axis labels
    const labelDays = [1, Math.ceil(days / 4), Math.ceil(days / 2), Math.ceil(3 * days / 4), days];
    const labels = labelDays.map(d => {
        const x = padL + ((d - 1) / (days - 1 || 1)) * plotW;
        return `<text x="${x}" y="${svgH - 4}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="var(--font-primary)">${d}</text>`;
    }).join('');

    // Grid lines
    const gridLines = [0.25, 0.5, 0.75].map(frac => {
        const y = padT + plotH - frac * plotH;
        return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--border-default)" stroke-dasharray="4,4"/>`;
    }).join('');

    container.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" role="img" aria-label="Cumulative spending trend chart">
      ${gridLines}
      <path d="${areaPath}" fill="var(--accent-muted)" />
      <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${labels}
    </svg>`;
}

// ── Transactions View ──
function renderTransactions() {
    const settings = getSettings();
    const symbol = settings.currencySymbol || '₹';
    const txns = getFilteredTransactions();
    const container = $('#txn-list');

    if (txns.length === 0) {
        const hasFilters = state.searchQuery || state.filterType || state.filterCategory || state.filterDateFrom || state.filterDateTo;
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${hasFilters ? '🔍' : '📝'}</div>
        <h3 class="empty-state__title">${hasFilters ? 'No results found' : 'No transactions yet'}</h3>
        <p class="empty-state__desc">${hasFilters ? 'Try adjusting your filters or search query.' : 'Tap the + button to add your first transaction.'}</p>
        ${!hasFilters ? '<button class="btn btn--primary" data-open-modal aria-label="Add Transaction">Add Transaction</button>' : ''}
      </div>`;

        // Re-bind the new button
        const newBtn = container.querySelector('[data-open-modal]');
        if (newBtn) newBtn.addEventListener('click', openAddModal);
        return;
    }

    // Group by day
    const grouped = groupByDay(txns);
    let html = '';

    for (const [date, dayTxns] of grouped) {
        const dayIncome = dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const dayExpense = dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const dayNet = dayIncome - dayExpense;

        html += `
      <div class="day-group">
        <div class="day-header">
          <span class="day-date">${formatDate(date)}</span>
          <span class="day-total" style="color: ${dayNet >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}">
            ${dayNet >= 0 ? '+' : '-'}${formatCurrency(Math.abs(dayNet), symbol)}
          </span>
        </div>`;

        for (const txn of dayTxns) {
            const icon = CATEGORY_ICONS[txn.category] || '📌';
            const amountClass = txn.type === 'income' ? 'income' : 'expense';
            const prefix = txn.type === 'income' ? '+' : '-';

            html += `
        <div class="txn-row" data-txn-id="${txn.id}" tabindex="0" role="button" aria-label="${txn.type} ${txn.category} ${formatCurrency(txn.amount, symbol)}">
          <div class="txn-icon">${icon}</div>
          <div class="txn-details">
            <div class="txn-category">${sanitize(txn.category)}</div>
            ${txn.note ? `<div class="txn-note">${sanitize(txn.note)}</div>` : ''}
          </div>
          <span class="txn-amount ${amountClass}">${prefix}${formatCurrency(txn.amount, symbol)}</span>
          <div class="txn-actions">
            <button class="btn--icon edit-txn-btn" data-edit-id="${txn.id}" aria-label="Edit transaction">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn--icon delete-txn-btn" data-delete-id="${txn.id}" aria-label="Delete transaction">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
        }

        html += '</div>';
    }

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.edit-txn-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(btn.dataset.editId);
        });
    });

    container.querySelectorAll('.delete-txn-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(btn.dataset.deleteId);
        });
    });

    // Row click to edit
    container.querySelectorAll('.txn-row').forEach(row => {
        row.addEventListener('click', () => openEditModal(row.dataset.txnId));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEditModal(row.dataset.txnId);
            }
        });
    });
}

// ── Month navigation ──
document.addEventListener('DOMContentLoaded', () => {
    $('#month-prev').addEventListener('click', () => {
        state.selectedMonth--;
        if (state.selectedMonth < 0) {
            state.selectedMonth = 11;
            state.selectedYear--;
        }
        renderDashboard();
    });

    $('#month-next').addEventListener('click', () => {
        state.selectedMonth++;
        if (state.selectedMonth > 11) {
            state.selectedMonth = 0;
            state.selectedYear++;
        }
        renderDashboard();
    });

    // Set budget from dashboard
    $('#set-budget-btn').addEventListener('click', () => {
        // Switch to settings view
        state.currentView = 'settings';
        $$('.nav-tab').forEach(t => t.classList.remove('active'));
        $('[data-view="settings"]').classList.add('active');
        $$('.view-panel').forEach(v => v.classList.remove('active'));
        $('#view-settings').classList.add('active');
        setTimeout(() => $('#budget-input').focus(), 200);
    });
});
