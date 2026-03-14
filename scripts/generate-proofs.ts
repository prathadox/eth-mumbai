/**
 * Proof Generation Script for ShieldPay
 *
 * Usage: npx tsx scripts/generate-proofs.ts
 */

import { execSync } from 'child_process';
import {
    readFileSync,
    writeFileSync,
    copyFileSync,
    mkdirSync,
    existsSync
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CIRCUITS_DIR = join(__dirname, '..', 'circuits');
const GENERATED_DATA_DIR = join(__dirname, 'generated-data');
const PROVERS_DIR = join(GENERATED_DATA_DIR, 'provers');
const OUTPUT_DIR = join(GENERATED_DATA_DIR, 'proofs');
const TARGET_DIR = join(CIRCUITS_DIR, 'target');

function runCommand(command: string, cwd?: string): string {
    console.log(`  Running: ${command}`);
    try {
        return execSync(command, {
            cwd: cwd || CIRCUITS_DIR,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } catch (error: unknown) {
        const err = error as { stderr?: string; stdout?: string };
        console.error('Command failed:');
        if (err.stderr) console.error(err.stderr.toString());
        if (err.stdout) console.error(err.stdout.toString());
        throw error;
    }
}

interface ProofResult {
    employee: string;
    stealthIndex: number;
    proverFile: string;
    proofPath: string;
    publicInputs: {
        merkleRoot: string;
        nullifierHash: string;
        stealthAddress: string;
        amount: string;
    };
    success: boolean;
    error?: string;
}

async function generateProofs(): Promise<void> {
    console.log('=== ShieldPay Proof Generator ===\n');

    if (!existsSync(PROVERS_DIR)) {
        throw new Error(`Provers directory not found: ${PROVERS_DIR}`);
    }

    const { readdir } = await import('fs/promises');
    const proverFiles = await readdir(PROVERS_DIR).then(
        files => files.filter(f => f.endsWith('.toml')).sort()
    );

    console.log(`Found ${proverFiles.length} Prover.toml files\n`);

    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    if (!existsSync(TARGET_DIR)) {
        mkdirSync(TARGET_DIR, { recursive: true });
    }

    console.log('Generating proofs...\n');
    const results: ProofResult[] = [];

    for (const proverFile of proverFiles) {
        console.log(`Processing: ${proverFile}`);

        const match = proverFile.match(/Prover_(\w+)_stealth(\d+)\.toml/);
        if (!match) continue;

        const employeeName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        const stealthIndex = parseInt(match[2], 10);
        const proverSourcePath = join(PROVERS_DIR, proverFile);
        const proverDestPath = join(CIRCUITS_DIR, 'Prover.toml');
        const outputSubdir = `${employeeName.toLowerCase()}_stealth${stealthIndex}`;
        const outputSubdirPath = join(TARGET_DIR, outputSubdir);

        try {
            if (!existsSync(outputSubdirPath)) {
                mkdirSync(outputSubdirPath, { recursive: true });
            }

            copyFileSync(proverSourcePath, proverDestPath);
            console.log(`  Copied Prover.toml`);

            console.log(`  Running nargo execute...`);
            runCommand('nargo execute', CIRCUITS_DIR);

            const witnessSource = join(CIRCUITS_DIR, 'target', 'circuits.gz');
            const circuitSource = join(CIRCUITS_DIR, 'target', 'circuits.json');

            if (existsSync(witnessSource)) {
                copyFileSync(witnessSource, join(outputSubdirPath, 'witness.gz'));
            }
            if (existsSync(circuitSource)) {
                copyFileSync(circuitSource, join(outputSubdirPath, 'circuit.json'));
            }

            let proofPath = '';
            try {
                console.log(`  Running bb prove...`);
                const vkPath = join(CIRCUITS_DIR, 'target', 'vk', 'vk', 'vk');
                runCommand(
                    `bb prove -b ${join(CIRCUITS_DIR, 'target', 'circuits.json')} ` +
                    `-w ${join(CIRCUITS_DIR, 'target', 'circuits.gz')} ` +
                    `-o ${outputSubdirPath} -k ${vkPath} -t evm`,
                    CIRCUITS_DIR
                );
                proofPath = join(outputSubdirPath, 'proof');
                console.log(`  Proof generated successfully`);
            } catch (bbError) {
                console.log(`  bb prove skipped (bb may not be installed)`);
                proofPath = 'N/A (bb not available)';
            }

            const proverContent = readFileSync(proverSourcePath, 'utf-8');
            const merkleRoot = proverContent.match(/merkle_root\s*=\s*"([^"]+)"/)?.[1] || '';
            const nullifierHash = proverContent.match(/nullifier_hash\s*=\s*"([^"]+)"/)?.[1] || '';
            const stealthAddress = proverContent.match(/stealth_address\s*=\s*"([^"]+)"/)?.[1] || '';
            const amount = proverContent.match(/amount\s*=\s*"([^"]+)"/)?.[1] || '';

            results.push({
                employee: employeeName,
                stealthIndex,
                proverFile,
                proofPath,
                publicInputs: { merkleRoot, nullifierHash, stealthAddress, amount },
                success: true
            });
            console.log(`  Success!\n`);

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`  Error: ${errorMsg}\n`);
            results.push({
                employee: employeeName,
                stealthIndex,
                proverFile,
                proofPath: 'N/A',
                publicInputs: { merkleRoot: '', nullifierHash: '', stealthAddress: '', amount: '' },
                success: false,
                error: errorMsg
            });
        }
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        totalProofs: results.length,
        successfulProofs: results.filter(r => r.success).length,
        failedProofs: results.filter(r => !r.success).length,
        results
    };

    const summaryPath = join(OUTPUT_DIR, 'proof-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\nSummary written to: ${summaryPath}`);

    const proofIndex = {
        generatedAt: new Date().toISOString(),
        proofs: results.map(r => ({
            key: `${r.employee.toLowerCase()}_stealth${r.stealthIndex}`,
            employee: r.employee,
            stealthIndex: r.stealthIndex,
            proofPath: r.proofPath,
            publicInputs: r.publicInputs
        }))
    };

    const indexPath = join(OUTPUT_DIR, 'proof-index.json');
    writeFileSync(indexPath, JSON.stringify(proofIndex, null, 2));
    console.log(`Index written to: ${indexPath}`);

    console.log('\n=== Summary ===');
    console.log(`Total: ${results.length}, Successful: ${summary.successfulProofs}, Failed: ${summary.failedProofs}`);
}

generateProofs().catch(console.error);
