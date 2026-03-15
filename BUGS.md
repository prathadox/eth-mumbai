# Bugs & Hurdles

---

## 1. ENS NameWrapper: `owner()` never returns your wallet

Every `.eth` name registered via the ENS app since 2023 is "wrapped". The ENS Registry's `owner(node)` returns the NameWrapper contract, not your wallet. Our login check was calling `registry.owner(namehash(name))` — it always failed.

Fix: check `NameWrapper.ownerOf(uint256(namehash(name)))` for wrapped names. Same issue hit subdomain creation — `registry.setSubnodeOwner` is a no-op on wrapped names. Switched to `NameWrapper.setSubnodeRecord(parentNode, stringLabel, owner, resolver, fuses, expiry)`. Also had to add an explicit `gas: BigInt(300_000)` because viem's estimator returned 21M gas (network cap is 25M, but the estimate was wrong).

---

## 2. MiMC constants identical in code, different outputs on-chain

The ZK circuit (Noir) and the Solidity contract both implement MiMC hash. Constants were copy-pasted — byte identical. Proofs passed locally but `verifier.verify()` always returned false on-chain.

Root cause: the Noir `h([a, b, 0, 0])` function runs **3 rounds per input** (12 rounds total). An early Solidity version ran **1 round per input** (4 rounds total). The loop body looked similar, just missing two lines. Merkle roots computed by the contract and by the circuit diverged completely.

Fix: wrote a Foundry test that printed intermediate values, ran `nargo test --show-output` to get the Noir equivalents, diffed step by step until both matched.

---

## 3. SIWE chainId locked auth to one chain, txns needed the other

ENS is on Sepolia. ShieldVault is on Base Sepolia. SIWE embeds `chainId` in the signed message. When the wallet was on Base Sepolia, auth rejected because the backend expected Sepolia's chain ID. When it was on Sepolia, vault transactions failed because the wrong network was active.

Fix: removed `chainId` enforcement from SIWE verification — the domain, nonce, and timestamp are sufficient for replay protection. Auth is about wallet identity, not network. Both chains are always in the Wagmi config; the frontend calls `switchChainAsync({ chainId: baseSepolia.id })` before any vault transaction without triggering re-auth.

---

## 4. Contract decryption: can't ask users to paste private keys

Employment contracts are encrypted with ECIES. The obvious path is "user pastes their private key to decrypt". That's not acceptable.

Fix: deterministic key derivation from a wallet signature. The employee signs a fixed domain-scoped message (`penguin-protocol:decrypt:<address>`), the signature bytes are hashed with keccak256, and that 32-byte value is used as key material for AES-256-GCM via Web Crypto API. Same wallet, same key, every time. Nothing stored, nothing transmitted.

---

## 5. `depositBatch` gas estimate: 131M, block limit: 25M

`ShieldVault.depositBatch` inserts leaves into a MiMC Merkle tree. Viem estimated 131,250,000 gas for 6 leaves. Base Sepolia's limit is 25M. Transaction rejected before hitting the mempool.

Fix: `gasLimit: 8_000_000` explicitly on the call. Actual cost on-chain was ~4.2M. Viem's simulation diverged from actual execution because the tree state at simulation time didn't match the real state.

---

## 6. Fileverse `fileId` is a `BigInt`, `JSON.stringify` throws

`agent.create()` returns `fileId` as a JavaScript `BigInt` (from an on-chain event). Passing it to `JSON.stringify` or Supabase directly throws `TypeError: Do not know how to serialize a BigInt`. Contracts were being stored with `fileverse_file_id: null`.

Fix: `String(file.fileId)` before any serialization or DB write. One line, half a day lost.
