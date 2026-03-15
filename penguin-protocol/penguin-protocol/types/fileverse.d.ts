declare module "@fileverse/agents" {
  import type { PrivateKeyAccount } from "viem/accounts";

  export interface AgentConfig {
    chain: "gnosis" | "sepolia";
    viemAccount: PrivateKeyAccount;
    pimlicoAPIKey: string;
    storageProvider: unknown;
  }

  export interface FileResult {
    fileId: string;
  }

  export class Agent {
    constructor(config: AgentConfig);
    setupStorage(namespace: string): Promise<void>;
    create(content: string): Promise<FileResult>;
    getFile(fileId: string): Promise<string>;
    update(fileId: string, content: string): Promise<FileResult>;
    delete(fileId: string): Promise<void>;
    getBlockNumber(): Promise<bigint>;
  }
}

declare module "@fileverse/agents/storage" {
  export interface PinataConfig {
    pinataJWT: string;
    pinataGateway: string;
  }

  export class PinataStorageProvider {
    constructor(config: PinataConfig);
  }
}
