/**
 * Stealth Address Generator for ShieldPay
 *
 * Generates deterministic stealth addresses for employees based on their master secret.
 * Mirrors the MiMC hash function from circuits/src/main.nr exactly.
 *
 * Usage: npx tsx scripts/generate-stealth-data.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// MiMC-2 Implementation (matches circuits/src/main.nr exactly)
// ============================================================================

const MIMC_C0 = BigInt('0x2b6f040c9184c11da84fb1f65f84ba3a');
const MIMC_C1 = BigInt('0x1cfc66f4c1e6d4a0e0c2a9dfe7b1c3f2');
const MIMC_C2 = BigInt('0x2a9dfe7b1c3f21cfc66f4c1e6d4a0e0c');
const BN254_P = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function addmod(a: bigint, b: bigint, m: bigint): bigint {
    return (a + b) % m;
}

function mulmod(a: bigint, b: bigint, m: bigint): bigint {
    return (a * b) % m;
}

function mimcRound(x: bigint, k: bigint, c: bigint): bigint {
    const t = addmod(addmod(x, k, BN254_P), c, BN254_P);
    return mulmod(mulmod(t, t, BN254_P), t, BN254_P);
}

/**
 * MiMC hash of 4 Field elements - mirrors h([a,b,c,d]) in Noir
 */
function mimcHash(inputs: bigint[]): bigint {
    if (inputs.length > 4) {
        throw new Error('inputs must be <= 4 elements');
    }

    // Pad to 4 elements
    while (inputs.length < 4) {
        inputs.push(0n);
    }

    let state = 0n;
    for (let i = 0; i < 4; i++) {
        const t = addmod(state, inputs[i], BN254_P);
        state = mimcRound(t, MIMC_C0, MIMC_C1);
        state = mimcRound(state, MIMC_C1, MIMC_C2);
        state = mimcRound(state, MIMC_C2, MIMC_C0);
    }
    return state;
}

/**
 * Convenience: h([a, b, 0, 0])
 */
function mimcHash2(a: bigint, b: bigint): bigint {
    return mimcHash([a, b, 0n, 0n]);
}

/**
 * Convenience: h([a, b, c, 0])
 */
function mimcHash3(a: bigint, b: bigint, c: bigint): bigint {
    return mimcHash([a, b, c, 0n]);
}

/**
 * Convenience: h([a, b, c, d])
 */
function mimcHash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
    return mimcHash([a, b, c, d]);
}

// ============================================================================
// Merkle Tree Utilities
// ============================================================================

function merkleRootOf(leaf: bigint, siblings: bigint[], indices: bigint[]): bigint {
    if (siblings.length !== 5 || indices.length !== 5) {
        throw new Error('Merkle path must have 5 elements (TREE_DEPTH=5)');
    }

    let cur = leaf;
    for (let i = 0; i < 5; i++) {
        if (indices[i] !== 0n && indices[i] !== 1n) {
            throw new Error('index must be 0 or 1');
        }
        let left: bigint, right: bigint;
        if (indices[i] === 0n) {
            left = cur;
            right = siblings[i];
        } else {
            left = siblings[i];
            right = cur;
        }
        cur = mimcHash2(left, right);
    }
    return cur;
}

function computeMerkleRoot(leaves: bigint[]): { root: bigint; proofs: MerkleProof[] } {
    const TREE_DEPTH = 5;
    const CAPACITY = 2 ** TREE_DEPTH; // 32

    // Pad leaves to capacity
    while (leaves.length < CAPACITY) {
        leaves.push(0n);
    }

    // Build tree level by level
    const levels: bigint[][] = [leaves];

    let currentLevel = leaves;
    while (currentLevel.length > 1) {
        const nextLevel: bigint[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            nextLevel.push(mimcHash2(currentLevel[i], currentLevel[i + 1]));
        }
        levels.push(nextLevel);
        currentLevel = nextLevel;
    }

    const root = levels[levels.length - 1][0];

    // Generate proofs for original (non-padded) leaves
    const proofs: MerkleProof[] = [];
    for (let i = 0; i < leaves.length / 2; i++) { // Only first half are real (before padding to 32)
        // Actually we want proofs for indices 0-5 (our 6 stealth addresses)
    }

    return { root, proofs: [] }; // We'll compute proofs differently
}

function getMerkleProof(leaves: bigint[], leafIndex: number): {
    root: bigint;
    proof: bigint[];
    pathIndices: bigint[]
} {
    const TREE_DEPTH = 5;
    const CAPACITY = 2 ** TREE_DEPTH; // 32

    // Pad leaves to capacity with zeros
    const paddedLeaves = [...leaves];
    while (paddedLeaves.length < CAPACITY) {
        paddedLeaves.push(0n);
    }

    // Build tree and collect siblings
    const siblings: bigint[] = [];
    const pathIndices: bigint[] = [];

    let index = leafIndex;
    let currentLevel = paddedLeaves;

    for (let level = 0; level < TREE_DEPTH; level++) {
        const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
        siblings.push(currentLevel[siblingIndex]);
        pathIndices.push(index % 2 === 0 ? 0n : 1n);

        // Build next level
        const nextLevel: bigint[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            nextLevel.push(mimcHash2(currentLevel[i], currentLevel[i + 1]));
        }
        currentLevel = nextLevel;
        index = Math.floor(index / 2);
    }

    const root = currentLevel[0];

    return { root, proof: siblings, pathIndices };
}

// ============================================================================
// Types
// ============================================================================

interface StealthAddress {
    index: number;
    address: string;
    secret: string;
    pubkey: string;
    commitment: string;
    nullifier: string;
    merkleProof: string[];
    pathIndices: string[];
    merkleRoot: string;
    leafIndex: number;
}

interface MerkleProof {
    proof: bigint[];
    pathIndices: bigint[];
    root: bigint;
}

interface Employee {
    name: string;
    masterSecret: bigint;
    totalSalary: number;
    numStealth: number;
    stealthAddresses: StealthAddress[];
}

interface DemoData {
    employees: Employee[];
    allCommitments: bigint[];
    merkleRoot: bigint;
}

// ============================================================================
// Stealth Address Derivation (matches circuit exactly)
// ============================================================================

/**
 * Derive stealth addresses for an employee
 *
 * Circuit derivation:
 *   claim_secret  = h([master_secret, address_index, 0, 0])
 *   claim_pubkey  = h([claim_secret, 0, 0, 0])
 *   stealth_addr  = h([claim_pubkey, 0, 0, 0])
 */
function deriveStealthAddresses(
    masterSecret: bigint,
    totalSalary: number,
    denom: number = 1000
): Omit<StealthAddress, 'commitment' | 'nullifier' | 'merkleProof' | 'pathIndices' | 'merkleRoot' | 'leafIndex'>[] {
    const numAddresses = totalSalary / denom;
    const addresses: Omit<StealthAddress, 'commitment' | 'nullifier' | 'merkleProof' | 'pathIndices' | 'merkleRoot' | 'leafIndex'>[] = [];

    for (let i = 0; i < numAddresses; i++) {
        // Derive claim_secret = h([master_secret, address_index, 0, 0])
        const claimSecret = mimcHash([masterSecret, BigInt(i), 0n, 0n]);

        // Derive claim_pubkey = h([claim_secret, 0, 0, 0])
        const claimPubkey = mimcHash([claimSecret, 0n, 0n, 0n]);

        // Derive stealth_address = h([claim_pubkey, 0, 0, 0])
        const stealthAddress = mimcHash([claimPubkey, 0n, 0n, 0n]);

        addresses.push({
            index: i,
            address: '0x' + stealthAddress.toString(16).padStart(64, '0'),
            secret: '0x' + claimSecret.toString(16).padStart(64, '0'),
            pubkey: '0x' + claimPubkey.toString(16).padStart(64, '0'),
        });
    }

    return addresses;
}

/**
 * Compute commitment = h([amount, employer_nonce, claim_pubkey, 0])
 */
function computeCommitment(amount: bigint, employerNonce: bigint, claimPubkey: bigint): bigint {
    return mimcHash([amount, employerNonce, claimPubkey, 0n]);
}

/**
 * Compute nullifier = h([claim_secret, leaf_index, 0, 0])
 */
function computeNullifier(claimSecret: bigint, leafIndex: bigint): bigint {
    return mimcHash([claimSecret, leafIndex, 0n, 0n]);
}

// ============================================================================
// Prover.toml Generation
// ============================================================================

function generateProverToml(params: {
    merkleRoot: bigint;
    nullifierHash: bigint;
    stealthAddress: bigint;
    amount: bigint;
    masterSecret: bigint;
    addressIndex: bigint;
    claimSecret: bigint;
    claimPubkey: bigint;
    employerNonce: bigint;
    actualAmount: bigint;
    leafIndex: bigint;
    merklePath: bigint[];
    pathIndices: bigint[];
}): string {
    return `merkle_root     = "0x${params.merkleRoot.toString(16).padStart(64, '0')}"
nullifier_hash  = "0x${params.nullifierHash.toString(16).padStart(64, '0')}"
stealth_address = "0x${params.stealthAddress.toString(16).padStart(64, '0')}"
amount          = "${params.amount}"

master_secret   = "${params.masterSecret}"
address_index   = "${params.addressIndex}"
claim_secret    = "${params.claimSecret}"
claim_pubkey    = "${params.claimPubkey}"
employer_nonce  = "${params.employerNonce}"
actual_amount   = "${params.actualAmount}"
leaf_index      = "${params.leafIndex}"
merkle_path     = [${params.merklePath.map(p => `"${p}"`).join(', ')}]
path_indices    = [${params.pathIndices.map(p => `"${p}"`).join(', ')}]
`;
}

// ============================================================================
// Main: Generate demo data for Alice ($1k), Bob ($2k), Carol ($3k)
// ============================================================================

function main() {
    console.log('=== ShieldPay Stealth Address Generator ===\n');

    // Employee master secrets (in production, these are randomly generated and encrypted)
    const employees: Array<{ name: string; masterSecret: bigint; totalSalary: number }> = [
        { name: 'Alice', masterSecret: 7n, totalSalary: 1000 },   // 1 stealth address
        { name: 'Bob', masterSecret: 42n, totalSalary: 2000 },    // 2 stealth addresses
        { name: 'Carol', masterSecret: 99n, totalSalary: 3000 },  // 3 stealth addresses
    ];

    // Common employer nonce (salt from company - in production unique per payment)
    const EMPLOYER_NONCE = 1000n;
    const AMOUNT_PER_STEALTH = 1000n;

    // Step 1: Generate stealth addresses for all employees
    console.log('Step 1: Generating stealth addresses...');
    const allStealthData: Array<{
        employeeName: string;
        masterSecret: bigint;
        stealth: ReturnType<typeof deriveStealthAddresses>[0];
        amount: bigint;
    }> = [];

    for (const emp of employees) {
        const addresses = deriveStealthAddresses(emp.masterSecret, emp.totalSalary, 1000);
        console.log(`  ${emp.name}: ${addresses.length} stealth address(es)`);

        for (const addr of addresses) {
            allStealthData.push({
                employeeName: emp.name,
                masterSecret: emp.masterSecret,
                stealth: addr,
                amount: AMOUNT_PER_STEALTH,
            });
        }
    }

    console.log(`  Total: ${allStealthData.length} stealth addresses\n`);

    // Step 2: Compute commitments for all stealth addresses
    console.log('Step 2: Computing commitments...');
    const commitments: bigint[] = [];

    for (const data of allStealthData) {
        const pubkey = BigInt(data.stealth.pubkey);
        const commitment = computeCommitment(data.amount, EMPLOYER_NONCE, pubkey);
        commitments.push(commitment);
        console.log(`  ${data.employeeName} #${data.stealth.index}: 0x${commitment.toString(16)}`);
    }
    console.log();

    // Step 3: Build Merkle tree and get proofs
    console.log('Step 3: Building Merkle tree...');
    const { root: merkleRoot } = computeMerkleRoot([...commitments]);

    // Get proofs for each commitment
    const proofs: Array<{ proof: bigint[]; pathIndices: bigint[]; root: bigint }> = [];
    for (let i = 0; i < commitments.length; i++) {
        const proofData = getMerkleProof([...commitments], i);
        proofs.push(proofData);
        console.log(`  Leaf ${i}: root = 0x${proofData.root.toString(16)}`);
    }
    console.log();

    // Use the final root from the last proof (all should be same)
    const finalRoot = proofs[proofs.length - 1].root;
    console.log(`Final Merkle Root: 0x${finalRoot.toString(16)}\n`);

    // Step 4: Build complete data structures
    console.log('Step 4: Building employee data structures...');

    let leafIndex = 0;
    const employeeData: Employee[] = [];
    const allProverData: Array<{ filename: string; content: string }> = [];

    for (const emp of employees) {
        const numStealth = emp.totalSalary / 1000;
        const stealthAddresses: StealthAddress[] = [];

        for (let i = 0; i < numStealth; i++) {
            const addresses = deriveStealthAddresses(emp.masterSecret, emp.totalSalary, 1000);
            const addr = addresses[i];

            const pubkey = BigInt(addr.pubkey);
            const secret = BigInt(addr.secret);
            const stealthAddr = BigInt(addr.address);

            const commitment = computeCommitment(AMOUNT_PER_STEALTH, EMPLOYER_NONCE, pubkey);
            const nullifier = computeNullifier(secret, BigInt(leafIndex));

            const proofData = proofs[leafIndex];

            stealthAddresses.push({
                index: i,
                address: addr.address,
                secret: addr.secret,
                pubkey: addr.pubkey,
                commitment: '0x' + commitment.toString(16).padStart(64, '0'),
                nullifier: '0x' + nullifier.toString(16).padStart(64, '0'),
                merkleProof: proofData.proof.map(p => '0x' + p.toString(16).padStart(64, '0')),
                pathIndices: proofData.pathIndices.map(p => '0x' + p.toString(16)),
                merkleRoot: '0x' + proofData.root.toString(16).padStart(64, '0'),
                leafIndex,
            });

            // Generate Prover.toml for this stealth address
            const proverToml = generateProverToml({
                merkleRoot: proofData.root,
                nullifierHash: nullifier,
                stealthAddress: stealthAddr,
                amount: AMOUNT_PER_STEALTH,
                masterSecret: emp.masterSecret,
                addressIndex: BigInt(i),
                claimSecret: secret,
                claimPubkey: pubkey,
                employerNonce: EMPLOYER_NONCE,
                actualAmount: AMOUNT_PER_STEALTH,
                leafIndex: BigInt(leafIndex),
                merklePath: proofData.proof,
                pathIndices: proofData.pathIndices,
            });

            allProverData.push({
                filename: `Prover_${emp.name.toLowerCase()}_stealth${i}.toml`,
                content: proverToml,
            });

            leafIndex++;
        }

        employeeData.push({
            name: emp.name,
            masterSecret: emp.masterSecret,
            totalSalary: emp.totalSalary,
            numStealth,
            stealthAddresses,
        });
    }

    console.log('  Employee data built successfully\n');

    // Step 5: Write output files
    const outputDir = join(__dirname, 'generated-data');
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON data file
    const jsonData = {
        generatedAt: new Date().toISOString(),
        employees: employeeData.map(emp => ({
            name: emp.name,
            masterSecret: emp.masterSecret.toString(),
            totalSalary: emp.totalSalary,
            numStealth: emp.numStealth,
            stealthAddresses: emp.stealthAddresses,
        })),
        globalData: {
            employerNonce: EMPLOYER_NONCE.toString(),
            amountPerStealth: AMOUNT_PER_STEALTH.toString(),
            merkleRoot: '0x' + finalRoot.toString(16).padStart(64, '0'),
            totalCommitments: commitments.length,
            commitments: commitments.map(c => '0x' + c.toString(16).padStart(64, '0')),
        },
    };

    const jsonPath = join(outputDir, 'demo-data.json');
    writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`Written: ${jsonPath}`);

    // Write Prover.toml files
    const proversDir = join(outputDir, 'provers');
    if (!existsSync(proversDir)) {
        mkdirSync(proversDir, { recursive: true });
    }

    for (const prover of allProverData) {
        const proverPath = join(proversDir, prover.filename);
        writeFileSync(proverPath, prover.content);
        console.log(`Written: ${proverPath}`);
    }

    // Write summary
    console.log('\n=== Summary ===');
    console.log(`Total employees: ${employeeData.length}`);
    console.log(`Total stealth addresses: ${leafIndex}`);
    console.log(`Merkle root: 0x${finalRoot.toString(16)}`);
    console.log(`\nFiles generated:`);
    console.log(`  - ${jsonPath} (JSON data for frontend/backend)`);
    console.log(`  - ${allProverData.length} Prover.toml files in ${proversDir}/`);

    // Print employee summary
    console.log('\n=== Employee Summary ===');
    for (const emp of employeeData) {
        console.log(`\n${emp.name}:`);
        console.log(`  Master Secret: ${emp.masterSecret}`);
        console.log(`  Total Salary: $${emp.totalSalary}`);
        console.log(`  Stealth Addresses: ${emp.numStealth}`);
        for (const stealth of emp.stealthAddresses) {
            console.log(`    [${stealth.index}] ${stealth.address.slice(0, 10)}...${stealth.address.slice(-8)}`);
            console.log(`         Commitment: ${stealth.commitment.slice(0, 10)}...${stealth.commitment.slice(-8)}`);
            console.log(`         Nullifier:  ${stealth.nullifier.slice(0, 10)}...${stealth.nullifier.slice(-8)}`);
        }
    }

    console.log('\n=== Next Steps ===');
    console.log('1. Copy Prover.toml files to circuits/ directory');
    console.log('2. Run: cd circuits && nargo execute for each prover file');
    console.log('3. Generate proofs with bb prove');
    console.log('4. Deploy contracts and test!');
}

main();
