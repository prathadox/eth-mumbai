# Track: Fileverse

Employment contracts stored on Fileverse — end-to-end encrypted, decryptable only by the two parties, with no server ever seeing plaintext.

---

## The Problem

An employment contract contains salary figures, role terms, and legal obligations. It needs to be:
- Accessible to both the company and the employee at any time
- Unreadable by any third party, including the storage provider
- Decryptable without the user ever typing or storing a private key
- Verifiable as unmodified

Centralized document storage (S3, Notion, Google Docs) fails on the first three. On-chain storage fails on cost and privacy. IPFS alone fails on key management.

---

## How Fileverse Is Used

Fileverse provides the storage and pinning layer. The privacy guarantees come from how the content is prepared before it ever reaches Fileverse.

**Encryption flow (contract creation)**

1. The company fills in contract terms (salary, interval, role)
2. The backend generates a random AES-256-GCM key
3. Contract content is encrypted with that key
4. The key is wrapped twice using ECIES:
   - Once with the company's secp256k1 pubkey
   - Once with the employee's secp256k1 pubkey (recovered from their SIWE signature)
5. The encrypted content + both wrapped keys are serialized into a JSON blob, embedded in a markdown file
6. That file is uploaded to Fileverse via `@fileverse/agents`, which pins it to IPFS via Pinata and registers the file on-chain
7. The returned `fileId` (a BigInt from the on-chain `AddedFile` event) is stored in the database

Fileverse receives an opaque blob. It cannot read salary figures, role terms, or any contract content.

**Decryption flow (employee reads contract)**

1. The employee hits the contracts page
2. The browser fetches the encrypted blob from Fileverse via the file API (by `fileId` → IPFS hash → gateway fetch)
3. The employee is prompted to sign a deterministic message with their wallet (`"Decrypt employment contract for alice.company.eth"`)
4. The signature is used as entropy to re-derive the AES key locally — the same key that was wrapped at creation time
5. The contract decrypts in the browser. No key ever leaves the client. No server sees plaintext.

The company follows the same flow with their own wrapped key copy.

**Integrity**

After upload, the backend computes `keccak256(fileId)` and writes it as an ENS text record on the employee's subdomain. The document's location is verifiable on-chain without a custom contract.

---

## Why This Approach

| Property | How it's achieved |
|---|---|
| Storage provider can't read content | AES-256-GCM encryption before upload |
| Both parties can decrypt independently | Two ECIES-wrapped key copies |
| No private key storage or input | Wallet signature derives AES key |
| Content integrity | `keccak256(fileId)` in ENS text record |
| Permanent, decentralized storage | Fileverse + IPFS + Pinata |
| Programmatic upload from server | `@fileverse/agents` Node.js SDK |

---

## Stack

Fileverse (`@fileverse/agents`) · Pinata (IPFS pinning) · AES-256-GCM · ECIES (`eth-crypto`) · ENS text records · Next.js API routes
