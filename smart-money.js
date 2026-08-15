// Momo Smart Money — local-first intelligence for Momo v1.11.0
const MOMO_SMART_VERSION = "1.11.0";
const DB_NAME = "momo_database";
const REFRESH_MIN_MS = 45000;
const MAX_BASELINE_EXPENSES = 12000;

let lastRefreshAt = 0;
let refreshPromise = null;
let observer = null;
let lastFingerprint = "";
let merchantModel = new Map();
let currentAnalysis = null;

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function asNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function text(value) { return String(value ?? "").trim(); }
function normalize(value) { return text(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function dateValue(record) { const raw = record?.date ?? record?.expenseDate ?? record?.transactionDate ?? record?.createdAt ?? record?.timestamp; const date = raw instanceof Date ? raw : new Date(raw || 0); return Number.isNaN(date.getTime()) ? new Date(0) : date; }
function amountValue(record) { return Math.max(0, asNumber(record?.amount ?? record?.value ?? record?.total ?? record?.cost)); }
function merchantValue(record) { return text(record?.merchant ?? record?.store ?? record?.title ?? record?.name ?? record?.description ?? record?.note); }
function categoryValue(record) { return text(record?.category ?? record?.categoryName ?? record?.type); }
function toPhp(record) { const amount = amountValue(record); const currency = text(record?.currency || "PHP").toUpperCase(); const rates = { PHP: 1, JPY: 2.56, USD: 0.0175, GBP: 0.0132, HKD: 0.136, SGD: 0.0224, CNY: 0.125 }; const rate = rates[currency]; return rate ? amount / rate : amount; }
function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }
function safeDate(raw) { const d = raw instanceof Date ? raw : new Date(raw || 0); return Number.isNaN(d.getTime()) ? null : d; }
function dueDate(record) { return safeDate(record?.nextDate ?? record?.nextDueDate ?? record?.dueDate ?? record?.renewalDate ?? record?.date ?? record?.plannedDate ?? record?.targetDate); }
function isInactive(record) { return record?.active === false || record?.enabled === false || ["cancelled", "canceled", "paid", "done", "completed", "archived"].includes(normalize(record?.status)); }

function openDb() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function readAll(db, storeName) { if (!db.objectStoreNames.contains(storeName)) return Promise.resolve([]); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, "readonly"); const req = tx.objectStore(storeName).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); }); }
function countStore(db, storeName) { if (!db.objectStoreNames.contains(storeName)) return Promise.resolve(0); return new Promise((resolve, reject) => { const tx = db.transaction(storeName, "readonly"); const req = tx.objectStore(storeName).count(); req.onsuccess = () => resolve(req.result || 0); req.onerror = () => reject(req.error); }); }
function settingMap(records) { const map = new Map(); for (const row of records) { const key = text(row?.key ?? row?.id ?? row?.name); if (!key) continue; const value = row?.value ?? row?.data ?? row?.payload ?? row?.setting ?? row; map.set(key, value); } return map; }
function findSetting(settings, fragments) { const wanted = fragments.map(normalize); for (const [key, value] of settings) { const nk = normalize(key); if (wanted.some((fragment) => nk.includes(fragment))) return value; } return null; }
function flattenRecords(value) { if (Array.isArray(value)) return value; if (value && typeof value === "object") { for (const key of ["items", "records", "goals", "payables", "cards", "values"]) if (Array.isArray(value[key])) return value[key]; } return []; }

async function loadData() {
  const db = await openDb();
  try {
    const names = ["expenses", "budgets", "recurring", "planned", "cards", "settings"];
    const counts = await Promise.all(names.map((name) => countStore(db, name)));
    const fingerprint = names.map((name, i) => `${name}:${counts[i]}`).join("|");
    const [expenses, budgets, recurring, planned, cards, settingsRows] = await Promise.all(names.map((name) => readAll(db, name)));
    return { fingerprint, expenses, budgets, recurring, planned, cards, settingsRows };
  } finally { db.close(); }
}

function monthlyIncome(settings, now) {
  const direct = findSetting(settings, ["monthly_income"]);
  if (typeof direct === "number") return direct;
  if (direct && typeof direct === "object") {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return asNumber(direct[monthKey] ?? direct.value ?? direct.amount);
  }
  return 0;
}

function monthlyBudgetTotal(budgets, now) {
  let total = 0;
  for (const budget of budgets) {
    if (isInactive(budget)) continue;
    const period = normalize(budget?.period ?? budget?.frequency ?? "month");
    if (period && !period.includes("month") && !period.includes("monthly")) continue;
    const rawDate = safeDate(budget?.month ?? budget?.startDate ?? budget?.date);
    if (rawDate && (rawDate.getFullYear() !== now.getFullYear() || rawDate.getMonth() !== now.getMonth())) continue;
    total += asNumber(budget?.amount ?? budget?.limit ?? budget?.budget);
  }
  return total;
}

function buildMerchantModel(expenses) {
  const model = new Map();
  for (const expense of expenses.slice(-MAX_BASELINE_EXPENSES)) {
    const merchant = normalize(merchantValue(expense)); const category = categoryValue(expense);
    if (!merchant || !category) continue;
    let entry = model.get(merchant);
    if (!entry) { entry = { total: 0, categories: new Map(), label: merchantValue(expense) }; model.set(merchant, entry); }
    entry.total += 1; entry.categories.set(category, (entry.categories.get(category) || 0) + 1);
  }
  merchantModel = model; return model;
}

function learnedCategory(merchant) {
  const entry = merchantModel.get(normalize(merchant));
  if (!entry || entry.total < 2) return null;
  const ranked = [...entry.categories.entries()].sort((a, b) => b[1] - a[1]);
  const [category, count] = ranked[0] || [];
  if (!category || count / entry.total < 0.6) return null;
  return { category, confidence: count / entry.total, count: entry.total };
}

function analyzeBaseline(expenses, now) {
  const cutoff = new Date(now.getTime() - 120 * 86400000);
  const samples = expenses.filter((e) => dateValue(e) >= cutoff && dateValue(e) < startOfDay(now)).slice(-MAX_BASELINE_EXPENSES);
  const byWeekday = Array.from({ length: 7 }, () => ({ total: 0, days: new Set() }));
  const byCategory = new Map(); let total = 0;
  for (const e of samples) {
    const d = dateValue(e); const amount = toPhp(e); total += amount;
    const weekday = byWeekday[d.getDay()]; weekday.total += amount; weekday.days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    const cat = categoryValue(e) || "Other"; const entry = byCategory.get(cat) || { total: 0, count: 0 }; entry.total += amount; entry.count += 1; byCategory.set(cat, entry);
  }
  const weekday = byWeekday[now.getDay()]; const weekdayAverage = weekday.days.size ? weekday.total / weekday.days.size : 0;
  const uniqueDays = new Set(samples.map((e) => dateValue(e).toDateString())).size;
  return { total, sampleCount: samples.length, dailyAverage: uniqueDays ? total / uniqueDays : 0, weekdayAverage, byCategory };
}

function currentMonthSpend(expenses, now) { const start = startOfMonth(now); const end = endOfMonth(now); let total = 0; for (const expense of expenses) { const d = dateValue(expense); if (d >= start && d <= end) total += toPhp(expense); } return total; }

function upcomingCommitments(recurring, planned, now, days = 14) {
  const end = new Date(startOfDay(now).getTime() + days * 86400000 + 86399999); const items = [];
  for (const record of [...recurring, ...planned]) {
    if (isInactive(record)) continue; const due = dueDate(record); if (!due || due < startOfDay(now) || due > end) continue;
    items.push({ title: merchantValue(record) || text(record?.label) || "Upcoming commitment", amount: toPhp(record), due, source: recurring.includes(record) ? "recurring" : "planned" });
  }
  items.sort((a, b) => a.due - b.due); return items;
}

function remainingMonthCommitments(recurring, planned, now) { const end = endOfMonth(now); return upcomingCommitments(recurring, planned, now, Math.max(1, daysBetween(now, end)) + 1).reduce((sum, item) => sum + item.amount, 0); }

function savingsInfo(settings, now) {
  const raw = findSetting(settings, ["savings_goals", "peach_jar", "savings"]); const goals = flattenRecords(raw); let protectedAmount = 0; let bestPacing = null;
  for (const goal of goals) {
    if (isInactive(goal)) continue;
    const current = asNumber(goal?.currentAmount ?? goal?.saved ?? goal?.current ?? goal?.balance); const target = asNumber(goal?.targetAmount ?? goal?.target ?? goal?.goalAmount); const monthly = asNumber(goal?.monthlyContribution ?? goal?.plannedContribution ?? goal?.contribution);
    if (goal?.protected === true || goal?.protect === true) protectedAmount += monthly;
    const targetDate = safeDate(goal?.targetDate ?? goal?.dueDate); if (!target || !targetDate || targetDate <= now) continue;
    const monthsLeft = Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth() + 1); const neededMonthly = Math.max(0, target - current) / monthsLeft; const delta = monthly - neededMonthly;
    const candidate = { name: text(goal?.name ?? goal?.title) || "Savings goal", current, target, monthly, neededMonthly, delta, targetDate };
    if (!bestPacing || Math.abs(candidate.delta) > Math.abs(bestPacing.delta)) bestPacing = candidate;
  }
  return { goals, protectedAmount, pacing: bestPacing };
}

function payableInfo(settings, cards) {
  const raw = findSetting(settings, ["payables", "payable", "loans", "debts"]); const records = [...flattenRecords(raw), ...cards].filter((x) => !isInactive(x));
  const normalized = records.map((p) => ({ name: text(p?.name ?? p?.title ?? p?.issuer ?? p?.cardName) || "Payable", balance: asNumber(p?.remainingBalance ?? p?.balance ?? p?.remaining ?? p?.amount), apr: asNumber(p?.apr ?? p?.interestRate ?? p?.rate), minimum: asNumber(p?.minimumPayment ?? p?.minPayment ?? p?.monthlyPayment) })).filter((p) => p.balance > 0);
  const total = normalized.reduce((sum, p) => sum + p.balance, 0); const monthlyMinimum = normalized.reduce((sum, p) => sum + p.minimum, 0); const snowball = [...normalized].sort((a, b) => a.balance - b.balance)[0] || null; const avalanche = [...normalized].sort((a, b) => b.apr - a.apr)[0] || null;
  return { records: normalized, total, monthlyMinimum, snowball, avalanche };
}

function detectDuplicates(expenses, now) {
  const recentCutoff = new Date(now.getTime() - 14 * 86400000); const recent = expenses.filter((e) => dateValue(e) >= recentCutoff).slice(-1000); const groups = new Map();
  for (const e of recent) { const d = dateValue(e); const merchant = normalize(merchantValue(e)); const amount = Math.round(toPhp(e) * 100) / 100; if (!amount || !merchant) continue; const key = `${merchant}|${amount}`; const arr = groups.get(key) || []; arr.push({ record: e, date: d }); groups.set(key, arr); }
  const suspects = [];
  for (const arr of groups.values()) { arr.sort((a, b) => a.date - b.date); for (let i = 1; i < arr.length; i += 1) { const gap = Math.abs(arr[i].date - arr[i - 1].date) / 86400000; if (gap <= 1.25) suspects.push({ a: arr[i - 1].record, b: arr[i].record, gapDays: gap }); } }
  return suspects.slice(-5);
}

function discoverRecurring(expenses, recurring) {
  const existing = new Set(recurring.map((r) => normalize(merchantValue(r)))); const groups = new Map();
  for (const e of expenses.slice(-MAX_BASELINE_EXPENSES)) { const merchant = normalize(merchantValue(e)); if (!merchant || existing.has(merchant)) continue; const amount = Math.round(toPhp(e)); if (!amount) continue; const key = `${merchant}|${amount}`; const arr = groups.get(key) || []; arr.push(dateValue(e)); groups.set(key, arr); }
  const candidates = [];
  for (const [key, dates] of groups) { if (dates.length < 3) continue; dates.sort((a, b) => a - b); const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86400000).filter((g) => g > 3 && g < 70); if (gaps.length < 2) continue; const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length; const monthlyLike = avg >= 24 && avg <= 38; const weeklyLike = avg >= 5 && avg <= 9; if (!monthlyLike && !weeklyLike) continue; const [merchant, amount] = key.split("|"); candidates.push({ merchant, amount: asNumber(amount), cadence: monthlyLike ? "monthly" : "weekly", occurrences: dates.length, avgGap: avg }); }
  return candidates.sort((a, b) => b.occurrences - a.occurrences).slice(0, 5);
}

function unusualSpending(expenses, baseline, now) {
  if (baseline.sampleCount < 12) return null; const todayStart = startOfDay(now); const todayTotal = expenses.reduce((sum, e) => dateValue(e) >= todayStart ? sum + toPhp(e) : sum, 0);
  if (baseline.weekdayAverage > 0 && todayTotal > baseline.weekdayAverage * 1.55 && todayTotal - baseline.weekdayAverage > 300) return { todayTotal, expected: baseline.weekdayAverage, ratio: todayTotal / baseline.weekdayAverage };
  return null;
}

function forecast({ expenses, recurring, planned, settings, budgets }, now, baseline) {
  const spent = currentMonthSpend(expenses, now); const income = monthlyIncome(settings, now); const budget = monthlyBudgetTotal(budgets, now); const base = income || budget; const elapsedDays = Math.max(1, now.getDate()); const remainingDays = Math.max(0, daysInMonth(now) - elapsedDays); const observedDaily = spent / elapsedDays; const blendedDaily = baseline.dailyAverage ? observedDaily * 0.72 + baseline.dailyAverage * 0.28 : observedDaily; const commitments = remainingMonthCommitments(recurring, planned, now); const projectedSpend = spent + blendedDaily * remainingDays + commitments; const projectedBuffer = base ? base - projectedSpend : 0;
  return { spent, income, budget, base, commitments, observedDaily, blendedDaily, projectedSpend, projectedBuffer };
}

function futureBuyImpact(planned, forecastData, now) {
  if (!forecastData.base) return null;
  const candidates = planned.filter((p) => !isInactive(p)).map((p) => ({ record: p, due: dueDate(p), amount: toPhp(p) })).filter((p) => p.amount > 0 && (!p.due || p.due >= startOfDay(now))).sort((a, b) => (a.due || new Date(8640000000000000)) - (b.due || new Date(8640000000000000)));
  const candidate = candidates[0]; if (!candidate) return null;
  return { title: merchantValue(candidate.record) || text(candidate.record?.label) || "Future buy", amount: candidate.amount, before: forecastData.projectedBuffer, after: forecastData.projectedBuffer - candidate.amount, due: candidate.due };
}

function smartScore(forecastData, upcoming, duplicates, unusual) {
  let score = 82; if (forecastData.base && forecastData.projectedBuffer < 0) score -= 28; else if (forecastData.base && forecastData.projectedBuffer < forecastData.base * 0.08) score -= 14; if (upcoming.reduce((s, x) => s + x.amount, 0) > Math.max(2500, forecastData.base * 0.25)) score -= 12; if (duplicates.length) score -= 8; if (unusual) score -= 7; return Math.max(35, Math.min(98, Math.round(score)));
}

function buildInsights(data, now) {
  const settings = settingMap(data.settingsRows); buildMerchantModel(data.expenses); const baseline = analyzeBaseline(data.expenses, now); const forecastData = forecast({ ...data, settings }, now, baseline); const upcoming = upcomingCommitments(data.recurring, data.planned, now, 14); const upcomingTotal = upcoming.reduce((sum, x) => sum + x.amount, 0); const duplicates = detectDuplicates(data.expenses, now); const recurringCandidates = discoverRecurring(data.expenses, data.recurring); const unusual = unusualSpending(data.expenses, baseline, now); const savings = savingsInfo(settings, now); const payables = payableInfo(settings, data.cards); const futureBuy = futureBuyImpact(data.planned, forecastData, now); const score = smartScore(forecastData, upcoming, duplicates, unusual); const cards = [];
  if (forecastData.base) { const positive = forecastData.projectedBuffer >= 0; cards.push({ priority: 100, tone: positive ? "positive" : "warning", icon: positive ? "✦" : "!", title: positive ? "Your month is on track" : "Your month may run tight", body: positive ? `At your current pace, Momo projects about ${money.format(forecastData.projectedBuffer)} left after expected spending and known commitments.` : `At your current pace, Momo projects a ${money.format(Math.abs(forecastData.projectedBuffer))} shortfall. Upcoming commitments are included.` }); }
  if (upcoming.length) cards.push({ priority: 96, tone: upcomingTotal > Math.max(2500, forecastData.base * 0.22) ? "attention" : "neutral", icon: "◷", title: `${money.format(upcomingTotal)} is coming up`, body: `${upcoming.length} known commitment${upcoming.length === 1 ? "" : "s"} fall in the next 14 days. The nearest is ${upcoming[0].title}${upcoming[0].due ? ` on ${upcoming[0].due.toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}.` });
  if (unusual) cards.push({ priority: 92, tone: "attention", icon: "↗", title: "Today is above your usual pace", body: `You have spent ${money.format(unusual.todayTotal)} today, about ${Math.round((unusual.ratio - 1) * 100)}% above your usual ${now.toLocaleDateString([], { weekday: "long" })} spending.` });
  if (duplicates.length) { const sample = duplicates[duplicates.length - 1]; cards.push({ priority: 90, tone: "warning", icon: "≋", title: "Possible duplicate expense", body: `${merchantValue(sample.b) || "A recent expense"} appears twice at about ${money.format(toPhp(sample.b))} within a short time. Check Activity before deleting anything.` }); }
  if (recurringCandidates.length) { const candidate = recurringCandidates[0]; cards.push({ priority: 82, tone: "neutral", icon: "↻", title: "Momo spotted a repeating payment", body: `${candidate.merchant} appears ${candidate.occurrences} times at roughly ${money.format(candidate.amount)}, following a ${candidate.cadence} pattern. Consider adding it to Recurring if it is a real bill or subscription.` }); }
  if (futureBuy) cards.push({ priority: 78, tone: futureBuy.after < 0 ? "attention" : "neutral", icon: "☆", title: `${futureBuy.title} changes your buffer`, body: `Buying it for ${money.format(futureBuy.amount)} would move your projected month-end buffer from ${money.format(futureBuy.before)} to ${money.format(futureBuy.after)}.` });
  if (savings.pacing && Math.abs(savings.pacing.delta) >= 100) { const p = savings.pacing; cards.push({ priority: 74, tone: p.delta > 0 ? "positive" : "attention", icon: "🌱", title: p.delta > 0 ? `${p.name} is ahead of pace` : `${p.name} needs a little more pace`, body: p.delta > 0 ? `Your planned contribution is about ${money.format(p.delta)} above the monthly pace needed to reach the target on time.` : `About ${money.format(Math.abs(p.delta))} more per month would match the current target pace.` }); }
  if (payables.records.length >= 2 && payables.snowball && payables.avalanche) { const same = payables.snowball.name === payables.avalanche.name; cards.push({ priority: 68, tone: "neutral", icon: "⌁", title: "Your payoff paths are ready to compare", body: same ? `${payables.snowball.name} is both your smallest balance and highest-rate priority right now.` : `Snowball would prioritize ${payables.snowball.name}; avalanche would prioritize ${payables.avalanche.name}${payables.avalanche.apr ? ` at ${payables.avalanche.apr}% APR` : ""}. Momo does not force either strategy.` }); }
  if (!cards.length && data.expenses.length) cards.push({ priority: 20, tone: "positive", icon: "🍑", title: "Nothing urgent needs your attention", body: "Momo checked your recent spending and known commitments and did not find a strong warning worth interrupting you for." });
  return { settings, baseline, forecast: forecastData, upcoming, duplicates, recurringCandidates, unusual, savings, payables, futureBuy, score, cards: cards.sort((a, b) => b.priority - a.priority).slice(0, 3) };
}

function ensureStyles() { if (document.querySelector('link[data-momo-smart-style]')) return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `smart-money.css?v=${encodeURIComponent(MOMO_SMART_VERSION)}`; link.dataset.momoSmartStyle = "true"; document.head.appendChild(link); }
function homeScreen() { return document.querySelector('[data-screen="home"]'); }
function ensurePanel() {
  let panel = document.getElementById("momoSmartMoneySection"); if (panel) return panel; const home = homeScreen(); if (!home) return null;
  panel = document.createElement("section"); panel.id = "momoSmartMoneySection"; panel.className = "momo-home-section momo-smart-money"; panel.dataset.homeModule = "smart";
  panel.innerHTML = `<div class="momo-smart-head"><div><p class="momo-smart-kicker">🍑 MOMO KNOWS</p><h2>Small things worth knowing</h2></div><button class="momo-smart-refresh" id="momoSmartRefresh" type="button" aria-label="Refresh Momo insights">Refresh</button></div><div id="momoSmartContent" aria-live="polite"><div class="momo-smart-empty">Momo is quietly checking your money patterns…</div></div>`;
  const today = document.getElementById("momoTodaySection"); if (today?.parentNode === home) today.insertAdjacentElement("afterend", panel); else home.appendChild(panel);
  panel.querySelector("#momoSmartRefresh")?.addEventListener("click", () => refreshSmartMoney(true)); return panel;
}
function escapeHtml(value) { return text(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

function render(analysis, generatedAt = new Date()) {
  const panel = ensurePanel(); const target = panel?.querySelector("#momoSmartContent"); if (!target) return;
  if (!analysis) { target.innerHTML = '<div class="momo-smart-empty">Momo could not read enough local data for smart insights yet.</div>'; return; }
  const cards = analysis.cards.map((card) => `<article class="momo-smart-card" data-tone="${card.tone || "neutral"}"><div class="momo-smart-icon" aria-hidden="true">${card.icon}</div><div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></div></article>`).join("");
  const forecastData = analysis.forecast; const headline = forecastData.base ? (forecastData.projectedBuffer >= 0 ? "Your plan still has breathing room." : "A tighter month is forming.") : "Momo is learning your normal."; const subline = forecastData.base ? "Forecast includes your current spending pace and known upcoming commitments." : "Add monthly income or budgets for a full month-end and Safe-to-Spend forecast.";
  target.innerHTML = `<div class="momo-smart-summary"><div class="momo-smart-summary-top"><div><strong>${escapeHtml(headline)}</strong><p>${escapeHtml(subline)}</p></div><div class="momo-smart-score"><span>Money pulse</span><b>${analysis.score}</b></div></div><div class="momo-smart-grid">${cards || '<div class="momo-smart-empty">Nothing urgent needs your attention right now.</div>'}</div><div class="momo-smart-foot"><span>Private · calculated on this device</span><span>${generatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div></div>`;
}

function updateSafeToSpend(analysis) {
  const amountEl = document.getElementById("momoSafeToday"); const explanationEl = document.getElementById("momoSafeExplanation"); if (!amountEl || !explanationEl || !analysis?.forecast?.base) return;
  const now = new Date(); const remainingDays = Math.max(1, daysInMonth(now) - now.getDate() + 1); const monthAvailable = Math.max(0, analysis.forecast.base - analysis.forecast.spent - analysis.forecast.commitments - analysis.savings.protectedAmount - analysis.payables.monthlyMinimum); const todaySafe = monthAvailable / remainingDays;
  amountEl.textContent = money.format(todaySafe); explanationEl.textContent = `After known bills, protected savings, payable minimums, and this month’s spending, about ${money.format(monthAvailable)} remains flexible across ${remainingDays} day${remainingDays === 1 ? "" : "s"}.`;
}

function merchantInputCandidates() { return [...document.querySelectorAll('input#expenseTitle,input[id*="merchant" i],input[name*="merchant" i],input[id*="store" i],input[name*="store" i],input[id*="expenseName" i],input[name*="expenseName" i]')]; }
function categoryInputCandidates() { return [...document.querySelectorAll('select[id*="category" i],select[name*="category" i],input[id*="category" i],input[name*="category" i]')]; }
function attachMerchantLearning() {
  for (const input of merchantInputCandidates()) {
    if (input.dataset.momoSmartBound) continue; input.dataset.momoSmartBound = "true";
    input.addEventListener("input", () => {
      const suggestion = learnedCategory(input.value); let hint = input.parentElement?.querySelector(".momo-smart-inline-hint");
      if (!suggestion) { hint?.remove(); return; }
      if (!hint) { hint = document.createElement("div"); hint.className = "momo-smart-inline-hint"; input.insertAdjacentElement("afterend", hint); }
      hint.textContent = `Momo remembers this merchant as ${suggestion.category} (${Math.round(suggestion.confidence * 100)}% of ${suggestion.count} past entries).`;
      const category = categoryInputCandidates().find((el) => !el.disabled && el.offsetParent !== null);
      if (category && !text(category.value) && category.tagName === "SELECT") { const option = [...category.options].find((o) => normalize(o.value) === normalize(suggestion.category) || normalize(o.textContent) === normalize(suggestion.category)); if (option) category.value = option.value; }
    });
  }
}

async function refreshSmartMoney(force = false) {
  if (refreshPromise) return refreshPromise; const now = Date.now(); if (!force && now - lastRefreshAt < REFRESH_MIN_MS) return currentAnalysis;
  refreshPromise = (async () => {
    try {
      ensureStyles(); ensurePanel(); const data = await loadData();
      if (!force && data.fingerprint === lastFingerprint && currentAnalysis && now - lastRefreshAt < REFRESH_MIN_MS * 4) { attachMerchantLearning(); return currentAnalysis; }
      lastFingerprint = data.fingerprint; currentAnalysis = buildInsights(data, new Date()); lastRefreshAt = Date.now(); render(currentAnalysis, new Date()); updateSafeToSpend(currentAnalysis); attachMerchantLearning(); window.dispatchEvent(new CustomEvent("momo:smart-money-updated", { detail: { version: MOMO_SMART_VERSION, score: currentAnalysis.score } })); return currentAnalysis;
    } catch (error) { console.error("Momo Smart Money refresh failed:", error); render(null); return null; } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

function watchForAppChanges() {
  if (observer || !document.body) return; let timer = 0;
  observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((m) => { const el = m.target?.nodeType === 1 ? m.target : m.target?.parentElement; return el && !el.closest?.("#momoSmartMoneySection") && (el.closest?.('[data-screen="home"]') || el.closest?.('[data-screen="add"]') || el.id === "toast"); });
    if (!relevant) return; window.clearTimeout(timer); timer = window.setTimeout(() => { attachMerchantLearning(); refreshSmartMoney(false); }, 900);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function start() {
  ensureStyles(); ensurePanel(); watchForAppChanges(); attachMerchantLearning(); window.setTimeout(() => refreshSmartMoney(true), 350);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshSmartMoney(false); });
  window.addEventListener("online", () => refreshSmartMoney(false)); window.addEventListener("focus", () => refreshSmartMoney(false), { passive: true }); window.addEventListener("momo:data-changed", () => refreshSmartMoney(true));
  window.MomoSmartMoney = Object.freeze({ version: MOMO_SMART_VERSION, refresh: () => refreshSmartMoney(true), getAnalysis: () => currentAnalysis, learnedCategory });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
