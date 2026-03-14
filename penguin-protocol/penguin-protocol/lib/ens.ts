import { ethers } from "ethers";

const ENS_REGISTRY_ABI = [
  "function owner(bytes32 node) view returns (address)",
  "function setSubnodeOwner(bytes32 node, bytes32 label, address owner) returns (bytes32)",
  "function setRecord(bytes32 node, address owner, address resolver, uint64 ttl)",
  "function setResolver(bytes32 node, address resolver)",
  "function resolver(bytes32 node) view returns (address)",
];

const RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value)",
  "function text(bytes32 node, string calldata key) view returns (string)",
  "function addr(bytes32 node) view returns (address)",
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

export async function getENSOwner(name: string): Promise<string> {
  const node = ethers.namehash(name);
  return getRegistry().owner(node);
}

// Issues a company ENS under our root domain.
// e.g. issueCompanyENS("acme", "0xCompanyWallet") → acme.penguin.eth
//
// Our signer creates the subdomain, sets the resolver, then TRANSFERS ownership
// to the company wallet. The company then owns acme.penguin.eth and can call
// setSubnodeOwner themselves to issue alice.acme.penguin.eth for employees.
export async function issueCompanyENS(
  slug: string,
  companyWallet: string
): Promise<string> {
  const signer = getSigner();
  const registry = getRegistry(true);
  const signerAddress = await signer.getAddress();
  const root = process.env.ENS_ROOT_DOMAIN!;

  const parentNode = ethers.namehash(root);
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes(slug));
  const subnode = ethers.namehash(`${slug}.${root}`);

  // Claim as signer first so we can call setResolver
  const tx1 = await registry.setSubnodeOwner(parentNode, labelHash, signerAddress);
  await tx1.wait();

  // Set public resolver so text records work
  const tx2 = await registry.setResolver(subnode, process.env.ENS_PUBLIC_RESOLVER_ADDRESS!);
  await tx2.wait();

  // Transfer ownership to the company wallet — they now control this node
  // and can create employee subdomains from it via their own wallet
  const tx3 = await registry.setSubnodeOwner(parentNode, labelHash, companyWallet);
  await tx3.wait();

  return `${slug}.${root}`;
}

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
  return resolver.text(node, key);
}
