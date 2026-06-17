const STORAGE_KEY = "personal-ledger-v1";

const categories = {
  expense: ["餐饮", "交通", "购物", "住房", "娱乐", "医疗", "学习", "其他支出"],
  income: ["工资", "奖金", "副业", "理财", "红包", "其他收入"]
};

const state = {
  entries: loadEntries(),
  selectedMonth: toMonthValue(new Date()),
  deferredInstallPrompt: null
};

const els = {
  form: document.querySelector("#entryForm"),
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
  income: document.querySelector("#monthIncome"),
  expense: document.querySelector("#monthExpense"),
  balance: document.querySelector("#monthBalance"),
  clearMonth: document.querySelector("#clearMonthButton"),
  installButton: document.querySelector("#installButton")
};

init();

function init() {
  els.monthPicker.value = state.selectedMonth;
  els.date.value = toDateValue(new Date());
  renderCategories(getSelectedType());
  render();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
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

function addEntry() {
  const amount = Number.parseFloat(els.amount.value);
  const date = els.date.value;
  const type = getSelectedType();
  const category = els.category.value;
  const note = els.note.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category) {
    return;
  }

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

function render() {
  const monthlyEntries = getMonthlyEntries();
  renderSummary(monthlyEntries);
  renderList(monthlyEntries);
}

function renderSummary(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc[entry.type] += entry.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  els.income.textContent = money(totals.income);
  els.expense.textContent = money(totals.expense);
  els.balance.textContent = money(totals.income - totals.expense);
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

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
      // Local file previews cannot register service workers; localhost works.
    });
  });
}
