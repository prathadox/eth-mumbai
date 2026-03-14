/**
 * Solidity Verifier Contract Generator for ShieldPay
 *
 * Usage: npx tsx scripts/generate-verifier.ts
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CIRCUITS_DIR = join(__dirname, '..', 'circuits');
const TARGET_DIR = join(CIRCUITS_DIR, 'target');
const VK_PATH = join(TARGET_DIR, 'vk', 'vk', 'vk');
const CONTRACTS_DIR = join(__dirname, '..', 'contracts', 'src');
const OUTPUT_PATH = join(CONTRACTS_DIR, 'Verifier.sol');

function runCommand(command: string, cwd?: string): string {
    console.log(`  Running: ${command}`);
    return execSync(command, {
        cwd: cwd || CIRCUITS_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

async function generateVerifier() {
    console.log('=== ShieldPay Verifier Contract Generator ===\n');

    if (!existsSync(VK_PATH)) {
        console.error(`VK not found at: ${VK_PATH}`);
        console.error('Run: npx tsx scripts/generate-proofs.ts first to generate the VK.');
        process.exit(1);
    }

    if (!existsSync(CONTRACTS_DIR)) {
        mkdirSync(CONTRACTS_DIR, { recursive: true });
    }

    console.log(`VK: ${VK_PATH}`);
    console.log(`Output: ${OUTPUT_PATH}\n`);

    try {
        runCommand(
            `bb write_solidity_verifier -k ${VK_PATH} -o ${OUTPUT_PATH} -t evm --optimized`,
            CIRCUITS_DIR
        );
        console.log(`\nVerifier contract written to: ${OUTPUT_PATH}`);
    } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string };
        console.error('Failed to generate verifier:');
        if (e.stderr) console.error(e.stderr);
        if (e.stdout) console.error(e.stdout);
        process.exit(1);
    }
}

generateVerifier().catch(console.error);
