-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'closed');

-- CreateEnum
CREATE TYPE "NodeLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('draft', 'finalized');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('pending', 'verified', 'pushed_to_chain', 'rejected');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('tiktok', 'instagram', 'x', 'youtube', 'other');

-- CreateTable
CREATE TABLE "campaigns_metadata" (
    "id" TEXT NOT NULL,
    "onchain_pda" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "brand_name" TEXT NOT NULL,
    "brand_logo_url" TEXT,
    "product_name" TEXT NOT NULL,
    "product_image_url" TEXT,
    "product_description" TEXT NOT NULL,
    "redirect_url" TEXT NOT NULL,
    "creator_wallet" TEXT NOT NULL,
    "pool_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes_metadata" (
    "id" TEXT NOT NULL,
    "onchain_pda" TEXT,
    "campaign_id" TEXT NOT NULL,
    "level" "NodeLevel" NOT NULL,
    "parent_node_id" TEXT,
    "creator_wallet" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "examples" JSONB,
    "tags" TEXT[],
    "media_urls" TEXT[],
    "stake_sol" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "fork_count" INTEGER NOT NULL DEFAULT 0,
    "conversions_count" INTEGER NOT NULL DEFAULT 0,
    "status" "DraftStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nodes_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves_metadata" (
    "id" TEXT NOT NULL,
    "onchain_pda" TEXT,
    "campaign_id" TEXT NOT NULL,
    "path" TEXT[],
    "creator_wallet" TEXT NOT NULL,
    "ref_code" TEXT NOT NULL,
    "content_url" TEXT,
    "platform" "Platform" NOT NULL,
    "stake_sol" DECIMAL(18,9) NOT NULL DEFAULT 0,
    "status" "DraftStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaves_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "leaf_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "referrer" TEXT,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_conversions" (
    "id" TEXT NOT NULL,
    "leaf_id" TEXT NOT NULL,
    "value_usdc" DECIMAL(18,6) NOT NULL,
    "source_data" JSONB NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'pending',
    "pushed_tx_sig" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_code_reservations" (
    "ref_code" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "reserved_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ref_code_reservations_pkey" PRIMARY KEY ("ref_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_metadata_onchain_pda_key" ON "campaigns_metadata"("onchain_pda");

-- CreateIndex
CREATE INDEX "campaigns_metadata_status_idx" ON "campaigns_metadata"("status");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_metadata_onchain_pda_key" ON "nodes_metadata"("onchain_pda");

-- CreateIndex
CREATE INDEX "nodes_metadata_campaign_id_level_idx" ON "nodes_metadata"("campaign_id", "level");

-- CreateIndex
CREATE INDEX "nodes_metadata_parent_node_id_idx" ON "nodes_metadata"("parent_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_metadata_onchain_pda_key" ON "leaves_metadata"("onchain_pda");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_metadata_ref_code_key" ON "leaves_metadata"("ref_code");

-- CreateIndex
CREATE INDEX "leaves_metadata_campaign_id_idx" ON "leaves_metadata"("campaign_id");

-- CreateIndex
CREATE INDEX "leaves_metadata_creator_wallet_idx" ON "leaves_metadata"("creator_wallet");

-- CreateIndex
CREATE INDEX "clicks_leaf_id_timestamp_idx" ON "clicks"("leaf_id", "timestamp");

-- CreateIndex
CREATE INDEX "pending_conversions_status_created_at_idx" ON "pending_conversions"("status", "created_at");

-- CreateIndex
CREATE INDEX "ref_code_reservations_expires_at_idx" ON "ref_code_reservations"("expires_at");

-- AddForeignKey
ALTER TABLE "nodes_metadata" ADD CONSTRAINT "nodes_metadata_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes_metadata" ADD CONSTRAINT "nodes_metadata_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "nodes_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves_metadata" ADD CONSTRAINT "leaves_metadata_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_leaf_id_fkey" FOREIGN KEY ("leaf_id") REFERENCES "leaves_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_conversions" ADD CONSTRAINT "pending_conversions_leaf_id_fkey" FOREIGN KEY ("leaf_id") REFERENCES "leaves_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
