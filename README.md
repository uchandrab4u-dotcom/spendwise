# SpendWise — Expense Tracker

A premium, matte-black themed personal expense tracker built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step — just open `index.html`.

## ✨ Features

- **Transactions CRUD** — Add, edit, delete income & expenses with undo support
- **Dashboard** — Monthly summary (income, expense, net), category breakdown, cumulative spending chart (SVG)
- **Budgeting** — Set a monthly budget, see progress bar with warning at 80% and alert at 100%
- **Filters & Search** — Filter by type, category, date range; search by note/category; sort by date or amount
- **Data Tools** — Export to CSV, import from JSON (validated), reset all data with confirmation
- **Settings** — Customizable currency symbol, monthly budget
- **Offline & Local** — All data persists in `localStorage` with versioned schema and migrations
- **Accessible** — Keyboard navigable, ARIA labels, focus-visible states, respects `prefers-reduced-motion`
- **Mobile-first** — Responsive layout with FAB on mobile, desktop-optimized toolbar

## 🚀 How to Run

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
2. That's it. No server, no install, no build step needed.

> For local development with ES modules, use a simple static server:
> ```
> npx -y serve .
> ```

## 📦 Data Schema

```json
{
  "version": 1,
  "settings": {
    "currencySymbol": "₹",
    "monthlyBudget": 0
  },
  "transactions": [
    {
      "id": "string",
      "type": "expense | income",
      "amount": 0,
      "category": "string",
      "date": "YYYY-MM-DD",
      "note": "string",
      "paymentMethod": "string",
      "createdAt": "ISO datetime",
      "updatedAt": "ISO datetime"
    }
  ]
}
```

**Storage key:** `expenseTracker:data`
**Versioning:** `migrate()` function in `storage.js` handles schema upgrades.

## 🗂️ Project Structure

```
├── index.html      — SPA layout, modals, empty states
├── styles.css      — Design tokens, component styles, responsive
├── app.js          — Main controller (type="module")
├── storage.js      — localStorage CRUD + migrations
├── utils.js        — Formatting, validation, helpers
└── README.md       — This file
```

## ✅ Manual Test Checklist

1. [ ] Open `index.html` — dashboard loads with no errors
2. [ ] Add an expense → appears in transactions, dashboard updates
3. [ ] Add an income → reflected in summary cards and net
4. [ ] Edit a transaction → changes persist
5. [ ] Delete a transaction → toast appears, undo works within 5s
6. [ ] Set monthly budget → progress bar shows, warning at 80%/100%
7. [ ] Navigate months → summary and chart update correctly
8. [ ] Search by note → filters transactions live
9. [ ] Filter by type/category/date range → results update
10. [ ] Sort by date/amount → order changes
11. [ ] Export CSV → file downloads with correct data
12. [ ] Import JSON → valid entries added, malformed rejected with error
13. [ ] Reset data → confirmation modal, all data cleared
14. [ ] Change currency symbol → all amounts update
15. [ ] Resize to mobile → FAB visible, layout adapts
16. [ ] Keyboard navigation → Tab/Enter work, Esc closes modal
17. [ ] No console errors throughout

## 🔮 Future Improvements

- Multi-currency support with exchange rates
- Recurring transactions
- Data backup/restore to file
- PWA with service worker for full offline
- Charts: pie chart for categories, bar chart comparison
- Dark/light theme toggle
- Tags and multi-category support
- Cloud sync option
