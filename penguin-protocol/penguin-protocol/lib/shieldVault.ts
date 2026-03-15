export const SHIELD_VAULT_ABI = [
  {
    name: "depositBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "commitments", type: "bytes32[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "withdrawToStealth",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "stealthFieldElement", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "isNullifierSpent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isKnownRoot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "root", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "currentRoot",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "addKnownRoot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "root", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "NoteCreated",
    type: "event",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint256", indexed: false },
      { name: "newRoot", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "WithdrawalToStealth",
    type: "event",
    inputs: [
      { name: "nullifierHash", type: "bytes32", indexed: true },
      { name: "stealthAddress", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MOCK_USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// All 6 commitments from demo-data.json (insert order = leaf indices 0–5)
export const DEMO_COMMITMENTS = [
  "0x244f9073835610542a9e1a1a31a8027079f3188c17aa893d9e5ddcf7c662919c", // Alice stealth0
  "0x23151eeccdadaad87840c310af9c8ca078ccda748f0e862bc29ddb268eabbf21", // Bob   stealth0
  "0x0413629e56c72e60eee88c7546dd2c35837d241f04015bdfeb9699866d285e77", // Bob   stealth1
  "0x0ce80d0b097a2fbd88e26682d65ca9b8d0917440ec1d442649b12f62c7ce1ed4", // Carol stealth0
  "0x02bfd723d01fe4cc599225451694a1b050d377b0bc64f40610cebfc9777adaf9", // Carol stealth1
  "0x235188ecac102b3c8a40d25fe87c4c53d3690f751b1cd11acbaa4d11508ad9d4", // Carol stealth2
] as const;

export const DEMO_AMOUNTS = [1000, 1000, 1000, 1000, 1000, 1000] as const;

export const MERKLE_ROOT =
  "0x16724eb551f43b3b9161b5b6fef99436f59bb8ed8d832da843c1147cf341cef7";
