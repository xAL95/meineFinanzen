import type { FinanceAccount, Transaction } from "./finance-data";

export type BankConnectionStatus = {
  activeProviderId?: BankProviderId;
  aspspCountry: string;
  aspspName: string;
  configured: boolean;
  connected: boolean;
  provider: "Enable Banking";
  supportedProviders: BankProviderOption[];
};

export type BankProviderId = "revolut" | "vivid";

export type BankProviderOption = {
  aspspCountry: string;
  aspspName: string;
  id: BankProviderId;
  label: string;
};

export type BankSyncPayload = {
  accounts: FinanceAccount[];
  aspsp: {
    country: string;
    name: string;
  };
  fetchedAt: string;
  provider: "Enable Banking";
  sessionValidUntil?: string;
  transactions: Transaction[];
};
