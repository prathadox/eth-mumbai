# ShieldPay - ZK Proof Generation Guide

## Prerequisites

You need **Barretenberg (bb)** installed to generate ZK proofs.

### Step 1: Install Barretenberg

```bash
# Option A: Using cargo (recommended)
cargo install bb

# Option B: Download pre-built binary
# Visit: https://github.com/AztecProtocol/aztec-packages/releases
# Download the latest bb binary for your platform

# Verify installation
bb --version
```

---

## Step-by-Step Proof Generation

### Step 2: Navigate to Circuits Directory

```bash
eth-mumbai/circuits
```

### Step 3: Compile the Circuit (if not already done)

```bash
nargo compile
```

This creates `target/circuits.json` - the compiled circuit representation.

### Step 4: Generate Verification Key (VK)

The verification key is required for proof generation.

```bash
# Create vk directory
mkdir -p target/vk

# Generate verification key for EVM verifier
bb write_vk -b target/circuits.json -o target/vk/vk -t evm
```

**Expected output:**
```
Writing verification key for ultra_honk...
VK written to: target/vk/vk
```

### Step 5: Generate Proofs for All Users

Run the automated script:

```bash
cd /home/kshitij/CODE/pengu/eth-mumbai
npm run generate-proofs
```

This will:
1. Copy each `Prover_*.toml` to `circuits/Prover.toml`
2. Run `nargo execute` to generate witness
3. Run `bb prove` to generate the proof
4. Save results to `scripts/generated-data/proofs/`

---

## Manual Proof Generation (Per User)

If you want to generate proofs manually for each user:

### Alice's Proof (Stealth #0)

```bash
cd /home/kshitij/CODE/pengu/eth-mumbai/circuits

# 1. Copy Alice's Prover.toml
cp scripts/generated-data/provers/Prover_alice_stealth0.toml Prover.toml

# 2. Generate witness
nargo execute

# 3. Generate proof
mkdir -p target/alice_stealth0
bb prove -b target/circuits.json -w target/circuits.gz -o target/alice_stealth0/proof -t evm

# 4. Verify the proof (optional)
bb verify -k target/vk/vk -p target/alice_stealth0/proof
```

### Bob's Proofs (Stealth #0, #1)

```bash
# Bob Stealth #0
cp scripts/generated-data/provers/Prover_bob_stealth0.toml Prover.toml
nargo execute
mkdir -p target/bob_stealth0
bb prove -b target/circuits.json -w target/circuits.gz -o target/bob_stealth0/proof -t evm

# Bob Stealth #1
cp scripts/generated-data/provers/Prover_bob_stealth1.toml Prover.toml
nargo execute
mkdir -p target/bob_stealth1
bb prove -b target/circuits.json -w target/circuits.gz -o target/bob_stealth1/proof -t evm
```

### Carol's Proofs (Stealth #0, #1, #2)

```bash
# Carol Stealth #0
cp scripts/generated-data/provers/Prover_carol_stealth0.toml Prover.toml
nargo execute
mkdir -p target/carol_stealth0
bb prove -b target/circuits.json -w target/circuits.gz -o target/carol_stealth0/proof -t evm

# Carol Stealth #1
cp scripts/generated-data/provers/Prover_carol_stealth1.toml Prover.toml
nargo execute
mkdir -p target/carol_stealth1
bb prove -b target/circuits.json -w target/circuits.gz -o target/carol_stealth1/proof -t evm

# Carol Stealth #2
cp scripts/generated-data/provers/Prover_carol_stealth2.toml Prover.toml
nargo execute
mkdir -p target/carol_stealth2
bb prove -b target/circuits.json -w target/circuits.gz -o target/carol_stealth2/proof -t evm
```

---

## Update JSON with Proof Paths

After generating all proofs, update the JSON files:

### Option A: Re-run the script (recommended)

```bash
npm run generate-proofs
```

This automatically updates:
- `scripts/generated-data/proofs/proof-summary.json`
- `scripts/generated-data/proofs/proof-index.json`

### Option B: Manual Update

If proofs are in `circuits/target/<user>_stealth<N>/proof`, the script will automatically pick them up.

---

## Verify Proofs

### Verify Individual Proof

```bash
cd circuits
bb verify -k target/vk/vk -p target/alice_stealth0/proof
```

**Expected output:**
```
Proof verified successfully
```

### Verify with Public Inputs

Create a public inputs file for verification:

```bash
# For Alice
cat > target/alice_stealth0/public_inputs.json << 'EOF'
{
  "merkle_root": "0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7",
  "nullifier_hash": "0x045ac9eee2894825af45760bd85cb6a1f61f75c0566ffb48ec7e94dd854b5db9",
  "stealth_address": "0x2c33787f2e3f1ac4590fcb55d465a1f5e2e005426f3f9a5ab78201cd9051f6ee",
  "amount": "1000"
}
EOF

# Verify with public inputs
bb verify -k target/vk/vk -p target/alice_stealth0/proof -i target/alice_stealth0/public_inputs.json
```

---

## Final Output Structure

After successful proof generation:

```
circuits/target/
├── vk/
│   └── vk                    # Verification key (for Solidity verifier)
├── alice_stealth0/
│   ├── proof                 # ZK proof bytes
│   ├── witness.gz            # Witness file
│   └── circuit.json          # Circuit representation
├── bob_stealth0/
│   └── proof
├── bob_stealth1/
│   └── proof
├── carol_stealth0/
│   └── proof
├── carol_stealth1/
│   └── proof
└── carol_stealth2/
    └── proof

scripts/generated-data/proofs/
├── proof-summary.json        # Detailed results
└── proof-index.json          # Quick lookup
```

---

## Troubleshooting

### Error: "Unable to open file: ./target/vk"

**Solution:** Generate the verification key first:
```bash
mkdir -p target/vk
bb write_vk -b target/circuits.json -o target/vk/vk -t evm
```

### Error: "Cannot find module 'circuits.json'"

**Solution:** Run `nargo compile` first:
```bash
nargo compile
```

### Error: "bb: command not found"

**Solution:** Install bb:
```bash
cargo install bb
# Or download from GitHub releases
```

### Error: "Proof verification failed"

**Solution:** Check that:
1. Prover.toml values are correct
2. Circuit was compiled after last modification
3. VK matches the circuit

---

## Quick Reference: All Commands

```bash
# Setup
cd /home/kshitij/CODE/pengu/eth-mumbai/circuits
nargo compile
mkdir -p target/vk
bb write_vk -b target/circuits.json -o target/vk/vk -t evm

# Generate all proofs automatically
cd ..
npm run generate-proofs

# Or generate manually (repeat for each user)
cp scripts/generated-data/provers/Prover_alice_stealth0.toml Prover.toml
nargo execute
bb prove -b target/circuits.json -w target/circuits.gz -o target/alice_stealth0/proof -t evm
bb verify -k target/vk/vk -p target/alice_stealth0/proof
```

---

## Next Steps After Proof Generation

1. **Deploy contracts:**
   ```bash
   cd contracts
   forge create --rpc-url <URL> --private-key <KEY> src/ShieldVault.sol:ShieldVault \
     --constructor-args <USDC_ADDRESS> <VERIFIER_ADDRESS>
   ```

2. **Fund vault with depositBatch:**
   ```bash
   forge script script/DemoStealth.s.sol --rpc-url <URL> --private-key <KEY> --broadcast
   ```

3. **Withdraw using proofs:**
   ```bash
   # Use the proof bytes from target/<user>_stealth<N>/proof
   # Call withdrawToStealth() with proof + public inputs
   ```

---

## Contact

For issues, check:
- Noir docs: https://noir-lang.org/docs/
- Barretenberg docs: https://docs.aztec.network/
