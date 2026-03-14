# Penguin Protocol

Private, encrypted on-chain payroll for companies — built on ENS, BitGo, and Fileverse.

---

## What It Does

Companies onboard with their existing Ethereum wallet and ENS name. They create BitGo treasury wallets for payroll, invite employees with on-chain ENS subdomains, issue encrypted employment contracts stored on IPFS via Fileverse, and run automated payroll via a cron job that calls BitGo `sendMany`. Employees claim their subdomain, register their public key, then decrypt their contract in-browser.

**Stack:** Next.js 15 · Supabase · BitGo SDK · ENS · Fileverse (`@fileverse/agents`) · Wagmi + RainbowKit · SIWE · ethers.js

---

## Architecture

```
Company Wallet (MetaMask / EOA)
  │
  ├─ owns  acme.eth  (ENS — Ethereum Sepolia)
  │        └─ issues  alice.acme.eth  →  employee
  │
  ├─ BitGo treasury wallet  (created server-side at onboarding)
  │        └─ cron job calls sendMany() every pay cycle
  │
  └─ Fileverse (IPFS + Pinata)
           └─ encrypted contract PDF / JSON per employee
```

**Auth:** SIWE — wallet signs a nonce, backend issues a JWT. No passwords.

**Encryption:** AES-256-GCM for the contract payload, ECIES (`eth-crypto`) to wrap the symmetric key to each party's secp256k1 public key. `MASTER_ENCRYPTION_KEY` encrypts BitGo passphrases at rest in Supabase.

**ENS ownership model:**
- Company brings their own ENS name (e.g. `acme.eth`) — we verify on-chain they own it
- Company wallet creates employee subdomains via `setSubnodeOwner` from the frontend
- Employee claims subdomain, sets `penguin.pubkey` text record
- Backend signer writes additional text records (docHash, receipt) only to nodes it's authorized on

---

## Flows

### Company Onboarding
1. Connect MetaMask → SIWE → JWT issued
2. Enter company name, slug, and their ENS name (`acme.eth`)
3. Server verifies on-chain ownership → creates BitGo treasury wallet → saves to Supabase

### Employee Invite
1. Company dashboard: enter employee wallet address
2. Company's MetaMask signs `setSubnodeOwner` tx — creates `alice.acme.eth` on-chain
3. Frontend calls `/api/employees/invite` to record in DB

### Employee Claim
1. Employee connects wallet, calls `setText(node, "penguin.pubkey", pubKey)`
2. `/api/employees/claim` verifies on-chain, updates DB status + stores public key

### Contract Creation (gated: employee must have claimed)
1. Company dashboard → create contract for employee
2. Server fetches employee public key from DB
3. Encrypts salary + terms with AES + ECIES key wrapping
4. Uploads ciphertext to Fileverse (IPFS via Pimlico/Pinata)
5. Stores `fileId`, `amount_enc`, `interval`, `last_paid_at` in Supabase

### Automated Payroll (cron)
- `GET /api/cron/payroll` — protected by `CRON_SECRET` header
- Fetches all active contracts due for payment
- Decrypts salary (`MASTER_ENCRYPTION_KEY` → passphrase → `sendMany`)
- Updates `last_paid_at` per contract

### Employee Contract View
1. Employee hits `/employee/contracts`
2. Fetches encrypted blob from `/api/contracts/file`
3. Decrypts in-browser: Web Crypto API (AES) + `eth-crypto` (ECIES)

---

## Env Vars

Copy `.env.local` and fill:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same |
| `BITGO_ACCESS_TOKEN` | BitGo dashboard → Access Tokens |
| `BITGO_ENTERPRISE_ID` | BitGo dashboard → Enterprise |
| `BITGO_ENV` | `test` or `prod` |
| `BITGO_COIN` | `teth` (testnet ETH) or `eth` |
| `RPC_URL` | **Ethereum Sepolia** — Alchemy or Infura. NOT Base Sepolia. |
| `SIGNER_PRIVATE_KEY` | Funded Sepolia wallet — writes ENS text records |
| `ENS_REGISTRY_ADDRESS` | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| `ENS_PUBLIC_RESOLVER_ADDRESS` | `0x8948458626811dd0f951F00ef54D0De1BDFef3E2` |
| `PIMLICO_API_KEY` | [pimlico.io](https://pimlico.io) |
| `PINATA_JWT` | [pinata.cloud](https://pinata.cloud) |
| `PINATA_GATEWAY` | Your Pinata gateway URL |
| `FILEVERSE_CHAIN` | `sepolia` |
| `MASTER_ENCRYPTION_KEY` | 32-byte hex — `openssl rand -hex 32` |
| `JWT_SECRET` | 32-byte hex — `openssl rand -hex 32` |
| `CRON_SECRET` | Random secret for cron auth |
| `NEXT_PUBLIC_RPC_URL` | **Ethereum Sepolia** RPC (same as above) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` (Ethereum Sepolia) |

> **Note:** `NEXT_PUBLIC_RPC_URL` must point to **Ethereum Sepolia** — ENS does not exist on Base Sepolia. If you use Base for payments, keep two separate RPC URLs.

---

## Database (Supabase)

Run `supabase/schema.sql` against your Supabase project. Tables:

- `companies` — wallet, ENS name, BitGo wallet ID, encrypted passphrase, public key
- `employees` — wallet, ENS subdomain, status (`invited` → `active`), public key
- `contracts` — encrypted salary (`amount_enc`), interval, `last_paid_at`, Fileverse `file_id`
- `auth_nonces` — SIWE nonces (TTL enforced in app)

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/nonce` | — | Generate SIWE nonce |
| `POST` | `/api/auth/siwe` | — | Verify SIWE, issue JWT |
| `POST` | `/api/auth/pubkey` | — | Recover secp256k1 pubkey from sig |
| `POST` | `/api/companies/create` | JWT | Create company + BitGo wallet |
| `GET` | `/api/companies/me` | JWT | Fetch current company |
| `POST` | `/api/employees/invite` | JWT | Record employee invite |
| `GET` | `/api/employees` | JWT | List company employees |
| `POST` | `/api/employees/claim` | JWT | Verify ENS claim, activate employee |
| `POST` | `/api/contracts/create` | JWT | Create encrypted contract |
| `GET` | `/api/contracts/[employee]` | JWT | List contracts for employee |
| `GET` | `/api/contracts/file` | JWT | Proxy encrypted file from Fileverse |
| `GET` | `/api/cron/payroll` | `x-cron-secret` | Run payroll cycle |

---

## Running Locally

```bash
pnpm install
cp .env.local.example .env.local   # fill in your keys
pnpm dev
```

Pages:
- `/` — landing
- `/company/onboard` — company signup
- `/company/dashboard` — invite employees, create contracts
- `/employee/claim` — claim ENS subdomain
- `/employee/contracts` — view + decrypt contracts

Trigger payroll manually:
```bash
curl -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/payroll
```

---

## Key Libraries

- [`bitgo`](https://github.com/BitGo/BitGoJS) — treasury wallet creation + `sendMany`
- [`@fileverse/agents`](https://github.com/fileverse/fileverse-agent) — IPFS doc upload/fetch via Pimlico + Pinata
- [`siwe`](https://github.com/spruceid/siwe) — Sign-In With Ethereum
- [`eth-crypto`](https://github.com/pubkey/eth-crypto) — ECIES encryption for key wrapping
- [`ethers`](https://docs.ethers.org) — ENS reads/writes, wallet signing
- [`wagmi`](https://wagmi.sh) + [`@rainbow-me/rainbowkit`](https://rainbowkit.com) — frontend wallet connection
