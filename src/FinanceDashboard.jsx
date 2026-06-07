import { useState, useMemo, useEffect, useRef } from "react";
import BarcodeScanner from "./BarcodeScanner";
import { saveData, onDataChange } from "./firebase";

// Suggested starter shopping list seeded from the user's fridge/pantry photos
// (things that looked low or absent). All editable.
const DEFAULT_GROCERIES = [
  { id: 1001, name: "Eggs (dozen)", barcode: null, qty: 1, checked: false, price: null },
  { id: 1002, name: "Bread", barcode: null, qty: 1, checked: false, price: null },
  { id: 1003, name: "Milk", barcode: null, qty: 2, checked: false, price: null },
  { id: 1004, name: "Bananas", barcode: null, qty: 1, checked: false, price: null },
  { id: 1005, name: "Apples", barcode: null, qty: 1, checked: false, price: null },
  { id: 1006, name: "Berries", barcode: null, qty: 1, checked: false, price: null },
  { id: 1007, name: "Lettuce / salad mix", barcode: null, qty: 1, checked: false, price: null },
  { id: 1008, name: "Baby spinach", barcode: null, qty: 1, checked: false, price: null },
  { id: 1009, name: "Brown onions", barcode: null, qty: 1, checked: false, price: null },
  { id: 1010, name: "Tomatoes", barcode: null, qty: 1, checked: false, price: null },
  { id: 1011, name: "Snacks (lunchbox)", barcode: null, qty: 1, checked: false, price: null },
  { id: 1012, name: "Butter / spread", barcode: null, qty: 1, checked: false, price: null },
];

const WEEKS_PER_YEAR = 52;
const FREQ_OPTIONS = ["Weekly", "Fortnightly", "Monthly", "Per Term", "Yearly"];
const FREQ_TO_WEEKLY = {
  Weekly: 1,
  Fortnightly: 0.5,
  Monthly: 1 / 4.33,
  "Per Term": 1 / 10,
  Yearly: 1 / WEEKS_PER_YEAR,
};

const CATEGORIES = [
  { name: "Kids", color: "#F4A261" },
  { name: "Food", color: "#2A9D8F" },
  { name: "Health", color: "#7B68EE" },
  { name: "Utilities", color: "#E9C46A" },
  { name: "Debt", color: "#E76F51" },
  { name: "Subscriptions", color: "#669BBC" },
  { name: "Activities", color: "#A7C957" },
  { name: "Other", color: "#999" },
];

const DEFAULT_EXPENSES = [
  { id: 1, name: "Daycare", amount: 200, freq: "Weekly", category: "Kids", enabled: true },
  { id: 2, name: "Food", amount: 100, freq: "Weekly", category: "Food", enabled: true },
  { id: 3, name: "School fees", amount: 100, freq: "Weekly", category: "Kids", enabled: true },
  { id: 4, name: "Loans", amount: 50, freq: "Weekly", category: "Debt", enabled: true },
  { id: 5, name: "Afterpay", amount: 100, freq: "Weekly", category: "Debt", enabled: true },
  { id: 6, name: "Medication", amount: 500, freq: "Monthly", category: "Health", enabled: true },
  { id: 7, name: "Water", amount: 100, freq: "Monthly", category: "Utilities", enabled: true },
  { id: 8, name: "Power", amount: 100, freq: "Monthly", category: "Utilities", enabled: true },
  { id: 9, name: "Subscriptions", amount: 50, freq: "Monthly", category: "Subscriptions", enabled: true },
  { id: 10, name: "Swimming", amount: 200, freq: "Monthly", category: "Activities", enabled: true },
  { id: 11, name: "Dance", amount: 350, freq: "Per Term", category: "Activities", enabled: true },
  { id: 12, name: "Other (Term)", amount: 200, freq: "Per Term", category: "Other", enabled: true },
];

const DEFAULT_INCOME = [{ id: 1, name: "Primary Income", amount: 0, freq: "Weekly" }];

const fmt = (v) => {
  const num = Math.abs(v);
  const str = num < 1 && num > 0 ? num.toFixed(2) : num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
  return (v < 0 ? "-" : "") + "$" + str.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
const toWeekly = (amount, freq) => amount * FREQ_TO_WEEKLY[freq];

function DonutChart({ segments, total, label }) {
  const size = 150, stroke = 22, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1a1a2e" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const dash = (total > 0 ? seg.value / total : 0) * circ, gap = circ - dash, o = offset;
        offset += dash;
        return <circle key={i} cx={size/2} cy={size/2} r={radius} fill="none" stroke={seg.color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-o}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "all 0.5s ease" }} />;
      })}
      <text x={size/2} y={size/2 - 8} textAnchor="middle" fill="#999" style={{ fontSize: 10 }}>{label}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fill="#fff" style={{ fontSize: 17, fontWeight: 700 }}>{fmt(total)}</text>
    </svg>
  );
}

function BarMeter({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 3 }}>
        <span>{label}</span><span>{fmt(value)} / {fmt(max)}</span>
      </div>
      <div style={{ height: 8, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function ScenarioCard({ income, expenses, color, label }) {
  const left = income - expenses;
  const plans = income <= 1000
    ? [{ n: "Emergency savings", v: 50 }, { n: "Buffer/flex", v: left - 50 > 0 ? left - 50 : 0 }]
    : income <= 1200
    ? [{ n: "Emergency savings", v: 100 }, { n: "Debt extra payments", v: 75 }, { n: "Spending money", v: Math.max(0, left - 175) }]
    : [{ n: "Savings/investing", v: 250 }, { n: "Debt payoff boost", v: 150 }, { n: "Lifestyle/fun", v: Math.max(0, left - 400) }];
  const verdict = income <= 1000 ? "Tight but manageable" : income <= 1200 ? "Healthy position" : "Strong position";
  return (
    <div style={{ padding: 14, background: "#12122a", borderRadius: 10, borderLeft: `3px solid ${color}`, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#ddd" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'Space Mono'" }}>{fmt(income)}/wk</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 10 }}>
        <span>Leftover</span>
        <span style={{ color: left >= 0 ? "#2A9D8F" : "#E8675A", fontFamily: "'Space Mono'" }}>{fmt(left)}/wk</span>
      </div>
      {plans.filter(p => p.v > 0).map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#777", padding: "3px 0" }}>
          <span>{p.n}</span>
          <span style={{ fontFamily: "'Space Mono'", color: "#aaa" }}>{fmt(p.v)}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 12, color, fontWeight: 500 }}>{verdict}</div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);
  const [incomes, setIncomes] = useState(DEFAULT_INCOME);
  const [savingsGoals, setSavingsGoals] = useState([
    { id: 1, name: "Emergency Fund", target: 1000, saved: 0 },
  ]);
  const [view, setView] = useState("Weekly");
  const [activeTab, setActiveTab] = useState("snapshot");
  const [nextId, setNextId] = useState(2000);
  const isRemoteUpdate = useRef(false);

  const [groceryItems, setGroceryItems] = useState(DEFAULT_GROCERIES);
  const [priceBook, setPriceBook] = useState({});
  const [shoppingTrips, setShoppingTrips] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [newGrocery, setNewGrocery] = useState("");

  // Listen for changes from Firebase (your wife's device or yours)
  useEffect(() => {
    return onDataChange((data) => {
      isRemoteUpdate.current = true;
      if (data.expenses) setExpenses(data.expenses);
      if (data.incomes) setIncomes(data.incomes);
      if (data.savingsGoals) setSavingsGoals(data.savingsGoals);
      if (data.nextId) setNextId(data.nextId);
      if (data.groceryItems) setGroceryItems(data.groceryItems);
      if (data.priceBook) setPriceBook(data.priceBook);
      if (data.shoppingTrips) setShoppingTrips(data.shoppingTrips);
      setTimeout(() => { isRemoteUpdate.current = false; }, 0);
    });
  }, []);

  // Save to Firebase when data changes locally
  useEffect(() => {
    if (isRemoteUpdate.current) return;
    saveData({ expenses, incomes, savingsGoals, nextId, groceryItems, priceBook, shoppingTrips });
  }, [expenses, incomes, savingsGoals, nextId, groceryItems, priceBook, shoppingTrips]);
  const [editingExpense, setEditingExpense] = useState(null);

  const viewMult = { Weekly: 1, Fortnightly: 2, Monthly: 4.33, Yearly: WEEKS_PER_YEAR };
  const mult = viewMult[view];

  const totalExpW = useMemo(() => expenses.filter(e => e.enabled).reduce((s, e) => s + toWeekly(e.amount, e.freq), 0), [expenses]);
  const totalIncW = useMemo(() => incomes.reduce((s, i) => s + toWeekly(i.amount, i.freq), 0), [incomes]);
  const surplus = totalIncW - totalExpW;

  const fixedWeekly = useMemo(() => expenses.filter(e => e.enabled && e.freq === "Weekly").reduce((s, e) => s + e.amount, 0), [expenses]);
  const monthlyAsWeekly = useMemo(() => expenses.filter(e => e.enabled && e.freq === "Monthly").reduce((s, e) => s + toWeekly(e.amount, e.freq), 0), [expenses]);
  const termAsWeekly = useMemo(() => expenses.filter(e => e.enabled && e.freq === "Per Term").reduce((s, e) => s + toWeekly(e.amount, e.freq), 0), [expenses]);

  const catBreakdown = useMemo(() => {
    const map = {};
    expenses.filter(e => e.enabled).forEach(e => { map[e.category] = (map[e.category] || 0) + toWeekly(e.amount, e.freq); });
    return CATEGORIES.filter(c => map[c.name]).map(c => ({ name: c.name, value: map[c.name], color: c.color }));
  }, [expenses]);

  const getId = () => { const id = nextId; setNextId(id + 1); return id; };
  const addExpense = () => { const id = getId(); setExpenses([...expenses, { id, name: "", amount: 0, freq: "Weekly", category: "Other", enabled: true }]); setEditingExpense(id); };
  const addIncome = () => setIncomes([...incomes, { id: getId(), name: "", amount: 0, freq: "Weekly" }]);
  const addGoal = () => setSavingsGoals([...savingsGoals, { id: getId(), name: "", target: 1000, saved: 0 }]);
  const updateExpense = (id, f, v) => setExpenses(expenses.map(e => e.id === id ? { ...e, [f]: v } : e));
  const updateIncome = (id, f, v) => setIncomes(incomes.map(i => i.id === id ? { ...i, [f]: v } : i));
  const updateGoal = (id, f, v) => setSavingsGoals(savingsGoals.map(g => g.id === id ? { ...g, [f]: v } : g));
  const removeExpense = (id) => { setExpenses(expenses.filter(e => e.id !== id)); setEditingExpense(null); };
  const removeIncome = (id) => setIncomes(incomes.filter(i => i.id !== id));
  const removeGoal = (id) => setSavingsGoals(savingsGoals.filter(g => g.id !== id));
  const weeksToGoal = (g) => { if (surplus <= 0) return Infinity; const r = g.target - g.saved; return r <= 0 ? 0 : Math.ceil(r / surplus); };

  // ===== Groceries =====
  const addGrocery = (name) => {
    const n = (name ?? newGrocery).trim();
    if (!n) return;
    setGroceryItems([...groceryItems, { id: getId(), name: n, barcode: null, qty: 1, checked: false, price: null }]);
    setNewGrocery("");
  };
  const updateGrocery = (id, f, v) => setGroceryItems(groceryItems.map(g => g.id === id ? { ...g, [f]: v } : g));
  const removeGrocery = (id) => setGroceryItems(groceryItems.filter(g => g.id !== id));
  const changeQty = (id, d) => setGroceryItems(groceryItems.map(g => g.id === id ? { ...g, qty: Math.max(1, g.qty + d) } : g));

  // Called from the scanner: merge by barcode (or add new), prefill price + check it.
  const handleScanned = ({ barcode, name, price }) => {
    setGroceryItems(prev => {
      const existing = prev.find(g => g.barcode === barcode);
      if (existing) {
        return prev.map(g => g.id === existing.id ? { ...g, name, price, checked: true } : g);
      }
      return [...prev, { id: getId(), name, barcode, qty: 1, checked: true, price }];
    });
    setPriceBook(prev => {
      const prior = prev[barcode];
      return {
        ...prev,
        [barcode]: {
          name,
          lastPrice: price,
          history: [...(prior?.history || []), { date: new Date().toISOString().slice(0, 10), price }].slice(-12),
        },
      };
    });
  };

  const checkedGroceries = useMemo(() => groceryItems.filter(g => g.checked), [groceryItems]);
  const tripTotal = useMemo(() => checkedGroceries.reduce((s, g) => s + (g.price || 0) * g.qty, 0), [checkedGroceries]);

  const finishTrip = () => {
    if (checkedGroceries.length === 0) return;
    const total = tripTotal;
    let id = nextId;
    const tripId = id++;
    const expenseId = id++;
    setNextId(id);
    const trip = {
      id: tripId,
      date: new Date().toISOString().slice(0, 10),
      store: "Aldi",
      items: checkedGroceries.map(g => ({ name: g.name, barcode: g.barcode, price: g.price || 0, qty: g.qty })),
      total,
    };
    setShoppingTrips([trip, ...shoppingTrips]);
    // Remove the purchased items from the active list.
    setGroceryItems(groceryItems.filter(g => !g.checked));
    // Auto-sync into the Food budget via a single managed weekly line.
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.name === "Groceries (scanned)" && e.category === "Food");
      if (idx >= 0) {
        return prev.map((e, i) => i === idx ? { ...e, amount: total, enabled: true } : e);
      }
      return [...prev, { id: expenseId, name: "Groceries (scanned)", amount: total, freq: "Weekly", category: "Food", enabled: true }];
    });
    setActiveTab("groceries");
  };

  const afterpayWeekly = useMemo(() => {
    const ap = expenses.find(e => e.name === "Afterpay" && e.enabled);
    return ap ? toWeekly(ap.amount, ap.freq) : 0;
  }, [expenses]);

  // styles
  const inp = { background: "#12122a", border: "1px solid #2a2a4a", borderRadius: 8, color: "#eee", padding: "10px 12px", fontSize: 16, fontFamily: "'DM Sans'", outline: "none", width: "100%", boxSizing: "border-box", WebkitAppearance: "none" };
  const sel = { ...inp, appearance: "none", cursor: "pointer" };
  const card = { background: "#0f0f23", borderRadius: 14, padding: 16, border: "1px solid #1a1a3a" };
  const pill = (a) => ({ padding: "8px 14px", background: a ? "#2a2a4a" : "transparent", border: "none", color: a ? "#fff" : "#666", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: a ? 600 : 400, fontFamily: "'DM Sans'", whiteSpace: "nowrap", flexShrink: 0 });
  const addBtnS = { background: "none", border: "1px solid #2A9D8F", color: "#2A9D8F", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans'" };
  const delBtnS = { background: "#1a1a2e", border: "none", color: "#E8675A", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans'", width: "100%", marginTop: 8 };
  const tipCard = { padding: "10px 12px", background: "#12122a", borderRadius: 10, marginBottom: 8, fontSize: 13 };

  const TABS = [["snapshot", "Snapshot"], ["groceries", "Groceries"], ["plan", "Budget Plan"], ["expenses", "Expenses"], ["income", "Income"], ["goals", "Goals"], ["whatif", "What If"]];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a1a", color: "#e0e0e0", fontFamily: "'DM Sans', sans-serif", padding: "16px 12px", WebkitTextSizeAdjust: "100%", overflowX: "hidden", boxSizing: "border-box", width: "100%", maxWidth: "100vw" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`*, *::before, *::after { box-sizing: border-box; } body { margin: 0; overflow-x: hidden; }`}</style>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}><span style={{ color: "#2A9D8F" }}>$</span> Finance Tracker</h1>
      </div>

      {/* Period toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", WebkitOverflowScrolling: "touch", background: "#0f0f23", borderRadius: 10, padding: 3 }}>
        {["Weekly", "Fortnightly", "Monthly", "Yearly"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ ...pill(view === v), fontSize: 12, padding: "7px 12px" }}>{v}</button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Income", value: totalIncW, color: "#2A9D8F", sub: totalIncW === 0 ? "enter on Income tab" : "per " + view.toLowerCase() },
          { label: "Expenses", value: totalExpW, color: "#E8675A", sub: expenses.filter(e => e.enabled).length + " active items" },
          { label: "Surplus", value: surplus, color: surplus >= 0 ? "#2A9D8F" : "#E8675A", sub: surplus >= 0 ? "available" : "shortfall" },
        ].map(item => (
          <div key={item.label} style={{ ...card, padding: "12px 16px", borderLeft: `3px solid ${item.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>{item.sub}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>{fmt(item.value * mult)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", WebkitOverflowScrolling: "touch", background: "#0f0f23", borderRadius: 10, padding: 3, scrollbarWidth: "none" }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={pill(activeTab === key)}>{label}</button>
        ))}
      </div>

      {/* ===== SNAPSHOT ===== */}
      {activeTab === "snapshot" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Cost breakdown */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 10px", fontWeight: 500 }}>Weekly Expense Breakdown</h3>
            {[
              { label: "Fixed weekly costs", value: fixedWeekly, color: "#E76F51" },
              { label: "Monthly costs (as weekly)", value: monthlyAsWeekly, color: "#7B68EE" },
              { label: "Term costs (as weekly)", value: termAsWeekly, color: "#A7C957" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a2e" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{r.label}</span>
                </div>
                <span style={{ fontFamily: "'Space Mono'", fontSize: 14, color: "#ccc" }}>{fmt(r.value)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 15, fontWeight: 700 }}>
              <span style={{ color: "#ccc" }}>Total weekly</span>
              <span style={{ fontFamily: "'Space Mono'", color: "#E8675A" }}>{fmt(totalExpW)}</span>
            </div>
          </div>

          {/* Donut + categories */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 12px", fontWeight: 500 }}>By Category</h3>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <DonutChart segments={catBreakdown} total={totalExpW * mult} label={`${view} spend`} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
              {catBreakdown.map(c => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                  <span style={{ color: "#888" }}>{c.name}</span>
                  <span style={{ color: "#ccc", fontFamily: "'Space Mono'", fontSize: 11 }}>{fmt(c.value * mult)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top expenses */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 10px", fontWeight: 500 }}>Top Expenses</h3>
            {[...expenses].filter(e => e.enabled).sort((a, b) => toWeekly(b.amount, b.freq) - toWeekly(a.amount, a.freq)).slice(0, 7).map(e => {
              const cat = CATEGORIES.find(c => c.name === e.category);
              return (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1a1a2e" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: cat?.color || "#666", flexShrink: 0 }} />
                    <span style={{ fontSize: 14 }}>{e.name}</span>
                  </div>
                  <span style={{ fontFamily: "'Space Mono'", fontSize: 14, color: "#E8675A", flexShrink: 0 }}>{fmt(toWeekly(e.amount, e.freq) * mult)}</span>
                </div>
              );
            })}
          </div>

          {/* Income scenarios */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 6px", fontWeight: 500 }}>Income Scenarios</h3>
            <p style={{ fontSize: 12, color: "#555", margin: "0 0 12px" }}>How different weekly incomes would play out against your {fmt(totalExpW)} expenses.</p>
            <ScenarioCard income={1000} expenses={totalExpW} color="#E9C46A" label="Scenario A" />
            <ScenarioCard income={1200} expenses={totalExpW} color="#2A9D8F" label="Scenario B" />
            <ScenarioCard income={1500} expenses={totalExpW} color="#669BBC" label="Scenario C" />
          </div>
        </div>
      )}

      {/* ===== GROCERIES ===== */}
      {activeTab === "groceries" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, color: "#888", margin: 0, fontWeight: 500 }}>Shopping List</h3>
              <span style={{ fontSize: 12, color: "#666" }}>{checkedGroceries.length}/{groceryItems.length} in cart</span>
            </div>

            <button onClick={() => setScannerOpen(true)} style={{ width: "100%", background: "#2A9D8F", border: "none", color: "#04201c", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", marginBottom: 10 }}>
              📷 Scan barcode
            </button>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={newGrocery} onChange={(e) => setNewGrocery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addGrocery(); }}
                style={inp} placeholder="Add an item…" />
              <button onClick={() => addGrocery()} style={{ ...addBtnS, flexShrink: 0 }}>+ Add</button>
            </div>

            {groceryItems.length === 0 && (
              <div style={{ fontSize: 13, color: "#555", textAlign: "center", padding: "16px 0" }}>List is empty. Scan or add items above.</div>
            )}

            {groceryItems.map(g => (
              <div key={g.id} style={{ padding: "10px 0", borderBottom: "1px solid #1a1a2e", opacity: g.checked ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div onClick={() => updateGrocery(g.id, "checked", !g.checked)} style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    border: `2px solid ${g.checked ? "#2A9D8F" : "#333"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: g.checked ? "#2A9D8F" : "transparent", transition: "all 0.2s",
                  }}>
                    {g.checked && <span style={{ color: "#fff", fontSize: 13 }}>{"✓"}</span>}
                  </div>
                  <input value={g.name} onChange={(e) => updateGrocery(g.id, "name", e.target.value)}
                    style={{ ...inp, padding: "8px 10px", textDecoration: g.checked ? "line-through" : "none" }} placeholder="Item name" />
                  <button onClick={() => removeGrocery(g.id)} style={{ background: "#1a1a2e", border: "none", color: "#E8675A", borderRadius: 8, padding: "8px 11px", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#12122a", borderRadius: 8, border: "1px solid #2a2a4a" }}>
                    <button onClick={() => changeQty(g.id, -1)} style={{ background: "none", border: "none", color: "#999", padding: "6px 12px", fontSize: 16, cursor: "pointer" }}>−</button>
                    <span style={{ fontSize: 14, color: "#ccc", minWidth: 20, textAlign: "center", fontFamily: "'Space Mono'" }}>{g.qty}</span>
                    <button onClick={() => changeQty(g.id, 1)} style={{ background: "none", border: "none", color: "#999", padding: "6px 12px", fontSize: 16, cursor: "pointer" }}>+</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                    <span style={{ color: "#555", fontSize: 14 }}>$</span>
                    <input type="number" inputMode="decimal" value={g.price ?? ""} onChange={(e) => updateGrocery(g.id, "price", e.target.value === "" ? null : parseFloat(e.target.value) || 0)}
                      style={{ ...inp, padding: "6px 10px", textAlign: "right" }} placeholder="0.00" />
                  </div>
                  <span style={{ fontFamily: "'Space Mono'", fontSize: 13, color: "#ccc", minWidth: 60, textAlign: "right", flexShrink: 0 }}>{fmt((g.price || 0) * g.qty)}</span>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14, padding: "12px", background: "#12122a", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#888" }}>Cart total ({checkedGroceries.length} items)</span>
                <span style={{ fontFamily: "'Space Mono'", fontSize: 18, fontWeight: 700, color: "#2A9D8F" }}>{fmt(tripTotal)}</span>
              </div>
              <button onClick={finishTrip} disabled={checkedGroceries.length === 0} style={{
                width: "100%", background: checkedGroceries.length === 0 ? "#1a1a2e" : "#2A9D8F",
                border: "none", color: checkedGroceries.length === 0 ? "#555" : "#04201c", borderRadius: 10,
                padding: "13px", fontSize: 15, fontWeight: 700, cursor: checkedGroceries.length === 0 ? "default" : "pointer", fontFamily: "'DM Sans'",
              }}>
                Finish trip → add to Food budget
              </button>
            </div>

            <p style={{ fontSize: 11, color: "#555", margin: "10px 0 0", lineHeight: 1.5 }}>
              Finishing a trip records it below and updates a “Groceries (scanned)” line in your Food budget. To avoid double-counting, you may want to disable the default “Food” item on the Expenses tab.
            </p>
          </div>

          {shoppingTrips.length > 0 && (
            <div style={card}>
              <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 10px", fontWeight: 500 }}>Recent Trips</h3>
              {shoppingTrips.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1a1a2e" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#ccc" }}>{t.store}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{t.date} · {t.items.length} items</div>
                  </div>
                  <span style={{ fontFamily: "'Space Mono'", fontSize: 14, color: "#E8675A" }}>{fmt(t.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== BUDGET PLAN ===== */}
      {activeTab === "plan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Smart tips */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 10px", fontWeight: 500 }}>Where You Can Improve</h3>
            <div style={tipCard}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#F4A261", fontWeight: 600 }}>Food</span>
                <span style={{ fontFamily: "'Space Mono'", color: "#aaa", fontSize: 12 }}>{fmt(100)}/wk</span>
              </div>
              <div style={{ color: "#777", fontSize: 12 }}>Try aim for $90/wk — saves $520/year</div>
            </div>
            <div style={tipCard}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#669BBC", fontWeight: 600 }}>Subscriptions</span>
                <span style={{ fontFamily: "'Space Mono'", color: "#aaa", fontSize: 12 }}>{fmt(toWeekly(50, "Monthly"))}/wk</span>
              </div>
              <div style={{ color: "#777", fontSize: 12 }}>Review for unused services</div>
            </div>
            <div style={{ ...tipCard, borderLeft: "3px solid #E76F51" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#E76F51", fontWeight: 600 }}>Afterpay</span>
                <span style={{ fontFamily: "'Space Mono'", color: "#aaa", fontSize: 12 }}>{fmt(100)}/wk</span>
              </div>
              <div style={{ color: "#E76F51", fontSize: 12, fontWeight: 500 }}>Biggest opportunity — once cleared = instant $100/wk freed</div>
            </div>
          </div>

          {/* Priority plan */}
          <div style={card}>
            <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 12px", fontWeight: 500 }}>Priority Action Plan</h3>
            {[
              { step: 1, title: "Build a Buffer First", desc: "Aim for $1,000 emergency fund. Even $30–$50/week works.", color: "#2A9D8F", icon: "\u{1F6E1}" },
              { step: 2, title: "Kill Afterpay Fast", desc: "Focus extra money here. This is your quickest win.", color: "#E76F51", icon: "\u26A1" },
              { step: 3, title: "Then Attack Loans", desc: "Snowball method or highest-interest first.", color: "#E9C46A", icon: "\u{1F3AF}" },
              { step: 4, title: "Then Build Savings", desc: "Emergency fund \u2192 3\u20136 months expenses. Then optional investing.", color: "#669BBC", icon: "\u{1F680}" },
            ].map(s => (
              <div key={s.step} style={{ padding: "12px", background: "#12122a", borderRadius: 10, borderLeft: `3px solid ${s.color}`, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#ddd" }}>Step {s.step}: {s.title}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888", paddingLeft: 30 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Honest take */}
          <div style={{ ...card, borderLeft: "3px solid #E9C46A" }}>
            <h3 style={{ fontSize: 14, color: "#E9C46A", margin: "0 0 8px", fontWeight: 600 }}>Honest Take</h3>
            <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6 }}>
              Your budget is tight but structured well. Biggest pressure points are Daycare ({fmt(200)}/wk) and Afterpay ({fmt(100)}/wk). Once Afterpay is gone, your life gets much easier instantly.
            </div>
          </div>

          {/* Example plan if income entered */}
          {totalIncW > 0 && (
            <div style={card}>
              <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 10px", fontWeight: 500 }}>Your Weekly Plan</h3>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a2e", fontSize: 13 }}>
                <span style={{ color: "#888" }}>Expenses</span>
                <span style={{ fontFamily: "'Space Mono'", color: "#E8675A" }}>{fmt(totalExpW)}</span>
              </div>
              {surplus > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a2e", fontSize: 13 }}>
                    <span style={{ color: "#888" }}>Savings</span>
                    <span style={{ fontFamily: "'Space Mono'", color: "#2A9D8F" }}>{fmt(Math.min(surplus * 0.4, surplus))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a2e", fontSize: 13 }}>
                    <span style={{ color: "#888" }}>Debt extra</span>
                    <span style={{ fontFamily: "'Space Mono'", color: "#E9C46A" }}>{fmt(Math.min(surplus * 0.3, surplus))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                    <span style={{ color: "#888" }}>Personal/flex</span>
                    <span style={{ fontFamily: "'Space Mono'", color: "#669BBC" }}>{fmt(surplus * 0.3)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== EXPENSES ===== */}
      {activeTab === "expenses" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: "#888", margin: 0, fontWeight: 500 }}>All Expenses</h3>
            <button onClick={addExpense} style={addBtnS}>+ Add</button>
          </div>
          {expenses.map(e => {
            const isEd = editingExpense === e.id;
            const cat = CATEGORIES.find(c => c.name === e.category);
            return (
              <div key={e.id} style={{ marginBottom: 6, borderRadius: 10, border: isEd ? "1px solid #2a2a4a" : "1px solid transparent", background: isEd ? "#12122a" : "transparent", overflow: "hidden", opacity: e.enabled ? 1 : 0.4, transition: "opacity 0.2s" }}>
                <div onClick={() => setEditingExpense(isEd ? null : e.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, cursor: "pointer", minHeight: 44 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={e.enabled}
                      onChange={ev => { ev.stopPropagation(); updateExpense(e.id, "enabled", ev.target.checked); }}
                      onClick={ev => ev.stopPropagation()}
                      style={{ accentColor: "#2A9D8F", width: 20, height: 20, flexShrink: 0 }} />
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: cat?.color || "#666", flexShrink: 0 }} />
                    <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name || "Unnamed"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Space Mono'", fontSize: 14, color: "#E8675A" }}>{fmt(toWeekly(e.amount, e.freq) * mult)}</span>
                    <span style={{ color: "#444", fontSize: 18, transform: isEd ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
                  </div>
                </div>
                {isEd && (
                  <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Name</label>
                      <input value={e.name} onChange={ev => updateExpense(e.id, "name", ev.target.value)} style={inp} placeholder="Expense name" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Amount</label>
                        <input type="number" inputMode="decimal" value={e.amount} onChange={ev => updateExpense(e.id, "amount", parseFloat(ev.target.value) || 0)} style={{ ...inp, textAlign: "right" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Frequency</label>
                        <select value={e.freq} onChange={ev => updateExpense(e.id, "freq", ev.target.value)} style={sel}>
                          {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Category</label>
                      <select value={e.category} onChange={ev => updateExpense(e.id, "category", ev.target.value)} style={sel}>
                        {CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <button onClick={() => removeExpense(e.id)} style={delBtnS}>Remove expense</button>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: 12, padding: "12px 0", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#888" }}>{view} total</span>
            <span style={{ fontFamily: "'Space Mono'", fontWeight: 700, color: "#E8675A" }}>{fmt(totalExpW * mult)}</span>
          </div>
        </div>
      )}

      {/* ===== INCOME ===== */}
      {activeTab === "income" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: "#888", margin: 0, fontWeight: 500 }}>Income Sources</h3>
            <button onClick={addIncome} style={addBtnS}>+ Add</button>
          </div>
          {incomes.map(i => (
            <div key={i.id} style={{ marginBottom: 12, padding: 12, background: "#12122a", borderRadius: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={i.name} onChange={ev => updateIncome(i.id, "name", ev.target.value)} style={inp} placeholder="Source name" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Amount</label>
                    <input type="number" inputMode="decimal" value={i.amount} onChange={ev => updateIncome(i.id, "amount", parseFloat(ev.target.value) || 0)} style={{ ...inp, textAlign: "right" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Frequency</label>
                    <select value={i.freq} onChange={ev => updateIncome(i.id, "freq", ev.target.value)} style={sel}>
                      {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => removeIncome(i.id)} style={delBtnS}>Remove</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "10px 0", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#888" }}>{view} total</span>
            <span style={{ fontFamily: "'Space Mono'", fontWeight: 700, color: "#2A9D8F" }}>{fmt(totalIncW * mult)}</span>
          </div>
          <p style={{ fontSize: 12, color: "#555", margin: "8px 0 0" }}>Enter take-home pay. The Budget Plan tab will customise based on your actual income.</p>
        </div>
      )}

      {/* ===== GOALS ===== */}
      {activeTab === "goals" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, color: "#888", margin: 0, fontWeight: 500 }}>Savings Goals</h3>
            <button onClick={addGoal} style={addBtnS}>+ Add</button>
          </div>
          {savingsGoals.map(g => {
            const weeks = weeksToGoal(g);
            return (
              <div key={g.id} style={{ marginBottom: 14, padding: 14, background: "#12122a", borderRadius: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <input value={g.name} onChange={ev => updateGoal(g.id, "name", ev.target.value)} style={inp} placeholder="Goal name" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Target</label>
                      <input type="number" inputMode="decimal" value={g.target} onChange={ev => updateGoal(g.id, "target", parseFloat(ev.target.value) || 0)} style={{ ...inp, textAlign: "right" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", marginBottom: 3, display: "block" }}>Saved so far</label>
                      <input type="number" inputMode="decimal" value={g.saved} onChange={ev => updateGoal(g.id, "saved", parseFloat(ev.target.value) || 0)} style={{ ...inp, textAlign: "right" }} />
                    </div>
                  </div>
                </div>
                <BarMeter value={g.saved} max={g.target} color="#2A9D8F" label={g.name || "Unnamed goal"} />
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  {g.saved >= g.target
                    ? <span style={{ color: "#2A9D8F" }}>Goal reached!</span>
                    : surplus > 0
                      ? <>~{weeks} weeks ({(weeks / (WEEKS_PER_YEAR / 12)).toFixed(1)} months) at current surplus</>
                      : <span style={{ color: "#E8675A" }}>Add income to project timeline</span>}
                </div>
                <button onClick={() => removeGoal(g.id)} style={delBtnS}>Remove goal</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== WHAT IF ===== */}
      {activeTab === "whatif" && (
        <div style={card}>
          <h3 style={{ fontSize: 14, color: "#888", margin: "0 0 6px", fontWeight: 500 }}>What-If Scenarios</h3>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 14, marginTop: 0 }}>Tap to toggle expenses and see how your surplus changes.</p>
          {expenses.map(e => {
            const weekly = toWeekly(e.amount, e.freq);
            const cat = CATEGORIES.find(c => c.name === e.category);
            return (
              <div key={e.id} onClick={() => updateExpense(e.id, "enabled", !e.enabled)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: 12, borderRadius: 10, marginBottom: 4, cursor: "pointer",
                background: e.enabled ? "#12122a" : "transparent",
                border: `1px solid ${e.enabled ? "#1a1a3a" : "#1a1a2e"}`,
                opacity: e.enabled ? 1 : 0.4, transition: "all 0.2s", minHeight: 44,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${e.enabled ? "#2A9D8F" : "#333"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: e.enabled ? "#2A9D8F" : "transparent", transition: "all 0.2s",
                  }}>
                    {e.enabled && <span style={{ color: "#fff", fontSize: 13 }}>{"\u2713"}</span>}
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius: 2, background: cat?.color || "#666", flexShrink: 0 }} />
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 14 }}>{e.name || "Unnamed"}</span>
                    <span style={{ fontSize: 11, color: "#555", marginLeft: 6 }}>{e.freq}</span>
                  </div>
                </div>
                <span style={{ fontFamily: "'Space Mono'", fontSize: 13, color: e.enabled ? "#E8675A" : "#555", flexShrink: 0, marginLeft: 8 }}>
                  {fmt(weekly * mult)}
                </span>
              </div>
            );
          })}
          <div style={{ marginTop: 16, padding: 14, background: "#12122a", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Expenses</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#E8675A", fontFamily: "'Space Mono'" }}>{fmt(totalExpW * mult)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Surplus</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: surplus >= 0 ? "#2A9D8F" : "#E8675A", fontFamily: "'Space Mono'" }}>{fmt(surplus * mult)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#555", borderTop: "1px solid #1a1a2e", paddingTop: 10 }}>
              Saving by disabling {expenses.filter(e => !e.enabled).length} item(s):{" "}
              <span style={{ color: "#2A9D8F", fontFamily: "'Space Mono'" }}>
                {fmt(expenses.filter(e => !e.enabled).reduce((s, e) => s + toWeekly(e.amount, e.freq), 0) * mult)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />

      {scannerOpen && (
        <BarcodeScanner
          priceBook={priceBook}
          onConfirm={handleScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
