export class TxBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxBuilderError";
  }
}

export interface CreateNodeTxArgs {
  campaign_id: string;
  parent_id: string | null;
  level: "L1" | "L2" | "L3";
  metadata_hash: string;
  stake_lamports: bigint;
  creator_wallet: string;
}

export interface CreateLeafTxArgs {
  campaign_id: string;
  path: readonly [string, string, string];
  ref_code: string;
  metadata_hash: string;
  stake_lamports: bigint;
  creator_wallet: string;
}

export interface UnsignedTx {
  unsigned_tx_b64: string;
  fee_payer: string;
  expected_program_id: string;
}

const NOT_WIRED =
  "tx-builder not yet wired to Group A's Anchor IDL. " +
  "Once IDL is committed at mcp/idl/hivework.json and HIVEWORK_PROGRAM_ID is set, this builder will return the unsigned tx.";

export async function buildUnsignedCreateNodeTx(
  _args: CreateNodeTxArgs,
): Promise<UnsignedTx> {
  throw new TxBuilderError(NOT_WIRED);
}

export async function buildUnsignedCreateLeafTx(
  _args: CreateLeafTxArgs,
): Promise<UnsignedTx> {
  throw new TxBuilderError(NOT_WIRED);
}
