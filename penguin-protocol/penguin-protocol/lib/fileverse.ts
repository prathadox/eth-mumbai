import { Agent } from "@fileverse/agents";
import { PinataStorageProvider } from "@fileverse/agents/storage";
import { privateKeyToAccount } from "viem/accounts";
import type { EncryptedContract } from "./encryption";

let _agent: Agent | null = null;

async function getAgent(): Promise<Agent> {
  if (_agent) return _agent;

  const storageProvider = new PinataStorageProvider({
    pinataJWT: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY!,
  });

  const account = privateKeyToAccount(process.env.SIGNER_PRIVATE_KEY as `0x${string}`);

  _agent = new Agent({
    chain: process.env.FILEVERSE_CHAIN as "gnosis" | "sepolia",
    viemAccount: account,
    pimlicoAPIKey: process.env.PIMLICO_API_KEY!,
    storageProvider,
  });

  await _agent.setupStorage("penguin-protocol");
  return _agent;
}

export async function uploadEncryptedContract(
  encryptedContract: EncryptedContract,
  metadata: { employeeEns: string; createdAt: string }
): Promise<{ fileId: string }> {
  const agent = await getAgent();

  // Fileverse stores markdown — we encode the encrypted payload as a fenced JSON block
  const content = `# Penguin Protocol — Encrypted Employment Contract

**Employee ENS:** ${metadata.employeeEns}
**Created:** ${metadata.createdAt}

\`\`\`json
${JSON.stringify(encryptedContract, null, 2)}
\`\`\`
`;

  const file = await agent.create(content);
  // fileId is a BigInt from the on-chain AddedFile event — stringify for storage
  return { fileId: String(file.fileId) };
}

export async function uploadProof(
  proofHex: string,
  meta: {
    key: string;
    employee: string;
    nullifierHash: string;
    stealthAddress: string;
    merkleRoot: string;
    amount: number;
  }
): Promise<{ fileId: string }> {
  const agent = await getAgent();
  const content = `# ShieldPay ZK Proof — ${meta.key}

**Employee:** ${meta.employee}
**Proof Key:** ${meta.key}
**Nullifier Hash:** ${meta.nullifierHash}
**Stealth Address:** ${meta.stealthAddress}
**Merkle Root:** ${meta.merkleRoot}
**Amount:** ${meta.amount} USDC

\`\`\`json
${JSON.stringify({ proofHex, nullifierHash: meta.nullifierHash, stealthAddress: meta.stealthAddress, merkleRoot: meta.merkleRoot, amount: meta.amount }, null, 2)}
\`\`\`
`;
  const file = await agent.create(content);
  return { fileId: String(file.fileId) };
}

export async function getProof(
  fileId: string
): Promise<{ proofHex: string; nullifierHash: string; stealthAddress: string; merkleRoot: string; amount: number }> {
  const agent = await getAgent();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileData = (await (agent as any).getFile(fileId)) as { contentIpfsHash: string };
  const ipfsHash = fileData.contentIpfsHash.replace("ipfs://", "");
  const gateway = process.env.PINATA_GATEWAY!.replace(/\/$/, "");
  const res = await fetch(`${gateway}/ipfs/${ipfsHash}`);
  if (!res.ok) throw new Error(`Failed to fetch proof from IPFS: ${res.status}`);
  const text = await res.text();
  const match = text.match(/```json\n([\s\S]+?)\n```/);
  if (!match) throw new Error("Could not parse proof from Fileverse file");
  return JSON.parse(match[1]);
}

export async function getEncryptedContract(fileId: string): Promise<EncryptedContract> {
  const agent = await getAgent();
  // getFile returns { portal, namespace, metadataIpfsHash, contentIpfsHash }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileData = (await (agent as any).getFile(fileId)) as {
    contentIpfsHash: string;
  };

  // contentIpfsHash is "ipfs://Qm..." — fetch actual content from gateway
  const ipfsHash = fileData.contentIpfsHash.replace("ipfs://", "");
  const gateway = process.env.PINATA_GATEWAY!.replace(/\/$/, "");
  console.log("[fileverse] fetching IPFS content:", `${gateway}/ipfs/${ipfsHash}`);
  const res = await fetch(`${gateway}/ipfs/${ipfsHash}`);
  if (!res.ok) throw new Error(`Failed to fetch from IPFS: ${res.status}`);
  const text = await res.text();

  const match = text.match(/```json\n([\s\S]+?)\n```/);
  if (!match) throw new Error("Could not parse encrypted contract from Fileverse file");

  return JSON.parse(match[1]) as EncryptedContract;
}
