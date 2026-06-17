const STORAGE_KEY = "personal-ledger-v1";
const BUDGET_KEY = "personal-ledger-budgets-v1";
const THEME_KEY = "personal-ledger-theme-v1";
const LAST_BACKUP_KEY = "personal-ledger-last-backup-v1";

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
  editingId: null,
  searchQuery: "",
  typeFilter: "all",
  theme: localStorage.getItem(THEME_KEY) || "light",
  deferredInstallPrompt: null
};

const els = {
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  views: document.querySelectorAll(".view"),
  navItems: document.querySelectorAll(".nav-item"),
  quickAddButton: document.querySelector("#quickAddButton"),
  form: document.querySelector("#entryForm"),
  formTitle: document.querySelector("#formTitle"),
  saveEntryButton: document.querySelector("#saveEntryButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  entryCard: document.querySelector("#entryCard"),
  monthPicker: document.querySelector("#monthPicker"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  amount: document.querySelector("#amountInput"),
  date: document.querySelector("#dateInput"),
  category: document.querySelector("#categoryInput"),
  note: document.querySelector("#noteInput"),
  list: document.querySelector("#entryList"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  template: document.querySelector("#entryTemplate"),
  empty: document.querySelector("#emptyState"),
  monthIncome: document.querySelector("#monthIncome"),
  monthExpense: document.querySelector("#monthExpense"),
  monthBalance: document.querySelector("#monthBalance"),
  todayExpense: document.querySelector("#todayExpense"),
  weekExpense: document.querySelector("#weekExpense"),
  monthProgressLabel: document.querySelector("#monthProgressLabel"),
  monthProgressText: document.querySelector("#monthProgressText"),
  monthProgressFill: document.querySelector("#monthProgressFill"),
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
  largestExpense: document.querySelector("#largestExpense"),
  largestExpenseNote: document.querySelector("#largestExpenseNote"),
  dailyAverage: document.querySelector("#dailyAverage"),
  budgetAdvice: document.querySelector("#budgetAdvice"),
  saveBudgetButton: document.querySelector("#saveBudgetButton"),
  categoryChart: document.querySelector("#categoryChart"),
  sevenDayChart: document.querySelector("#sevenDayChart"),
  reportList: document.querySelector("#reportList"),
  yearLabel: document.querySelector("#yearLabel"),
  yearIncome: document.querySelector("#yearIncome"),
  yearExpense: document.querySelector("#yearExpense"),
  yearBalance: document.querySelector("#yearBalance"),
  profileSummary: document.querySelector("#profileSummary"),
  backupAge: document.querySelector("#backupAge"),
  themeInputs: document.querySelectorAll("input[name='themeMode']"),
  exportButton: document.querySelector("#exportButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importInput: document.querySelector("#importInput"),
  backupStatus: document.querySelector("#backupStatus"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  applyTheme(state.theme);
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
    saveEntryFromForm();
  });

  els.cancelEditButton.addEventListener("click", resetEntryForm);

  els.monthPicker.addEventListener("change", () => {
    state.selectedMonth = els.monthPicker.value || toMonthValue(new Date());
    render();
  });

  els.prevMonth.addEventListener("click", () => changeMonth(-1));
  els.nextMonth.addEventListener("click", () => changeMonth(1));

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-button");
    const editButton = event.target.closest(".edit-button");
    if (button) {
      deleteEntry(button.dataset.id);
      return;
    }
    if (editButton) {
      startEditEntry(editButton.dataset.id);
    }
  });

  els.searchInput.addEventListener("input", () => {
    state.searchQuery = els.searchInput.value.trim().toLowerCase();
    render();
  });

  els.typeFilter.addEventListener("change", () => {
    state.typeFilter = els.typeFilter.value;
    render();
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
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.importInput.addEventListener("change", importBackup);

  els.themeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.theme = input.value;
      localStorage.setItem(THEME_KEY, state.theme);
      applyTheme(state.theme);
    });
  });

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

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = normalized;
  document.querySelector("meta[name='theme-color']").setAttribute("content", normalized === "dark" ? "#101413" : "#f4f7f6");
  els.themeInputs.forEach((input) => {
    input.checked = input.value === normalized;
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

function saveEntryFromForm() {
  const amount = Number.parseFloat(els.amount.value);
  const date = els.date.value;
  const type = getSelectedType();
  const category = els.category.value;
  const note = els.note.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category) return;

  const payload = {
    id: state.editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    category,
    note,
    createdAt: new Date().toISOString()
  };

  if (state.editingId) {
    const oldEntry = state.entries.find((entry) => entry.id === state.editingId);
    payload.createdAt = oldEntry?.createdAt || payload.createdAt;
    state.entries = state.entries.map((entry) => entry.id === state.editingId ? payload : entry);
  } else {
    state.entries.unshift(payload);
  }

  state.selectedMonth = date.slice(0, 7);
  els.monthPicker.value = state.selectedMonth;
  resetEntryForm(date);
  saveEntries();
  render();
  els.amount.focus();
}

function startEditEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  state.editingId = id;
  document.querySelector(`input[name='type'][value='${entry.type}']`).checked = true;
  renderCategories(entry.type);
  els.amount.value = entry.amount;
  els.date.value = entry.date;
  els.category.value = entry.category;
  els.note.value = entry.note;
  els.formTitle.textContent = "编辑记录";
  els.saveEntryButton.textContent = "保存修改";
  els.cancelEditButton.hidden = false;
  switchView("ledger");
  els.entryCard.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => els.amount.focus(), 250);
}

function resetEntryForm(keepDate = toDateValue(new Date())) {
  state.editingId = null;
  els.form.reset();
  document.querySelector("input[name='type'][value='expense']").checked = true;
  els.date.value = keepDate;
  renderCategories("expense");
  els.formTitle.textContent = "新增记录";
  els.saveEntryButton.textContent = "保存记录";
  els.cancelEditButton.hidden = true;
}

function deleteEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  if (state.editingId === id) resetEntryForm();
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
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  setBackupStatus(`已导出 ${state.entries.length} 条记录`);
  renderProfile();
}

function exportCsv() {
  const header = ["类型", "金额", "日期", "分类", "备注", "创建时间"];
  const rows = state.entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((entry) => [
      entry.type === "income" ? "收入" : "支出",
      entry.amount,
      entry.date,
      entry.category,
      entry.note,
      entry.createdAt
    ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-ledger-${toDateValue(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupStatus("已导出 CSV，可用 Excel 打开");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
  renderQuickStats(monthlyEntries, totals);
  renderList(getFilteredEntries(monthlyEntries));
  renderCharts(monthlyEntries, totals);
  renderReports();
  renderProfile();
}

function renderSummary(totals) {
  els.monthIncome.textContent = money(totals.income);
  els.monthExpense.textContent = money(totals.expense);
  els.monthBalance.textContent = money(totals.income - totals.expense);
}

function renderQuickStats(monthlyEntries, totals) {
  const today = toDateValue(new Date());
  const weekStart = getWeekStart(new Date());
  const todayExpense = monthlyEntries
    .filter((entry) => entry.type === "expense" && entry.date === today)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const weekExpense = monthlyEntries
    .filter((entry) => entry.type === "expense" && new Date(`${entry.date}T00:00:00`) >= weekStart)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const budget = state.budgets[state.selectedMonth] || 0;
  const usedRatio = budget > 0 ? Math.min(totals.expense / budget, 1) : 0;

  els.todayExpense.textContent = money(todayExpense);
  els.weekExpense.textContent = money(weekExpense);
  els.monthProgressText.textContent = budget > 0
    ? `${money(totals.expense)} / ${money(budget)}`
    : "未设置";
  els.monthProgressLabel.textContent = budget > 0 ? "本月预算使用" : "本月预算";
  els.monthProgressFill.style.width = `${usedRatio * 100}%`;
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
      item.querySelector(".edit-button").dataset.id = entry.id;
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
  renderInsights(entries);
  renderSevenDayChart();
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

function renderInsights(entries) {
  const expenses = entries.filter((entry) => entry.type === "expense");
  const largest = expenses.slice().sort((a, b) => b.amount - a.amount)[0];
  const expenseTotal = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const averageDays = getElapsedDaysForMonth(state.selectedMonth);
  const dailyAverage = averageDays > 0 ? expenseTotal / averageDays : 0;
  const budget = state.budgets[state.selectedMonth] || 0;

  els.largestExpense.textContent = largest ? money(largest.amount) : money(0);
  els.largestExpenseNote.textContent = largest ? `${largest.category} · ${largest.note || formatDate(largest.date)}` : "暂无";
  els.dailyAverage.textContent = money(dailyAverage);

  if (!budget) {
    els.budgetAdvice.textContent = "设置预算后，会在这里提醒本月花费节奏。";
  } else if (expenseTotal > budget) {
    els.budgetAdvice.textContent = "本月支出已经超过预算，建议先暂停非必要消费。";
  } else {
    const left = budget - expenseTotal;
    els.budgetAdvice.textContent = `距离预算还剩 ${money(left)}，继续保持。`;
  }
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

function renderSevenDayChart() {
  const days = getRecentDays(7);
  const expensesByDate = state.entries
    .filter((entry) => entry.type === "expense")
    .reduce((acc, entry) => {
      acc[entry.date] = (acc[entry.date] || 0) + entry.amount;
      return acc;
    }, {});
  const rows = days.map((date) => ({
    date,
    amount: expensesByDate[date] || 0
  }));
  const max = Math.max(...rows.map((row) => row.amount), 1);

  els.sevenDayChart.textContent = "";
  rows.forEach((row) => {
    const bar = document.createElement("div");
    bar.className = "day-bar";
    bar.innerHTML = `
      <div class="day-fill" style="height:${Math.max((row.amount / max) * 96, 8)}px"></div>
      <span>${formatShortDay(row.date)}</span>
      <strong>${row.amount ? compactMoney(row.amount) : "0"}</strong>
    `;
    els.sevenDayChart.append(bar);
  });
}

function renderReports() {
  const months = getMonthReports();
  renderYearSummary();
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
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  els.backupAge.textContent = lastBackup ? formatBackupAge(lastBackup) : "未备份";
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

function getFilteredEntries(entries) {
  return entries.filter((entry) => {
    const matchesType = state.typeFilter === "all" || entry.type === state.typeFilter;
    const text = `${entry.category} ${entry.note}`.toLowerCase();
    const matchesSearch = !state.searchQuery || text.includes(state.searchQuery);
    return matchesType && matchesSearch;
  });
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

function renderYearSummary() {
  const year = new Date().getFullYear();
  const entries = state.entries.filter((entry) => entry.date.startsWith(`${year}-`));
  const totals = getTotals(entries);
  els.yearLabel.textContent = `${year}`;
  els.yearIncome.textContent = money(totals.income);
  els.yearExpense.textContent = money(totals.expense);
  els.yearBalance.textContent = money(totals.income - totals.expense);
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

function formatShortDay(value) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function compactMoney(value) {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`;
  if (value >= 1000) return `${Math.round(value)}`;
  return `${Math.round(value)}`;
}

function formatBackupAge(value) {
  const backupDate = new Date(value);
  if (Number.isNaN(backupDate.getTime())) return "未备份";
  const diffDays = Math.floor((Date.now() - backupDate.getTime()) / 86400000);
  if (diffDays <= 0) return "今天已备份";
  return `${diffDays} 天前备份`;
}

function getElapsedDaysForMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  if (isCurrentMonth) return now.getDate();
  return new Date(year, month, 0).getDate();
}

function getRecentDays(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    return toDateValue(date);
  });
}

function getWeekStart(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
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
