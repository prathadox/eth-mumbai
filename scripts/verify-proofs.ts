/**
 * Proof Verification Script for ShieldPay
 *
 * Usage: npx tsx scripts/verify-proofs.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CIRCUITS_DIR = join(__dirname, '..', 'circuits');
const TARGET_DIR = join(CIRCUITS_DIR, 'target');
const VK_PATH = join(TARGET_DIR, 'vk', 'vk', 'vk');

const PROOFS = [
    'alice_stealth0',
    'bob_stealth0',
    'bob_stealth1',
    'carol_stealth0',
    'carol_stealth1',
    'carol_stealth2',
];

function runCommand(command: string, cwd?: string): string {
    return execSync(command, {
        cwd: cwd || CIRCUITS_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

async function verifyProofs() {
    console.log('=== ShieldPay Proof Verifier ===\n');

    if (!existsSync(VK_PATH)) {
        console.error(`VK not found at: ${VK_PATH}`);
        console.error('Run: bb write_vk -b circuits/target/circuits.json -o circuits/target/vk -t evm');
        process.exit(1);
    }

    let passed = 0;
    let failed = 0;

    for (const key of PROOFS) {
        const proofDir = join(TARGET_DIR, key);
        const proofFile = join(proofDir, 'proof');
        const publicInputs = join(proofDir, 'public_inputs');

        process.stdout.write(`  Verifying ${key}... `);

        if (!existsSync(proofFile) || !existsSync(publicInputs)) {
            console.log('SKIP (proof not found)');
            failed++;
            continue;
        }

        try {
            runCommand(
                `bb verify -k ${VK_PATH} -p ${proofFile} -i ${publicInputs} -t evm`,
                CIRCUITS_DIR
            );
            console.log('PASS ✓');
            passed++;
        } catch (err: unknown) {
            const e = err as { stderr?: string };
            console.log('FAIL ✗');
            if (e.stderr) console.error(`    ${e.stderr.trim()}`);
            failed++;
        }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

verifyProofs().catch(console.error);
