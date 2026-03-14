// MiMC-2 algebraic hash (3 rounds, x^3 nonlinearity).
// Pure arithmetic - no black boxes, no bb version issues.
// Replace with poseidon2 in production once bb nightly stabilises.

global MIMC_C0: Field = 0x2b6f040c9184c11da84fb1f65f84ba3a;
global MIMC_C1: Field = 0x1cfc66f4c1e6d4a0e0c2a9dfe7b1c3f2;
global MIMC_C2: Field = 0x2a9dfe7b1c3f21cfc66f4c1e6d4a0e0c;

fn mimc_round(x: Field, k: Field, c: Field) -> Field {
    let t = x + k + c;
    t * t * t
}

// Hash up to 4 Field inputs into one Field output.
// Unused slots should be 0.
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

// ============================================================================
// Stealth Address Payroll Circuit
// ============================================================================
// Proves:
// 1. Stealth address derived correctly from master_secret + address_index
// 2. Commitment exists in Merkle tree
// 3. Nullifier is valid (prevents double-spend)
// 4. Amount matches claimed value
//
// Public inputs (4 fields):
//   - merkle_root: Root of Merkle tree
//   - nullifier_hash: Unique spend token
//   - stealth_address: Destination address (as Field)
//   - amount: Amount being claimed
//
// Private witnesses:
//   - master_secret: Employee's master secret
//   - address_index: Which stealth address (0, 1, 2...)
//   - claim_secret: Derived secret for this stealth
//   - claim_pubkey: Public key from claim_secret
//   - employer_nonce: Salt from company
//   - merkle_path: Sibling hashes
//   - path_indices: Left=0, Right=1 at each level
// ============================================================================

fn main(
    // Public inputs (visible on-chain)
    merkle_root:     pub Field,
    nullifier_hash:  pub Field,
    stealth_address: pub Field,
    amount:          pub Field,

    // Private witnesses (hidden)
    master_secret:   Field,
    address_index:   Field,
    claim_secret:    Field,
    claim_pubkey:    Field,
    employer_nonce:  Field,
    actual_amount:   Field,
    leaf_index:      Field,
    merkle_path:     [Field; 5],
    path_indices:    [Field; 5]
) {
    // 1. Prove stealth address derived from master_secret
    // derived_secret = h([master_secret, address_index, 0, 0])
    let derived_secret = h([master_secret, address_index, 0, 0]);
    assert(derived_secret == claim_secret, "Wrong stealth derivation");

    // 2. Prove claim_pubkey from claim_secret
    // claim_pubkey = h([claim_secret, 0, 0, 0])
    let computed_pubkey = h([claim_secret, 0, 0, 0]);
    assert(computed_pubkey == claim_pubkey, "Wrong claim pubkey");

    // 3. Prove stealth_address from claim_pubkey
    // stealth_address = h([claim_pubkey, 0, 0, 0])
    // This creates a deterministic address from the pubkey
    let computed_address = h([claim_pubkey, 0, 0, 0]);
    assert(computed_address == stealth_address, "Wrong stealth address");

    // 4. Prove commitment exists in Merkle tree
    // commitment = h([actual_amount, employer_nonce, claim_pubkey, 0])
    let commitment = h([actual_amount, employer_nonce, claim_pubkey, 0]);
    let computed_root = merkle_root_of(commitment, merkle_path, path_indices);
    assert(computed_root == merkle_root, "Not in Merkle tree");

    // 5. Prove nullifier is valid
    // nullifier_hash = h([claim_secret, leaf_index, 0, 0])
    let computed_nullifier = h([claim_secret, leaf_index, 0, 0]);
    assert(computed_nullifier == nullifier_hash, "Invalid nullifier");

    // 6. Amount consistency
    assert(actual_amount == amount, "Amount mismatch");
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

// ============================================================================
// Test: Generate values for a single stealth address
// Run with: nargo test --show-output
// ============================================================================
#[test]
fn generate_test_values() {
    let master_secret:  Field = 7;
    let address_index:  Field = 0;
    let employer_nonce: Field = 11;
    let actual_amount:  Field = 1000;
    let leaf_index:     Field = 0;

    // Derive claim_secret from master_secret and index
    let claim_secret = h([master_secret, address_index, 0, 0]);

    // Derive claim_pubkey from claim_secret
    let claim_pubkey = h([claim_secret, 0, 0, 0]);

    // Derive stealth_address from claim_pubkey
    let stealth_address = h([claim_pubkey, 0, 0, 0]);

    // Compute commitment
    let commitment = h([actual_amount, employer_nonce, claim_pubkey, 0]);

    // Compute nullifier
    let nullifier_hash = h([claim_secret, leaf_index, 0, 0]);

    // Compute Merkle root (with all-zero siblings for testing)
    let merkle_root = merkle_root_of(commitment, [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);

    std::println(f"master_secret   = {master_secret}");
    std::println(f"address_index   = {address_index}");
    std::println(f"claim_secret    = {claim_secret}");
    std::println(f"claim_pubkey    = {claim_pubkey}");
    std::println(f"stealth_address = {stealth_address}");
    std::println(f"commitment      = {commitment}");
    std::println(f"nullifier_hash  = {nullifier_hash}");
    std::println(f"merkle_root     = {merkle_root}");
}

// ============================================================================
// Test: Verify the circuit constraints pass with correct values
// ============================================================================
#[test]
fn verify_stealth_proof() {
    let master_secret:  Field = 7;
    let address_index:  Field = 0;
    let employer_nonce: Field = 11;
    let actual_amount:  Field = 1000;
    let leaf_index:     Field = 0;

    let claim_secret = h([master_secret, address_index, 0, 0]);
    let claim_pubkey = h([claim_secret, 0, 0, 0]);
    let stealth_address = h([claim_pubkey, 0, 0, 0]);
    let commitment = h([actual_amount, employer_nonce, claim_pubkey, 0]);
    let nullifier_hash = h([claim_secret, leaf_index, 0, 0]);
    let merkle_root = merkle_root_of(commitment, [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);

    // Call main with all correct values
    main(
        merkle_root,
        nullifier_hash,
        stealth_address,
        actual_amount,
        master_secret,
        address_index,
        claim_secret,
        claim_pubkey,
        employer_nonce,
        actual_amount,
        leaf_index,
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    );

    std::println(f"Verification passed!");
}
