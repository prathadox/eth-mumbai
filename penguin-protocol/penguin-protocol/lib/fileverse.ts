import { Agent } from "@fileverse/agents";
import { PinataStorageProvider } from "@fileverse/agents/storage";
import { privateKeyToAccount } from "viem/accounts";
import type { EncryptedContract } from "./encryption";

let _agent: Agent | null = null;

async function getAgent(): Promise<Agent> {
  if (_agent) return _agent;

  const storageProvider = new PinataStorageProvider({
    jwt: process.env.PINATA_JWT!,
    gateway: process.env.PINATA_GATEWAY!,
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
  return { fileId: file.fileId as string };
}

export async function getEncryptedContract(fileId: string): Promise<EncryptedContract> {
  const agent = await getAgent();
  const fileData = await agent.getFile(fileId);

  // Extract JSON block from markdown
  const match = (fileData as string).match(/```json\n([\s\S]+?)\n```/);
  if (!match) throw new Error("Could not parse encrypted contract from Fileverse file");

  return JSON.parse(match[1]) as EncryptedContract;
}
