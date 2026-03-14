fn main(
    // PUBLIC INPUTS
    commitment: pub Field,
    nullifier: pub Field,
    amount: pub Field,

    // PRIVATE INPUTS
    secret: Field,
    nonce: Field,
    actual_amount: Field
) {

    let computed_commitment =
        std::hash::pedersen_hash([
            actual_amount,
            nonce,
            secret
        ]);

    assert(computed_commitment == commitment);

    let computed_nullifier =
        std::hash::pedersen_hash([secret]);

    assert(computed_nullifier == nullifier);

    assert(actual_amount == amount);
}

#[test]
fn generate_values() {

    let secret: Field = 7;
    let nonce: Field = 11;
    let amount: Field = 10000;

    let commitment =
        std::hash::pedersen_hash([
            amount,
            nonce,
            secret
        ]);

    let nullifier =
        std::hash::pedersen_hash([secret]);

    println(commitment);
    println(nullifier);
}