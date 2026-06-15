"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  Download,
  Euro,
  Landmark,
  LayoutDashboard,
  LogIn,
  LogOut,
  PiggyBank,
  PlugZap,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  ActionButton,
  Badge,
  Card,
  ColorDot,
  ColorField,
  Field,
  IconButton,
  Notice,
  ProgressBar,
  SearchField,
  SelectField,
  SelectInput,
  SubmitButton,
  Surface,
  TextInput,
  type BadgeTone,
} from "@/components/finance/ui";
import {
  accountTypeLabels,
  cadenceLabels,
  demoFinanceData,
  formatCurrency,
  formatPercent,
  getDaysUntil,
  getTodayISO,
  getMonthlyTrendData,
  getNextBillingDate,
  isActivePeriod,
  monthlyAmount,
  summarizeFinanceData,
  trendData,
  type AccountType,
  type Cadence,
  type FinanceAccount,
  type FinanceData,
  type IncomeSource,
  type Subscription,
  type SubscriptionCategory,
  type BudgetCategory,
  type Transaction,
  type TransactionType,
} from "@/lib/finance-data";
import {
  createAccount,
  createBudget,
  createIncome,
  createSubscription,
  createSubscriptionCategory,
  createTransaction,
  deleteFinanceDocument,
  confirmTotpMfaSetup,
  disableMfaForCurrentUser,
  getCurrentAppwriteUser,
  getMfaStatus,
  isAppwriteConfigured,
  loadFinanceData,
  loginWithEmail,
  logoutAppwriteUser,
  startTotpMfaSetup,
  upsertAccount,
  upsertTransaction,
  updateFinanceDocument,
  type AppUser,
  type LoginWithEmailResult,
  type MfaStatus,
  type TotpMfaSetup,
  verifyMfaLogin,
} from "@/lib/appwrite";
import type { BankConnectionStatus, BankSyncPayload } from "@/lib/bank-sync";

type View = "overview" | "accounts" | "income" | "transactions" | "budgets" | "subscriptions";
type AuthStatus = "checking" | "guest" | "ready";
type StorageMode = "appwrite" | "demo";
type DeletableCollection =
  | "accounts"
  | "incomes"
  | "subscriptions"
  | "subscriptionCategories"
  | "budgets"
  | "transactions";

const demoStorageKey = "meinefinanzen-demo-data-v1";

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "accounts", label: "Konten", icon: WalletCards },
  { id: "income", label: "Einkommen", icon: Banknote },
  { id: "transactions", label: "Buchungen", icon: CreditCard },
  { id: "budgets", label: "Budgets", icon: Target },
  { id: "subscriptions", label: "Abos", icon: ReceiptText },
];

const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Einnahme",
  expense: "Ausgabe",
};

const accountTypeOptions = toSelectOptions(accountTypeLabels);
const cadenceOptions = toSelectOptions(cadenceLabels);
const transactionTypeOptions = toSelectOptions(transactionTypeLabels);
const transactionFilterOptions = [{ label: "Alle Typen", value: "all" }, ...transactionTypeOptions];

export function FinanceApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [storageMode, setStorageMode] = useState<StorageMode>("demo");
  const [user, setUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<FinanceData>(demoFinanceData);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<BankConnectionStatus | null>(null);
  const [bankProviderId, setBankProviderId] = useState("revolut");
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [totpSetup, setTotpSetup] = useState<TotpMfaSetup | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      const bankCallback = readBankCallback();

      if (!isAppwriteConfigured) {
        if (bankCallback.connected) {
          setUser(createDemoUser());
          setData(readDemoData());
          setStorageMode("demo");
          setMfaStatus(null);
          setMessage("Bankverbindung hergestellt. Du kannst jetzt synchronisieren.");
          setAuthStatus("ready");
        } else {
          if (bankCallback.error) {
            setMessage(`Bankverbindung: ${bankCallback.error}`);
          }

          setAuthStatus("guest");
        }

        clearBankCallbackQuery();
        return;
      }

      const currentUser = await getCurrentAppwriteUser();

      if (!isMounted) {
        return;
      }

      if (!currentUser) {
        if (bankCallback.connected) {
          setUser(createDemoUser());
          setData(readDemoData());
          setStorageMode("demo");
          setMfaStatus(null);
          setMessage("Bankverbindung hergestellt. Du kannst jetzt synchronisieren.");
          setAuthStatus("ready");
        } else {
          if (bankCallback.error) {
            setMessage(`Bankverbindung: ${bankCallback.error}`);
          }

          setAuthStatus("guest");
        }

        clearBankCallbackQuery();
        return;
      }

      try {
        const [remoteData, currentMfaStatus] = await Promise.all([
          loadFinanceData(currentUser.id),
          getMfaStatus().catch(() => ({ enabled: currentUser.mfa, totp: currentUser.mfa })),
        ]);

        if (!isMounted) {
          return;
        }

        setUser(currentUser);
        setData({
          ...demoFinanceData,
          accounts: remoteData.accounts,
          incomes: remoteData.incomes,
          subscriptions: remoteData.subscriptions,
          subscriptionCategories: ensureSubscriptionCategories(remoteData.subscriptionCategories, remoteData.subscriptions),
          budgets: remoteData.budgets,
          transactions: remoteData.transactions,
        });
        setStorageMode("appwrite");
        setMfaStatus(currentMfaStatus);
        if (bankCallback.connected) {
          setMessage("Bankverbindung hergestellt. Du kannst jetzt synchronisieren.");
        } else if (bankCallback.error) {
          setMessage(`Bankverbindung: ${bankCallback.error}`);
        }
        setAuthStatus("ready");
      } catch {
        if (!isMounted) {
          return;
        }

        setUser(currentUser);
        setData(readDemoData());
        setStorageMode("demo");
        setMfaStatus(null);
        setMessage(
          bankCallback.connected
            ? "Bankverbindung hergestellt. Appwrite Collections sind noch nicht fertig eingerichtet."
            : "Appwrite ist erreichbar, aber die Collections sind noch nicht fertig eingerichtet.",
        );
        setAuthStatus("ready");
      } finally {
        clearBankCallbackQuery();
      }
    }

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (authStatus === "ready" && storageMode === "demo") {
      window.localStorage.setItem(demoStorageKey, JSON.stringify(data));
    }
  }, [authStatus, data, storageMode]);

  useEffect(() => {
    if (authStatus !== "ready") {
      return;
    }

    let isMounted = true;

    async function loadBankStatus() {
      try {
        const status = await readJsonResponse<BankConnectionStatus>(
          await fetch("/api/bank-connections/enable-banking", { cache: "no-store" }),
        );

        if (isMounted) {
          setBankStatus(status);
          setBankProviderId((current) => {
            if (status.activeProviderId) {
              return status.activeProviderId;
            }

            if (status.supportedProviders.some((provider) => provider.id === current)) {
              return current;
            }

            return status.supportedProviders[0]?.id ?? "revolut";
          });
        }
      } catch {
        if (isMounted) {
          setBankStatus(null);
        }
      }
    }

    loadBankStatus();

    return () => {
      isMounted = false;
    };
  }, [authStatus]);

  const summary = useMemo(() => summarizeFinanceData(data), [data]);
  const monthlyTrend = useMemo(() => getMonthlyTrendData(data), [data]);

  const categoryBreakdown = useMemo(() => {
    const freeCashflow = Math.max(summary.freeCashflow, 0);

    return [
      { name: "Fixkosten", value: summary.monthlySubscriptions, color: "#0f766e" },
      { name: "Budgets", value: summary.monthlyBudgetSpend, color: "#ea580c" },
      { name: "Frei", value: freeCashflow, color: "#2563eb" },
    ].filter((entry) => entry.value > 0);
  }, [summary.freeCashflow, summary.monthlyBudgetSpend, summary.monthlySubscriptions]);

  const activeSubscriptions = useMemo(
    () => data.subscriptions.filter((subscription) => isActivePeriod(subscription.startsAt, subscription.endsAt)),
    [data.subscriptions],
  );

  async function finishAppwriteLogin(loggedInUser: AppUser) {
    const [remoteData, currentMfaStatus] = await Promise.all([
      loadFinanceData(loggedInUser.id),
      getMfaStatus().catch(() => ({ enabled: loggedInUser.mfa, totp: loggedInUser.mfa })),
    ]);

    setUser(loggedInUser);
    setData({
      ...demoFinanceData,
      accounts: remoteData.accounts,
      incomes: remoteData.incomes,
      subscriptions: remoteData.subscriptions,
      subscriptionCategories: ensureSubscriptionCategories(remoteData.subscriptionCategories, remoteData.subscriptions),
      budgets: remoteData.budgets,
      transactions: remoteData.transactions,
    });
    setStorageMode("appwrite");
    setMfaStatus(currentMfaStatus);
    setTotpSetup(null);
    setAuthStatus("ready");
  }

  async function handleLogin(email: string, password: string): Promise<LoginWithEmailResult | null> {
    setBusy(true);
    setMessage(null);

    try {
      const result = await loginWithEmail(email, password);

      if (result.status === "mfaRequired") {
        setMessage("2FA-Code erforderlich.");
        return result;
      }

      await finishAppwriteLogin(result.user);
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login fehlgeschlagen.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyMfaLogin(challengeId: string, otp: string) {
    setBusy(true);
    setMessage(null);

    try {
      const loggedInUser = await verifyMfaLogin(challengeId, otp);
      await finishAppwriteLogin(loggedInUser);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "2FA-Code konnte nicht bestätigt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);

    try {
      if (storageMode === "appwrite") {
        await logoutAppwriteUser();
      }
    } finally {
      setUser(null);
      setData(demoFinanceData);
      setStorageMode("demo");
      setMfaStatus(null);
      setTotpSetup(null);
      setAuthStatus("guest");
      setBusy(false);
    }
  }

  async function handleStartMfaSetup() {
    if (storageMode !== "appwrite") {
      setMessage("2FA ist nur für Appwrite-Konten verfügbar.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      setTotpSetup(await startTotpMfaSetup());
      setMessage("2FA-Einrichtung gestartet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "2FA-Einrichtung konnte nicht gestartet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmMfaSetup(otp: string) {
    setBusy(true);
    setMessage(null);

    try {
      const updatedUser = await confirmTotpMfaSetup(otp);
      const currentMfaStatus = await getMfaStatus().catch(() => ({ enabled: updatedUser.mfa, totp: updatedUser.mfa }));

      setUser(updatedUser);
      setMfaStatus(currentMfaStatus);
      setTotpSetup(null);
      setMessage("2FA ist aktiviert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "2FA-Code konnte nicht bestätigt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableMfa() {
    if (!window.confirm("2FA für dieses Konto deaktivieren?")) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const updatedUser = await disableMfaForCurrentUser();
      const currentMfaStatus = await getMfaStatus().catch(() => ({ enabled: updatedUser.mfa, totp: false }));

      setUser(updatedUser);
      setMfaStatus(currentMfaStatus);
      setTotpSetup(null);
      setMessage("2FA ist deaktiviert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "2FA konnte nicht deaktiviert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStartBankConnection(providerId: string) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await readJsonResponse<{ url: string }>(
        await fetch("/api/bank-connections/enable-banking", {
          body: JSON.stringify({ providerId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );

      window.location.assign(response.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bankverbindung konnte nicht gestartet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncBankConnection() {
    setBusy(true);
    setMessage(null);

    try {
      const sync = await readJsonResponse<BankSyncPayload>(
        await fetch("/api/bank-connections/enable-banking/sync?days=90", { cache: "no-store" }),
      );
      const persistedSync =
        storageMode === "appwrite" && user ? await persistBankSync(user.id, sync) : sync;

      setData((current) => mergeBankSyncData(current, persistedSync));
      setMessage(
        `Bankdaten synchronisiert: ${persistedSync.accounts.length} Konten, ${persistedSync.transactions.length} Buchungen.`,
      );
      setBankStatus((current) => (current ? { ...current, connected: true } : current));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bankdaten konnten nicht synchronisiert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<FinanceAccount, "id"> = {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "giro") as AccountType,
      balance: toNumber(formData.get("balance")),
      goal: optionalNumber(formData.get("goal")),
      institution: String(formData.get("institution") ?? ""),
      updatedAt: getTodayISO(),
    };

    if (!input.name || !input.institution) {
      setMessage("Konto und Anbieter brauchen einen Namen.");
      return;
    }

    try {
      const account =
        storageMode === "appwrite" && user
          ? await createAccount(user.id, input)
          : { ...input, id: createLocalId("acc") };

      setData((current) => ({
        ...current,
        accounts: [account, ...current.accounts],
      }));
      setMessage("Konto gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Konto konnte nicht gespeichert werden.");
    }
  }

  async function handleAddIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<IncomeSource, "id"> = {
      source: String(formData.get("source") ?? ""),
      amount: toNumber(formData.get("amount")),
      cadence: String(formData.get("cadence") ?? "monthly") as Cadence,
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: optionalString(formData.get("endsAt")),
      note: optionalString(formData.get("note")),
    };

    if (!input.source || !input.startsAt) {
      setMessage("Einkommen braucht Quelle und Startdatum.");
      return;
    }

    try {
      const income =
        storageMode === "appwrite" && user
          ? await createIncome(user.id, input)
          : { ...input, id: createLocalId("inc") };

      setData((current) => ({
        ...current,
        incomes: [income, ...current.incomes],
      }));
      setMessage("Einkommen gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Einkommen konnte nicht gespeichert werden.");
    }
  }

  async function handleAddSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<Subscription, "id"> = {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      amount: toNumber(formData.get("amount")),
      cadence: String(formData.get("cadence") ?? "monthly") as Cadence,
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: optionalString(formData.get("endsAt")),
    };

    if (!input.name || !input.category || !input.startsAt) {
      setMessage("Abo braucht Name, Kategorie und Startdatum.");
      return;
    }

    try {
      const subscription =
        storageMode === "appwrite" && user
          ? await createSubscription(user.id, input)
          : { ...input, id: createLocalId("sub") };

      setData((current) => ({
        ...current,
        subscriptions: [subscription, ...current.subscriptions],
      }));
      setMessage("Abo gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abo konnte nicht gespeichert werden.");
    }
  }

  async function handleAddSubscriptionCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<SubscriptionCategory, "id"> = {
      name: String(formData.get("name") ?? "").trim(),
      color: String(formData.get("color") ?? "#0f766e"),
    };

    if (!input.name) {
      setMessage("Kategorie braucht einen Namen.");
      return;
    }

    const exists = data.subscriptionCategories.some(
      (category) => category.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (exists) {
      setMessage("Diese Abo-Kategorie existiert bereits.");
      return;
    }

    try {
      const category =
        storageMode === "appwrite" && user
          ? await createSubscriptionCategory(user.id, input)
          : { ...input, id: createLocalId("cat") };

      setData((current) => ({
        ...current,
        subscriptionCategories: [category, ...current.subscriptionCategories],
      }));
      setMessage("Abo-Kategorie gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abo-Kategorie konnte nicht gespeichert werden.");
    }
  }

  async function handleAddBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<BudgetCategory, "id"> = {
      name: String(formData.get("name") ?? "").trim(),
      spent: toNumber(formData.get("spent")),
      limit: toNumber(formData.get("limit")),
      color: String(formData.get("color") ?? "#2563eb"),
    };

    if (!input.name || input.limit <= 0) {
      setMessage("Budget braucht Namen und ein Limit größer als 0.");
      return;
    }

    try {
      const budget =
        storageMode === "appwrite" && user
          ? await createBudget(user.id, input)
          : { ...input, id: createLocalId("bud") };

      setData((current) => ({
        ...current,
        budgets: [budget, ...current.budgets],
      }));
      setMessage("Budget gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Budget konnte nicht gespeichert werden.");
    }
  }

  async function handleAddTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: Omit<Transaction, "id"> = {
      title: String(formData.get("title") ?? "").trim(),
      amount: toNumber(formData.get("amount")),
      type: String(formData.get("type") ?? "expense") as TransactionType,
      category: String(formData.get("category") ?? "").trim(),
      accountId: optionalString(formData.get("accountId")),
      date: String(formData.get("date") ?? ""),
      note: optionalString(formData.get("note")),
    };

    if (!input.title || !input.category || input.amount <= 0 || !input.date) {
      setMessage("Buchung braucht Titel, Kategorie, Betrag und Datum.");
      return;
    }

    try {
      const transaction =
        storageMode === "appwrite" && user
          ? await createTransaction(user.id, input)
          : { ...input, id: createLocalId("tx") };

      setData((current) => ({
        ...current,
        transactions: [transaction, ...current.transactions],
      }));
      setMessage("Buchung gespeichert.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Buchung konnte nicht gespeichert werden.");
    }
  }

  async function handleUpdate(type: DeletableCollection, id: string, patch: Record<string, unknown>) {
    try {
      if (storageMode === "appwrite") {
        await updateFinanceDocument(type, id, patch);
      }

      setData((current) => ({
        ...current,
        [type]: current[type].map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }));
      setMessage("Änderung gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Änderung konnte nicht gespeichert werden.");
    }
  }

  async function handleUpdateSubscriptionCategory(id: string, patch: Pick<SubscriptionCategory, "name" | "color">) {
    const currentCategory = data.subscriptionCategories.find((category) => category.id === id);
    const nextName = patch.name.trim();

    if (!currentCategory) {
      setMessage("Kategorie wurde nicht gefunden.");
      return;
    }

    if (!nextName) {
      setMessage("Kategorie braucht einen Namen.");
      return;
    }

    const duplicate = data.subscriptionCategories.some(
      (category) => category.id !== id && category.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      setMessage("Diese Abo-Kategorie existiert bereits.");
      return;
    }

    const categoryPatch = {
      color: patch.color,
      name: nextName,
    };
    const categoryWasRenamed = currentCategory.name !== nextName;
    const affectedSubscriptions = data.subscriptions.filter(
      (subscription) => subscription.category === currentCategory.name,
    );

    try {
      if (storageMode === "appwrite") {
        await updateFinanceDocument("subscriptionCategories", id, categoryPatch);

        if (categoryWasRenamed) {
          await Promise.all(
            affectedSubscriptions.map((subscription) =>
              updateFinanceDocument("subscriptions", subscription.id, { category: nextName }),
            ),
          );
        }
      }

      setData((current) => ({
        ...current,
        subscriptionCategories: current.subscriptionCategories.map((category) =>
          category.id === id ? { ...category, ...categoryPatch } : category,
        ),
        subscriptions: categoryWasRenamed
          ? current.subscriptions.map((subscription) =>
              subscription.category === currentCategory.name ? { ...subscription, category: nextName } : subscription,
            )
          : current.subscriptions,
      }));
      setMessage("Kategorie aktualisiert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kategorie konnte nicht aktualisiert werden.");
    }
  }

  function handleExportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meinefinanzen-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Export erstellt.");
  }

  async function handleImportData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (storageMode === "appwrite") {
      setMessage("Import ist im Appwrite-Modus deaktiviert, damit keine Daten nur lokal überschrieben werden.");
      event.target.value = "";
      return;
    }

    try {
      const imported = normalizeFinanceData(JSON.parse(await file.text()) as Partial<FinanceData>);
      setData(imported);
      setMessage("Import geladen.");
    } catch {
      setMessage("Import konnte nicht gelesen werden.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDelete(type: DeletableCollection, id: string) {
    if (type === "subscriptionCategories") {
      const category = data.subscriptionCategories.find((item) => item.id === id);
      const isUsed = category
        ? data.subscriptions.some((subscription) => subscription.category === category.name)
        : false;

      if (isUsed) {
        setMessage("Kategorie wird noch von Abos verwendet und kann nicht gelöscht werden.");
        return;
      }
    }

    if (!window.confirm("Diesen Eintrag wirklich löschen?")) {
      return;
    }

    try {
      if (storageMode === "appwrite") {
        await deleteFinanceDocument(type, id);
      }

      setData((current) => ({
        ...current,
        [type]: current[type].filter((item) => item.id !== id),
      }));
      setMessage("Eintrag gelöscht.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Eintrag konnte nicht gelöscht werden.");
    }
  }

  function renderActiveView(): ReactNode {
    switch (view) {
      case "accounts":
        return (
          <AccountsView
            accounts={data.accounts}
            bankBusy={busy}
            bankProviderId={bankProviderId}
            bankStatus={bankStatus}
            mfaBusy={busy}
            mfaStatus={mfaStatus}
            onAdd={handleAddAccount}
            onBankProviderChange={setBankProviderId}
            onCancelMfaSetup={() => setTotpSetup(null)}
            onConfirmMfaSetup={handleConfirmMfaSetup}
            onDelete={handleDelete}
            onDisableMfa={handleDisableMfa}
            onStartMfaSetup={handleStartMfaSetup}
            onStartBankConnection={handleStartBankConnection}
            onSyncBankConnection={handleSyncBankConnection}
            onUpdate={handleUpdate}
            showSecurityPanel={storageMode === "appwrite"}
            totpSetup={totpSetup}
          />
        );
      case "income":
        return <IncomeView incomes={data.incomes} onAdd={handleAddIncome} onDelete={handleDelete} onUpdate={handleUpdate} />;
      case "transactions":
        return (
          <TransactionsView
            accounts={data.accounts}
            budgets={data.budgets}
            onAdd={handleAddTransaction}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            transactions={data.transactions}
          />
        );
      case "budgets":
        return <BudgetsView budgets={data.budgets} onAdd={handleAddBudget} onDelete={handleDelete} onUpdate={handleUpdate} />;
      case "subscriptions":
        return (
          <SubscriptionsView
            categories={data.subscriptionCategories}
            onAdd={handleAddSubscription}
            onAddCategory={handleAddSubscriptionCategory}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onUpdateCategory={handleUpdateSubscriptionCategory}
            subscriptions={data.subscriptions}
          />
        );
      default:
        return (
          <Overview
            activeSubscriptions={activeSubscriptions}
            categoryBreakdown={categoryBreakdown}
            data={data}
            onDelete={handleDelete}
            summary={summary}
            trend={monthlyTrend}
          />
        );
    }
  }

  if (authStatus === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f4ef] px-6 text-[#17201d]">
        <div className="flex items-center gap-3 rounded-lg border border-[#d9d4c8] bg-white px-5 py-4 shadow-sm">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[#0f766e]" />
          <span className="text-sm font-medium">Finanzdaten werden geladen</span>
        </div>
      </main>
    );
  }

  if (authStatus === "guest") {
    return <LoginScreen busy={busy} message={message} onLogin={handleLogin} onVerifyMfa={handleVerifyMfaLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-[#17201d]">
      <header className="sticky top-0 z-30 border-b border-[#ded8cb] bg-[#fbfaf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#173f35] text-white">
              <Euro size={21} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-[#173f35]">meineFinanzen</p>
              <p className="mt-1 text-xs text-[#716b61]">{storageMode === "appwrite" ? "Appwrite Sync" : "Demo lokal"}</p>
            </div>
          </div>

          <nav className="hidden max-w-[58vw] items-center overflow-x-auto rounded-lg border border-[#ded8cb] bg-white p-1 md:flex">
            {navItems.map((item) => (
              <NavButton key={item.id} active={view === item.id} item={item} onClick={() => setView(item.id)} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.name}</p>
              <p className="text-xs text-[#716b61]">{user?.email}</p>
            </div>
            <input
              accept="application/json"
              className="hidden"
              onChange={handleImportData}
              ref={importInputRef}
              type="file"
            />
            <IconButton
              className="h-10 w-10"
              icon={Download}
              iconSize={18}
              label="Daten exportieren"
              onClick={handleExportData}
              tone="neutral"
            />
            <IconButton
              className="h-10 w-10"
              icon={Upload}
              iconSize={18}
              label="Daten importieren"
              onClick={() => importInputRef.current?.click()}
              tone="neutral"
            />
            <IconButton
              className="h-10 w-10"
              disabled={busy}
              icon={LogOut}
              iconSize={18}
              label="Ausloggen"
              onClick={handleLogout}
              tone="neutral"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        {message ? (
          <Notice className="mb-5">{message}</Notice>
        ) : null}

        <DashboardHeader summary={summary} view={view} />

        {renderActiveView()}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ded8cb] bg-[#fbfaf7] px-2 py-2 shadow-[0_-12px_30px_rgba(23,32,29,0.08)] md:hidden">
        <div className="mx-auto flex max-w-md gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <MobileNavButton key={item.id} active={view === item.id} item={item} onClick={() => setView(item.id)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function LoginScreen({
  busy,
  message,
  onLogin,
  onVerifyMfa,
}: {
  busy: boolean;
  message: string | null;
  onLogin: (email: string, password: string) => Promise<LoginWithEmailResult | null>;
  onVerifyMfa: (challengeId: string, otp: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mfaChallengeId) {
      await onVerifyMfa(mfaChallengeId, otp);
      return;
    }

    const result = await onLogin(email, password);

    if (result?.status === "mfaRequired") {
      setMfaChallengeId(result.challengeId);
      setOtp("");
      setPassword("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#17201d] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md items-center">
        <form className="w-full space-y-4 rounded-lg border border-[#ded8cb] bg-[#fbfaf7] p-5 shadow-sm sm:p-7" onSubmit={handleSubmit}>
          <Field
            controlSize="lg"
            disabled={Boolean(mfaChallengeId)}
            label="E-Mail"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="du@example.com"
            required
            type="email"
            value={email}
          />

          {mfaChallengeId ? (
            <Field
              autoComplete="one-time-code"
              controlSize="lg"
              inputMode="numeric"
              label="2FA-Code"
              onChange={(event) => setOtp(event.target.value)}
              placeholder="123456"
              required
              value={otp}
            />
          ) : (
            <Field
              controlSize="lg"
              label="Passwort"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort"
              required
              type="password"
              value={password}
            />
          )}

          {message ? <Notice>{message}</Notice> : null}

          <ActionButton
            disabled={busy}
            full
            icon={LogIn}
            size="lg"
            type="submit"
          >
            {mfaChallengeId ? "Code bestätigen" : "Einloggen"}
          </ActionButton>
        </form>
      </div>
    </main>
  );
}

function DashboardHeader({ summary, view }: { summary: ReturnType<typeof summarizeFinanceData>; view: View }) {
  const metrics = [
    { label: "Einkommen", value: formatCurrency(summary.monthlyIncome) },
    { label: "Abos", value: formatCurrency(summary.monthlySubscriptions) },
    { label: "Cashflow", value: formatCurrency(summary.freeCashflow) },
    { label: "Sparrate", value: formatPercent(summary.savingsRate) },
  ];

  return (
    <section className="mb-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#0f766e]">{viewLabel(view)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal sm:text-4xl">
            {formatCurrency(summary.totalAssets)}
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((metric) => (
            <HeaderMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Overview({
  activeSubscriptions,
  categoryBreakdown,
  data,
  onDelete,
  summary,
  trend,
}: {
  activeSubscriptions: Subscription[];
  categoryBreakdown: Array<{ name: string; value: number; color: string }>;
  data: FinanceData;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  summary: ReturnType<typeof summarizeFinanceData>;
  trend: typeof trendData;
}) {
  const summaryCards: SummaryCardProps[] = [
    {
      icon: Landmark,
      label: "Vermögen",
      tone: "green",
      trend: "up",
      value: formatCurrency(summary.totalAssets),
    },
    {
      icon: PiggyBank,
      label: "Sparkonten & Depot",
      tone: "blue",
      trend: "up",
      value: formatCurrency(summary.savings),
    },
    {
      icon: ReceiptText,
      label: "Aktive Abos",
      meta: `${summary.expiringSubscriptions} enden bald`,
      tone: "orange",
      value: `${summary.activeSubscriptions}`,
    },
    {
      icon: TrendingUp,
      label: "Freier Cashflow",
      tone: summary.freeCashflow >= 0 ? "green" : "rose",
      trend: summary.freeCashflow >= 0 ? "up" : "down",
      value: formatCurrency(summary.freeCashflow),
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Surface title="Monatlicher Verlauf">
          <ChartFrame className="h-80" height={320}>
            {({ height, width }) => (
              <AreaChart data={trend} height={height} margin={{ left: 0, right: 12, top: 14 }} width={width}>
                <CartesianGrid stroke="#ece5d8" strokeDasharray="3 3" vertical={false} />
                <XAxis axisLine={false} dataKey="month" tickLine={false} />
                <YAxis axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} tickLine={false} width={42} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="income" name="Einkommen" stroke="#2563eb" strokeWidth={3} type="monotone" />
                <Area dataKey="costs" name="Kosten" stroke="#dc2626" strokeWidth={3} type="monotone" />
                <Area dataKey="savings" name="Sparen" stroke="#16a34a" strokeWidth={3} type="monotone" />
              </AreaChart>
            )}
          </ChartFrame>
        </Surface>

        <Surface title="Monatsstruktur">
          <div className="grid gap-4 sm:grid-cols-[170px_1fr] xl:grid-cols-1">
            <ChartFrame className="h-44" height={176}>
              {({ height, width }) => (
                <PieChart height={height} width={width}>
                  <Pie data={categoryBreakdown} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={3}>
                    {categoryBreakdown.map((entry) => (
                      <Cell fill={entry.color} key={entry.name} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              )}
            </ChartFrame>
            <div className="space-y-3">
              {categoryBreakdown.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ColorDot color={entry.color} />
                    <span className="text-[#5f5a51]">{entry.name}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Surface title="Budgets">
          <div className="space-y-4">
            {data.budgets.map((budget) => {
              const progress = Math.min((budget.spent / budget.limit) * 100, 100);

              return (
                <div key={budget.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{budget.name}</span>
                    <span className="text-[#716b61]">
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}
                    </span>
                  </div>
                  <ProgressBar color={budget.color} value={progress} />
                </div>
              );
            })}
          </div>
        </Surface>

        <Surface title="Nächste Abos">
          <div className="divide-y divide-[#eee8dc]">
            {activeSubscriptions.slice(0, 5).map((subscription) => (
              <SubscriptionListItem
                category={data.subscriptionCategories.find((item) => item.name === subscription.category)}
                key={subscription.id}
                onDelete={() => onDelete("subscriptions", subscription.id)}
                subscription={subscription}
              />
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function AccountsView({
  accounts,
  bankBusy,
  bankProviderId,
  bankStatus,
  mfaBusy,
  mfaStatus,
  onAdd,
  onBankProviderChange,
  onCancelMfaSetup,
  onConfirmMfaSetup,
  onDelete,
  onDisableMfa,
  onStartMfaSetup,
  onStartBankConnection,
  onSyncBankConnection,
  onUpdate,
  showSecurityPanel,
  totpSetup,
}: {
  accounts: FinanceAccount[];
  bankBusy: boolean;
  bankProviderId: string;
  bankStatus: BankConnectionStatus | null;
  mfaBusy: boolean;
  mfaStatus: MfaStatus | null;
  onAdd: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBankProviderChange: (providerId: string) => void;
  onCancelMfaSetup: () => void;
  onConfirmMfaSetup: (otp: string) => Promise<void>;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  onDisableMfa: () => Promise<void>;
  onStartMfaSetup: () => Promise<void>;
  onStartBankConnection: (providerId: string) => Promise<void>;
  onSyncBankConnection: () => Promise<void>;
  onUpdate: (type: DeletableCollection, id: string, patch: Record<string, unknown>) => Promise<void>;
  showSecurityPanel: boolean;
  totpSetup: TotpMfaSetup | null;
}) {
  const accountChart = accounts.map((account) => ({
    name: account.name,
    balance: account.balance,
  }));

  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <div className="grid gap-5 content-start">
        {showSecurityPanel ? (
          <TwoFactorPanel
            busy={mfaBusy}
            onCancelSetup={onCancelMfaSetup}
            onConfirmSetup={onConfirmMfaSetup}
            onDisable={onDisableMfa}
            onStartSetup={onStartMfaSetup}
            setup={totpSetup}
            status={mfaStatus}
          />
        ) : null}

        <BankConnectionPanel
          busy={bankBusy}
          onProviderChange={onBankProviderChange}
          onStart={onStartBankConnection}
          onSync={onSyncBankConnection}
          selectedProviderId={bankProviderId}
          status={bankStatus}
        />

        <Surface title="Konto anlegen">
          <form className="grid gap-3" onSubmit={onAdd}>
            <Field label="Kontoname" name="name" placeholder="Tagesgeld" required />
            <Field label="Anbieter" name="institution" placeholder="Bank oder Broker" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Typ" name="type" options={accountTypeOptions} />
              <Field label="Saldo" min="0" name="balance" placeholder="0" required step="0.01" type="number" />
            </div>
            <Field label="Zielbetrag" min="0" name="goal" placeholder="Optional" step="0.01" type="number" />
            <SubmitButton label="Konto speichern" />
          </form>
        </Surface>
      </div>

      <div className="grid gap-5">
        <Surface title="Kontenverteilung">
          <ChartFrame className="h-72" height={288}>
            {({ height, width }) => (
              <BarChart data={accountChart} height={height} width={width}>
                <CartesianGrid stroke="#ece5d8" strokeDasharray="3 3" vertical={false} />
                <XAxis axisLine={false} dataKey="name" tickLine={false} />
                <YAxis axisLine={false} tickFormatter={(value) => `${Number(value) / 1000}k`} tickLine={false} width={42} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="balance" fill="#0f766e" name="Saldo" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
        </Surface>

        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDelete={() => onDelete("accounts", account.id)}
              onUpdate={(patch) => onUpdate("accounts", account.id, patch)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TwoFactorPanel({
  busy,
  onCancelSetup,
  onConfirmSetup,
  onDisable,
  onStartSetup,
  setup,
  status,
}: {
  busy: boolean;
  onCancelSetup: () => void;
  onConfirmSetup: (otp: string) => Promise<void>;
  onDisable: () => Promise<void>;
  onStartSetup: () => Promise<void>;
  setup: TotpMfaSetup | null;
  status: MfaStatus | null;
}) {
  const isEnabled = status?.enabled ?? false;
  const statusLabel = isEnabled ? "Aktiv" : setup ? "Einrichtung" : "Aus";
  const statusTone: BadgeTone = isEnabled ? "green" : setup ? "blue" : "neutral";

  async function handleConfirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onConfirmSetup(String(formData.get("otp") ?? "").trim());
  }

  return (
    <Surface title="Kontosicherheit">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e7f4ef] text-[#0f766e]">
            <ShieldCheck size={21} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Zwei-Faktor-Login</p>
            <p className="mt-1 text-sm text-[#716b61]">Authenticator-App</p>
          </div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      {setup ? (
        <form className="mt-5 grid gap-3" onSubmit={handleConfirmSetup}>
          <Field label="Setup-Schlüssel" name="secret" readOnly value={setup.secret} />
          <Field label="Authenticator-URI" name="uri" readOnly value={setup.uri} />
          <Field
            autoComplete="one-time-code"
            inputMode="numeric"
            label="Bestätigungscode"
            name="otp"
            placeholder="123456"
            required
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton disabled={busy} type="submit">
              Aktivieren
            </ActionButton>
            <ActionButton disabled={busy} onClick={onCancelSetup} variant="secondary">
              Abbrechen
            </ActionButton>
          </div>
        </form>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <ActionButton disabled={busy || isEnabled} onClick={onStartSetup}>
            2FA einrichten
          </ActionButton>
          <ActionButton disabled={busy || !isEnabled} onClick={onDisable} variant="secondary">
            2FA deaktivieren
          </ActionButton>
        </div>
      )}
    </Surface>
  );
}

function BankConnectionPanel({
  busy,
  onProviderChange,
  onStart,
  onSync,
  selectedProviderId,
  status,
}: {
  busy: boolean;
  onProviderChange: (providerId: string) => void;
  onStart: (providerId: string) => Promise<void>;
  onSync: () => Promise<void>;
  selectedProviderId: string;
  status: BankConnectionStatus | null;
}) {
  const isConfigured = status?.configured ?? false;
  const selectedProvider =
    status?.supportedProviders.find((provider) => provider.id === selectedProviderId) ??
    status?.supportedProviders[0];
  const isConnected = Boolean(status?.connected && status.activeProviderId === selectedProvider?.id);
  const statusLabel = !isConfigured ? "Setup" : isConnected ? "Verbunden" : "Bereit";
  const statusTone: BadgeTone = isConnected ? "green" : isConfigured ? "blue" : "neutral";
  const providerOptions =
    status?.supportedProviders ?? [{ id: "revolut", label: "Revolut", aspspCountry: "DE", aspspName: "Revolut" }];

  return (
    <Surface title="Bankverbindung">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e8f0ff] text-[#2563eb]">
            <ShieldCheck size={21} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{selectedProvider?.label ?? status?.aspspName ?? "Revolut"}</p>
            <p className="mt-1 text-sm text-[#716b61]">
              {status?.provider ?? "Enable Banking"} · {selectedProvider?.aspspCountry ?? status?.aspspCountry ?? "DE"}
            </p>
          </div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <SelectField
        disabled={busy || !status}
        label="Bankanbieter"
        labelClassName="mt-5"
        name="bankProvider"
        onChange={(event) => onProviderChange(event.target.value)}
        options={providerOptions.map((provider) => ({ label: provider.label, value: provider.id }))}
        value={selectedProvider?.id ?? selectedProviderId}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ActionButton
          disabled={busy || !isConfigured || !isConnected}
          icon={RefreshCw}
          onClick={onSync}
        >
          Synchronisieren
        </ActionButton>
        <ActionButton
          disabled={busy || !isConfigured}
          icon={PlugZap}
          onClick={() => onStart(selectedProvider?.id ?? selectedProviderId)}
          variant="secondary"
        >
          {isConnected ? "Neu verbinden" : "Verbinden"}
        </ActionButton>
      </div>
    </Surface>
  );
}

function IncomeView({
  incomes,
  onAdd,
  onDelete,
  onUpdate,
}: {
  incomes: IncomeSource[];
  onAdd: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  onUpdate: (type: DeletableCollection, id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <Surface title="Einkommen anlegen">
        <form className="grid gap-3" onSubmit={onAdd}>
          <Field label="Quelle" name="source" placeholder="Gehalt, Projekt, Dividenden" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Betrag" min="0" name="amount" placeholder="0" required step="0.01" type="number" />
            <SelectField defaultValue="monthly" label="Rhythmus" name="cadence" options={cadenceOptions} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ab wann" name="startsAt" required type="date" />
            <Field label="Bis wann" name="endsAt" type="date" />
          </div>
          <Field label="Notiz" name="note" placeholder="Optional" />
          <SubmitButton label="Einkommen speichern" />
        </form>
      </Surface>

      <Surface title="Einkommensquellen">
        <div className="divide-y divide-[#eee8dc]">
          {incomes.map((income) => (
            <IncomeListItem
              income={income}
              key={income.id}
              onDelete={() => onDelete("incomes", income.id)}
              onUpdate={(patch) => onUpdate("incomes", income.id, patch)}
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

function IncomeListItem({
  income,
  onDelete,
  onUpdate,
}: {
  income: IncomeSource;
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  function handleIncomeUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onUpdate({
      amount: toNumber(formData.get("amount")),
      cadence: String(formData.get("cadence") ?? "monthly") as Cadence,
      endsAt: String(formData.get("endsAt") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      startsAt: String(formData.get("startsAt") ?? ""),
    });
  }

  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 xl:grid-cols-[1fr_430px_auto] xl:items-center">
      <div>
        <div className="flex items-center gap-2">
          <StatusDot active={isActivePeriod(income.startsAt, income.endsAt)} />
          <p className="font-semibold">{income.source}</p>
        </div>
        <p className="mt-1 text-sm text-[#716b61]">
          {formatDate(income.startsAt)} bis {formatDate(income.endsAt)}
          {income.note ? ` · ${income.note}` : ""}
        </p>
      </div>

      <form className="grid gap-2 sm:grid-cols-2" onSubmit={handleIncomeUpdate}>
        <TextInput
          controlSize="sm"
          defaultValue={income.source}
          name="source"
          placeholder="Quelle"
          required
        />
        <TextInput
          controlSize="sm"
          defaultValue={income.amount}
          min="0"
          name="amount"
          step="0.01"
          type="number"
        />
        <SelectInput
          controlSize="sm"
          defaultValue={income.cadence}
          name="cadence"
        >
          {cadenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
        <TextInput
          controlSize="sm"
          defaultValue={income.startsAt}
          name="startsAt"
          required
          type="date"
        />
        <TextInput
          controlSize="sm"
          defaultValue={income.endsAt ?? ""}
          name="endsAt"
          type="date"
        />
        <TextInput
          controlSize="sm"
          defaultValue={income.note ?? ""}
          name="note"
          placeholder="Notiz"
        />
        <ActionButton
          className="sm:col-span-2"
          size="sm"
          type="submit"
        >
          Aktualisieren
        </ActionButton>
      </form>

      <div className="flex items-center justify-between gap-3 xl:justify-end">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(monthlyAmount(income.amount, income.cadence))}</p>
          <p className="text-xs text-[#716b61]">pro Monat</p>
        </div>
        <IconButton label="Einkommen löschen" onClick={onDelete} />
      </div>
    </div>
  );
}

function SubscriptionsView({
  categories,
  onAdd,
  onAddCategory,
  onDelete,
  onUpdate,
  onUpdateCategory,
  subscriptions,
}: {
  categories: SubscriptionCategory[];
  onAdd: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddCategory: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  onUpdate: (type: DeletableCollection, id: string, patch: Record<string, unknown>) => Promise<void>;
  onUpdateCategory: (id: string, patch: Pick<SubscriptionCategory, "name" | "color">) => Promise<void>;
  subscriptions: Subscription[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="grid gap-5">
        <Surface title="Abo-Kategorie erstellen">
          <form className="grid gap-3" onSubmit={onAddCategory}>
            <Field label="Name" name="name" placeholder="Streaming, Mobilfunk, Versicherung" required />
            <ColorField defaultValue="#0f766e" label="Farbe" name="color" />
            <SubmitButton label="Kategorie speichern" />
          </form>
        </Surface>

        <Surface title="Abo anlegen">
          <form className="grid gap-3" onSubmit={onAdd}>
            <Field label="Name" name="name" placeholder="Netflix, Versicherung, Leasing" required />
            <SubscriptionCategorySelect categories={categories} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kosten" min="0" name="amount" placeholder="0" required step="0.01" type="number" />
              <SelectField defaultValue="monthly" label="Rhythmus" name="cadence" options={cadenceOptions} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ab wann" name="startsAt" required type="date" />
              <Field label="Bis wann" name="endsAt" type="date" />
            </div>
            <SubmitButton label="Abo speichern" />
          </form>
        </Surface>
      </div>

      <div className="grid gap-5">
        <Surface title="Abo-Kategorien">
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const usageCount = subscriptions.filter(
                (subscription) => subscription.category === category.name,
              ).length;

              return (
                <SubscriptionCategoryCard
                  category={category}
                  key={category.id}
                  onDelete={() => onDelete("subscriptionCategories", category.id)}
                  onUpdate={(patch) => onUpdateCategory(category.id, patch)}
                  usageCount={usageCount}
                />
              );
            })}
          </div>
        </Surface>

        <Surface title="Abos & Verträge">
          <div className="divide-y divide-[#eee8dc]">
            {subscriptions.map((subscription) => (
              <SubscriptionListItem
                categories={categories}
                category={categories.find((item) => item.name === subscription.category)}
                key={subscription.id}
                onDelete={() => onDelete("subscriptions", subscription.id)}
                onUpdate={(patch) => onUpdate("subscriptions", subscription.id, patch)}
                subscription={subscription}
              />
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function TransactionsView({
  accounts,
  budgets,
  onAdd,
  onDelete,
  onUpdate,
  transactions,
}: {
  accounts: FinanceAccount[];
  budgets: BudgetCategory[];
  onAdd: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  onUpdate: (type: DeletableCollection, id: string, patch: Record<string, unknown>) => Promise<void>;
  transactions: Transaction[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const categories = [...new Set([...budgets.map((budget) => budget.name), "Gehalt", "Projekt", "Sonstiges"])];
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const haystack = `${transaction.title} ${transaction.category} ${transaction.note ?? ""}`.toLowerCase();
    return matchesType && haystack.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <Surface title="Buchung erfassen">
        <form className="grid gap-3" onSubmit={onAdd}>
          <Field label="Titel" name="title" placeholder="Supermarkt, Gehalt, Rechnung" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField defaultValue="expense" label="Typ" name="type" options={transactionTypeOptions} />
            <Field label="Betrag" min="0" name="amount" placeholder="0" required step="0.01" type="number" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kategorie" list="transaction-categories" name="category" placeholder="Lebensmittel" required />
            <SelectField label="Konto" name="accountId">
              <option value="">Kein Konto</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>
          </div>
          <Field defaultValue={getTodayISO()} label="Datum" name="date" required type="date" />
          <Field label="Notiz" name="note" placeholder="Optional" />
          <datalist id="transaction-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <SubmitButton label="Buchung speichern" />
        </form>
      </Surface>

      <Surface title="Buchungen">
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <SearchField
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buchungen suchen"
            value={searchTerm}
          />
          <SelectInput
            onChange={(event) => setTypeFilter(event.target.value as "all" | TransactionType)}
            value={typeFilter}
          >
            {transactionFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="divide-y divide-[#eee8dc]">
          {filteredTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#716b61]">Keine Buchungen gefunden.</p>
          ) : (
            filteredTransactions.map((transaction) => (
              <TransactionListItem
                key={transaction.id}
                onDelete={() => onDelete("transactions", transaction.id)}
                onUpdate={(patch) => onUpdate("transactions", transaction.id, patch)}
                transaction={transaction}
              />
            ))
          )}
        </div>
      </Surface>
    </div>
  );
}

function BudgetsView({
  budgets,
  onAdd,
  onDelete,
  onUpdate,
}: {
  budgets: BudgetCategory[];
  onAdd: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (type: DeletableCollection, id: string) => Promise<void>;
  onUpdate: (type: DeletableCollection, id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <Surface title="Budget anlegen">
        <form className="grid gap-3" onSubmit={onAdd}>
          <Field label="Name" name="name" placeholder="Lebensmittel, Mobilität, Urlaub" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aktuell ausgegeben" min="0" name="spent" placeholder="0" step="0.01" type="number" />
            <Field label="Limit" min="1" name="limit" placeholder="500" required step="0.01" type="number" />
          </div>
          <ColorField defaultValue="#2563eb" label="Farbe" name="color" />
          <SubmitButton label="Budget speichern" />
        </form>
      </Surface>

      <Surface title="Budgets verwalten">
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetCard
              budget={budget}
              key={budget.id}
              onDelete={() => onDelete("budgets", budget.id)}
              onUpdate={(patch) => onUpdate("budgets", budget.id, patch)}
            />
          ))}
        </div>
      </Surface>
    </div>
  );
}

type SummaryCardProps = {
  icon: LucideIcon;
  label: string;
  meta?: string;
  tone: Exclude<BadgeTone, "neutral">;
  trend?: "up" | "down";
  value: string;
};

function SummaryCard({ icon: Icon, label, meta, tone, trend, value }: SummaryCardProps) {
  const toneClass = {
    green: "bg-[#e7f4ef] text-[#0f766e]",
    blue: "bg-[#e8f0ff] text-[#2563eb]",
    orange: "bg-[#fff1e7] text-[#c2410c]",
    rose: "bg-[#fff1f2] text-[#be123c]",
  }[tone];
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-lg ${toneClass}`}>
          <Icon size={21} aria-hidden />
        </div>
        {trend ? (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${trend === "down" ? "text-[#be123c]" : "text-[#0f766e]"}`}>
            <TrendIcon size={15} aria-hidden />
            {trend === "down" ? "Rückgang" : "Plus"}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-sm text-[#716b61]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {meta ? <p className="mt-2 text-xs text-[#716b61]">{meta}</p> : null}
    </Card>
  );
}

function TransactionListItem({
  onDelete,
  onUpdate,
  transaction,
}: {
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  transaction: Transaction;
}) {
  function handleTransactionUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onUpdate({
      amount: toNumber(formData.get("amount")),
      category: String(formData.get("category") ?? "").trim(),
      note: optionalString(formData.get("note")),
    });
  }

  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[1fr_360px_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{transaction.title}</p>
          <Badge tone={transaction.type === "income" ? "green" : "orange"}>
            {transactionTypeLabels[transaction.type]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-[#716b61]">
          {transaction.category} · {formatDate(transaction.date)}
          {transaction.note ? ` · ${transaction.note}` : ""}
        </p>
      </div>

      <form className="grid gap-2 sm:grid-cols-[110px_1fr]" onSubmit={handleTransactionUpdate}>
        <TextInput
          controlSize="sm"
          defaultValue={transaction.amount}
          min="0"
          name="amount"
          step="0.01"
          type="number"
        />
        <TextInput
          controlSize="sm"
          defaultValue={transaction.category}
          name="category"
          placeholder="Kategorie"
        />
        <TextInput
          className="sm:col-span-2"
          controlSize="sm"
          defaultValue={transaction.note}
          name="note"
          placeholder="Notiz"
        />
        <ActionButton
          className="sm:col-span-2"
          size="sm"
          type="submit"
        >
          Aktualisieren
        </ActionButton>
      </form>

      <div className="flex items-center justify-between gap-3 lg:justify-end">
        <div className="text-right">
          <p className={`font-semibold ${transaction.type === "income" ? "text-[#0f766e]" : "text-[#be123c]"}`}>
            {transaction.type === "income" ? "+" : "-"}
            {formatCurrency(transaction.amount)}
          </p>
        </div>
        <IconButton label="Buchung löschen" onClick={onDelete} />
      </div>
    </div>
  );
}

function BudgetCard({
  budget,
  onDelete,
  onUpdate,
}: {
  budget: BudgetCategory;
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const progress = Math.min((budget.spent / budget.limit) * 100, 100);

  function handleBudgetUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onUpdate({
      spent: toNumber(formData.get("spent")),
      limit: toNumber(formData.get("limit")),
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ColorDot className="h-3 w-3" color={budget.color} />
            <p className="truncate font-semibold">{budget.name}</p>
          </div>
          <p className="mt-1 text-sm text-[#716b61]">
            {formatCurrency(budget.spent)} von {formatCurrency(budget.limit)}
          </p>
        </div>
        <IconButton label="Budget löschen" onClick={onDelete} />
      </div>
      <ProgressBar className="mt-4" color={budget.color} value={progress} />
      <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={handleBudgetUpdate}>
        <TextInput
          controlSize="sm"
          defaultValue={budget.spent}
          min="0"
          name="spent"
          step="0.01"
          type="number"
        />
        <TextInput
          controlSize="sm"
          defaultValue={budget.limit}
          min="1"
          name="limit"
          step="0.01"
          type="number"
        />
        <ActionButton
          className="sm:col-span-2"
          size="sm"
          type="submit"
        >
          Aktualisieren
        </ActionButton>
      </form>
    </Card>
  );
}

function AccountCard({
  account,
  onDelete,
  onUpdate,
}: {
  account: FinanceAccount;
  onDelete: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const progress = account.goal ? Math.min((account.balance / account.goal) * 100, 100) : null;

  function handleBalanceUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const balance = toNumber(formData.get("balance"));
    onUpdate({ balance, updatedAt: getTodayISO() });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{account.name}</p>
          <p className="mt-1 text-sm text-[#716b61]">
            {account.institution} · {accountTypeLabels[account.type]}
          </p>
        </div>
        <IconButton label="Konto löschen" onClick={onDelete} />
      </div>
      <p className="mt-5 text-2xl font-semibold">{formatCurrency(account.balance)}</p>
      {progress !== null ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs text-[#716b61]">
            <span>Sparziel</span>
            <span>{formatPercent(progress / 100)}</span>
          </div>
          <ProgressBar className="h-2" value={progress} />
        </div>
      ) : null}
      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={handleBalanceUpdate}>
        <TextInput
          controlSize="sm"
          defaultValue={account.balance}
          min="0"
          name="balance"
          step="0.01"
          type="number"
        />
        <ActionButton
          size="sm"
          type="submit"
        >
          Aktualisieren
        </ActionButton>
      </form>
      <p className="mt-4 text-xs text-[#716b61]">Aktualisiert am {formatDate(account.updatedAt)}</p>
    </Card>
  );
}

function SubscriptionCategoryCard({
  category,
  onDelete,
  onUpdate,
  usageCount,
}: {
  category: SubscriptionCategory;
  onDelete: () => void;
  onUpdate: (patch: Pick<SubscriptionCategory, "name" | "color">) => Promise<void>;
  usageCount: number;
}) {
  function handleCategoryUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onUpdate({
      color: String(formData.get("color") ?? "#0f766e"),
      name: String(formData.get("name") ?? "").trim(),
    });
  }

  return (
    <div
      className="grid min-h-20 gap-3 rounded-lg border border-[#eee8dc] bg-[#fbfaf7] px-4 py-3"
      data-testid={`subscription-category-${category.name.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ColorDot className="h-4 w-4" color={category.color} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{category.name}</p>
            <p className="text-xs text-[#716b61]">{usageCount === 1 ? "1 Abo" : `${usageCount} Abos`}</p>
          </div>
        </div>
        <IconButton label="Kategorie löschen" onClick={onDelete} />
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_48px]" onSubmit={handleCategoryUpdate}>
        <TextInput
          controlSize="sm"
          defaultValue={category.name}
          name="name"
          placeholder="Kategorie"
          required
        />
        <TextInput
          className="px-2"
          controlSize="sm"
          defaultValue={category.color}
          name="color"
          type="color"
        />
        <ActionButton
          className="sm:col-span-2"
          size="sm"
          type="submit"
        >
          Aktualisieren
        </ActionButton>
      </form>
    </div>
  );
}

function SubscriptionListItem({
  categories,
  category,
  onDelete,
  onUpdate,
  subscription,
}: {
  categories?: SubscriptionCategory[];
  category?: SubscriptionCategory;
  onDelete: () => void;
  onUpdate?: (patch: Record<string, unknown>) => Promise<void>;
  subscription: Subscription;
}) {
  const meta = subscriptionStatus(subscription);

  function handleSubscriptionUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onUpdate?.({
      amount: toNumber(formData.get("amount")),
      cadence: String(formData.get("cadence") ?? "monthly") as Cadence,
      category: String(formData.get("category") ?? "").trim(),
      endsAt: String(formData.get("endsAt") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      startsAt: String(formData.get("startsAt") ?? ""),
    });
  }

  return (
    <div
      className={`grid gap-3 py-4 first:pt-0 last:pb-0 ${
        onUpdate ? "xl:grid-cols-[1fr_460px_auto] xl:items-center" : "md:grid-cols-[1fr_auto] md:items-center"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{subscription.name}</p>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-[#716b61]">
          <span className="inline-flex items-center gap-1.5">
            <ColorDot color={category?.color ?? "#716b61"} />
            {subscription.category}
          </span>{" "}
          · {formatDate(subscription.startsAt)} bis {formatDate(subscription.endsAt)}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#716b61]">
          <CalendarClock size={14} aria-hidden />
          Nächste Abbuchung: {formatDate(getNextBillingDate(subscription.startsAt, subscription.cadence))}
        </p>
      </div>

      {onUpdate ? (
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={handleSubscriptionUpdate}>
          <TextInput
            controlSize="sm"
            defaultValue={subscription.name}
            name="name"
            placeholder="Abo"
            required
          />
          <SelectInput
            controlSize="sm"
            defaultValue={subscription.category}
            disabled={(categories ?? []).length === 0}
            name="category"
            required
          >
            {(categories ?? []).map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </SelectInput>
          <TextInput
            controlSize="sm"
            defaultValue={subscription.amount}
            min="0"
            name="amount"
            step="0.01"
            type="number"
          />
          <SelectInput
            controlSize="sm"
            defaultValue={subscription.cadence}
            name="cadence"
          >
            {cadenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <TextInput
            controlSize="sm"
            defaultValue={subscription.startsAt}
            name="startsAt"
            required
            type="date"
          />
          <TextInput
            controlSize="sm"
            defaultValue={subscription.endsAt ?? ""}
            name="endsAt"
            type="date"
          />
          <ActionButton
            className="sm:col-span-2"
            size="sm"
            type="submit"
          >
            Aktualisieren
          </ActionButton>
        </form>
      ) : null}

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(monthlyAmount(subscription.amount, subscription.cadence))}</p>
          <p className="text-xs text-[#716b61]">
            {formatCurrency(subscription.amount)} / {cadenceLabels[subscription.cadence]}
          </p>
        </div>
        <IconButton label="Abo löschen" onClick={onDelete} />
      </div>
    </div>
  );
}

function ChartFrame({
  children,
  className,
  height,
}: {
  children: (size: { height: number; width: number }) => ReactNode;
  className: string;
  height: number;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ height, width: 0 });

  useEffect(() => {
    const element = frameRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry.contentRect.width);
      const nextHeight = Math.floor(entry.contentRect.height || height);

      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return {
          height: nextHeight,
          width: nextWidth,
        };
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [height]);

  return (
    <div className={`min-w-0 ${className}`} ref={frameRef}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ded8cb] bg-white px-3 py-2 text-right shadow-sm">
      <p className="text-[11px] font-medium uppercase text-[#716b61]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function NavButton({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: { id: View; label: string; icon: LucideIcon };
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
        active ? "bg-[#173f35] text-white" : "text-[#5f5a51] hover:bg-[#f4efe5] hover:text-[#173f35]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={17} aria-hidden />
      {item.label}
    </button>
  );
}

function MobileNavButton({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: { id: View; label: string; icon: LucideIcon };
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      aria-pressed={active}
      className={`grid min-h-14 w-20 shrink-0 place-items-center rounded-lg text-[11px] font-semibold transition ${
        active ? "bg-[#173f35] text-white" : "text-[#5f5a51]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={18} aria-hidden />
      <span>{item.label}</span>
    </button>
  );
}

function SubscriptionCategorySelect({ categories }: { categories: SubscriptionCategory[] }) {
  return (
    <SelectField disabled={categories.length === 0} label="Kategorie" name="category" required>
      {categories.length === 0 ? (
        <option value="">Erst eine Kategorie erstellen</option>
      ) : (
        categories.map((category) => (
          <option key={category.id} value={category.name}>
            {category.name}
          </option>
        ))
      )}
    </SelectField>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return <ColorDot color={active ? "#16a34a" : "#d97706"} />;
}

function subscriptionStatus(subscription: Subscription): { label: string; tone: BadgeTone } {
  const today = new Date().toISOString().slice(0, 10);

  if (subscription.startsAt > today) {
    return { label: "Startet", tone: "blue" };
  }

  if (subscription.endsAt && subscription.endsAt < today) {
    return { label: "Beendet", tone: "neutral" };
  }

  if (subscription.endsAt) {
    const days = getDaysUntil(subscription.endsAt);

    if (days <= 60) {
      return { label: `${days} Tage`, tone: "orange" };
    }
  }

  return { label: "Aktiv", tone: "green" };
}

function viewLabel(view: View) {
  switch (view) {
    case "accounts":
      return "Konten & Sparkonten";
    case "income":
      return "Einkommen";
    case "transactions":
      return "Buchungen";
    case "budgets":
      return "Budgets";
    case "subscriptions":
      return "Abos & Verträge";
    default:
      return "Gesamtübersicht";
  }
}

function formatDate(date?: string) {
  if (!date) {
    return "laufend";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function toNumber(value: FormDataEntryValue | null) {
  return Number(String(value ?? "0").replace(",", ".")) || 0;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const parsed = toNumber(value);
  return parsed > 0 ? parsed : undefined;
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length > 0 ? stringValue : undefined;
}

function toSelectOptions(options: Record<string, string>) {
  return Object.entries(options).map(([value, label]) => ({ label, value }));
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDemoUser(): AppUser {
  return {
    email: "demo@meinefinanzen.local",
    id: "demo",
    mfa: false,
    name: "Demo Nutzer",
  };
}

function readDemoData() {
  try {
    const stored = window.localStorage.getItem(demoStorageKey);
    return stored ? normalizeFinanceData(JSON.parse(stored) as Partial<FinanceData>) : demoFinanceData;
  } catch {
    return demoFinanceData;
  }
}

function readBankCallback() {
  const params = new URLSearchParams(window.location.search);

  return {
    connected: params.get("bankConnected") === "1",
    error: params.get("bankError"),
  };
}

function clearBankCallbackQuery() {
  const url = new URL(window.location.href);
  const changed = url.searchParams.has("bankConnected") || url.searchParams.has("bankError");

  url.searchParams.delete("bankConnected");
  url.searchParams.delete("bankError");

  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Anfrage fehlgeschlagen.");
  }

  return payload as T;
}

async function persistBankSync(userId: string, sync: BankSyncPayload): Promise<BankSyncPayload> {
  const [accounts, transactions] = await Promise.all([
    Promise.all(sync.accounts.map((account) => upsertAccount(userId, account))),
    Promise.all(sync.transactions.map((transaction) => upsertTransaction(userId, transaction))),
  ]);

  return {
    ...sync,
    accounts,
    transactions,
  };
}

function mergeBankSyncData(current: FinanceData, sync: Pick<BankSyncPayload, "accounts" | "transactions">): FinanceData {
  const syncedAccountIds = new Set(sync.accounts.map((account) => account.id));
  const accountMap = new Map(current.accounts.map((account) => [account.id, account]));

  for (const account of sync.accounts) {
    accountMap.set(account.id, account);
  }

  const transactionMap = new Map(current.transactions.map((transaction) => [transaction.id, transaction]));

  for (const transaction of sync.transactions) {
    transactionMap.set(transaction.id, transaction);
  }

  return {
    ...current,
    accounts: [
      ...sync.accounts,
      ...[...accountMap.values()].filter((account) => !syncedAccountIds.has(account.id)),
    ],
    transactions: [...transactionMap.values()].sort((left, right) => right.date.localeCompare(left.date)),
  };
}

function normalizeFinanceData(data: Partial<FinanceData>): FinanceData {
  const subscriptions = data.subscriptions ?? demoFinanceData.subscriptions;

  return {
    accounts: data.accounts ?? demoFinanceData.accounts,
    incomes: data.incomes ?? demoFinanceData.incomes,
    subscriptions,
    subscriptionCategories: ensureSubscriptionCategories(data.subscriptionCategories, subscriptions),
    budgets: data.budgets ?? demoFinanceData.budgets,
    transactions: data.transactions ?? demoFinanceData.transactions,
  };
}

function ensureSubscriptionCategories(
  categories: SubscriptionCategory[] | undefined,
  subscriptions: Subscription[],
) {
  const categoryMap = new Map<string, SubscriptionCategory>();

  for (const category of demoFinanceData.subscriptionCategories) {
    categoryMap.set(category.name.toLowerCase(), category);
  }

  for (const category of categories ?? []) {
    categoryMap.set(category.name.toLowerCase(), category);
  }

  for (const subscription of subscriptions) {
    if (!categoryMap.has(subscription.category.toLowerCase())) {
      categoryMap.set(subscription.category.toLowerCase(), {
        id: createLocalId("cat"),
        name: subscription.category,
        color: "#716b61",
      });
    }
  }

  return [...categoryMap.values()];
}

const tooltipStyle = {
  border: "1px solid #ded8cb",
  borderRadius: "8px",
  boxShadow: "0 10px 26px rgba(23, 32, 29, 0.12)",
};
