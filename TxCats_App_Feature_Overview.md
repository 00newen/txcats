# TxCats – Feature Overview

## 🔐 Security & Privacy

- **End-to-End Encryption (E2EE)**: All sensitive data (transactions, categories, patterns) is encrypted/decrypted only on the client device using the Web Crypto API.
- **Zero-knowledge backend**: The server stores only ciphertext; it cannot read any financial data.
- **User passphrase**: Derived key used for encryption. Never stored or transmitted.
- **Key architecture**:
  - **KEK (Key Encryption Key)**: Derived from user passphrase (PBKDF2 100k).
  - **DEK (Data Encryption Key)**: Random AES-GCM 256 key used for encrypting data.
  - DEK is wrapped with KEK and stored server-side; only unwrapped locally.
- **Security practices**: unique IVs per record, AAD binding, constant-time comparisons, secure wipe on lock/logout.

---

## 👤 Authentication & Accounts

- **Clerk for authentication**: Hosted auth with sessions handled by Clerk.
- **Providers**: Email/password, Google, Apple, and Facebook SSO (via Clerk).
- **Separate passphrase for encryption**: Never stored or transmitted; unrelated to Clerk credentials.
- **User meta storage (server-side, app DB)**:
  - userSaltBase64 (for deriving KEK)
  - wrappedDEKBase64 (encrypted DEK)
  - verificationBlobBase64 (for verifying correct passphrase)
- **Session model**: Use Clerk-provided session/JWT for API access; server trusts Clerk middleware.

---

## 💾 Data Storage Model

- **Vault-based storage**:
  - Each user has one or more **vaults** (`vaultId`). A vault is the unit of ownership and future sharing.
  - All encrypted records are bound to a vault (not a user) to make sharing possible later without re-encryption.
- **Cloud storage (Postgres via Drizzle)**:
  - **VaultItem**: a generic table that stores ciphertext records for multiple resource types (transactions, categories, patterns, accounts, etc.).
  - **UserMeta**: stores encryption metadata (salt, wrapped DEK, verification) for unlocking.
- **Encryption boundary**:
  - Encrypted: transactions, categories, patterns, accounts, merchant names, descriptions, amounts, dates, account identifiers.
  - Unencrypted (server metadata only): `vaultId`, `userId` (from Clerk), `resourceType`, record `id`, timestamps, version, deletion flags.
- **No IndexedDB cache by default**.
  - Decrypted data lives only in memory during an unlocked session.
- **No server-side search or filtering**.
  - All search, filtering, analytics happen client-side after decryption.

---

## 🗄️ IndexedDB: Benefits vs. Why We're Skipping It

**Benefits**

- Offline-first capability (PWA-style usage without network).
- Fast local reads/writes for very large datasets.
- Can store **ciphertext only** to keep zero-knowledge.

**Why we're skipping it (for now)**

- Adds **sync complexity** (two sources of truth: local + cloud).
- Increases surface for **conflicts** and cache invalidation bugs.
- Our flow already **decrypts into memory** for immediate UI needs.

**Conclusion**: We’ll keep the design simple and cloud-centric. If offline/PWA becomes a goal, we can add an optional, ciphertext-only IndexedDB cache later behind a feature flag.

---

## 💸 Transaction Management

- **CSV Upload**: Client-side parsing (Papa Parse). Detects or allows manual column mapping.
- **Bulk Import**: Large file handling (chunked uploads, progress tracking).
- **Account-aware transactions**:
  - Transactions belong to a specific **account** (derived from CSV account identifier).
  - Multiple accounts per user are supported.
  - Transfers between two owned accounts are detected and treated as **internal transfers** (not income or expense) when viewing aggregated data.
  - When filtering by a single account, transfers behave as debit/credit relative to that account.
- **Smart Categorization**:
  - Pattern-based classification (merchant name exact/partial, description keywords).
  - No standalone amount-range patterns.
- **Manual Categorization**:
  - Inbox-style review and table-based bulk editing.
  - Keyboard shortcuts for speed.
  - Manual categorization may optionally create learning patterns.
  - Ability to mark a categorization as an **exception** (prevents pattern learning).
  - Recent categorization history remains visible for easy undo.
- **Filtering & Sorting**:
  - Filter by category, account, date range, text.
  - Sort by date (desc default).
  - Visual indicators for expense, income, and internal transfer.

---

## 🏷️ Category System

- **Hierarchical categories** (tree structure, max depth = 3).
- **Categories are real entities**:
  - A parent category can itself have transactions assigned.
  - Parent totals automatically **roll up** child category totals in analytics.
- **Constraints & rules**:
  - Each category has at most **one parent**.
  - **Hard block** on cycles (no loops allowed).
  - Re-parenting a category moves its entire subtree.
  - Re-parenting is blocked if it would exceed max depth (3 levels).
- **Deletion rules**:
  - Categories with children **cannot be deleted** until children are reassigned.
  - Deleting a category triggers a wizard to reassign affected transactions.
- **UX for managing hierarchy**:
  - Drag-and-drop tree view.
  - Parent selection dropdown in category edit form.
- **Visuals**:
  - Custom colors and icons.
  - Color-coded badges across UI.

---

## 🧠 Learning Patterns

- **Pattern Types**:
  - Merchant name (exact match)
  - Merchant name (partial match)
  - Description keyword match
- **Priority System (1–100)**:
  - Manual patterns: priority 100
  - Auto-learned patterns: default priority 70
- **Matching order**:
  1. Manual transaction overrides
  2. Exact merchant match
  3. Partial merchant match
  4. Description keyword match
- **Tie-breaking**:
  - Higher priority → higher confidence → specificity → usage count → most recent update
- **Confidence tracking**:
  - Pattern confidence updates based on user corrections.
- **Auto-learning**:
  - Manual categorizations may create or update patterns.
  - Exception flag prevents learning.
- **Retroactive changes**:
  - Updating a pattern shows a preview of how many transactions will be affected.
  - User confirms before re-categorization is applied.

---

## 📊 Dashboard & Analytics

- **Stats Overview**: total spent, total income, net flow, transaction count (30 days).
- **Spending Trends**: line chart over 30 days (Recharts).
- **Category Breakdown**: top 6 categories with percentage bars.
- **Recent Transactions**: last 8 transactions with badges and category colors.

---

## 📁 Backup & Restore

- **Encrypted export/import** of `.txcats` file (contains only ciphertext + metadata).
- **Passphrase required** to decrypt after restore.
- **Optional remote sync** (E2EE-safe cloud API).

---

## 🧩 User Interface

- **Modern, responsive design** (mobile & desktop).
- **Sidebar navigation** with icons and gradients.
- **Topbar** with **Clerk UserButton** (account & sign out) and a separate **Lock** button for passphrase state.
- **Loading skeletons** for UX smoothness.
- **Toast notifications** for feedback.
- **Theme support** (light/dark).

---

## ⚙️ Technical Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State/Data**: React Query, Zod
- **Visualization**: Recharts
- **Icons**: Lucide React
- **Parsing**: Papa Parse
- **Crypto**: Web Crypto API (PBKDF2, AES-GCM)
- **Auth**: **Clerk** (email/password + Google/Apple/Facebook)
- **Backend**: Next.js Route Handlers + **Drizzle** (Postgres)

---

## 🧱 Architecture Summary

1. **User signs in with Clerk** → session/JWT available to route handlers.
2. **User unlocks with passphrase** → derive KEK → unwrap DEK → verify locally.
3. **All encryption/decryption** occurs locally with DEK.
4. **Client encrypts** data → sends ciphertext DTOs to server.
5. **Server stores** only ciphertext + metadata; uses Clerk auth to authorize.
6. **Analytics** computed client-side after decrypting data.

---

## 🔄 Future Extensions

- **Cross-device sync** (client-encrypted data blobs)
- **2FA for login** (non-passphrase related)

---

## 🔁 Transaction Deduplication & Idempotent Storage

TxCats must prevent storing duplicate bank transactions, even when the same CSV file is imported multiple times, imported from different devices, or partially re-imported.

### Deterministic Transaction IDs

- Every transaction **must have a deterministic, client-generated `id`**.
- The `id` is generated **before encryption** and **before sending data to the server**.
- The server must treat the transaction `id` as opaque and must never derive it from plaintext.

#### ID generation rules (client-side)

1. **If the bank/CSV provides a stable transaction identifier** (e.g. mutation ID, entry ID):
   - Use it as part of the fingerprint.
2. **Otherwise**, generate a fingerprint from a stable combination of CSV fields, such as:
   - account identifier
   - transaction date (as provided by the bank)
   - amount + currency
   - description / counterparty text
3. Canonicalize the fingerprint deterministically (normalized strings, stable ordering).
4. Generate the transaction `id` as a cryptographic hash (e.g. SHA-256) of the fingerprint.
5. The same real-world transaction must always produce the same `id`.

### Server-Side Uniqueness Constraint

- The database must enforce uniqueness using a constraint on: (vault_id, resource_type, id)
- This constraint is the **single source of truth** for deduplication.

### UPSERT-Based Persistence

- The server must use **UPSERT semantics** when persisting transactions.

#### Import behavior (CSV uploads)

- Use `INSERT … ON CONFLICT DO NOTHING`
- If a transaction with the same `(vault_id, resource_type, id)` already exists:
- The insert is ignored
- Existing ciphertext remains unchanged
- This guarantees:
- Safe re-imports
- Idempotent imports
- No duplicate transactions

#### Update behavior (edits, categorization changes)

- Use `INSERT … ON CONFLICT DO UPDATE`
- Existing records are updated when:
- Category changes
- Manual overrides occur
- Learning-related fields are modified

### Client Responsibilities

- The client **must not** query the server to check whether a transaction already exists.
- The client **must not** keep a full in-memory index to detect duplicates.
- The client simply:
1. Generates deterministic IDs
2. Encrypts the records
3. Sends them in bulk to the server

### Server Responsibilities

- The server must:
- Never inspect or derive meaning from ciphertext
- Never attempt plaintext-based deduplication
- Rely entirely on database constraints + UPSERT logic
- Deduplication must remain correct across:
- sessions
- devices
- users (future vault sharing)
- repeated imports

### Design Rationale

- Deduplication is enforced **at the database level**, not in application logic.
- Encryption randomness (unique IVs) does not affect deduplication, since uniqueness is based on deterministic IDs.
- This approach scales cleanly and remains compatible with future vault sharing without requiring re-encryption.

---

## 🧾 CSV Import: Multi-Bank Support

TxCats must support CSV exports from different banks without hardcoding a single schema.

### Canonical Transaction Fields
All imported CSV rows must be mapped into a canonical transaction shape:
- bookingDate (required)
- amount (required)
- description (required)
- accountId (recommended)
- valueDate (optional)
- counterparty (optional)
- merchantOrName (optional)
- currency (optional; default if missing)
- bankTxId (optional)
- rawRow (optional; full original row stored encrypted)

### Mapping UI
The Upload flow must include a mapping step that:
- lists detected CSV headers
- proposes an automatic mapping using heuristics
- allows the user to manually map required/optional fields
- shows a preview of the first N mapped rows

### Import Profiles
Users can save an "Import Profile" (encrypted) containing:
- header → canonical field mappings
- parsing rules (delimiter, decimal separator, date format)
- optional bank label
Profiles are auto-selected when a CSV matches the same normalized header signature.

### Parsing & Normalization
The importer must handle common bank variations:
- delimiter differences (comma/semicolon/tab)
- date format differences
- decimal separators (comma vs dot)
- debit/credit representation differences
All normalization happens client-side before encryption.

### Dedup Compatibility
Deterministic transaction IDs must be generated from canonical fields (post-mapping),
so re-importing the same file or importing from another device does not create duplicates.

---

