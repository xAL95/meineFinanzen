import {
  Account,
  AuthenticationFactor,
  AuthenticatorType,
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  type Models,
} from "appwrite";
import type {
  FinanceAccount,
  FinanceData,
  IncomeSource,
  Subscription,
  SubscriptionCategory,
  Transaction,
  BudgetCategory,
} from "./finance-data";

type AccountDocument = Models.Document &
  Omit<FinanceAccount, "id"> & {
    userId: string;
  };

type IncomeDocument = Models.Document &
  Omit<IncomeSource, "id"> & {
    userId: string;
  };

type SubscriptionDocument = Models.Document &
  Omit<Subscription, "id"> & {
    userId: string;
  };

type SubscriptionCategoryDocument = Models.Document &
  Omit<SubscriptionCategory, "id"> & {
    userId: string;
  };

type BudgetDocument = Models.Document &
  Omit<BudgetCategory, "id"> & {
    userId: string;
  };

type TransactionDocument = Models.Document &
  Omit<Transaction, "id"> & {
    userId: string;
  };

export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "",
  collections: {
    accounts: process.env.NEXT_PUBLIC_APPWRITE_ACCOUNTS_COLLECTION_ID ?? "",
    incomes: process.env.NEXT_PUBLIC_APPWRITE_INCOMES_COLLECTION_ID ?? "",
    subscriptions: process.env.NEXT_PUBLIC_APPWRITE_SUBSCRIPTIONS_COLLECTION_ID ?? "",
    subscriptionCategories:
      process.env.NEXT_PUBLIC_APPWRITE_SUBSCRIPTION_CATEGORIES_COLLECTION_ID ?? "",
    budgets: process.env.NEXT_PUBLIC_APPWRITE_BUDGETS_COLLECTION_ID ?? "",
    transactions: process.env.NEXT_PUBLIC_APPWRITE_TRANSACTIONS_COLLECTION_ID ?? "",
  },
};

export const isAppwriteConfigured = Boolean(
  appwriteConfig.endpoint &&
    appwriteConfig.projectId &&
    appwriteConfig.databaseId &&
    appwriteConfig.collections.accounts &&
    appwriteConfig.collections.incomes &&
    appwriteConfig.collections.subscriptions &&
    appwriteConfig.collections.subscriptionCategories &&
    appwriteConfig.collections.budgets &&
    appwriteConfig.collections.transactions,
);

const client = new Client();

if (appwriteConfig.endpoint && appwriteConfig.projectId) {
  client.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId);
}

export const appwriteAccount = new Account(client);
export const appwriteDatabases = new Databases(client);

export type AppUser = {
  id: string;
  mfa: boolean;
  name: string;
  email: string;
};

export type LoginWithEmailResult =
  | {
      status: "success";
      user: AppUser;
    }
  | {
      challengeId: string;
      status: "mfaRequired";
    };

export type MfaStatus = {
  enabled: boolean;
  totp: boolean;
};

export type TotpMfaSetup = {
  secret: string;
  uri: string;
};

function mapAppwriteUser(user: Models.User<Models.Preferences>): AppUser {
  return {
    email: user.email,
    id: user.$id,
    mfa: user.mfa,
    name: user.name || user.email,
  };
}

export async function getCurrentAppwriteUser(): Promise<AppUser | null> {
  if (!isAppwriteConfigured) {
    return null;
  }

  try {
    const user = await appwriteAccount.get();
    return mapAppwriteUser(user);
  } catch {
    return null;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<LoginWithEmailResult> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite ist noch nicht konfiguriert.");
  }

  await appwriteAccount.createEmailPasswordSession({ email, password });

  try {
    const user = await appwriteAccount.get();
    return {
      status: "success",
      user: mapAppwriteUser(user),
    };
  } catch (error) {
    try {
      const challenge = await appwriteAccount.createMFAChallenge({
        factor: AuthenticationFactor.Totp,
      });

      return {
        challengeId: challenge.$id,
        status: "mfaRequired",
      };
    } catch {
      throw error;
    }
  }
}

export async function verifyMfaLogin(challengeId: string, otp: string): Promise<AppUser> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite ist noch nicht konfiguriert.");
  }

  await appwriteAccount.updateMFAChallenge({ challengeId, otp });
  const user = await appwriteAccount.get();

  return mapAppwriteUser(user);
}

export async function getMfaStatus(): Promise<MfaStatus> {
  if (!isAppwriteConfigured) {
    return {
      enabled: false,
      totp: false,
    };
  }

  const [user, factors] = await Promise.all([
    appwriteAccount.get(),
    appwriteAccount.listMFAFactors(),
  ]);

  return {
    enabled: user.mfa,
    totp: factors.totp,
  };
}

export async function startTotpMfaSetup(): Promise<TotpMfaSetup> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite ist noch nicht konfiguriert.");
  }

  const setup = await appwriteAccount.createMFAAuthenticator({
    type: AuthenticatorType.Totp,
  });

  return {
    secret: setup.secret,
    uri: setup.uri,
  };
}

export async function confirmTotpMfaSetup(otp: string): Promise<AppUser> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite ist noch nicht konfiguriert.");
  }

  const user = await appwriteAccount.updateMFAAuthenticator({
    otp,
    type: AuthenticatorType.Totp,
  });

  if (!user.mfa) {
    return mapAppwriteUser(await appwriteAccount.updateMFA({ mfa: true }));
  }

  return mapAppwriteUser(user);
}

export async function disableMfaForCurrentUser(): Promise<AppUser> {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite ist noch nicht konfiguriert.");
  }

  return mapAppwriteUser(await appwriteAccount.updateMFA({ mfa: false }));
}

export async function logoutAppwriteUser() {
  if (!isAppwriteConfigured) {
    return;
  }

  await appwriteAccount.deleteSession("current");
}

export async function loadFinanceData(
  userId: string,
): Promise<
  Pick<
    FinanceData,
    "accounts" | "incomes" | "subscriptions" | "subscriptionCategories" | "budgets" | "transactions"
  >
> {
  ensureAppwriteConfigured();

  const [accounts, incomes, subscriptions, subscriptionCategories, budgets, transactions] = await Promise.all([
    appwriteDatabases.listDocuments<AccountDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.accounts,
      queries: byUserQueries(userId),
    }),
    appwriteDatabases.listDocuments<IncomeDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.incomes,
      queries: byUserQueries(userId),
    }),
    appwriteDatabases.listDocuments<SubscriptionDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.subscriptions,
      queries: byUserQueries(userId),
    }),
    appwriteDatabases.listDocuments<SubscriptionCategoryDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.subscriptionCategories,
      queries: byUserQueries(userId),
    }),
    appwriteDatabases.listDocuments<BudgetDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.budgets,
      queries: byUserQueries(userId),
    }),
    appwriteDatabases.listDocuments<TransactionDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.transactions,
      queries: byUserQueries(userId),
    }),
  ]);

  return {
    accounts: accounts.documents.map(mapAccountDocument),
    incomes: incomes.documents.map(mapIncomeDocument),
    subscriptions: subscriptions.documents.map(mapSubscriptionDocument),
    subscriptionCategories: subscriptionCategories.documents.map(mapSubscriptionCategoryDocument),
    budgets: budgets.documents.map(mapBudgetDocument),
    transactions: transactions.documents.map(mapTransactionDocument),
  };
}

export async function createAccount(userId: string, input: Omit<FinanceAccount, "id">) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<AccountDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.accounts,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapAccountDocument(document);
}

export async function upsertAccount(userId: string, account: FinanceAccount) {
  ensureAppwriteConfigured();

  const input = toAccountDocumentData(account, userId);

  try {
    const document = await appwriteDatabases.updateDocument<AccountDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.accounts,
      documentId: account.id,
      data: input,
    });

    return mapAccountDocument(document);
  } catch {
    const document = await appwriteDatabases.createDocument<AccountDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.accounts,
      documentId: account.id,
      data: input,
      permissions: documentPermissions(userId),
    });

    return mapAccountDocument(document);
  }
}

export async function createIncome(userId: string, input: Omit<IncomeSource, "id">) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<IncomeDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.incomes,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapIncomeDocument(document);
}

export async function createSubscription(userId: string, input: Omit<Subscription, "id">) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<SubscriptionDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.subscriptions,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapSubscriptionDocument(document);
}

export async function createSubscriptionCategory(
  userId: string,
  input: Omit<SubscriptionCategory, "id">,
) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<SubscriptionCategoryDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.subscriptionCategories,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapSubscriptionCategoryDocument(document);
}

export async function createBudget(userId: string, input: Omit<BudgetCategory, "id">) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<BudgetDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.budgets,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapBudgetDocument(document);
}

export async function createTransaction(userId: string, input: Omit<Transaction, "id">) {
  ensureAppwriteConfigured();

  const document = await appwriteDatabases.createDocument<TransactionDocument>({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections.transactions,
    documentId: ID.unique(),
    data: {
      ...input,
      userId,
    },
    permissions: documentPermissions(userId),
  });

  return mapTransactionDocument(document);
}

export async function upsertTransaction(userId: string, transaction: Transaction) {
  ensureAppwriteConfigured();

  const input = toTransactionDocumentData(transaction, userId);

  try {
    const document = await appwriteDatabases.updateDocument<TransactionDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.transactions,
      documentId: transaction.id,
      data: input,
    });

    return mapTransactionDocument(document);
  } catch {
    const document = await appwriteDatabases.createDocument<TransactionDocument>({
      databaseId: appwriteConfig.databaseId,
      collectionId: appwriteConfig.collections.transactions,
      documentId: transaction.id,
      data: input,
      permissions: documentPermissions(userId),
    });

    return mapTransactionDocument(document);
  }
}

export async function updateFinanceDocument(
  type:
    | "accounts"
    | "incomes"
    | "subscriptions"
    | "subscriptionCategories"
    | "budgets"
    | "transactions",
  documentId: string,
  data: Record<string, unknown>,
) {
  ensureAppwriteConfigured();

  return appwriteDatabases.updateDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections[type],
    documentId,
    data,
  });
}

export async function deleteFinanceDocument(
  type:
    | "accounts"
    | "incomes"
    | "subscriptions"
    | "subscriptionCategories"
    | "budgets"
    | "transactions",
  documentId: string,
) {
  ensureAppwriteConfigured();

  await appwriteDatabases.deleteDocument({
    databaseId: appwriteConfig.databaseId,
    collectionId: appwriteConfig.collections[type],
    documentId,
  });
}

function byUserQueries(userId: string) {
  return [Query.equal("userId", userId), Query.orderDesc("$createdAt")];
}

function documentPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function ensureAppwriteConfigured() {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite Umgebungsvariablen fehlen.");
  }
}

function toAccountDocumentData(account: FinanceAccount, userId: string): Omit<AccountDocument, keyof Models.Document> {
  return {
    balance: account.balance,
    goal: account.goal,
    institution: account.institution,
    name: account.name,
    type: account.type,
    updatedAt: account.updatedAt,
    userId,
  };
}

function toTransactionDocumentData(
  transaction: Transaction,
  userId: string,
): Omit<TransactionDocument, keyof Models.Document> {
  return {
    accountId: transaction.accountId,
    amount: transaction.amount,
    category: transaction.category,
    date: transaction.date,
    note: transaction.note,
    title: transaction.title,
    type: transaction.type,
    userId,
  };
}

function mapAccountDocument(document: AccountDocument): FinanceAccount {
  return {
    id: document.$id,
    name: document.name,
    type: document.type,
    balance: document.balance,
    goal: document.goal,
    institution: document.institution,
    updatedAt: document.updatedAt,
  };
}

function mapIncomeDocument(document: IncomeDocument): IncomeSource {
  return {
    id: document.$id,
    source: document.source,
    amount: document.amount,
    cadence: document.cadence,
    startsAt: document.startsAt,
    endsAt: document.endsAt,
    note: document.note,
  };
}

function mapSubscriptionDocument(document: SubscriptionDocument): Subscription {
  return {
    id: document.$id,
    name: document.name,
    amount: document.amount,
    cadence: document.cadence,
    category: document.category,
    startsAt: document.startsAt,
    endsAt: document.endsAt,
  };
}

function mapSubscriptionCategoryDocument(
  document: SubscriptionCategoryDocument,
): SubscriptionCategory {
  return {
    id: document.$id,
    name: document.name,
    color: document.color,
  };
}

function mapBudgetDocument(document: BudgetDocument): BudgetCategory {
  return {
    id: document.$id,
    name: document.name,
    spent: document.spent,
    limit: document.limit,
    color: document.color,
  };
}

function mapTransactionDocument(document: TransactionDocument): Transaction {
  return {
    id: document.$id,
    title: document.title,
    amount: document.amount,
    type: document.type,
    category: document.category,
    accountId: document.accountId,
    date: document.date,
    note: document.note,
  };
}
