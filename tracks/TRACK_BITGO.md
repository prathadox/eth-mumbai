# Track: BitGo Privacy

A private payroll system where BitGo handles custody and programmable disbursement, and a ZK vault handles unlinkable distribution to employees.

---

## The Problem

Enterprise payroll has two hard requirements that conflict: the company needs programmable, auditable control over funds, and employees need payments that don't expose their identity or salary on a public chain.

Using a raw EOA for treasury means either making every payment traceable, or building complex multi-hop obfuscation on top. Neither is maintainable.

---

## How BitGo Is Used

BitGo sits at the treasury layer. The company's USDC lives in a BitGo managed wallet — with full SDK control, policy enforcement, and programmatic access — before it ever touches the privacy layer.

**Wallet creation**

On company onboarding, the backend calls BitGo's SDK to create a managed wallet and generate a receive address. This address is stored in the database and shown to the company as their treasury deposit target.

**Scheduled disbursement**

A cron endpoint runs on a configurable interval. For each active employee contract:
1. It decrypts the employee's salary amount (stored encrypted in the DB with a server-side master key)
2. Checks the payment interval (weekly / biweekly / monthly) against `last_paid_at`
3. Calls BitGo's `sendMany` to move USDC from the company's BitGo wallet to ShieldVault's deposit address

The BitGo wallet handles signing, fee management, and transaction broadcast. The backend never touches a raw private key.

**The privacy handoff**

Once USDC crosses into ShieldVault, BitGo's job is done. From that point, all further movement is governed by ZK proofs and stealth addresses. The company's BitGo wallet appears on-chain as funding a vault contract — not paying specific employees. The vault disburses to stealth addresses derived from employee secrets. No observer can link the BitGo disbursement to any individual recipient.

---

## Why This Composition Works

| Layer | Handled by | What it gives you |
|---|---|---|
| Custody & signing | BitGo | Managed keys, programmable policy, no raw key exposure |
| Disbursement scheduling | Cron + BitGo SDK | Reliable, auditable company-side payments |
| Privacy boundary | ShieldVault + ZK | Unlinkable receipt, stealth addresses |
| Identity | ENS subdomains | Human-readable, no custom registry |

BitGo doesn't need to know anything about ZK proofs. ShieldVault doesn't need to know anything about BitGo. Each component has a single responsibility and the boundary between them is a standard ERC-20 transfer.

---

## Deployed

BitGo testnet wallets provisioned per company at onboarding. ShieldVault on Base Sepolia at `0x367707c3710514B196Bcf6bafE11977e264aa223`.

---

## Stack

BitGo SDK (`@bitgo/sdk-api`, `@bitgo/sdk-coin-eth`) · Next.js API routes · Supabase · ShieldVault (Solidity/Foundry) · Base Sepolia
