# Penguin Protocol

Private payroll on Ethereum. Companies pay employees without exposing salary amounts or wallet addresses on-chain.

---

## The Problem

Standard on-chain payroll leaks everything — sender, receiver, amount. Employees can be targeted, salaries compared, treasury movements tracked.

---

## How It Works

**Identity via ENS**
Companies own `company.eth`. When they onboard an employee, they mint a subdomain (`alice.company.eth`) directly to the employee's wallet using `NameWrapper.setSubnodeRecord`. No custom registry — ENS does the work.

**Authentication via SIWE**
Both parties sign in with their wallet (EIP-4361). Backend verifies the signature, checks ENS subdomain ownership against the database, issues a JWT.

**Contracts stored on Fileverse**
Salary terms are encrypted with both the company's and employee's public keys (ECIES), stored as a JSON blob inside a markdown file on Fileverse (pinned to IPFS). Only the two parties can decrypt. The employee decrypts by signing a deterministic message — no private key input needed.

**Private payroll via ShieldVault**
The vault holds USDC and maintains a MiMC Merkle tree. The company deposits a batch of commitments — each one encodes a salary note against a stealth address. The employee submits a ZK proof (Noir + Barretenberg UltraHonk) proving membership in the tree and receives USDC at a stealth address with no on-chain link to their identity.

---

## Flow

```
Company                         Employee
   │                               │
   ├─ register company.eth (ENS)   │
   ├─ invite employee              │
   │   └─ mint alice.company.eth ──►│
   │                               ├─ SIWE login (Sepolia)
   ├─ create encrypted contract ───►│ (stored on Fileverse/IPFS)
   │                               ├─ decrypt with wallet signature
   │                               │
   ├─ send USDC to BitGo treasury  │
   ├─ script: treasury → ShieldVault (depositBatch)
   │                               │
   │                               ├─ fetch ZK proof from API
   │                               └─ withdrawToStealth (Base Sepolia)
   │                                   └─ USDC → stealth address
```

---

## Why This Is Better

| Without this | With this |
|---|---|
| Salary visible on-chain | Encrypted in IPFS, ZK proof to claim |
| Employee wallet linked to payment | Stealth address, no on-chain link |
| Custom employee registry | ENS subdomains |
| Private key for decryption | Wallet signature derives key locally |
| Single point of failure | BitGo treasury + private vault separated |

---

## Deployed (Base Sepolia)

| Contract | Address |
|---|---|
| MockUSDC | `0x231E63e5E40E208D7570aaD33eF8a045d8EA4A3d` |
| HonkVerifier | `0xDA559F68d4D001E34a6ccDD55B2975E3eaD8d79B` |
| ShieldVault | `0x367707c3710514B196Bcf6bafE11977e264aa223` |

ENS on Sepolia. Vault + ZK verification on Base Sepolia.

---

## Stack

Next.js · RainbowKit/Wagmi · SIWE · ENS NameWrapper · Fileverse · Pinata/IPFS · Noir · Barretenberg · Solidity/Foundry · BitGo · Supabase
