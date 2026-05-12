-- CreateEnum
CREATE TYPE "ConversionCriteria" AS ENUM ('purchase', 'signup', 'mint', 'subscription', 'donation');

-- AlterTable
ALTER TABLE "campaigns_metadata"
  ADD COLUMN "conversion_value_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "conversion_criteria" "ConversionCriteria" NOT NULL DEFAULT 'purchase';
