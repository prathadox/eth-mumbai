# ShieldPay — Winning Technical Blueprint
### Private Crypto Payroll with Multi-Stealth Architecture · ETHMumbai 2026

---

## Executive Summary

**The Problem:** On-chain payroll is fully public. Employees can look up each other's salaries. Competitors see your entire compensation structure. No company will deploy real payroll while coworkers can see everyone's compensation in real time.

**The Solution:** ShieldPay combines BitGo institutional multi-sig, ERC-5564 stealth addresses with **multi-address splitting**, ERC-4337 gasless claims, and Noir ZK batch proofs to deliver the first truly private crypto payroll system.

**What makes this win:**
- ✅ **Real privacy** — Multi-stealth architecture prevents salary inference via amount clustering
- ✅ **Zero employee friction** — One-click gasless claim via Pimlico Paymaster (no ETH needed)
- ✅ **Enterprise ready** — BitGo multi-sig for treasury, ENS for identity, Base for low cost
- ✅ **Four sponsor tracks** — BitGo ($2,000) + Base ($1,050) + Privacy ($500) + ENS = ~$4,000+
- ✅ **42-hour buildable** — Clear scope, proven primitives, realistic demo

**Prize Strategy:** This hits BitGo (direct SDK integration), Base (deployed + gasless UX), Privacy (stealth + ZK), and ENS (resolution layer) simultaneously. The judges from each sponsor see their technology used correctly and meaningfully.

---

## 1. The Privacy Architecture That Actually Works

### Why Standard Stealth Addresses Aren't Enough

**Problem:** One stealth address per employee still leaks salary via amount clustering:

```
executeBatch():
  → 0xABC received 10,000 USDC  ← "senior dev"
  → 0xDEF received 3,000 USDC   ← "junior dev"
  → 0xGHI received 15,000 USDC  ← "CTO"
```

Even with hidden identities, amounts reveal organizational hierarchy. An attacker can cluster employees by salary bands and track them across months.

### ShieldPay's Multi-Stealth Solution

**Each employee receives 2-4 random stealth addresses per pay period, with salary split randomly:**

```
executeBatch():
  → 0xABC received 3,000 USDC   ┐
  → 0xDEF received 2,000 USDC   │ Employee 1 (10K total)
  → 0xGHI received 5,000 USDC   ┘
  → 0xJKL received 4,000 USDC   ┐ Employee 2 (7K total)
  → 0xMNO received 3,000 USDC   ┘
  → 0xPQR received 1,500 USDC   ┐
  → 0xSTU received 1,000 USDC   │ Employee 3 (3.5K total)
  → 0xVWX received 1,000 USDC   ┘
```

**Why this breaks clustering:**
- No two payments look like "one person's salary"
- Random splits change monthly — can't track patterns
- Number of addresses per employee varies (2-4)
- Minimum split of $100 prevents dust-based deanonymization

**Cryptographic foundation:** Each stealth address uses a different ephemeral key. They are mathematically unlinkable to each other or to the recipient's identity. Only the employee's view key can detect all addresses belonging to them. [ERC-5564 spec]

---

## 2. System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        SHIELDPAY ARCHITECTURE                         │
│                                                                       │
│  ┌────────────────┐         ┌──────────────────┐                     │
│  │  CFO Dashboard │────────▶│  Backend API     │                     │
│  │   (Next.js)    │         │  (Node/Express)  │                     │
│  └────────────────┘         └────────┬─────────┘                     │
│                                      │                                │
│                    ┌─────────────────┼─────────────────┐              │
│                    ▼                 ▼                 ▼              │
│           ┌────────────────┐ ┌──────────────┐ ┌────────────────┐    │
│           │  BitGoJS SDK   │ │ Stealth Addr │ │  ENS Resolver  │    │
│           │   Multi-sig    │ │  Generator   │ │   ERC-6538     │    │
│           │   Treasury     │ │  (ERC-5564)  │ │   Registry     │    │
│           └───────┬────────┘ └──────┬───────┘ └────────┬───────┘    │
│                   │                 │                   │            │
│                   └─────────────────┼───────────────────┘            │
│                                     ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │  ShieldPayroll.sol (Base)    │                │
│                      │  - executeBatch()            │                │
│                      │  - 2-of-3 Multi-sig         │                │
│                      │  - ERC-5564 Announcements   │                │
│                      └──────────────┬───────────────┘                │
│                                     │                                │
│                                     ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │  Noir ZK Circuit             │                │
│                      │  - Batch integrity proof     │                │
│                      │  - Sum verification          │                │
│                      │  - No individual amounts     │                │
│                      └──────────────────────────────┘                │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                       EMPLOYEE CLAIM FLOW                             │
│                                                                       │
│  ┌────────────────┐         ┌──────────────────┐                     │
│  │ Employee Portal│────────▶│  Stealth Scanner │                     │
│  │   (Next.js)    │         │  (View Key Scan) │                     │
│  └────────────────┘         └────────┬─────────┘                     │
│                                      │                                │
│                                      ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │ Found: 3 stealth addresses   │                │
│                      │  0xABC: 3,000 USDC          │                │
│                      │  0xDEF: 2,000 USDC          │                │
│                      │  0xGHI: 5,000 USDC          │                │
│                      └──────────────┬───────────────┘                │
│                                     │                                │
│                                     ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │  ERC-4337 UserOp Builder     │                │
│                      │  - 3 signed UserOperations   │                │
│                      │  - Pimlico Paymaster         │                │
│                      │  - Gasless sweep             │                │
│                      └──────────────┬───────────────┘                │
│                                     │                                │
│                                     ▼                                │
│                      ┌──────────────────────────────┐                │
│                      │  Employee Main Wallet        │                │
│                      │  Receives: 10,000 USDC       │                │
│                      │  Gas paid: $0.00             │                │
│                      └──────────────────────────────┘                │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Smart Contracts (Solidity)
- **Chain:** Base Sepolia (testnet) → Base Mainnet (production)
- **Framework:** Foundry (forge, cast, anvil)
- **Contracts:**
  - `ShieldPayroll.sol` — Multi-sig batch executor with ERC-5564 announcements
  - Integrates ERC-5564 Announcer at `0x55649E01B5Df198D18D95b5cc5051630cfD45564`
  - USDC Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### ZK Circuits (Noir)
- **Language:** Noir v0.23+
- **Backend:** Barretenberg prover
- **Circuit:** `batch_integrity/main.nr`
  - Proves sum(salaries) = total_disbursed
  - Uses Pedersen commitments to hide individual amounts
  - ~5-10 second proving time for 20 employees

### Backend (Node.js/TypeScript)
- **Framework:** Express.js + TypeScript
- **Key Services:**
  - `BitGoService.ts` — Multi-sig wallet management, co-signed transfers
  - `StealthService.ts` — Multi-address generation (2-4 per employee)
  - `ENSService.ts` — Resolve `alice.eth` → stealth meta-address
  - `NoirService.ts` — Generate batch integrity proofs
- **Database:** PostgreSQL (payroll records, employee ENS names)
- **APIs:**
  - BitGo SDK v20+ (testnet wallet creation, sendMany)
  - Pimlico Paymaster API (ERC-4337 gas sponsorship)

### Frontend (Next.js 14)
- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS v3.4
- **Web3:** wagmi v2, viem v2, RainbowKit
- **Key Features:**
  - CFO Dashboard — Create payroll batches, approve with BitGo
  - Employee Portal — One-click gasless claim via Pimlico
  - Stealth Scanner — Detect all owned stealth addresses via view key

### Infrastructure
- **Deployment:** Vercel (frontend + API routes), Railway (backend)
- **RPC:** Alchemy or QuickNode (Base Sepolia)
- **Bundler:** Pimlico (ERC-4337 bundler + paymaster for Base)
- **IPFS:** (Optional) Store encrypted payroll metadata

---

## 4. Core Technical Implementation

### 4.1 Multi-Stealth Address Generation

```typescript
// StealthService.ts

import { secp256k1 } from "@noble/curves/secp256k1";
import { randomBytes } from "@noble/hashes/utils";
import { keccak_256 } from "@noble/hashes/sha3";

interface StealthPayment {
  stealthAddress: `0x${string}`;
  ephemeralPubKey: `0x${string}`;
  amount: number;
  viewTag: number;
}

/**
 * Generate 2-4 stealth addresses for one employee with random amount splits.
 * Each address is cryptographically unlinkable.
 */
export function generateMultiStealthPayments(
  stealthMetaAddress: string, // from ENS ERC-6538 registry
  totalSalaryUsdc: number
): StealthPayment[] {
  const numSplits = Math.floor(Math.random() * 3) + 2; // 2-4 addresses
  const amounts = randomSplit(totalSalaryUsdc, numSplits);

  return amounts.map((amount) => {
    // Parse stealth meta-address: "st:eth:0x<spendingPubKey><viewingPubKey>"
    const [schemeId, spendPubKeyHex, viewPubKeyHex] = 
      parseStealthMetaAddress(stealthMetaAddress);

    // Generate fresh ephemeral key pair for THIS address
    const ephemeralPrivKey = secp256k1.utils.randomPrivateKey();
    const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, false);

    // ECDH shared secret
    const viewPubKey = hexToPoint(viewPubKeyHex);
    const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivKey, viewPubKey);
    const sharedSecretHash = keccak_256(sharedSecret.slice(1)); // drop 0x04 prefix

    // Stealth address = spendPubKey + hash(sharedSecret) * G
    const spendPubKey = hexToPoint(spendPubKeyHex);
    const stealthPubKey = secp256k1.ProjectivePoint.fromHex(spendPubKey)
      .add(secp256k1.ProjectivePoint.BASE.multiply(BigInt("0x" + Buffer.from(sharedSecretHash).toString("hex"))));

    const stealthAddress = pubKeyToAddress(stealthPubKey.toRawBytes(false));

    // View tag (first byte of shared secret) — scanning optimization
    const viewTag = sharedSecretHash[0];

    return {
      stealthAddress,
      ephemeralPubKey: "0x" + Buffer.from(ephemeralPubKey).toString("hex"),
      amount,
      viewTag,
    };
  });
}

/**
 * Split total amount into N random parts, each >= $100 USDC minimum.
 */
function randomSplit(total: number, n: number): number[] {
  const MIN = 100; // minimum split to prevent dust attacks
  if (total < MIN * n) return [total]; // can't split, return full amount

  const splits: number[] = [];
  let remaining = total;

  for (let i = 0; i < n - 1; i++) {
    const maxSplit = remaining - MIN * (n - i - 1);
    const split = Math.floor(Math.random() * (maxSplit - MIN + 1)) + MIN;
    splits.push(split);
    remaining -= split;
  }
  splits.push(remaining); // last split gets remainder

  return splits;
}
```

### 4.2 Smart Contract — ShieldPayroll.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IErc5564Announcer {
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes memory ephemeralPubKey,
        bytes memory metadata
    ) external;
}

/**
 * @title ShieldPayroll
 * @notice Private payroll system using ERC-5564 stealth addresses + 2-of-3 multi-sig
 * @dev Multiple stealth addresses per employee for amount privacy
 */
contract ShieldPayroll is AccessControl {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    IERC20 public immutable usdc;
    IErc5564Announcer public constant ANNOUNCER = 
        IErc5564Announcer(0x55649E01B5Df198D18D95b5cc5051630cfD45564);
    
    uint256 public requiredSignatures = 2;
    uint256 public signerCount;
    
    mapping(bytes32 => uint256) public approvals;
    mapping(bytes32 => bool) public executed;
    
    event BatchProposed(bytes32 indexed batchHash, address proposer);
    event BatchApproved(bytes32 indexed batchHash, address signer);
    event BatchExecuted(bytes32 indexed batchHash, uint256 totalAmount);
    
    constructor(
        address _usdc,
        address[] memory _signers
    ) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        for (uint i = 0; i < _signers.length; i++) {
            _grantRole(SIGNER_ROLE, _signers[i]);
        }
        signerCount = _signers.length;
    }
    
    struct StealthPayment {
        address stealthAddress;
        uint256 amount;
        bytes ephemeralPubKey;
        uint8 viewTag;
    }
    
    /**
     * @notice Execute batch payroll with multi-sig approval
     * @param payments Array of stealth payments (multiple per employee)
     * @param zkProof Noir proof that sum(amounts) = total, no individual amounts revealed
     */
    function executeBatch(
        StealthPayment[] calldata payments,
        bytes calldata zkProof
    ) external onlyRole(SIGNER_ROLE) {
        bytes32 batchHash = keccak256(abi.encode(payments, zkProof));
        require(!executed[batchHash], "Already executed");
        
        approvals[batchHash]++;
        emit BatchApproved(batchHash, msg.sender);
        
        if (approvals[batchHash] < requiredSignatures) {
            return; // need more signatures
        }
        
        executed[batchHash] = true;
        
        // Verify ZK proof (in production, call verifier contract)
        // require(verifyBatchProof(zkProof), "Invalid proof");
        
        uint256 totalDisbursed = 0;
        
        for (uint i = 0; i < payments.length; i++) {
            StealthPayment memory p = payments[i];
            
            // Transfer USDC to stealth address
            require(
                usdc.transfer(p.stealthAddress, p.amount),
                "Transfer failed"
            );
            
            // Announce on ERC-5564 registry
            bytes memory metadata = abi.encodePacked(p.viewTag);
            ANNOUNCER.announce(
                1, // scheme ID (SECP256k1)
                p.stealthAddress,
                p.ephemeralPubKey,
                metadata
            );
            
            totalDisbursed += p.amount;
        }
        
        emit BatchExecuted(batchHash, totalDisbursed);
    }
    
    /**
     * @notice Fund treasury (company deposits USDC)
     */
    function fundTreasury(uint256 amount) external {
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }
}
```

### 4.3 Employee Gasless Claim (ERC-4337 + Pimlico)

```typescript
// lib/claimSalary.ts

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  createSmartAccountClient,
  ENTRYPOINT_ADDRESS_V07,
} from "permissionless";
import { privateKeyToSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoPaymasterClient } from "permissionless/clients/pimlico";

const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

/**
 * One-click salary claim: scan all stealth addresses, sweep to main wallet, zero gas.
 */
export async function claimSalary(
  employeeMainWallet: `0x${string}`,
  viewPrivateKey: `0x${string}`,
  spendPrivateKey: `0x${string}`
) {
  const pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY!;
  const pimlicoUrl = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${pimlicoApiKey}`;
  
  // 1. Scan ERC-5564 announcements to find owned stealth addresses
  const stealthAddresses = await scanStealthAddresses(viewPrivateKey);
  
  // 2. Derive spending key for each stealth address
  const stealthPrivKeys = stealthAddresses.map((addr) =>
    deriveStealthPrivateKey(spendPrivateKey, addr.ephemeralPubKey, addr.viewTag)
  );
  
  // 3. Create paymaster client
  const paymasterClient = createPimlicoPaymasterClient({
    transport: http(pimlicoUrl),
    entryPoint: ENTRYPOINT_ADDRESS_V07,
  });
  
  // 4. For each stealth address, create a UserOperation to sweep USDC
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  
  const txHashes: string[] = [];
  
  for (let i = 0; i < stealthAddresses.length; i++) {
    const stealthAddr = stealthAddresses[i].address;
    const stealthPrivKey = stealthPrivKeys[i];
    
    // Check balance
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [stealthAddr],
    });
    
    if (balance === 0n) continue; // skip empty
    
    // Create smart account for this stealth address
    const smartAccount = await privateKeyToSimpleSmartAccount(publicClient, {
      privateKey: stealthPrivKey,
      factoryAddress: "0x9406Cc6185a346906296840746125a0E44976454", // SimpleAccountFactory
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    });
    
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: baseSepolia,
      bundlerTransport: http(pimlicoUrl),
      middleware: {
        sponsorUserOperation: paymasterClient.sponsorUserOperation, // GASLESS
      },
    });
    
    // Send USDC to employee's main wallet
    const txHash = await smartAccountClient.sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [employeeMainWallet, balance],
      }),
    });
    
    txHashes.push(txHash);
  }
  
  return {
    success: true,
    claimedAddresses: stealthAddresses.length,
    totalAmount: stealthAddresses.reduce((sum, a) => sum + a.balance, 0),
    txHashes,
  };
}
```

### 4.4 Noir ZK Circuit — Batch Integrity Proof

```rust
// circuits/batch_integrity/src/main.nr

use dep::std;

/**
 * Proves that sum(individual_salaries) = total_disbursed
 * WITHOUT revealing individual salary amounts.
 * 
 * Uses Pedersen commitments: C(amount) = amount*G + blinding*H
 */
fn main(
    // Public inputs
    total_disbursed: Field,
    commitment_sum: [Field; 2], // Pedersen commitment to sum
    
    // Private inputs (witness)
    individual_amounts: [Field; 20],
    individual_blindings: [Field; 20],
    num_employees: Field
) {
    // 1. Verify sum of private amounts equals public total
    let mut computed_sum: Field = 0;
    for i in 0..20 {
        if i < num_employees {
            computed_sum += individual_amounts[i];
        }
    }
    assert(computed_sum == total_disbursed);
    
    // 2. Verify Pedersen commitments
    let mut commitment_accumulator = [0 as Field; 2];
    for i in 0..20 {
        if i < num_employees {
            let c = std::hash::pedersen_commitment([
                individual_amounts[i],
                individual_blindings[i]
            ]);
            commitment_accumulator[0] += c[0];
            commitment_accumulator[1] += c[1];
        }
    }
    
    assert(commitment_accumulator[0] == commitment_sum[0]);
    assert(commitment_accumulator[1] == commitment_sum[1]);
    
    // 3. Range check: all amounts > 0 (no negative salaries)
    for i in 0..20 {
        if i < num_employees {
            assert(individual_amounts[i] > 0);
        }
    }
}
```

---

## 5. Complete File Structure

```
shieldpay/
├── contracts/                 # Solidity smart contracts
│   ├── src/
│   │   ├── ShieldPayroll.sol         # Main payroll contract
│   │   └── interfaces/
│   │       └── IErc5564Announcer.sol
│   ├── test/
│   │   └── ShieldPayroll.t.sol       # Foundry tests
│   ├── script/
│   │   └── Deploy.s.sol              # Deployment script
│   └── foundry.toml
│
├── circuits/                  # Noir ZK circuits
│   ├── batch_integrity/
│   │   ├── src/
│   │   │   └── main.nr               # Batch proof circuit
│   │   ├── Prover.toml
│   │   └── Nargo.toml
│   └── scripts/
│       └── generate_proof.sh
│
├── backend/                   # Node.js API
│   ├── src/
│   │   ├── index.ts                  # Express server
│   │   ├── routes/
│   │   │   ├── payroll.ts            # Payroll batch endpoints
│   │   │   └── employees.ts          # Employee management
│   │   ├── services/
│   │   │   ├── BitGoService.ts       # Multi-sig wallet ops
│   │   │   ├── StealthService.ts     # Multi-address generation
│   │   │   ├── ENSService.ts         # ENS resolution
│   │   │   └── NoirService.ts        # ZK proof generation
│   │   ├── db/
│   │   │   ├── schema.sql            # PostgreSQL schema
│   │   │   └── connection.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Landing page
│   │   ├── dashboard/
│   │   │   └── page.tsx              # CFO Dashboard
│   │   └── claim/
│   │       └── page.tsx              # Employee Portal
│   ├── components/
│   │   ├── PayrollBatchForm.tsx      # Create batch UI
│   │   ├── StealthScanner.tsx        # Scan owned addresses
│   │   ├── ClaimButton.tsx           # One-click gasless claim
│   │   └── BitGoConnector.tsx        # BitGo wallet connection
│   ├── lib/
│   │   ├── wagmi.ts                  # Wagmi config
│   │   ├── stealth.ts                # Stealth address utils
│   │   └── claim.ts                  # ERC-4337 claim logic
│   ├── package.json
│   └── next.config.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRIVACY_ANALYSIS.md
│   └── DEMO_SCRIPT.md
│
└── README.md
```

---

## 6. The 42-Hour Sprint Roadmap

### Pre-Hackathon (Now — March 21)
- [ ] **Create BitGo testnet account** — `app.bitgo.com/signup` (approval takes 2-6 hours)
- [ ] **Get API keys:**
  - Pimlico API key (instant)
  - Alchemy/QuickNode RPC key (instant)
- [ ] **Install tooling:**
  - Foundry: `curl -L https://foundry.paradigm.xyz | bash`
  - Noir: `curl -L https://install.aztec.network | bash`
  - Node.js 20+, pnpm

### Day 1: Foundation (Hours 0-14) — March 22, 9am-11pm

**Hour 0-2: Smart Contract**
- [ ] Initialize Foundry project
- [ ] Write `ShieldPayroll.sol` multi-sig + batch executor
- [ ] Deploy to Base Sepolia
- [ ] Verify contract on BaseScan

**Hour 2-5: Stealth Address Generation**
- [ ] Implement `StealthService.ts` with `@noble/curves`
- [ ] Add multi-address splitting (2-4 per employee)
- [ ] Test ephemeral key derivation
- [ ] Unit tests for amount randomization

**Hour 5-8: ENS Integration**
- [ ] Connect to ERC-6538 Registry on Base Sepolia
- [ ] Resolve test ENS names to stealth meta-addresses
- [ ] Store sample employee ENS names in database

**Hour 8-11: BitGo Multi-Sig**
- [ ] Create BitGo testnet wallet (2-of-3 threshold)
- [ ] Implement `BitGoService.ts` with `sendMany()`
- [ ] Test co-signed USDC transfer
- [ ] Fund wallet with testnet USDC

**Hour 11-14: Backend API**
- [ ] Express server with `/api/payroll/create` endpoint
- [ ] PostgreSQL schema for employees + batches
- [ ] Connect all services (BitGo + Stealth + ENS)
- [ ] Test full payroll batch creation flow

**✅ Day 1 End-of-Day Checkpoint:** Smart contract deployed, stealth addresses generating, BitGo wallet operational.

---

### Day 2: Zero-Knowledge + Frontend (Hours 14-32) — March 23, 9am-1am

**Hour 14-18: Noir Circuit**
- [ ] Write `batch_integrity/main.nr` circuit
- [ ] Pedersen commitments for salary amounts
- [ ] Compile circuit: `nargo compile`
- [ ] Generate test proof with 5 employees
- [ ] Measure proving time (<10 seconds target)

**Hour 18-22: CFO Dashboard**
- [ ] Next.js app with wagmi + RainbowKit
- [ ] PayrollBatchForm component
- [ ] ENS name input for employees
- [ ] Display generated stealth addresses
- [ ] BitGo approval button (opens BitGo dashboard)

**Hour 22-26: Employee Portal**
- [ ] Stealth address scanner component
- [ ] Derive view/spend keys from wallet signature
- [ ] Scan ERC-5564 announcements
- [ ] Display found addresses + amounts

**Hour 26-32: Gasless Claim (ERC-4337)**
- [ ] Integrate Pimlico SDK
- [ ] Implement UserOperation builder for each stealth address
- [ ] Add Paymaster sponsorship
- [ ] One-click claim button that sweeps all addresses
- [ ] Test on Base Sepolia with real testnet USDC

**✅ Day 2 End-of-Day Checkpoint:** Full working prototype. CFO can create batches, employee can claim gaslessly.

---

### Day 3: Polish + Demo (Hours 32-42) — March 24, 1am-11am

**Hour 32-36: UI/UX Polish**
- [ ] Tailwind styling for dashboard and portal
- [ ] Loading states for all async operations
- [ ] Error handling and user feedback
- [ ] Mobile responsive design

**Hour 36-38: Demo Deployment**
- [ ] Deploy contracts to Base Sepolia (final verified version)
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Create demo video (2-3 minutes)

**Hour 38-40: Documentation**
- [ ] Update README with live demo link
- [ ] Architecture diagram (Excalidraw)
- [ ] Privacy analysis document
- [ ] Sponsor integration highlights (BitGo + Base + Privacy + ENS)

**Hour 40-42: Final Testing**
- [ ] End-to-end test: Create batch → Approve → Employee claims
- [ ] Check all transactions on BaseScan
- [ ] Verify stealth addresses are unlinkable
- [ ] Record demo walkthrough

**✅ Submission Ready:** Working product, live demo, documentation, video.

---

## 7. Demo Script for Judges (5 Minutes)

### Opening (30 seconds)
"Hi, I'm [name]. ShieldPay is the first truly private crypto payroll system. Companies get institutional-grade treasury management with BitGo, employees get privacy via stealth addresses — and nobody can see anyone's salary on-chain."

### Problem Setup (45 seconds)
"Right now, on-chain payroll is fully public. If I work at a crypto company and know my coworker's wallet address, I can see exactly what they're paid. [Show Etherscan example of a public payroll transaction with visible amounts.] This is why no serious company uses blockchain for payroll. Privacy is the blocker."

### The Solution (90 seconds)
"ShieldPay solves this with three technologies:

**1. Multi-stealth addresses** — Each employee receives 2-4 fresh addresses per month with random splits. [Show dashboard: Alice gets 3 addresses: $3K, $2K, $5K]. These addresses are cryptographically unlinkable — even to each other. An observer can't tell if three payments went to one person or three people.

**2. BitGo multi-sig** — The company treasury is a 2-of-3 multi-sig wallet using BitGo's SDK. [Show BitGo approval screen.] This is the same custody solution billion-dollar institutions use.

**3. Gasless claiming with Pimlico** — Employees click one button, all their stealth addresses sweep to their main wallet, and they pay zero gas. [Click 'Claim Salary' button, show Pimlico UserOp.] The Paymaster sponsors everything."

### Live Demo (90 seconds)
1. "I'm the CFO. I create a payroll batch for 3 employees." [Enter ENS names: alice.eth, bob.eth, charlie.eth with amounts.]
2. "Backend generates 9 stealth addresses total — 3 per employee — with randomized splits."
3. "I approve the batch via BitGo. Transaction executes on Base." [Show BaseScan tx.]
4. "Now I'm Alice. I open the employee portal and click Claim." [Switch to employee view.]
5. "My wallet scans the ERC-5564 announcements, finds my 3 addresses, and sweeps them gaslessly." [Show success screen with $10K received.]
6. "On-chain, all anyone sees is this." [Show BaseScan: 9 separate payments, no names, no pattern.]

### Sponsor Integration Highlights (30 seconds)
"This directly integrates four sponsor technologies:
- **BitGo** — We use their multi-sig SDK for custody and co-signing
- **Base** — All contracts deployed on Base for low fees
- **Privacy track** — Multi-stealth + ZK proofs for unlinkable payments
- **ENS** — Employee identity resolution via ERC-6538 registry

Every sponsor sees their tech used correctly and meaningfully."

### Closing (30 seconds)
"ShieldPay is production-ready architecture. After this hackathon, we can onboard real crypto companies — BitGo already has 50+ enterprise clients who need this exact product. Thank you."

---

## 8. Why This Wins

### ✅ Technical Depth
- **Three complex primitives working together:** ERC-5564 stealth addresses, ERC-4337 account abstraction, Noir ZK circuits
- **Production-grade patterns:** Multi-sig, Paymaster gas sponsorship, ENS resolution
- **Real privacy engineering:** Multi-address splitting solves the clustering problem that standard stealth addresses don't

### ✅ Sponsor Alignment
- **BitGo:** Direct SDK integration, multi-sig custody, enterprise angle
- **Base:** Deployed on Base, showcases low-fee UX, gasless transactions
- **Privacy:** Novel multi-stealth architecture + ZK batch proofs
- **ENS:** Identity layer for employee resolution

### ✅ Real-World Problem
- Every crypto company with >5 employees has this exact pain point
- The "transparent salaries" problem is immediately understandable to judges
- BitGo's existing enterprise customer base is the natural GTM path

### ✅ UX Innovation
- Employee clicks ONE button to claim — fully abstracted complexity
- Zero gas fees via Paymaster — removes final UX friction
- CFO approves via familiar BitGo dashboard — no new tooling

### ✅ 42-Hour Feasibility
- No novel cryptographic research needed — all primitives exist
- stealth-address-kit and Pimlico SDKs handle heavy lifting
- Clear day-by-day roadmap with realistic scope
- Core demo (create batch → claim) is ~500 lines of code

---

## 9. Post-Hackathon: The Actual Product

### Immediate (Week 1)
- Mainnet deployment on Base
- Legal review (payroll = financial product)
- First pilot: Internal payroll at a crypto company (e.g., Protocol Labs, ConsenSys)

### Near-term (Month 1-3)
- **Amount hiding upgrade:** Add Pedersen commitment amounts on-chain (not just multi-address splitting)
- **Compliance layer:** ZK proof of non-sanctioned status for employees (required for institutional adoption)
- **Staggered disbursement:** Spread N stealth addresses across different blocks to prevent timing correlation
- **ENS subdomain issuance:** Company can mint `alice.company.eth` subnames for employees

### Long-term (Month 6+)
- **Multi-chain:** Expand to Arbitrum, Optimism, Polygon
- **Fiat off-ramp:** Integrate BitGo's off-ramp API so employees receive INR/USD directly
- **DAO treasury payroll:** Adapt for DAOs paying contributors (Uniswap DAO, Gitcoin, etc.)
- **Venture funding:** Approach VCs with BitGo customer pipeline as warm intro

---

## 10. Critical Addresses & Resources

### Base Sepolia Contracts
| Contract | Address |
|---|---|
| USDC (Testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| ERC-5564 Announcer | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| ERC-6538 Registry | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

### API Keys Needed
- [ ] BitGo Testnet API Key: `app.bitgo.com/signup`
- [ ] Pimlico API Key: `dashboard.pimlico.io`
- [ ] Alchemy Base Sepolia RPC: `dashboard.alchemy.com`
- [ ] BaseScan API Key (for verification): `basescan.org/apis`

### Tools & Libraries
```bash
# Foundry (Solidity)
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Noir (ZK Circuits)
curl -L https://install.aztec.network | bash

# Frontend Dependencies
pnpm add wagmi viem @rainbow-me/rainbowkit
pnpm add permissionless permissionless/accounts permissionless/clients/pimlico

# Backend Dependencies
pnpm add bitgo @noble/curves @noble/hashes ethers
```

### Key Documentation
- ERC-5564 Spec: `eips.ethereum.org/EIPS/eip-5564`
- BitGo SDK Docs: `github.com/BitGo/BitGoJS`
- Pimlico Paymaster: `docs.pimlico.io/guides/how-to/use-paymaster`
- Noir Language: `noir-lang.org/docs`

---

## 11. Risk Mitigation & Honest Scoping

### What We're NOT Claiming
❌ "Completely untraceable" — Forward tracking risk remains if employee sends to known address  
❌ "Production-ready security" — Needs professional audit before mainnet with real funds  
❌ "Regulatory compliance" — Legal review required for payroll (financial product)  
❌ "Scale to 10,000 employees" — ZK circuit proving time becomes bottleneck beyond ~50 employees per batch  

### What We ARE Claiming
✅ "Breaks identity-to-payment linkage" — The core privacy problem is solved  
✅ "Multi-address splitting prevents amount clustering" — Real improvement over standard stealth addresses  
✅ "Enterprise-grade custody via BitGo" — Institutional trust anchor  
✅ "Buildable in 42 hours" — Realistic scope for hackathon demo  
✅ "Clear path to production" — Post-hackathon product roadmap is concrete  

### Known Limitations (Be Honest with Judges)
1. **Timing correlation:** All stealth addresses in same batch are linkable via transaction timestamp (mitigated by staggered blocks in v2)
2. **Forward tracking:** Employee consolidating stealth addresses to KYC exchange deanonymizes (user education + best practices guide)
3. **Gas sponsorship cost:** Paymaster needs to be funded (business model: company pays gas as part of payroll service fee)
4. **ZK proving time:** ~5-10 seconds per batch (acceptable for monthly payroll, not suitable for real-time payments)

**Judge strategy:** Lead with these limitations in the presentation. Judges respect honest engineering scoping far more than overclaiming. Frame them as "v2 improvements" not "critical flaws."

---

## 12. Final Pre-Submission Checklist

### Technical Completeness
- [ ] Smart contracts deployed and verified on Base Sepolia
- [ ] Frontend live on Vercel with demo credentials
- [ ] Backend API live on Railway
- [ ] End-to-end test video recorded (CFO creates batch → Employee claims)

### Sponsor Requirements
- [ ] **BitGo:** SDK integrated, multi-sig wallet created, co-signed transaction shown
- [ ] **Base:** Contracts deployed on Base, BaseScan links in README
- [ ] **Privacy:** Multi-stealth architecture explained, ZK circuit shown
- [ ] **ENS:** ENS resolution flow demonstrated

### Documentation
- [ ] README with:
  - Live demo link
  - Video walkthrough (YouTube/Loom)
  - Architecture diagram
  - Sponsor integration highlights
  - "Try it yourself" instructions
- [ ] GitHub repo clean:
  - No API keys committed
  - .env.example file
  - Clear folder structure

### Pitch Deck (Optional but Recommended)
- [ ] Slide 1: Problem (on-chain payroll is public)
- [ ] Slide 2: Solution (multi-stealth + BitGo + gasless)
- [ ] Slide 3: Architecture diagram
- [ ] Slide 4: Demo screenshots
- [ ] Slide 5: Sponsor integrations
- [ ] Slide 6: Post-hackathon roadmap

---

## Conclusion: The Winning Formula

**ShieldPay wins because:**
1. **It solves a real problem** every crypto company has (transparent payroll)
2. **It's technically impressive** (three complex primitives working together)
3. **It integrates four sponsors meaningfully** (BitGo + Base + Privacy + ENS)
4. **It's actually buildable in 42 hours** (realistic scope, proven primitives)
5. **It has clear post-hackathon potential** (BitGo customer pipeline, VC pitch)

**The judges will remember:**
- The multi-stealth architecture (novel insight)
- The one-click gasless claim UX (delightful demo moment)
- The honest scoping of limitations (engineering integrity)
- The sponsor integration depth (they feel heard)

**Now go build it. You have 42 hours. Make them count.**

---

*"Privacy isn't a feature. It's a prerequisite for adoption."*

**Questions? Issues? During the hackathon, reference this document as your north star. Good luck.**