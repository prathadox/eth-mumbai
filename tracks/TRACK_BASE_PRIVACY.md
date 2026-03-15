# Track: Base — Private Transaction Rails

Shielded stablecoin payments on Base Sepolia. Deposits are blinded commitments. Withdrawals go to stealth addresses via ZK proof. No on-chain link between payer and payee.

---

## The Problem

Sending USDC directly from a company wallet to an employee wallet is a public broadcast: sender, receiver, and amount are visible to anyone. For payroll this is worse than a data breach — it's permanent and immutable.

The fix isn't mixing or hopping through intermediaries. It requires a cryptographic construction where the link between deposit and withdrawal is computationally impossible to recover without the employee's secret.

---

## The Construction

**ShieldVault** is deployed on Base Sepolia. It holds USDC and maintains an incremental Merkle tree (depth 5, up to 32 leaves) using MiMC hashes over the BN254 scalar field.

### Deposit (company side)

The company calls `depositBatch(bytes32[] commitments, uint256[] amounts)`. For each employee, the commitment is:

```
commitment = MiMC(amount, employer_nonce, claim_pubkey, 0)
```

where `claim_pubkey` is derived from the employee's master secret — a value only the employee knows. The commitment is inserted as a Merkle leaf. USDC is transferred in. No employee address appears on-chain.

### Withdrawal (employee side)

The employee locally derives their stealth address through a 3-hop MiMC chain:

```
claim_secret   = MiMC(master_secret, address_index, 0, 0)
claim_pubkey   = MiMC(claim_secret, 0, 0, 0)
stealth_address = MiMC(claim_pubkey, 0, 0, 0)  → truncated to 20 bytes
```

They generate a ZK proof (Noir circuit, Barretenberg UltraHonk backend) asserting:
- Their commitment exists in a known Merkle root (`merkle_root` is a public input)
- The nullifier `MiMC(claim_secret, leaf_index, 0, 0)` hasn't been spent
- The stealth address is correctly derived from their private secret
- The amount matches the commitment

The contract calls the on-chain `HonkVerifier`, checks the nullifier hasn't been spent, and transfers USDC to the stealth address. The nullifier is marked spent.

### What an observer sees

```
ShieldVault.depositBatch(commitments=[0xabc..., 0xdef...], amounts=[1000, 1000])
ShieldVault.withdrawToStealth(proof=...) → transfer USDC to 0x73f...
ShieldVault.withdrawToStealth(proof=...) → transfer USDC to 0x91e...
```

The deposit has no employee addresses. The stealth addresses receiving USDC have no transaction history and no link to any ENS name or primary wallet.

---

## ZK Circuit

Written in Noir. Compiled with `nargo`. Proofs generated with Barretenberg CLI (`bb prove`). Verifier contract generated with `bb write_solidity_verifier` and deployed to Base Sepolia.

The MiMC hash constants are hardcoded identically in the Noir circuit and the Solidity contract — no trusted setup, no black-box operations, fully auditable hash primitive.

---

## Deployed (Base Sepolia)

| Contract | Address |
|---|---|
| MockUSDC | `0x231E63e5E40E208D7570aaD33eF8a045d8EA4A3d` |
| HonkVerifier | `0xDA559F68d4D001E34a6ccDD55B2975E3eaD8d79B` |
| ShieldVault | `0x367707c3710514B196Bcf6bafE11977e264aa223` |

---

## Properties

| Property | Mechanism |
|---|---|
| Deposit hides recipient | Commitment = MiMC hash, no address on-chain |
| Withdrawal hides origin | Merkle proof, any valid leaf could be the spender |
| Double-spend prevention | Nullifier hash stored on-chain after first use |
| Amount privacy at rest | Commitment encodes amount, not visible without secret |
| Stealth address unlinkability | 3-hop MiMC derivation from master secret |

---

## Stack

Noir · Barretenberg UltraHonk · Solidity/Foundry · MiMC (BN254) · Base Sepolia · Viem · RainbowKit
