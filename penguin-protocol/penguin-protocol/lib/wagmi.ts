import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, sepolia } from "wagmi/chains";

const CHAIN_MAP: Record<string, typeof baseSepolia | typeof sepolia> = {
  "84532": baseSepolia,
  "11155111": sepolia,
};

function getChains() {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111";
  const primary = CHAIN_MAP[chainId] ?? sepolia;
  return [primary];
}

export const wagmiConfig = getDefaultConfig({
  appName: "Penguin Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: getChains(),
  ssr: true,
});
