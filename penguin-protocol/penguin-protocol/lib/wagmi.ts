import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, gnosis, mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Penguin Protocol",
  // Falls back to empty string at build time — requires a real ID at runtime
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [sepolia, gnosis, mainnet],
  ssr: true,
});
