export type HiveEvent =
  | {
      type: "node_created";
      campaignId: string;
      nodeId: string;
      level: "L1" | "L2" | "L3";
      creatorWallet: string;
    }
  | {
      type: "leaf_created";
      campaignId: string;
      leafId: string;
      refCode: string;
      creatorWallet: string;
    }
  | {
      type: "click";
      leafId: string;
      refCode: string;
    }
  | {
      type: "conversion_pending";
      pendingId: string;
      leafId: string;
      valueUsdc: string;
    }
  | {
      type: "conversion_confirmed";
      conversionId: string;
      leafId: string;
      txSig: string;
    };

export type HiveEventType = HiveEvent["type"];

export const HIVE_EVENT_TYPES = [
  "node_created",
  "leaf_created",
  "click",
  "conversion_pending",
  "conversion_confirmed",
] as const satisfies readonly HiveEventType[];
