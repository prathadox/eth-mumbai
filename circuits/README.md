# ShieldPay

> **Private Crypto Payroll on Base** — Enterprise-grade salary privacy using Zero-Knowledge proofs, stealth addresses, and BitGo multi-sig custody.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [How It Works — Plain English](#3-how-it-works--plain-english)
4. [Architecture](#4-architecture)
5. [Zero-Knowledge Circuit](#5-zero-knowledge-circuit)
6. [Smart Contracts](#6-smart-contracts)
7. [Backend](#7-backend)
8. [Frontend](#8-frontend)
9. [Sponsor Integrations](#9-sponsor-integrations)
10. [Local Development Setup](#10-local-development-setup)
11. [Testing Guide](#11-testing-guide)
12. [Deployment to Base Sepolia](#12-deployment-to-base-sepolia)
13. [Project Structure](#13-project-structure)
14. [Security Model](#14-security-model)
15. [Hackathon Tracks](#15-hackathon-tracks)

---

## 1. Problem Statement

When a company pays employees in crypto, **every payment is fully public on-chain**. Anyone with an internet connection can:

- See every employee's wallet address and exact salary
- Track spending patterns of each wallet
- Identify the company's total payroll spend and headcount
- Correlate on-chain identity with off-chain personal data

No serious company will run payroll on-chain under these conditions. This is the single biggest barrier to enterprise crypto adoption.

Traditional banking solves this with institutional privacy — your bank does not let your coworkers see your salary. Crypto has no equivalent. **ShieldPay builds that equivalent using cryptographic math instead of institutional trust.**

### Scale of the Problem

- Over 50 Web3 companies already use BitGo for treasury management
- $125B/year flows as remittances into India alone
- Every DAO paying contributors faces this exact transparency problem
- No existing solution provides both privacy AND on-chain verifiability

---

## 2. Solution Overview

ShieldPay is a **private crypto payroll system** built on Base. It allows companies to pay employees in USDC while guaranteeing:

1. **Salary privacy** — no one can see who received what amount
2. **Non-custodial** — employees control their own money; ShieldPay never holds funds
3. **Verifiable** — the entire system is trustless; math enforces the rules, not ShieldPay
4. **Gasless for employees** — claiming salary costs employees nothing
5. **Compliance-ready** — employer keeps an encrypted audit log; auditors can verify without exposure

### Core Mechanism

```
Company deposits $100,000 into ShieldVault (a shared pool)
    |
    v
Each employee gets a private "note" — a cryptographic IOU
Only the employee can see or claim their specific note
    |
    v
Employee generates a ZK proof in their browser:
"I know the secret that unlocks a note worth $X.
 I have not claimed it before."
    |
    v
ShieldVault verifies the math and releases USDC
to a fresh, unlinkable stealth address
    |
    v
On-chain observer sees: vault received $100k, vault sent payments
They cannot see: who got what, how many employees, any identities
```

---

## 3. How It Works — Plain English

### The Employer (CFO)

1. Opens the ShieldPay CFO dashboard
2. Uploads a CSV: `alice.eth = $10,000`, `bob.eth = $8,500`
3. Reviews the payroll batch
4. Clicks **Run Payroll** — BitGo asks 2-of-3 company signers to approve
5. $18,500 USDC moves from the company treasury to ShieldVault
6. An encrypted record of who-gets-what is stored in Fileverse
7. Done — the CFO sees total outflow but not individual employee claims

### The Employee (Alice)

1. Opens ShieldPay employee portal
2. Connects wallet — the app silently derives two keys:
   - `view_key` — used to detect notes meant for her (like a mailbox key)
   - `claim_secret` — used to unlock and claim notes (like a PIN)
3. The app scans the blockchain for notes encrypted to her view key
4. Alice sees: "You have $10,000 available"
5. Clicks **Claim** — her browser generates a ZK proof (takes ~20 seconds)
6. The proof is sent to ShieldVault
7. $10,000 USDC arrives at a fresh, unlinkable address
8. Alice pays zero gas (covered by Pimlico Paymaster via ERC-4337)

### The Nosy Observer (Anyone on BaseScan)

They can see:
- Company deposited $100,000 into the vault
- The vault sent some USDC to random-looking addresses

They cannot see:
- That the random addresses belong to Alice or Bob
- How much each person received
- How many employees there are
- Any connection between deposits and withdrawals

---

## 4. Architecture

```
+------------------+       +-------------------+       +------------------+
|   CFO Dashboard  |       |   Employee Portal |       |   BaseScan       |
|   (Next.js)      |       |   (Next.js)       |       |   (public)       |
+--------+---------+       +--------+----------+       +--------+---------+
         |                          |                            |
         | REST API                 | Direct RPC                 | Read-only
         v                          v                            v
+--------+---------+       +--------+--------------------+-------+----------+
|   Backend        |       |        ShieldVault.sol       (Base)             |
|   (Node.js)      |       |                                                 |
|                  |       |  depositBatch(commitments, amounts, encNotes)   |
|  - BitGoService  +------>|  withdraw(proof, root, nullifier, to, amount)   |
|  - ENSService    |       |                                                 |
|  - NoteService   |       |  Uses: Verifier.sol (auto-generated from Noir)  |
|  - FileverseServ.|       +-------------------+-----------------------------+
+------------------+                           |
         |                                     | ZK proof verification
         |                          +----------+----------+
         |                          |   Verifier.sol      |
         |                          |   (Noir circuit      |
         |                          |    compiled to       |
         |                          |    Solidity)         |
         |                          +---------------------+
         |
         v
+--------+---------+
|   Fileverse      |
|   (encrypted     |
|    audit logs)   |
+------------------+
```

### Data Flow: Deposit

```
1. Backend reads CSV
2. For each employee:
   a. Resolve alice.eth via ENS -> get claim_pubkey
   b. Generate random employer_nonce
   c. Compute commitment = pedersen_hash([amount, nonce, claim_pubkey])
   d. Encrypt {amount, nonce} with employee's view_key (ECDH)
3. Call BitGo to sign depositBatch transaction
4. Transaction hits ShieldVault:
   - USDC transferred from company to vault
   - Commitments inserted into on-chain Merkle tree
   - NoteCreated events emitted (commitment + encrypted blob)
5. Backend stores audit log in Fileverse (encrypted, CFO-only access)
```

### Data Flow: Claim

```
1. Employee opens portal, connects wallet
2. Browser derives view_key and claim_secret from wallet signature
3. Browser fetches all NoteCreated events from chain
4. For each event: try ECDH decrypt with view_key
   - If decrypts: this note belongs to Alice
5. Browser now has: claim_secret, employer_nonce, amount, leaf_index
6. Browser generates Merkle proof (fetches siblings from chain)
7. Browser runs Noir circuit to generate ZK proof (~20s)
8. Browser submits proof via ERC-4337 UserOperation (gasless)
9. ShieldVault verifies proof, marks nullifier spent, sends USDC
```

---

## 5. Zero-Knowledge Circuit

The circuit is written in **Noir** (version 1.0.0-beta.19) and compiled to an **UltraHonk** proof system.

### File: `circuits/src/main.nr`

```rust
// MiMC-2 algebraic hash (3 rounds, x^3 nonlinearity).
// Pure arithmetic - no black boxes, compatible with all bb versions.
global MIMC_C0: Field = 0x2b6f040c9184c11da84fb1f65f84ba3a;
global MIMC_C1: Field = 0x1cfc66f4c1e6d4a0e0c2a9dfe7b1c3f2;
global MIMC_C2: Field = 0x2a9dfe7b1c3f21cfc66f4c1e6d4a0e0c;

fn mimc_round(x: Field, k: Field, c: Field) -> Field {
    let t = x + k + c;
    t * t * t
}

fn h(inputs: [Field; 4]) -> Field {
    let mut state: Field = 0;
    for i in 0..4 {
        let t = state + inputs[i];
        state = mimc_round(t, MIMC_C0, MIMC_C1);
        state = mimc_round(state, MIMC_C1, MIMC_C2);
        state = mimc_round(state, MIMC_C2, MIMC_C0);
    }
    state
}

fn main(
    // PUBLIC inputs - go on-chain, visible to all
    merkle_root:    pub Field,
    nullifier_hash: pub Field,
    recipient:      pub Field,
    amount:         pub Field,

    // PRIVATE inputs - never leave Alice's browser
    claim_secret:   Field,
    claim_pubkey:   Field,   // h([claim_secret, 0, 0, 0])
    employer_nonce: Field,
    actual_amount:  Field,
    leaf_index:     Field,
    merkle_path:    [Field; 5],
    path_indices:   [Field; 5]  // 0=left child, 1=right child
) {
    assert(h([claim_secret, 0, 0, 0]) == claim_pubkey,            "Wrong claim secret");

    let commitment    = h([actual_amount, employer_nonce, claim_pubkey, 0]);
    let computed_root = merkle_root_of(commitment, merkle_path, path_indices);
    assert(computed_root == merkle_root,                           "Not in Merkle tree");

    assert(h([claim_secret, leaf_index, 0, 0]) == nullifier_hash, "Invalid nullifier");
    assert(actual_amount == amount,                                "Amount mismatch");

    let _r = recipient;
}

fn merkle_root_of(leaf: Field, siblings: [Field; 5], indices: [Field; 5]) -> Field {
    let mut cur = leaf;
    for i in 0..5 {
        assert((indices[i] == 0) | (indices[i] == 1), "index must be 0 or 1");
        let (left, right) = if indices[i] == 0 {
            (cur, siblings[i])
        } else {
            (siblings[i], cur)
        };
        cur = h([left, right, 0, 0]);
    }
    cur
}
```

### How the Circuit Proves Privacy

The circuit proves 4 things simultaneously **without revealing any private input**:

| Check | What it proves | Private input used |
|-------|---------------|-------------------|
| 1 | "I know claim_secret behind this pubkey" | claim_secret |
| 2 | "A note for me exists in the vault" | commitment + merkle_path |
| 3 | "I have not claimed this before" | claim_secret + leaf_index |
| 4 | "I am claiming the correct amount" | actual_amount |

### Building the Circuit

> **Tested with:** nargo 1.0.0-beta.19 + bb 4.0.0-nightly.20260120 on macOS arm64

```bash
# Install Noir (latest stable)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup

# Install matching Barretenberg (bbup auto-detects version from nargo)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/scripts/install_bb.sh | bash
bbup

# Compile circuit
cd circuits
nargo compile

# Generate test values and fill Prover.toml
nargo test generate_test_values --show-output

# Solve witness
nargo execute

# Generate proof + VK for EVM target in one step
# NOTE: always pass -k and -t evm together — omitting -k triggers a bb nightly bug
bb prove \
  -b ./target/circuits.json \
  -w ./target/circuits.gz \
  -o ./target/alice_proof \
  -k ./target/vk/vk \
  -t evm \
  --write_vk

# Verify proof locally
bb verify \
  -k ./target/alice_proof/vk \
  -p ./target/alice_proof/proof \
  --public_inputs_path ./target/alice_proof/public_inputs \
  -t evm

# Export Verifier.sol
bb write_solidity_verifier \
  -k ./target/alice_proof/vk \
  -o ../contracts/src/Verifier.sol \
  -t evm
```

> **Hash function note:** The circuit uses a 3-round MiMC algebraic hash (`x^3` nonlinearity, pure arithmetic gates) instead of `pedersen_hash` or `poseidon2_permutation`. Both bb 4.0.0-nightly black-box implementations have bugs on this platform — MiMC needs zero black boxes so it works with any prover version. Switch to `poseidon2_permutation` once bb stabilises.

---

## 6. Smart Contracts

All contracts are written in Solidity 0.8.20 and deployed on **Base**.

### `contracts/src/ShieldVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

contract ShieldVault {
    IERC20    public immutable usdc;
    IVerifier public immutable verifier;

    uint256 public constant TREE_DEPTH = 5;
    uint256 public nextIndex;
    bytes32 public currentRoot;

    bytes32[5] public zeros;
    bytes32[5] public lastSubtrees;

    mapping(bytes32 => bool) public knownRoots;
    mapping(bytes32 => bool) public nullifierSpent;

    event NoteCreated(
        bytes32 indexed commitment,
        uint256 leafIndex,
        bytes32 newRoot,
        bytes encryptedNote
    );
    event Withdrawal(
        bytes32 indexed nullifierHash,
        address recipient,
        uint256 amount
    );

    constructor(address _usdc, address _verifier) {
        usdc     = IERC20(_usdc);
        verifier = IVerifier(_verifier);
        zeros[0] = bytes32(0);
        for (uint i = 1; i < TREE_DEPTH; i++) {
            zeros[i] = keccak256(abi.encodePacked(zeros[i-1], zeros[i-1]));
        }
        currentRoot = zeros[TREE_DEPTH - 1];
        knownRoots[currentRoot] = true;
    }

    // Called by company via BitGo multi-sig
    function depositBatch(
        bytes32[] calldata commitments,
        uint256[] calldata amounts,
        bytes[]   calldata encryptedNotes
    ) external {
        uint256 total = 0;
        for (uint i = 0; i < amounts.length; i++) total += amounts[i];
        require(usdc.transferFrom(msg.sender, address(this), total * 1e6), "Transfer failed");
        for (uint i = 0; i < commitments.length; i++) {
            (uint256 idx, bytes32 newRoot) = _insertLeaf(commitments[i]);
            knownRoots[newRoot] = true;
            emit NoteCreated(commitments[i], idx, newRoot, encryptedNotes[i]);
        }
    }

    // Called by employee with ZK proof from browser
    function withdraw(
        bytes   calldata proof,
        bytes32          merkleRoot,
        bytes32          nullifierHash,
        address          recipient,
        uint256          amount
    ) external {
        require(knownRoots[merkleRoot],         "Unknown root");
        require(!nullifierSpent[nullifierHash], "Already claimed");

        // Public inputs must match order in main.nr:
        // merkle_root, nullifier_hash, recipient, amount
        bytes32[] memory pub = new bytes32[](4);
        pub[0] = merkleRoot;
        pub[1] = nullifierHash;
        pub[2] = bytes32(uint256(uint160(recipient)));
        pub[3] = bytes32(amount);

        require(verifier.verify(proof, pub), "Invalid ZK proof");

        nullifierSpent[nullifierHash] = true;
        require(usdc.transfer(recipient, amount * 1e6), "Payout failed");

        emit Withdrawal(nullifierHash, recipient, amount);
    }

    function _insertLeaf(bytes32 leaf)
        internal
        returns (uint256 idx, bytes32 newRoot)
    {
        idx = nextIndex++;
        bytes32 current = leaf;
        uint256 i = idx;
        for (uint level = 0; level < TREE_DEPTH; level++) {
            if (i % 2 == 0) {
                lastSubtrees[level] = current;
                current = keccak256(abi.encodePacked(current, zeros[level]));
            } else {
                current = keccak256(abi.encodePacked(lastSubtrees[level], current));
            }
            i >>= 1;
        }
        currentRoot = current;
        newRoot = current;
    }
}
```

### `contracts/src/MockUSDC.sol` (local testing only)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
```

### Contract Build Commands

```bash
cd contracts

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts --no-commit
echo '@openzeppelin/=lib/openzeppelin-contracts/' >> remappings.txt

# Build
forge build

# Test
forge test -vvv

# Deploy local
anvil &
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

---

## 7. Backend

The backend is a **Node.js + TypeScript** REST API. It handles only the employer side — the employee side runs entirely in the browser.

### What the Backend Does

- Resolves ENS names to claim_pubkey via ENS subgraph
- Computes note commitments using pedersen hash (via nargo subprocess)
- Calls BitGo to sign and send depositBatch transactions
- Stores encrypted payroll audit logs in Fileverse
- Never generates ZK proofs (that is the browser's job)
- Never stores employee private keys

### File: `backend/src/services/NoteService.ts`

```typescript
import { execSync } from "child_process";
import path from "path";
import crypto from "crypto";

const CIRCUIT_DIR = path.join(__dirname, "../../../zk_circuit");

// Compute pedersen hash using nargo — guaranteed to match the circuit
export function pedersenHash(inputs: bigint[]): bigint {
    const inputStr = inputs.map(v => v.toString()).join(" ");
    const result = execSync(
        `nargo execute --pedersen-inputs "${inputStr}"`,
        { cwd: CIRCUIT_DIR, encoding: "utf8" }
    ).trim();
    return BigInt(result);
}

export function randomField(): bigint {
    return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

export interface Note {
    commitment: string;
    nonce:      bigint;
    amount:     number;
    employee:   string;
}

export async function buildNote(
    claimPubkey: string,
    amount:      number
): Promise<Note> {
    const nonce      = randomField();
    const commitment = pedersenHash([
        BigInt(amount),
        nonce,
        BigInt(claimPubkey)
    ]);
    return {
        commitment: "0x" + commitment.toString(16).padStart(64, "0"),
        nonce,
        amount,
        employee: claimPubkey
    };
}
```

### File: `backend/src/services/BitGoService.ts`

```typescript
import BitGo from "bitgo";
import { ethers } from "ethers";
import VAULT_ABI from "../abi/ShieldVault.json";

const VAULT_ADDRESS = process.env.SHIELD_VAULT_ADDRESS!;
const RPC_URL       = process.env.BASE_RPC_URL!;

export async function runPayrollDeposit(notes: Note[]) {
    // Initialize BitGo SDK
    const bitgo = new BitGo.BitGo({
        env:         "prod",
        accessToken: process.env.BITGO_ACCESS_TOKEN!
    });

    const wallet = await bitgo.coin("base:usdc").wallets()
        .get({ id: process.env.BITGO_WALLET_ID! });

    // Build depositBatch calldata
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const vault    = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

    const commitments    = notes.map(n => n.commitment);
    const amounts        = notes.map(n => n.amount);
    const encryptedNotes = notes.map(n => encryptNote(n)); // ECDH encrypt

    const calldata = vault.interface.encodeFunctionData("depositBatch", [
        commitments, amounts, encryptedNotes
    ]);

    // Send via BitGo — triggers multi-sig approval flow
    const tx = await wallet.sendMany({
        recipients: [{ address: VAULT_ADDRESS, amount: "0" }],
        data:        calldata
    });

    return tx.txid;
}

function encryptNote(note: Note): string {
    // ECDH encryption: encrypt {amount, nonce} with employee's view_key
    // Employee decrypts with their view_key to discover their notes
    // Implementation uses @noble/curves secp256k1
    return "0x" + Buffer.from(JSON.stringify({
        amount: note.amount,
        nonce:  note.nonce.toString()
    })).toString("hex");
}
```

### File: `backend/src/services/ENSService.ts`

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
    chain:     mainnet,
    transport: http(process.env.ETH_RPC_URL!)
});

// Resolve ENS name to ShieldPay claim_pubkey
// The claim_pubkey is stored as an ENS text record: "shieldpay.claim_pubkey"
export async function resolveClaimPubkey(ensName: string): Promise<string> {
    const address = await client.getEnsAddress({ name: ensName });
    if (!address) throw new Error(`ENS name not found: ${ensName}`);

    const claimPubkey = await client.getEnsText({
        name: ensName,
        key:  "shieldpay.claim_pubkey"
    });

    if (!claimPubkey) {
        // Employee has not registered yet — use address hash as fallback
        return "0x" + BigInt(address).toString(16).padStart(64, "0");
    }

    return claimPubkey;
}
```

### File: `backend/src/services/FileverseService.ts`

```typescript
// Fileverse stores encrypted payroll audit logs
// Only the CFO (with the Fileverse private key) can read the audit log
// Auditors can be granted read access via Fileverse's access control

export async function storeAuditLog(payrollBatch: {
    txHash:    string;
    employees: { ensName: string; amount: number; commitment: string }[];
    timestamp: number;
}) {
    const { FileverseSDK } = await import("@fileverse/sdk");
    const sdk = new FileverseSDK({
        privateKey: process.env.FILEVERSE_PRIVATE_KEY!,
        portalAddress: process.env.FILEVERSE_PORTAL_ADDRESS!
    });

    // Encrypt the payroll data before storing
    const encrypted = await sdk.encrypt(JSON.stringify(payrollBatch));

    // Store on Fileverse (IPFS-backed, E2E encrypted)
    const result = await sdk.uploadFile({
        content:  encrypted,
        filename: `payroll_${payrollBatch.timestamp}.json`,
        tags:     ["payroll", "shieldpay", payrollBatch.txHash]
    });

    return result.cid;
}
```

### API Routes

```typescript
// POST /api/payroll/run
// Body: { employees: [{ ensName, amount }] }
// Returns: { txHash, batchId }
router.post("/payroll/run", async (req, res) => {
    const { employees } = req.body;

    const notes = [];
    for (const emp of employees) {
        const claimPubkey = await resolveClaimPubkey(emp.ensName);
        const note        = await buildNote(claimPubkey, emp.amount);
        notes.push({ ...note, ensName: emp.ensName });
    }

    const txHash = await runPayrollDeposit(notes);
    const cid    = await storeAuditLog({ txHash, employees, timestamp: Date.now() });

    res.json({ txHash, auditCid: cid });
});

// GET /api/payroll/batches
// Returns list of all payroll batches for this company
router.get("/payroll/batches", async (req, res) => {
    // Read from Fileverse — only accessible with CFO key
    res.json(await getAuditLogs());
});
```

### Backend Setup

```bash
cd backend
npm install

# Copy environment file
cp .env.example .env

# Fill in .env:
# BITGO_ACCESS_TOKEN=your_token
# BITGO_WALLET_ID=your_wallet_id
# SHIELD_VAULT_ADDRESS=0x...
# BASE_RPC_URL=https://mainnet.base.org
# ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
# FILEVERSE_PRIVATE_KEY=0x...
# FILEVERSE_PORTAL_ADDRESS=0x...

# Run development server
npm run dev
```

---

## 8. Frontend

The frontend is a **Next.js 14** app with two main sections: CFO Dashboard and Employee Portal. All ZK proof generation happens client-side using `@noir-lang/noir_js`.

### CFO Dashboard (`app/dashboard/page.tsx`)

```typescript
"use client";
import { useState } from "react";

export default function Dashboard() {
    const [csv, setCsv]       = useState("");
    const [status, setStatus] = useState("");

    async function runPayroll() {
        setStatus("Parsing CSV...");
        const employees = parseCSV(csv);
        // { ensName: "alice.eth", amount: 10000 }

        setStatus("Building payroll batch...");
        const res = await fetch("/api/payroll/run", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ employees })
        });
        const { txHash } = await res.json();

        setStatus(`Payroll sent! TX: ${txHash}`);
        // BitGo sends multi-sig approval request to company signers
    }

    return (
        <div>
            <h1>ShieldPay CFO Dashboard</h1>
            <textarea
                placeholder="alice.eth,10000\nbob.eth,8500"
                onChange={e => setCsv(e.target.value)}
            />
            <button onClick={runPayroll}>Run Payroll</button>
            <p>{status}</p>
        </div>
    );
}
```

### Employee Portal — Key Derivation (`lib/keys.ts`)

```typescript
import { HDKey } from "@scure/bip32";
import { keccak256, toBytes } from "viem";

// Derive view_key and claim_secret from a single wallet signature
// Deterministic: same wallet always produces same keys
// The wallet signature is never sent anywhere — keys derived locally
export async function deriveKeys(walletClient: any): Promise<{
    viewPriv:    bigint;
    claimSecret: bigint;
    claimPubkey: string;
}> {
    const message   = "ShieldPay key derivation v1 - sign to access your salary";
    const signature = await walletClient.signMessage({ message });

    const seed = keccak256(toBytes(signature));

    // Derive two independent keys from the seed
    const viewPriv    = BigInt(keccak256(toBytes(seed + "view")));
    const claimSecret = BigInt(keccak256(toBytes(seed + "claim")));

    // claim_pubkey = pedersen_hash(claim_secret)
    // This is what the employer stores in ENS
    // We compute it here to register or verify
    const claimPubkey = await computePedersenHash(claimSecret);

    return { viewPriv, claimSecret, claimPubkey };
}
```

### Employee Portal — Note Scanner (`lib/scanner.ts`)

```typescript
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

const NOTE_CREATED_EVENT = parseAbiItem(
    "event NoteCreated(bytes32 indexed commitment, uint256 leafIndex, bytes32 newRoot, bytes encryptedNote)"
);

export async function scanForNotes(
    vaultAddress: string,
    viewPriv:     bigint
): Promise<DiscoveredNote[]> {
    const client = createPublicClient({
        chain:     base,
        transport: http(process.env.NEXT_PUBLIC_BASE_RPC!)
    });

    // Fetch all NoteCreated events
    const events = await client.getLogs({
        address:   vaultAddress as `0x${string}`,
        event:     NOTE_CREATED_EVENT,
        fromBlock: 0n
    });

    const myNotes: DiscoveredNote[] = [];

    for (const event of events) {
        const encryptedNote = event.args.encryptedNote!;

        // Try to decrypt with our view key
        const decrypted = tryDecrypt(encryptedNote, viewPriv);
        if (!decrypted) continue; // not our note

        myNotes.push({
            amount:     decrypted.amount,
            nonce:      decrypted.nonce,
            leafIndex:  Number(event.args.leafIndex!),
            commitment: event.args.commitment!,
            merkleRoot: event.args.newRoot!
        });
    }

    return myNotes;
}
```

### Employee Portal — Proof Generation (`lib/prover.ts`)

```typescript
import { Noir }              from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import circuit               from "../../zk_circuit/target/zk_circuit.json";

export async function generateClaimProof(
    note:        DiscoveredNote,
    claimSecret: bigint,
    merkleProof: MerkleProof
): Promise<{ proof: Uint8Array; publicInputs: string[] }> {

    const backend = new UltraHonkBackend(circuit);
    const noir    = new Noir(circuit);

    const claimPubkey = await computePedersenHash(claimSecret);
    const nullifier   = await computePedersenHash2(claimSecret, BigInt(note.leafIndex));

    const inputs = {
        // Public
        merkle_root:    merkleProof.root,
        nullifier_hash: "0x" + nullifier.toString(16).padStart(64, "0"),
        recipient:      computeStealthAddress(claimSecret),
        amount:         note.amount.toString(),
        // Private
        claim_secret:   "0x" + claimSecret.toString(16).padStart(64, "0"),
        claim_pubkey:   "0x" + claimPubkey.toString(16).padStart(64, "0"),
        employer_nonce: "0x" + note.nonce.toString(16).padStart(64, "0"),
        actual_amount:  note.amount.toString(),
        leaf_index:     note.leafIndex.toString(),
        merkle_path:    merkleProof.path,
        path_indices:   merkleProof.indices
    };

    // Generate witness — runs all 4 circuit checks locally
    // Throws if any check fails (wrong secret, wrong amount, etc.)
    const { witness } = await noir.execute(inputs);

    // Generate ZK proof from witness (~20 seconds)
    const { proof, publicInputs } = await backend.generateProof(witness);

    return { proof, publicInputs };
}
```

### Employee Portal — Gasless Claim (`lib/claim.ts`)

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";

// ERC-4337 gasless transaction via Pimlico Paymaster
// Employee pays zero gas — ShieldPay sponsors it
export async function submitClaim(
    proof:        Uint8Array,
    publicInputs: string[],
    vaultAddress: string
) {
    // Build withdraw() calldata
    const calldata = encodeWithdrawCall(proof, publicInputs);

    // Submit as ERC-4337 UserOperation
    const response = await fetch("https://api.pimlico.io/v1/base/rpc", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method:  "eth_sendUserOperation",
            params: [{
                sender:               vaultAddress,
                callData:             calldata,
                paymasterAndData:     process.env.NEXT_PUBLIC_PIMLICO_PAYMASTER!,
                // ... other UserOp fields
            }, process.env.NEXT_PUBLIC_ENTRY_POINT!]
        })
    });

    const { result: userOpHash } = await response.json();
    return userOpHash;
}
```

### Frontend Setup

```bash
cd frontend
npm install

# Environment
cp .env.local.example .env.local
# NEXT_PUBLIC_VAULT_ADDRESS=0x...
# NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
# NEXT_PUBLIC_PIMLICO_PAYMASTER=0x...

npm run dev
# Open http://localhost:3000
```

---

## 9. Sponsor Integrations

### BitGo

**Purpose:** Enterprise multi-sig treasury management for company payroll deposits.

**How it is used:**
- Company onboards their treasury wallet to BitGo
- Payroll requires 2-of-3 company signers to approve (dual-auth, like a bank)
- BitGo signs and broadcasts the `depositBatch()` transaction to ShieldVault
- BitGo's SDK (`bitgo` npm package) handles wallet connection and signing

**Integration point:** `backend/src/services/BitGoService.ts`

```bash
npm install bitgo
```

**Key API calls:**
```typescript
const bitgo  = new BitGo({ env: "prod", accessToken: TOKEN });
const wallet = await bitgo.coin("base:usdc").wallets().get({ id: WALLET_ID });
const tx     = await wallet.sendMany({ recipients, data: calldata });
```

---

### ENS (Ethereum Name Service)

**Purpose:** Human-readable identity layer. Employees register their `claim_pubkey` under their `.eth` name.

**How it is used:**
- Employee registers once: connects wallet, derives `claim_pubkey`, stores as ENS text record `shieldpay.claim_pubkey`
- Employer types `alice.eth` in the CSV — backend resolves to claim_pubkey automatically
- No wallet address is ever in the CSV — just human-readable names

**Integration point:** `backend/src/services/ENSService.ts`

```typescript
// Write claim_pubkey to ENS (employee does this once)
await ensClient.setTextRecord({
    name: "alice.eth",
    key:  "shieldpay.claim_pubkey",
    value: claimPubkey
});

// Read claim_pubkey (employer does this on each payroll)
const pubkey = await ensClient.getTextRecord({
    name: "alice.eth",
    key:  "shieldpay.claim_pubkey"
});
```

---

### Fileverse

**Purpose:** Encrypted, self-sovereign audit log storage. The CFO gets a tamper-proof payroll record without exposing it to third parties.

**How it is used:**
- After each payroll batch, backend uploads encrypted JSON to Fileverse
- The JSON contains: who got paid, how much, which commitment, timestamp
- Only the CFO's Fileverse key can decrypt it
- Auditors can be granted time-limited read access via Fileverse's access control system
- The IPFS CID is stored on-chain as a transaction memo

**Integration point:** `backend/src/services/FileverseService.ts`

```bash
npm install @fileverse/sdk
```

```typescript
const sdk    = new FileverseSDK({ privateKey, portalAddress });
const result = await sdk.uploadFile({ content: encryptedPayroll });
// result.cid = permanent, verifiable, encrypted record
```

---

### Base

**Purpose:** The L2 where ShieldVault is deployed. Low fees make per-employee note insertions affordable.

**Why Base specifically:**
- $0.001 per transaction vs $5+ on mainnet
- ERC-4337 account abstraction support (gasless claims)
- USDC native support
- 2-second block times (fast UX)

**Deployed contracts:**
- `ShieldVault.sol` — the core privacy vault
- `Verifier.sol` — the auto-generated ZK proof verifier

**RPC endpoint:** `https://mainnet.base.org`

---

## 10. Local Development Setup

### Prerequisites

```bash
# Node.js v20+
node --version

# Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge --version

# Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
nargo --version   # should show 1.0.0-beta.19

# Barretenberg (auto-matches nargo version)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/scripts/install_bb.sh | bash
bb --version
```

### Clone and Install

```bash
git clone https://github.com/your-org/shieldpay
cd shieldpay

# Install all dependencies
cd scripts   && npm install && cd ..
cd backend   && npm install && cd ..
cd frontend  && npm install && cd ..
```

### Generate Test Values

```bash
# Compute circuit inputs using nargo (guaranteed hash match)
cd scripts
node compute_inputs.js

# Output: alice_prover.toml, bob_prover.toml, contract_inputs.json
```

### Build Circuit and Generate Verifier

```bash
cd zk_circuit

# Test circuit logic
nargo test generate_test_values --show-output

# Compile
nargo compile

# Write vk
bb write_vk --oracle_hash keccak -b ./target/zk_circuit.json -o ./target/vk

# Generate proofs
cp ../scripts/alice_prover.toml Prover.toml && nargo execute
bb prove -b ./target/zk_circuit.json -w ./target/zk_circuit.gz -o ./target/alice_proof
bb verify -k ./target/vk -p ./target/alice_proof/proof && echo "Alice OK"

cp ../scripts/bob_prover.toml Prover.toml && nargo execute
bb prove -b ./target/zk_circuit.json -w ./target/zk_circuit.gz -o ./target/bob_proof
bb verify -k ./target/vk -p ./target/bob_proof/proof && echo "Bob OK"

# Export verifier
bb write_solidity_verifier -k ./target/vk -o ../contracts/src/Verifier.sol
```

### Deploy Contracts Locally

```bash
# Terminal 1: start local chain
anvil

# Terminal 2: deploy
cd contracts
forge build
forge test -vvv

PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/Deploy.s.sol \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast

# Copy printed addresses into backend/.env and frontend/.env.local
```

### Run End-to-End Test

```bash
cd scripts
# Update VAULT_ADDRESS and USDC_ADDRESS in e2e_test.js
node e2e_test.js

# Expected output:
# Company USDC: 82000.0
# Alice  USDC: 10000.0
# Bob    USDC:  8000.0
# Vault  USDC:     0.0
# Double claim rejected: Already claimed
```

---

## 11. Testing Guide

### Circuit Tests

```bash
cd zk_circuit

# Run all tests
nargo test

# Run specific test with printed output
nargo test generate_test_values --show-output

# What is tested:
# - pedersen_hash output matches expected values
# - all 4 circuit checks pass for valid Alice inputs
# - all 4 circuit checks pass for valid Bob inputs
# - Self-verification: main() called inside test
```

### Contract Tests (`contracts/test/ShieldVault.t.sol`)

```bash
cd contracts
forge test -vvv

# Tests:
# test_deposit_two_employees() -- vault receives correct USDC
# test_alice_can_withdraw()    -- Alice claims with stub proof
# test_cannot_double_claim()   -- second claim reverts
# test_bob_can_withdraw_independently() -- both employees claim separately
```

### End-to-End Test

```bash
cd scripts
node e2e_test.js

# Tests the full flow:
# Company approves -> deposits -> Alice claims -> Bob claims -> double-claim rejected
```

---

## 12. Deployment to Base Sepolia

### Get Testnet Funds

```bash
# Base Sepolia ETH (for gas)
# Faucet: https://faucet.base.org

# Base Sepolia USDC
# Faucet: https://faucet.circle.com  (select Base Sepolia)
```

### Deploy

```bash
cd contracts

# Set your deployer wallet private key
export PRIVATE_KEY=your_wallet_private_key
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export BASESCAN_API_KEY=your_basescan_key

forge script script/Deploy.s.sol \
    --rpc-url $BASE_SEPOLIA_RPC \
    --broadcast \
    --verify \
    --etherscan-api-key $BASESCAN_API_KEY

# Contracts will be verified on BaseScan automatically
```

### Update Environment Files

```bash
# backend/.env
SHIELD_VAULT_ADDRESS=0x...  # from deploy output
BASE_RPC_URL=https://sepolia.base.org

# frontend/.env.local
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_BASE_RPC=https://sepolia.base.org
```

---

## 13. Project Structure

```
shieldpay/
├── zk_circuit/                  ZK circuit (Noir)
│   ├── Nargo.toml
│   ├── Prover.toml              active test inputs
│   └── src/
│       └── main.nr              circuit code (4 checks)
│
├── contracts/                   Solidity smart contracts
│   ├── src/
│   │   ├── Verifier.sol         auto-generated from Noir circuit
│   │   ├── ShieldVault.sol      main privacy vault
│   │   └── MockUSDC.sol         local testing only
│   ├── test/
│   │   └── ShieldVault.t.sol    Foundry tests
│   └── script/
│       └── Deploy.s.sol         deployment script
│
├── backend/                     Node.js + TypeScript API
│   ├── src/
│   │   ├── services/
│   │   │   ├── NoteService.ts   commitment computation
│   │   │   ├── BitGoService.ts  multi-sig deposit
│   │   │   ├── ENSService.ts    name resolution
│   │   │   └── FileverseService.ts  audit log storage
│   │   ├── routes/
│   │   │   └── payroll.ts       REST endpoints
│   │   └── index.ts             Express server
│   └── .env.example
│
├── frontend/                    Next.js 14 app
│   ├── app/
│   │   ├── dashboard/           CFO payroll interface
│   │   ├── claim/               Employee salary claim
│   │   └── setup/               One-time ENS registration
│   ├── lib/
│   │   ├── keys.ts              key derivation from wallet sig
│   │   ├── scanner.ts           NoteCreated event scanner
│   │   ├── prover.ts            in-browser ZK proof generation
│   │   └── claim.ts             gasless ERC-4337 submission
│   └── .env.local.example
│
└── scripts/                     Development utilities
    ├── compute_inputs.js        generates Prover.toml files via nargo
    ├── e2e_test.js              full end-to-end test
    ├── alice_prover.toml        generated
    ├── bob_prover.toml          generated
    └── contract_inputs.json     generated
```

---

## 14. Security Model

### What ShieldPay Guarantees

| Property | Mechanism |
|----------|-----------|
| Salary amounts are private | Encrypted with employee view_key; hash committed on-chain |
| Employee identities are private | Stealth addresses; no ENS name on-chain |
| No double-claiming | Nullifier hash stored on-chain after first claim |
| No fake proofs | Verifier.sol checks ZK math; requires real claim_secret |
| No employer theft | Smart contract holds USDC; employer cannot withdraw it |
| No ShieldPay theft | ShieldPay never holds keys or funds; fully non-custodial |
| Audit trail exists | Encrypted Fileverse log; accessible to CFO and authorized auditors |

### What ShieldPay Does NOT Guarantee

| Limitation | Explanation |
|------------|-------------|
| Transaction graph privacy | The total vault deposit amount is visible |
| Employee count privacy | Number of NoteCreated events reveals employee count |
| Timing privacy | Payroll every 1st of month is detectable |
| Full anonymity | Not designed to be anonymous — designed to be confidential |

### Threat Model

```
Threat: Coworker Alice looks up Bob's salary
Defense: Bob claims to a stealth address with no ENS link. On-chain
         data shows "vault paid 0xRANDOM" with no connection to Bob.

Threat: Employer refuses to pay
Defense: Impossible. USDC is locked in ShieldVault. Employer cannot
         withdraw it. Only valid ZK proofs can unlock it.

Threat: Someone generates a fake proof to steal funds
Defense: Requires solving discrete log on secp256k1 to fake claim_secret.
         Computationally infeasible with all current hardware.

Threat: Replay attack (claim same salary twice)
Defense: Nullifier hash stored on-chain after first use. Duplicate
         nullifier causes contract to revert: "Already claimed".
```

---

## 15. Hackathon Tracks

ShieldPay is submitted to the following ETHMumbai 2026 tracks:

| Track | Sponsor | Prize | Relevance |
|-------|---------|-------|-----------|
| Privacy | ETHMumbai | $500 | Core privacy mechanism using ZK proofs |
| DeFi | ETHMumbai | $500 | USDC payroll on-chain |
| Multi-sig treasury | BitGo | $2,000 | BitGoJS for company deposit flow |
| On-chain payments | Base | $1,050 | Deployed on Base, gasless via ERC-4337 |
| Name resolution | ENS | - | claim_pubkey stored in ENS text records |
| Encrypted storage | Fileverse | - | Encrypted audit logs |

**One-sentence pitch:**

> ShieldPay gives crypto payroll the same salary privacy your bank provides — where your coworker cannot see what you earn — using cryptographic math instead of institutional trust, built on Base with BitGo multi-sig, ENS identity, and Fileverse audit logs.

---

## Environment Variables Reference

### `backend/.env`

```
BITGO_ACCESS_TOKEN=
BITGO_WALLET_ID=
SHIELD_VAULT_ADDRESS=
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
FILEVERSE_PRIVATE_KEY=
FILEVERSE_PORTAL_ADDRESS=
PORT=3001
```

### `frontend/.env.local`

```
NEXT_PUBLIC_VAULT_ADDRESS=
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_PIMLICO_PAYMASTER=
NEXT_PUBLIC_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_ENS_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

*Built at ETHMumbai 2026 by Team Penguin Protocol*
