const STORAGE_KEY = "personal-ledger-v1";
const BUDGET_KEY = "personal-ledger-budgets-v1";

const categories = {
  expense: ["餐饮", "交通", "购物", "住房", "娱乐", "医疗", "学习", "其他支出"],
  income: ["工资", "奖金", "副业", "理财", "红包", "其他收入"]
};

const viewMeta = {
  ledger: { eyebrow: "明细", title: "个人账本" },
  charts: { eyebrow: "图表", title: "统计分析" },
  reports: { eyebrow: "报告", title: "月度报告" },
  profile: { eyebrow: "我", title: "设置与备份" }
};

const state = {
  entries: loadJson(STORAGE_KEY, []),
  budgets: loadJson(BUDGET_KEY, {}),
  selectedMonth: toMonthValue(new Date()),
  activeView: "ledger",
  deferredInstallPrompt: null
};

const els = {
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  quickAddButton: document.querySelector("#quickAddButton"),
  form: document.querySelector("#entryForm"),
  entryCard: document.querySelector("#entryCard"),
  monthPicker: document.querySelector("#monthPicker"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  amount: document.querySelector("#amountInput"),
  date: document.querySelector("#dateInput"),
  category: document.querySelector("#categoryInput"),
  note: document.querySelector("#noteInput"),
  list: document.querySelector("#entryList"),
  template: document.querySelector("#entryTemplate"),
  empty: document.querySelector("#emptyState"),
  monthIncome: document.querySelector("#monthIncome"),
  monthExpense: document.querySelector("#monthExpense"),
  monthBalance: document.querySelector("#monthBalance"),
  clearMonth: document.querySelector("#clearMonthButton"),
  chartMonthLabel: document.querySelector("#chartMonthLabel"),
  chartIncome: document.querySelector("#chartIncome"),
  chartExpense: document.querySelector("#chartExpense"),
  chartBalance: document.querySelector("#chartBalance"),
  budgetInput: document.querySelector("#budgetInput"),
  budgetPercent: document.querySelector("#budgetPercent"),
  budgetDonut: document.querySelector("#budgetDonut"),
  budgetCenter: document.querySelector("#budgetCenter"),
  budgetLeft: document.querySelector("#budgetLeft"),
  saveBudgetButton: document.querySelector("#saveBudgetButton"),
  categoryChart: document.querySelector("#categoryChart"),
  reportList: document.querySelector("#reportList"),
  profileSummary: document.querySelector("#profileSummary"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  backupStatus: document.querySelector("#backupStatus"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  els.monthPicker.value = state.selectedMonth;
  els.date.value = toDateValue(new Date());
  renderCategories(getSelectedType());
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  els.navItems.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  els.quickAddButton.addEventListener("click", () => {
    switchView("ledger");
    els.entryCard.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => els.amount.focus(), 250);
  });

  els.form.addEventListener("change", (event) => {
    if (event.target.name === "type") {
      renderCategories(event.target.value);
    }
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addEntry();
  });

  els.monthPicker.addEventListener("change", () => {
    state.selectedMonth = els.monthPicker.value || toMonthValue(new Date());
    render();
  });

  els.prevMonth.addEventListener("click", () => changeMonth(-1));
  els.nextMonth.addEventListener("click", () => changeMonth(1));

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-button");
    if (!button) return;
    deleteEntry(button.dataset.id);
  });

  els.clearMonth.addEventListener("click", () => {
    const monthlyEntries = getMonthlyEntries();
    if (monthlyEntries.length === 0) return;
    const ok = window.confirm("确定清空当前月份的所有记录吗？");
    if (!ok) return;
    state.entries = state.entries.filter((entry) => !entry.date.startsWith(state.selectedMonth));
    saveEntries();
    render();
  });

  els.saveBudgetButton.addEventListener("click", () => {
    const value = Number.parseFloat(els.budgetInput.value);
    if (Number.isFinite(value) && value > 0) {
      state.budgets[state.selectedMonth] = Math.round(value * 100) / 100;
    } else {
      delete state.budgets[state.selectedMonth];
    }
    localStorage.setItem(BUDGET_KEY, JSON.stringify(state.budgets));
    renderBudget(getMonthlyEntries());
  });

  els.exportButton.addEventListener("click", exportBackup);
  els.importInput.addEventListener("change", importBackup);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function switchView(view) {
  state.activeView = view;
  els.views.forEach((section) => section.classList.toggle("active", section.id === `${view}View`));
  els.navItems.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  els.viewEyebrow.textContent = viewMeta[view].eyebrow;
  els.viewTitle.textContent = viewMeta[view].title;
  render();
}

function addEntry() {
  const amount = Number.parseFloat(els.amount.value);
  const date = els.date.value;
  const type = getSelectedType();
  const category = els.category.value;
  const note = els.note.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category) return;

  state.entries.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    category,
    note,
    createdAt: new Date().toISOString()
  });

  state.selectedMonth = date.slice(0, 7);
  els.monthPicker.value = state.selectedMonth;
  els.form.reset();
  document.querySelector("input[name='type'][value='expense']").checked = true;
  els.date.value = date;
  renderCategories("expense");
  saveEntries();
  render();
  els.amount.focus();
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  saveEntries();
  render();
}

function exportBackup() {
  const backup = {
    app: "personal-ledger-pwa",
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
    budgets: state.budgets
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-ledger-backup-${toDateValue(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupStatus(`已导出 ${state.entries.length} 条记录`);
}

async function importBackup(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseBackup(text);
    if (imported.entries.length === 0) {
      setBackupStatus("备份文件里没有记录");
      return;
    }

    const overwrite = window.confirm("点“确定”覆盖当前账本；点“取消”合并到当前账本。");
    state.entries = overwrite ? imported.entries : mergeEntries(state.entries, imported.entries);
    state.budgets = overwrite ? imported.budgets : { ...imported.budgets, ...state.budgets };
    saveEntries();
    localStorage.setItem(BUDGET_KEY, JSON.stringify(state.budgets));
    render();
    setBackupStatus(`已导入 ${imported.entries.length} 条记录`);
  } catch {
    setBackupStatus("导入失败，请选择账本备份 JSON 文件");
  }
}

function parseBackup(text) {
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(entries)) throw new Error("Invalid backup");

  const budgets = data && typeof data.budgets === "object" && !Array.isArray(data.budgets)
    ? normalizeBudgets(data.budgets)
    : {};

  return {
    entries: entries.map(normalizeEntry).filter(Boolean),
    budgets
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const type = entry.type === "income" ? "income" : entry.type === "expense" ? "expense" : null;
  const amount = Number(entry.amount);
  const date = typeof entry.date === "string" ? entry.date : "";
  const category = typeof entry.category === "string" ? entry.category.trim() : "";
  const note = typeof entry.note === "string" ? entry.note.trim().slice(0, 40) : "";

  if (!type || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !category) {
    return null;
  }

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    category,
    note,
    createdAt: typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString()
  };
}

function normalizeBudgets(budgets) {
  return Object.fromEntries(
    Object.entries(budgets)
      .filter(([month, value]) => /^\d{4}-\d{2}$/.test(month) && Number(value) > 0)
      .map(([month, value]) => [month, Math.round(Number(value) * 100) / 100])
  );
}

function mergeEntries(currentEntries, importedEntries) {
  const existing = new Set(currentEntries.map(entryKey));
  const merged = currentEntries.slice();

  importedEntries.forEach((entry) => {
    const key = entryKey(entry);
    if (!existing.has(key)) {
      existing.add(key);
      merged.push(entry);
    }
  });

  return merged;
}

function entryKey(entry) {
  return [entry.id, entry.type, entry.amount, entry.date, entry.category, entry.note, entry.createdAt].join("|");
}

function setBackupStatus(message) {
  els.backupStatus.textContent = message;
}

function render() {
  const monthlyEntries = getMonthlyEntries();
  const totals = getTotals(monthlyEntries);
  renderSummary(totals);
  renderList(monthlyEntries);
  renderCharts(monthlyEntries, totals);
  renderReports();
  renderProfile();
}

function renderSummary(totals) {
  els.monthIncome.textContent = money(totals.income);
  els.monthExpense.textContent = money(totals.expense);
  els.monthBalance.textContent = money(totals.income - totals.expense);
}

function renderList(entries) {
  els.list.textContent = "";
  els.empty.hidden = entries.length > 0;
  els.clearMonth.hidden = entries.length === 0;

  const fragment = document.createDocumentFragment();
  entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .forEach((entry) => {
      const item = els.template.content.firstElementChild.cloneNode(true);
      const sign = entry.type === "income" ? "+" : "-";

      item.classList.add(entry.type);
      item.querySelector(".entry-icon").textContent = entry.type === "income" ? "入" : "出";
      item.querySelector(".entry-category").textContent = entry.category;
      item.querySelector(".entry-note").textContent = entry.note || "无备注";
      item.querySelector(".entry-amount").textContent = `${sign}${money(entry.amount)}`;
      item.querySelector(".entry-date").textContent = formatDate(entry.date);
      item.querySelector(".entry-date").dateTime = entry.date;
      item.querySelector(".delete-button").dataset.id = entry.id;
      fragment.append(item);
    });

  els.list.append(fragment);
}

function renderCharts(entries, totals) {
  els.chartMonthLabel.textContent = formatMonth(state.selectedMonth);
  els.chartIncome.textContent = money(totals.income);
  els.chartExpense.textContent = money(totals.expense);
  els.chartBalance.textContent = money(totals.income - totals.expense);
  renderBudget(entries);
  renderCategoryChart(entries);
}

function renderBudget(entries) {
  const expense = getTotals(entries).expense;
  const budget = state.budgets[state.selectedMonth] || 0;
  const left = budget - expense;
  const usedRatio = budget > 0 ? Math.min(expense / budget, 1) : 0;
  const usedPercent = budget > 0 ? Math.round((expense / budget) * 100) : 0;

  els.budgetInput.value = budget || "";
  els.budgetLeft.textContent = money(left);
  els.budgetPercent.textContent = budget > 0 ? `${usedPercent}%` : "--";
  els.budgetCenter.textContent = budget > 0 ? `${usedPercent}%` : "--";
  els.budgetDonut.style.background = `conic-gradient(var(--yellow) ${usedRatio * 360}deg, #38393d 0deg)`;
}

function renderCategoryChart(entries) {
  const expenses = entries.filter((entry) => entry.type === "expense");
  const byCategory = expenses.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
    return acc;
  }, {});
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 0;

  els.categoryChart.textContent = "";
  if (rows.length === 0) {
    els.categoryChart.innerHTML = '<p class="helper-text">本月还没有支出数据。</p>';
    return;
  }

  rows.forEach(([category, amount]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-head"><span>${category}</span><strong>${money(amount)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max((amount / max) * 100, 6)}%"></div></div>
    `;
    els.categoryChart.append(row);
  });
}

function renderReports() {
  const months = getMonthReports();
  els.reportList.textContent = "";

  if (months.length === 0) {
    els.reportList.innerHTML = '<p class="helper-text">还没有任何记录。</p>';
    return;
  }

  months.forEach((item) => {
    const row = document.createElement("article");
    row.className = "report-item";
    row.innerHTML = `
      <div class="report-month">${item.label}</div>
      <div class="report-stats">
        <div><span>支出</span><strong>${money(item.expense)}</strong></div>
        <div><span>收入</span><strong>${money(item.income)}</strong></div>
        <div><span>结余</span><strong>${money(item.income - item.expense)}</strong></div>
      </div>
    `;
    els.reportList.append(row);
  });
}

function renderProfile() {
  els.profileSummary.textContent = `本机保存 ${state.entries.length} 条记录`;
}

function renderCategories(type) {
  els.category.textContent = "";
  categories[type].forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.category.append(option);
  });
}

function getMonthlyEntries() {
  return state.entries.filter((entry) => entry.date.startsWith(state.selectedMonth));
}

function getTotals(entries) {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.type] += entry.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

function getMonthReports() {
  const reports = new Map();
  state.entries.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    if (!reports.has(month)) reports.set(month, { month, income: 0, expense: 0 });
    reports.get(month)[entry.type] += entry.amount;
  });

  return Array.from(reports.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((item) => ({ ...item, label: formatMonth(item.month) }));
}

function changeMonth(step) {
  const [year, month] = state.selectedMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + step, 1);
  state.selectedMonth = toMonthValue(next);
  els.monthPicker.value = state.selectedMonth;
  render();
}

function getSelectedType() {
  return new FormData(els.form).get("type") || "expense";
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatMonth(value) {
  const [, month] = value.split("-");
  return `${Number(month)}月`;
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Local file previews cannot register service workers; localhost and HTTPS work.
    });
  });
}
