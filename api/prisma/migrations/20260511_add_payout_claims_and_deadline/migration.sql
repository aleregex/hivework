-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('node', 'leaf');

-- AlterTable: campaign deadline
ALTER TABLE "campaigns_metadata" ADD COLUMN "deadline" TIMESTAMP(3);

-- CreateTable: payout_claims
CREATE TABLE "payout_claims" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_onchain_pda" TEXT NOT NULL,
    "source_onchain_pda" TEXT NOT NULL,
    "kind" "PayoutKind" NOT NULL,
    "creator_wallet" TEXT NOT NULL,
    "amount_usdc" DECIMAL(18,6) NOT NULL,
    "stake_released_lamports" BIGINT NOT NULL DEFAULT 0,
    "tx_signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_claims_tx_signature_key" ON "payout_claims"("tx_signature");

-- CreateIndex
CREATE INDEX "payout_claims_creator_wallet_claimed_at_idx" ON "payout_claims"("creator_wallet", "claimed_at");

-- CreateIndex
CREATE INDEX "payout_claims_campaign_id_idx" ON "payout_claims"("campaign_id");

-- AddForeignKey
ALTER TABLE "payout_claims" ADD CONSTRAINT "payout_claims_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
