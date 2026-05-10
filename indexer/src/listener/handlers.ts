// One handler per event: CampaignCreated, NodeCreated, LeafCreated, ConversionRegistered, CampaignClosed.
// All upserts (idempotent) so backfill can re-run safely.
export async function dispatch(_event: unknown, _signature: string, _slot: bigint): Promise<void> {
  // TODO: switch by event.name and call onCampaignCreated / onNodeCreated / ...
}
