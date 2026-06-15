import { createHash, createSign, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { BankConnectionStatus, BankProviderId, BankProviderOption, BankSyncPayload } from "./bank-sync";
import type { AccountType, FinanceAccount, Transaction } from "./finance-data";
import { getTodayISO } from "./finance-data";

export const enableBankingCookies = {
  activeProvider: "meinefinanzen-enable-banking-provider",
  session: "meinefinanzen-enable-banking-session",
  state: "meinefinanzen-enable-banking-state",
} as const;

type EnableBankingConfig = {
  apiBaseUrl: string;
  appId: string;
  provider: BankProviderOption;
  privateKey: string;
  psuType: "personal" | "business";
};

type Amount = {
  amount: string;
  currency: string;
};

type EnableBankingAccount = {
  account_servicer?: {
    name?: string;
  };
  cash_account_type?: string;
  currency?: string;
  details?: string;
  identification_hash?: string;
  name?: string;
  product?: string;
  uid: string;
};

type EnableBankingBalance = {
  balance_amount: Amount;
  balance_type: string;
  last_change_date_time?: string;
  reference_date?: string;
};

type EnableBankingTransaction = {
  bank_transaction_code?: {
    description?: string;
  };
  booking_date?: string;
  creditor?: {
    name?: string;
  };
  credit_debit_indicator: "CRDT" | "DBIT";
  debtor?: {
    name?: string;
  };
  entry_reference?: string;
  merchant_category_code?: string;
  note?: string;
  reference_number?: string;
  remittance_information?: string[];
  status: string;
  transaction_amount: Amount;
  transaction_date?: string;
  transaction_id?: string;
  value_date?: string;
};

type AuthorizeSessionResponse = {
  access: {
    valid_until?: string;
  };
  accounts: EnableBankingAccount[];
  aspsp: {
    country: string;
    name: string;
  };
  session_id: string;
};

type GetSessionResponse = {
  access: {
    valid_until?: string;
  };
  accounts: string[];
  aspsp: {
    country: string;
    name: string;
  };
  status: string;
};

type HalBalances = {
  balances: EnableBankingBalance[];
};

type HalTransactions = {
  continuation_key?: string | null;
  transactions: EnableBankingTransaction[];
};

type StartAuthorizationResponse = {
  authorization_id: string;
  psu_id_hash: string;
  url: string;
};

export class EnableBankingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EnableBankingRequestError";
    this.status = status;
  }
}

export function getEnableBankingStatus(sessionId?: string, activeProviderId?: string): BankConnectionStatus {
  const providers = getBankProviderOptions();
  const activeProvider = getBankProviderOption(parseBankProviderId(activeProviderId));

  return {
    activeProviderId: sessionId ? activeProvider.id : undefined,
    aspspCountry: activeProvider.aspspCountry,
    aspspName: activeProvider.aspspName,
    configured: isEnableBankingConfigured(),
    connected: Boolean(sessionId),
    provider: "Enable Banking",
    supportedProviders: providers,
  };
}

export function isEnableBankingConfigured(config = readEnableBankingConfig()) {
  return Boolean(config.appId && config.privateKey);
}

export async function startEnableBankingAuthorization(request: NextRequest, providerId?: string) {
  const selectedProvider = getBankProviderOption(parseBankProviderId(providerId));
  const config = requireEnableBankingConfig(selectedProvider.id);
  const state = randomUUID();
  const redirectUrl =
    process.env.ENABLE_BANKING_REDIRECT_URL ??
    new URL("/api/bank-connections/enable-banking/callback", request.nextUrl.origin).toString();
  const validUntil = new Date(Date.now() + getConsentDays() * 86_400_000).toISOString();
  const response = await enableBankingFetch<StartAuthorizationResponse>("/auth", {
    body: JSON.stringify({
      access: {
        balances: true,
        transactions: true,
        valid_until: validUntil,
      },
      aspsp: {
        country: config.provider.aspspCountry,
        name: config.provider.aspspName,
      },
      language: "de",
      psu_type: config.psuType,
      redirect_url: redirectUrl,
      state,
    }),
    method: "POST",
  });

  return {
    providerId: config.provider.id,
    state,
    url: response.url,
  };
}

export async function authorizeEnableBankingSession(code: string) {
  return enableBankingFetch<AuthorizeSessionResponse>("/sessions", {
    body: JSON.stringify({ code }),
    method: "POST",
  });
}

export async function syncEnableBankingSession(request: NextRequest, sessionId: string): Promise<BankSyncPayload> {
  const dateFrom = getDateFrom(request.nextUrl.searchParams.get("days"));
  const session = await enableBankingFetch<GetSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`);

  if (session.status !== "AUTHORIZED") {
    throw new EnableBankingRequestError("Die Bankverbindung ist nicht autorisiert.", 409);
  }

  const requestHeaders = getPsuHeaders(request);
  const syncedAccounts = await Promise.all(
    session.accounts.map(async (accountId) => {
      const [details, balances, transactions] = await Promise.all([
        enableBankingFetch<EnableBankingAccount>(`/accounts/${encodeURIComponent(accountId)}/details`, {
          headers: requestHeaders,
        }),
        enableBankingFetch<HalBalances>(`/accounts/${encodeURIComponent(accountId)}/balances`, {
          headers: requestHeaders,
        }),
        fetchAllTransactions(accountId, dateFrom, requestHeaders),
      ]);

      const financeAccount = mapAccount(details, balances.balances, session.aspsp.name);

      return {
        account: financeAccount,
        transactions: transactions.map((transaction) =>
          mapTransaction(transaction, financeAccount.id, session.aspsp.name),
        ),
      };
    }),
  );

  return {
    accounts: syncedAccounts.map((entry) => entry.account),
    aspsp: session.aspsp,
    fetchedAt: new Date().toISOString(),
    provider: "Enable Banking",
    sessionValidUntil: session.access.valid_until,
    transactions: syncedAccounts.flatMap((entry) => entry.transactions),
  };
}

export function parseAuthorizationStateCookie(value?: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<{ providerId: BankProviderId; state: string }>;

    if (parsed.state && parsed.providerId) {
      return {
        providerId: getBankProviderOption(parsed.providerId).id,
        state: parsed.state,
      };
    }
  } catch {
    return {
      providerId: "revolut" as const,
      state: value,
    };
  }

  return null;
}

export function serializeAuthorizationStateCookie(state: string, providerId: BankProviderId) {
  return JSON.stringify({ providerId, state });
}

export function getSecureCookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
  };
}

function readEnableBankingConfig(providerId: BankProviderId = "revolut"): EnableBankingConfig {
  return {
    apiBaseUrl: process.env.ENABLE_BANKING_API_BASE_URL ?? "https://api.enablebanking.com",
    appId: process.env.ENABLE_BANKING_APP_ID ?? "",
    provider: getBankProviderOption(providerId),
    privateKey: normalizePrivateKey(process.env.ENABLE_BANKING_PRIVATE_KEY ?? ""),
    psuType: process.env.ENABLE_BANKING_PSU_TYPE === "business" ? "business" : "personal",
  };
}

function requireEnableBankingConfig(providerId?: BankProviderId) {
  const config = readEnableBankingConfig(providerId);

  if (!isEnableBankingConfigured(config)) {
    throw new EnableBankingRequestError("Enable Banking ist noch nicht konfiguriert.", 501);
  }

  return config;
}

function getBankProviderOptions(): BankProviderOption[] {
  return [
    {
      aspspCountry: process.env.ENABLE_BANKING_REVOLUT_ASPSP_COUNTRY ?? process.env.ENABLE_BANKING_ASPSP_COUNTRY ?? "DE",
      aspspName: process.env.ENABLE_BANKING_REVOLUT_ASPSP_NAME ?? process.env.ENABLE_BANKING_ASPSP_NAME ?? "Revolut",
      id: "revolut",
      label: "Revolut",
    },
    {
      aspspCountry: process.env.ENABLE_BANKING_VIVID_ASPSP_COUNTRY ?? "DE",
      aspspName: process.env.ENABLE_BANKING_VIVID_ASPSP_NAME ?? "Vivid Money",
      id: "vivid",
      label: "Vivid",
    },
  ];
}

function getBankProviderOption(providerId: BankProviderId = "revolut") {
  return getBankProviderOptions().find((provider) => provider.id === providerId) ?? getBankProviderOptions()[0];
}

function parseBankProviderId(value?: string | null): BankProviderId {
  return value === "vivid" ? "vivid" : "revolut";
}

async function enableBankingFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = requireEnableBankingConfig();
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${createEnableBankingJwt(config)}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new EnableBankingRequestError(getErrorMessage(payload), response.status);
  }

  return payload as T;
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const candidate = record.message ?? record.error_description ?? record.error ?? record.code;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "Enable Banking Anfrage fehlgeschlagen.";
}

function createEnableBankingJwt(config: EnableBankingConfig) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    kid: config.appId,
    typ: "JWT",
  };
  const payload = {
    aud: "api.enablebanking.com",
    exp: issuedAt + 300,
    iat: issuedAt,
    iss: "enablebanking.com",
  };
  const tokenBody = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(tokenBody).end().sign(config.privateKey);

  return `${tokenBody}.${toBase64Url(signature)}`;
}

function toBase64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;

  return buffer.toString("base64").replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

function normalizePrivateKey(key: string) {
  return key.replaceAll("\\n", "\n").trim();
}

function getConsentDays() {
  const parsed = Number(process.env.ENABLE_BANKING_CONSENT_DAYS ?? "90");

  if (!Number.isFinite(parsed)) {
    return 90;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 180);
}

function getDateFrom(daysValue: string | null) {
  const parsed = Number(daysValue ?? "90");
  const days = Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), 1), 365) : 90;
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

function getPsuHeaders(request: NextRequest) {
  const headers = new Headers();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent");
  const accept = request.headers.get("accept");
  const acceptLanguage = request.headers.get("accept-language");
  const referer = request.headers.get("referer");

  if (forwardedFor) {
    headers.set("Psu-Ip-Address", forwardedFor);
  }

  if (userAgent) {
    headers.set("Psu-User-Agent", userAgent);
  }

  if (accept) {
    headers.set("Psu-Accept", accept);
  }

  if (acceptLanguage) {
    headers.set("Psu-Accept-Language", acceptLanguage);
  }

  if (referer) {
    headers.set("Psu-Referer", referer);
  }

  return headers;
}

async function fetchAllTransactions(accountId: string, dateFrom: string, headers: Headers) {
  const transactions: EnableBankingTransaction[] = [];
  let continuationKey: string | null | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      date_from: dateFrom,
      transaction_status: "BOOK",
    });

    if (continuationKey) {
      params.set("continuation_key", continuationKey);
    }

    const page = await enableBankingFetch<HalTransactions>(
      `/accounts/${encodeURIComponent(accountId)}/transactions?${params.toString()}`,
      { headers },
    );

    transactions.push(...page.transactions);
    continuationKey = page.continuation_key;
    pageCount += 1;
  } while (continuationKey && pageCount < 8);

  return transactions;
}

function mapAccount(
  account: EnableBankingAccount,
  balances: EnableBankingBalance[],
  fallbackInstitution: string,
): FinanceAccount {
  const selectedBalance = selectBalance(balances);
  const idBase = account.identification_hash ?? account.uid;
  const updatedAt =
    selectedBalance?.reference_date ??
    selectedBalance?.last_change_date_time?.slice(0, 10) ??
    getTodayISO();

  return {
    balance: selectedBalance ? Number(selectedBalance.balance_amount.amount) || 0 : 0,
    id: `bank-${hashPart(idBase)}`,
    institution: account.account_servicer?.name ?? fallbackInstitution,
    name: account.name ?? account.product ?? account.details ?? `${fallbackInstitution} Konto`,
    type: mapAccountType(account),
    updatedAt,
  };
}

function mapAccountType(account: EnableBankingAccount): AccountType {
  const haystack = `${account.cash_account_type ?? ""} ${account.name ?? ""} ${account.product ?? ""}`.toLowerCase();

  if (haystack.includes("svgs") || haystack.includes("saving") || haystack.includes("spar")) {
    return "sparen";
  }

  if (haystack.includes("cash")) {
    return "cash";
  }

  return "giro";
}

function selectBalance(balances: EnableBankingBalance[]) {
  const priority = ["CLAV", "ITAV", "XPCD", "CLBD", "ITBD", "VALU", "INFO"];

  return [...balances].sort(
    (left, right) => priorityIndex(left.balance_type, priority) - priorityIndex(right.balance_type, priority),
  )[0];
}

function priorityIndex(value: string, priority: string[]) {
  const index = priority.indexOf(value);
  return index === -1 ? priority.length : index;
}

function mapTransaction(
  transaction: EnableBankingTransaction,
  accountId: string,
  fallbackInstitution: string,
): Transaction {
  const remittance = transaction.remittance_information?.filter(Boolean).join(" · ");
  const isIncome = transaction.credit_debit_indicator === "CRDT";
  const counterparty = isIncome ? transaction.debtor?.name : transaction.creditor?.name;
  const fallbackTitle = transaction.bank_transaction_code?.description ?? remittance ?? `${fallbackInstitution} Buchung`;
  const amount = Math.abs(Number(transaction.transaction_amount.amount) || 0);
  const date =
    transaction.booking_date ?? transaction.value_date ?? transaction.transaction_date ?? getTodayISO();
  const externalId =
    transaction.entry_reference ??
    transaction.transaction_id ??
    `${accountId}:${date}:${transaction.transaction_amount.amount}:${remittance ?? ""}`;

  return {
    accountId,
    amount,
    category: transaction.bank_transaction_code?.description ?? getFallbackCategory(transaction),
    date,
    id: `bank-tx-${hashPart(`${accountId}:${externalId}`)}`,
    note: getTransactionNote(transaction, remittance),
    title: counterparty ?? fallbackTitle,
    type: isIncome ? "income" : "expense",
  };
}

function getFallbackCategory(transaction: EnableBankingTransaction) {
  if (transaction.merchant_category_code) {
    return `MCC ${transaction.merchant_category_code}`;
  }

  return transaction.credit_debit_indicator === "CRDT" ? "Bankeingang" : "Bankausgang";
}

function getTransactionNote(transaction: EnableBankingTransaction, remittance?: string) {
  const details = [remittance, transaction.reference_number, transaction.note].filter(Boolean);

  return details.length > 0 ? details.join(" · ") : undefined;
}

function hashPart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
