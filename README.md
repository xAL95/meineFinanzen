# meineFinanzen

Responsive Next.js Finanz-Dashboard mit Appwrite Authentication und Database-Anbindung.

## Start

```bash
npm install
npm run dev
```

Die App läuft standardmäßig unter [http://localhost:3000](http://localhost:3000).

Ohne Appwrite-Konfiguration startet die Anwendung mit einem lokalen Demo-Modus. Die Demo speichert Daten im Browser-LocalStorage.

## Kostenlose Bankverbindung

Die App kann Revolut und Vivid read-only ueber Enable Banking verbinden. Das bleibt kostenlos, solange du Enable Banking im eingeschraenkten Modus fuer eigene verknuepfte Konten und private Nutzung verwendest. Fuer kommerzielle Nutzung, fremde Nutzerkonten oder nicht verknuepfte Konten ist diese Gratis-Variante nicht vorgesehen.

1. Bei Enable Banking eine Production-Application anlegen und per "Activate by linking accounts" dein eigenes Revolut- oder Vivid-Konto verknuepfen.
2. Die Redirect-URL aus `.env.example` in der Enable-Banking-App registrieren.
3. `ENABLE_BANKING_APP_ID` und `ENABLE_BANKING_PRIVATE_KEY` in `.env.local` setzen. Den privaten Schluessel nie mit `NEXT_PUBLIC_` exponieren.
4. Falls dein Revolut-Zugang nicht ueber `Revolut`/`DE` oder dein Vivid-Zugang nicht ueber `Vivid Money`/`DE` laeuft, die passenden Anbieter-Variablen in `.env.local` anpassen.
5. App neu starten, in `Konten` den Anbieter waehlen, auf `Verbinden` gehen und nach der Freigabe `Synchronisieren` nutzen.

### Anbieter-Variablen

| Anbieter | Name | Land |
| --- | --- | --- |
| Revolut | `ENABLE_BANKING_REVOLUT_ASPSP_NAME` | `ENABLE_BANKING_REVOLUT_ASPSP_COUNTRY` |
| Vivid | `ENABLE_BANKING_VIVID_ASPSP_NAME` | `ENABLE_BANKING_VIVID_ASPSP_COUNTRY` |

Der direkte Revolut-Open-Banking-Produktionszugang wird hier bewusst nicht verwendet, weil er fuer Kontoinformationen eine regulierte TPP-Rolle bzw. eIDAS/OBIE-Zertifikate oder Revolut-Partnerzugang voraussetzt.

## Appwrite einrichten

1. `.env.example` nach `.env.local` kopieren und Werte eintragen.
2. In Appwrite Email/Password Authentication aktivieren.
3. Benutzer im Appwrite Console anlegen. Die App hat bewusst keine Register- oder Passwort-Reset-Maske.
4. Optional Appwrite MFA/TOTP aktivieren. Nutzer koennen 2FA danach in der App unter `Konten` einrichten.
5. Eine Database mit sechs Collections erstellen: `accounts`, `incomes`, `subscriptions`, `subscription_categories`, `budgets`, `transactions`.
6. Document Security aktivieren und Nutzern Collection-Permission zum Erstellen geben. Lesen, Aktualisieren und Löschen wird pro Dokument für den eingeloggten User gesetzt.

### Collection `accounts`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `name` | string | ja |
| `type` | string | ja |
| `balance` | float | ja |
| `goal` | float | nein |
| `institution` | string | ja |
| `updatedAt` | string | ja |

### Collection `incomes`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `source` | string | ja |
| `amount` | float | ja |
| `cadence` | string | ja |
| `startsAt` | string | ja |
| `endsAt` | string | nein |
| `note` | string | nein |

### Collection `subscriptions`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `name` | string | ja |
| `amount` | float | ja |
| `cadence` | string | ja |
| `category` | string | ja |
| `startsAt` | string | ja |
| `endsAt` | string | nein |

### Collection `subscription_categories`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `name` | string | ja |
| `color` | string | ja |

### Collection `budgets`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `name` | string | ja |
| `spent` | float | ja |
| `limit` | float | ja |
| `color` | string | ja |

### Collection `transactions`

| Attribute | Typ | Pflicht |
| --- | --- | --- |
| `userId` | string | ja |
| `title` | string | ja |
| `amount` | float | ja |
| `type` | string | ja |
| `category` | string | ja |
| `accountId` | string | nein |
| `date` | string | ja |
| `note` | string | nein |

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
