import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, sepolia } from "wagmi/chains";

// Both chains always available so wallet can switch between Sepolia (ENS) and Base Sepolia (vault)
export const wagmiConfig = getDefaultConfig({
  appName: "Penguin Protocol",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [sepolia, baseSepolia],
  ssr: true,
});
