import { ethers } from "ethers";

const ENS_REGISTRY_ABI = [
  "function owner(bytes32 node) view returns (address)",
  "function resolver(bytes32 node) view returns (address)",
  "function setSubnodeOwner(bytes32 node, bytes32 label, address owner) returns (bytes32)",
  "function setResolver(bytes32 node, address resolver)",
];

const RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value)",
  "function text(bytes32 node, string calldata key) view returns (string)",
  "function addr(bytes32 node) view returns (address)",
  "function setAddr(bytes32 node, address addr)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL!);
}

function getSigner() {
  return new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY!, getProvider());
}

function getRegistry(withSigner = false) {
  return new ethers.Contract(
    process.env.ENS_REGISTRY_ADDRESS!,
    ENS_REGISTRY_ABI,
    withSigner ? getSigner() : getProvider()
  );
}

// Returns the current owner of an ENS name on-chain
export async function getENSOwner(name: string): Promise<string> {
  const node = ethers.namehash(name);
  return getRegistry().owner(node);
}

// Verifies that the given wallet owns the ENS name on-chain
export async function verifyENSOwnership(
  name: string,
  walletAddress: string
): Promise<boolean> {
  const owner = await getENSOwner(name);
  return owner.toLowerCase() === walletAddress.toLowerCase();
}

// Sets the addr record on the company's ENS name to their BitGo treasury address.
// Called by our backend signer — signer must be approved operator OR this must be called
// while signer still owns the node (during setup flow before company takes ownership).
// In our flow: company owns their ENS already, so we call setAddr via the resolver
// using the company's own signed tx (frontend) — backend signer only writes text records.
// This function is for backend-initiated setAddr (e.g. during onboarding API call).
export async function setAddrRecord(
  name: string,
  targetAddress: string
): Promise<void> {
  const signer = getSigner();
  const registry = getRegistry();
  const node = ethers.namehash(name);

  const resolverAddress: string = await registry.resolver(node);
  if (resolverAddress === ethers.ZeroAddress) {
    throw new Error(`No resolver set for ${name}`);
  }

  const resolver = new ethers.Contract(resolverAddress, RESOLVER_ABI, signer);
  const tx = await resolver.setAddr(node, targetAddress);
  await tx.wait();
}

// Writes a text record to an ENS name.
// Our backend signer must be approved to write, or must own the node.
// For employee nodes: employee owns it after claiming. We cannot write text records
// to nodes we don't own — so docHash is written during contract creation BEFORE
// employee takes ownership, or employee sets it themselves from frontend.
export async function setTextRecord(
  name: string,
  key: string,
  value: string
): Promise<void> {
  const signer = getSigner();
  const registry = getRegistry();
  const node = ethers.namehash(name);

  const resolverAddress: string = await registry.resolver(node);
  if (resolverAddress === ethers.ZeroAddress) {
    throw new Error(`No resolver set for ${name}`);
  }

  const resolver = new ethers.Contract(resolverAddress, RESOLVER_ABI, signer);
  const tx = await resolver.setText(node, key, value);
  await tx.wait();
}

export async function getTextRecord(name: string, key: string): Promise<string> {
  const registry = getRegistry();
  const node = ethers.namehash(name);

  const resolverAddress: string = await registry.resolver(node);
  if (resolverAddress === ethers.ZeroAddress) return "";

  const resolver = new ethers.Contract(resolverAddress, RESOLVER_ABI, getProvider());
  try {
    return await resolver.text(node, key);
  } catch {
    return "";
  }
}
