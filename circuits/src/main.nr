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

fn main(
    merkle_root:    pub Field,
    nullifier_hash: pub Field,
    recipient:      pub Field,
    amount:         pub Field,

    claim_secret:   Field,
    claim_pubkey:   Field,
    employer_nonce: Field,
    actual_amount:  Field,
    leaf_index:     Field,
    merkle_path:    [Field; 5],
    path_indices:   [Field; 5]
) {
    assert(h([claim_secret, 0, 0, 0]) == claim_pubkey,              "Wrong claim secret");

    let commitment    = h([actual_amount, employer_nonce, claim_pubkey, 0]);
    let computed_root = merkle_root_of(commitment, merkle_path, path_indices);
    assert(computed_root == merkle_root,                             "Not in Merkle tree");

    assert(h([claim_secret, leaf_index, 0, 0]) == nullifier_hash,   "Invalid nullifier");
    assert(actual_amount == amount,                                  "Amount mismatch");

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

#[test]
fn generate_test_values() {
    let claim_secret:   Field = 7;
    let employer_nonce: Field = 11;
    let actual_amount:  Field = 10000;
    let leaf_index:     Field = 0;

    let claim_pubkey   = h([claim_secret, 0, 0, 0]);
    let commitment     = h([actual_amount, employer_nonce, claim_pubkey, 0]);
    let nullifier_hash = h([claim_secret, leaf_index, 0, 0]);
    let merkle_root    = merkle_root_of(commitment, [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]);

    std::println(f"claim_pubkey   = {claim_pubkey}");
    std::println(f"commitment     = {commitment}");
    std::println(f"nullifier_hash = {nullifier_hash}");
    std::println(f"merkle_root    = {merkle_root}");
}
