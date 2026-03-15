# Track: ENS

ENS as the identity and data layer for a private payroll protocol — subdomains for employee onboarding, text records for public key distribution and contract verification.

---

## The Problem

Payroll systems need a way to identify employees that doesn't require a centralized user registry, doesn't expose wallet addresses publicly, and can be verified on-chain without a custom contract. ENS already solves this — but most integrations stop at simple name-to-address resolution.

---

## What We Do With ENS

ENS is doing four distinct jobs in this protocol, none of which are simple address lookup.

**1. Company identity**

Companies own `company.eth` on Sepolia. Ownership is verified on-chain at onboarding time by querying both the ENS Registry and NameWrapper contracts. No self-reported name — the backend checks actual on-chain ownership before creating a company record.

**2. Employee onboarding via subdomains**

When a company invites an employee, the backend calls `NameWrapper.setSubnodeRecord` directly:

- Mints `alice.company.eth` to the employee's wallet
- No custom registry contract needed
- Subdomain ownership is the access credential — SIWE verifies wallet controls the subdomain, JWT is issued

The employee's identity in the system is their ENS name, not their wallet address. If they rotate wallets, the subdomain moves with them.

**3. Public key distribution via text records**

After the employee logs in with SIWE, the backend recovers their secp256k1 public key from the signature (not just the address — the full uncompressed key). This is stored in the database and used later for ECIES encryption of their salary contract.

We also write the public key as an ENS text record on `alice.company.eth`, making it publicly verifiable and queryable by anyone who needs to encrypt data for that employee — without a custom key registry.

**4. Contract verification via text records**

After an employment contract is uploaded to Fileverse and pinned to IPFS, the backend computes `keccak256(fileId)` and writes it as a text record on the employee's ENS subdomain. Anyone can verify the contract hasn't been tampered with by fetching the fileId from the API, hashing it, and comparing against the on-chain text record. No custom attestation contract required.

---

## ENS Usage Summary

| Usage | ENS primitive | What it replaces |
|---|---|---|
| Company identity verification | `ownerOf` on Registry + NameWrapper | Custom registry contract |
| Employee onboarding | `NameWrapper.setSubnodeRecord` | User database with invite codes |
| Access control | SIWE + subdomain ownership check | Username/password or OAuth |
| Public key distribution | Text record (`pubkey`) | Custom key registry |
| Contract integrity proof | Text record (`contractHash`) | Custom attestation contract |

---

## Deployed

ENS operations run on Sepolia mainnet where `company.eth` names already exist. Subdomains are minted live at employee onboarding.

---

## Stack

ENS Registry · NameWrapper · `ethers@^6` (resolver, text records) · SIWE (secp256k1 key recovery) · Next.js API routes · Supabase
