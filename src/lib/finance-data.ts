export type AccountType = "giro" | "sparen" | "investment" | "cash";

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

export type TransactionType = "income" | "expense";

export type FinanceAccount = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  goal?: number;
  institution: string;
  updatedAt: string;
};

export type IncomeSource = {
  id: string;
  source: string;
  amount: number;
  cadence: Cadence;
  startsAt: string;
  endsAt?: string;
  note?: string;
};

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  cadence: Cadence;
  category: string;
  startsAt: string;
  endsAt?: string;
};

export type SubscriptionCategory = {
  id: string;
  name: string;
  color: string;
};

export type BudgetCategory = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  color: string;
};

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId?: string;
  date: string;
  note?: string;
};

export type FinanceData = {
  accounts: FinanceAccount[];
  incomes: IncomeSource[];
  subscriptions: Subscription[];
  subscriptionCategories: SubscriptionCategory[];
  budgets: BudgetCategory[];
  transactions: Transaction[];
};

export const accountTypeLabels: Record<AccountType, string> = {
  giro: "Girokonto",
  sparen: "Sparkonto",
  investment: "Investment",
  cash: "Bargeld",
};

export const cadenceLabels: Record<Cadence, string> = {
  weekly: "Woche",
  monthly: "Monat",
  quarterly: "Quartal",
  yearly: "Jahr",
};

export const demoFinanceData: FinanceData = {
  accounts: [
    {
      id: "acc-main",
      name: "Hauptkonto",
      type: "giro",
      balance: 3820.4,
      institution: "N26",
      updatedAt: "2026-05-28",
    },
    {
      id: "acc-savings",
      name: "Notgroschen",
      type: "sparen",
      balance: 12400,
      goal: 15000,
      institution: "Trade Republic",
      updatedAt: "2026-05-26",
    },
    {
      id: "acc-etf",
      name: "ETF Depot",
      type: "investment",
      balance: 28750.22,
      goal: 50000,
      institution: "Scalable",
      updatedAt: "2026-05-30",
    },
  ],
  incomes: [
    {
      id: "inc-salary",
      source: "Gehalt",
      amount: 4200,
      cadence: "monthly",
      startsAt: "2024-01-01",
      note: "Netto",
    },
    {
      id: "inc-freelance",
      source: "Freelance Retainer",
      amount: 850,
      cadence: "monthly",
      startsAt: "2026-02-01",
      endsAt: "2026-09-30",
    },
  ],
  subscriptions: [
    {
      id: "sub-rent",
      name: "Miete",
      amount: 1280,
      cadence: "monthly",
      category: "Wohnen",
      startsAt: "2025-05-01",
    },
    {
      id: "sub-spotify",
      name: "Spotify Family",
      amount: 17.99,
      cadence: "monthly",
      category: "Streaming",
      startsAt: "2023-08-12",
    },
    {
      id: "sub-gym",
      name: "Fitnessstudio",
      amount: 49,
      cadence: "monthly",
      category: "Gesundheit",
      startsAt: "2026-01-15",
      endsAt: "2027-01-14",
    },
    {
      id: "sub-icloud",
      name: "iCloud+",
      amount: 9.99,
      cadence: "monthly",
      category: "Software",
      startsAt: "2024-11-01",
    },
    {
      id: "sub-insurance",
      name: "Haftpflicht",
      amount: 74.9,
      cadence: "yearly",
      category: "Versicherung",
      startsAt: "2025-10-01",
      endsAt: "2026-09-30",
    },
  ],
  subscriptionCategories: [
    { id: "cat-living", name: "Wohnen", color: "#0f766e" },
    { id: "cat-streaming", name: "Streaming", color: "#2563eb" },
    { id: "cat-health", name: "Gesundheit", color: "#16a34a" },
    { id: "cat-software", name: "Software", color: "#7c3aed" },
    { id: "cat-insurance", name: "Versicherung", color: "#ea580c" },
  ],
  budgets: [
    { id: "bud-food", name: "Lebensmittel", spent: 420, limit: 550, color: "#2563eb" },
    { id: "bud-mobility", name: "Mobilität", spent: 118, limit: 180, color: "#16a34a" },
    { id: "bud-leisure", name: "Freizeit", spent: 290, limit: 350, color: "#ea580c" },
    { id: "bud-home", name: "Haushalt", spent: 155, limit: 220, color: "#db2777" },
  ],
  transactions: [
    {
      id: "tx-salary-may",
      title: "Gehalt Mai",
      amount: 4200,
      type: "income",
      category: "Gehalt",
      accountId: "acc-main",
      date: "2026-05-28",
    },
    {
      id: "tx-freelance-may",
      title: "Freelance Retainer",
      amount: 850,
      type: "income",
      category: "Projekt",
      accountId: "acc-main",
      date: "2026-05-15",
    },
    {
      id: "tx-groceries",
      title: "Supermarkt",
      amount: 84.2,
      type: "expense",
      category: "Lebensmittel",
      accountId: "acc-main",
      date: "2026-05-25",
    },
    {
      id: "tx-train",
      title: "Deutschlandticket",
      amount: 49,
      type: "expense",
      category: "Mobilität",
      accountId: "acc-main",
      date: "2026-05-01",
    },
    {
      id: "tx-dinner",
      title: "Restaurant",
      amount: 72.5,
      type: "expense",
      category: "Freizeit",
      accountId: "acc-main",
      date: "2026-05-18",
    },
    {
      id: "tx-household",
      title: "Drogerie",
      amount: 38.9,
      type: "expense",
      category: "Haushalt",
      accountId: "acc-main",
      date: "2026-05-09",
    },
  ],
};

export const trendData = [
  { month: "Dez", income: 4650, costs: 3070, savings: 1580 },
  { month: "Jan", income: 5050, costs: 3230, savings: 1820 },
  { month: "Feb", income: 5050, costs: 3190, savings: 1860 },
  { month: "Mrz", income: 5050, costs: 3340, savings: 1710 },
  { month: "Apr", income: 5050, costs: 3125, savings: 1925 },
  { month: "Mai", income: 5050, costs: 2990, savings: 2060 },
];

export function monthlyAmount(amount: number, cadence: Cadence) {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function getTodayISO() {
  return toLocalISODate(new Date());
}

export function toLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isActivePeriod(startsAt: string, endsAt?: string) {
  const today = getTodayISO();
  return startsAt <= today && (!endsAt || endsAt >= today);
}

export function getDaysUntil(date: string) {
  const today = new Date(getTodayISO());
  const target = new Date(date);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function getNextBillingDate(startsAt: string, cadence: Cadence) {
  const today = new Date(getTodayISO());
  const next = new Date(startsAt);

  if (next >= today) {
    return toLocalISODate(next);
  }

  while (next < today) {
    switch (cadence) {
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "quarterly":
        next.setMonth(next.getMonth() + 3);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }
  }

  return toLocalISODate(next);
}

export function getMonthlyTrendData(data: FinanceData) {
  if (data.transactions.length === 0) {
    return trendData;
  }

  const now = new Date(getTodayISO());
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("de-DE", { month: "short" }).format(date);
    return { key, month: label, income: 0, costs: 0, savings: 0 };
  });

  for (const transaction of data.transactions) {
    const month = transaction.date.slice(0, 7);
    const bucket = months.find((item) => item.key === month);

    if (!bucket) {
      continue;
    }

    if (transaction.type === "income") {
      bucket.income += transaction.amount;
    } else {
      bucket.costs += transaction.amount;
    }
  }

  return months.map((month) => ({
    month: month.month,
    income: month.income,
    costs: month.costs,
    savings: month.income - month.costs,
  }));
}

export function summarizeFinanceData(data: FinanceData) {
  const totalAssets = data.accounts.reduce((sum, account) => sum + account.balance, 0);
  const savings = data.accounts
    .filter((account) => account.type === "sparen" || account.type === "investment")
    .reduce((sum, account) => sum + account.balance, 0);
  const monthlyIncome = data.incomes
    .filter((income) => isActivePeriod(income.startsAt, income.endsAt))
    .reduce((sum, income) => sum + monthlyAmount(income.amount, income.cadence), 0);
  const monthlySubscriptions = data.subscriptions
    .filter((subscription) => isActivePeriod(subscription.startsAt, subscription.endsAt))
    .reduce((sum, subscription) => sum + monthlyAmount(subscription.amount, subscription.cadence), 0);
  const currentMonth = getTodayISO().slice(0, 7);
  const transactionExpensesThisMonth = data.transactions
    .filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(currentMonth))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthlyBudgetSpend =
    transactionExpensesThisMonth > 0
      ? transactionExpensesThisMonth
      : data.budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const transactionIncomeThisMonth = data.transactions
    .filter((transaction) => transaction.type === "income" && transaction.date.startsWith(currentMonth))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const effectiveMonthlyIncome = transactionIncomeThisMonth > 0 ? transactionIncomeThisMonth : monthlyIncome;
  const freeCashflow = effectiveMonthlyIncome - monthlySubscriptions - monthlyBudgetSpend;
  const savingsRate = effectiveMonthlyIncome > 0 ? freeCashflow / effectiveMonthlyIncome : 0;
  const activeSubscriptions = data.subscriptions.filter((subscription) =>
    isActivePeriod(subscription.startsAt, subscription.endsAt),
  ).length;
  const expiringSubscriptions = data.subscriptions.filter((subscription) => {
    if (!subscription.endsAt) {
      return false;
    }

    const days = getDaysUntil(subscription.endsAt);
    return days >= 0 && days <= 60;
  }).length;

  return {
    totalAssets,
    savings,
    monthlyIncome: effectiveMonthlyIncome,
    monthlySubscriptions,
    monthlyBudgetSpend,
    freeCashflow,
    savingsRate,
    activeSubscriptions,
    expiringSubscriptions,
  };
}
