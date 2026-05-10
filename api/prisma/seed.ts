import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { generateRefCode } from "../src/refcode.js";

if (!process.env.DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Wallets from COORDINATION.md (devnet, Group C demo wallets).
// Agent pubkey is a placeholder until B/agent confirms one.
const BRAND_WALLET = "DPYGZFEBpbWy4ZrtffidiwX6e4o1BViPRa12nSaGJNpJ";
const HUMAN_1 = "HDB8PCh2n9LeJaMxc6p2MjEZqLxLKYqNN8JpWrFLHga1";
const HUMAN_2 = "54ZWDopbSHSECW46MBqs6HSUDCWgqMkzH7BbQPsjifgY";
const HUMAN_3 = "Dn9Ybbbj8tN6R93pVyEgeSYwRumpzMv4b2KymJnZQUE8";
// TODO(B/agent): replace with the agent's real devnet pubkey once shared.
const AGENT_PLACEHOLDER = "AGENTPLACEHOLDERPubkey1111111111111111111111";

async function main(): Promise<void> {
  console.log("[seed] resetting Halo Cola fixture…");

  // Idempotent reset: drop the demo campaign by brand+product so reruns are safe
  // without nuking other campaigns devs may have created locally.
  await prisma.campaignMetadata.deleteMany({
    where: { brandName: "Halo Cola", productName: { contains: "Original Recipe" } },
  });

  const campaign = await prisma.campaignMetadata.create({
    data: {
      status: "active",
      brandName: "Halo Cola",
      brandLogoUrl: null,
      productName: "Original Recipe · 12-pack of 355ml cans",
      productImageUrl: null,
      productDescription:
        "Globally distributed cola brand. $24/12-pack, ships in 30+ countries via shop.halocola.com.",
      redirectUrl: "https://shop.halocola.com/original",
      creatorWallet: BRAND_WALLET,
      poolUsdc: "800",
    },
  });
  console.log(`[seed] campaign ${campaign.id}`);

  // Tree topology mirrors web/lib/mocks/tree.ts:
  //   root → 2 hooks (L1) → 3 audios (L2) → 3 visuals (L3) → 3 leaves
  const h1 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L1",
      parentNodeId: null,
      creatorWallet: HUMAN_1,
      title: "First sip on a hot day",
      description:
        "Emotional opener: extreme close-up of someone cracking a cold can after a long workout. No words for the first 3s, just the can-crack and the gasp.",
      tags: ["emotional", "summer", "cold-drink"],
      mediaUrls: [],
      stakeSol: "1.0",
      forkCount: 1,
      conversionsCount: 0,
      status: "finalized",
    },
  });
  const h2 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L1",
      parentNodeId: null,
      creatorWallet: AGENT_PLACEHOLDER,
      title: "Move over, big soda",
      description:
        "Challenger angle: side-by-side with the legacy cola brand, calling out artificial sweeteners and price hikes. Direct, irreverent.",
      tags: ["challenger", "comparison"],
      mediaUrls: [],
      stakeSol: "1.0",
      forkCount: 2,
      conversionsCount: 0,
      status: "finalized",
    },
  });

  const a1 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L2",
      parentNodeId: h1.id,
      creatorWallet: HUMAN_2,
      title: "Lo-fi beach instrumental",
      description:
        "Slow lo-fi loop, 80 BPM, ocean ambient layered in. Pairs with the heat-of-the-day visual. Royalty-free.",
      tags: ["lo-fi", "ambient", "royalty-free"],
      mediaUrls: [],
      stakeSol: "0.5",
      forkCount: 1,
      conversionsCount: 0,
      status: "finalized",
    },
  });
  const a2 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L2",
      parentNodeId: h1.id,
      creatorWallet: AGENT_PLACEHOLDER,
      title: "ASMR can crack + pour",
      description:
        "No music. Just an extreme-detail recording of the can opening, fizz, and pour over ice. 6 seconds.",
      tags: ["asmr", "no-music"],
      mediaUrls: [],
      stakeSol: "0.5",
      forkCount: 0,
      conversionsCount: 0,
      status: "finalized",
    },
  });
  const a3 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L2",
      parentNodeId: h2.id,
      creatorWallet: HUMAN_3,
      title: "Trending TikTok sound (BR)",
      description:
        "Top-3 trending sound on TikTok Brazil this week. Refresh weekly — high reach, short shelf life.",
      tags: ["trending", "tiktok", "br"],
      mediaUrls: [],
      stakeSol: "0.5",
      forkCount: 1,
      conversionsCount: 0,
      status: "finalized",
    },
  });

  const v1 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L3",
      parentNodeId: a1.id,
      creatorWallet: HUMAN_1,
      title: "Condensation on glass bottle",
      description:
        "Macro shot of cold beads of water rolling down a glass bottle. Soft golden-hour light. Heat-and-cold contrast.",
      tags: ["macro", "golden-hour"],
      mediaUrls: [],
      stakeSol: "0.25",
      forkCount: 0,
      conversionsCount: 0,
      status: "finalized",
    },
  });
  const v2 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L3",
      parentNodeId: a1.id,
      creatorWallet: AGENT_PLACEHOLDER,
      title: "Bottle vs can comparison",
      description:
        "Side-by-side of Halo Cola can next to the legacy brand can. Same size, same price, different ingredients list overlay.",
      tags: ["comparison", "ingredients"],
      mediaUrls: [],
      stakeSol: "0.25",
      forkCount: 0,
      conversionsCount: 0,
      status: "finalized",
    },
  });
  const v3 = await prisma.nodeMetadata.create({
    data: {
      campaignId: campaign.id,
      level: "L3",
      parentNodeId: a3.id,
      creatorWallet: HUMAN_2,
      title: "Friends on rooftop, sunset",
      description:
        "Group of friends laughing on a city rooftop at golden hour, passing cans around. Real people, no models.",
      tags: ["lifestyle", "ugc"],
      mediaUrls: [],
      stakeSol: "0.25",
      forkCount: 0,
      conversionsCount: 0,
      status: "finalized",
    },
  });

  const leaves = [
    {
      path: [h1.id, a1.id, v1.id],
      creatorWallet: HUMAN_1,
      contentUrl: "https://www.tiktok.com/@sofia.creates/video/000000001",
      platform: "tiktok" as const,
    },
    {
      path: [h1.id, a1.id, v2.id],
      creatorWallet: AGENT_PLACEHOLDER,
      contentUrl: "https://www.instagram.com/reel/agentcola001",
      platform: "instagram" as const,
    },
    {
      path: [h2.id, a3.id, v3.id],
      creatorWallet: HUMAN_3,
      contentUrl: "https://www.youtube.com/shorts/marcelo-eats-001",
      platform: "youtube" as const,
    },
  ];

  for (const l of leaves) {
    const refCode = generateRefCode();
    await prisma.leafMetadata.create({
      data: {
        campaignId: campaign.id,
        path: l.path,
        creatorWallet: l.creatorWallet,
        refCode,
        contentUrl: l.contentUrl,
        platform: l.platform,
        stakeSol: "0.1",
        status: "finalized",
      },
    });
    console.log(`[seed] leaf refCode=${refCode} platform=${l.platform}`);
  }

  console.log("[seed] done");
}

main()
  .catch((err) => {
    console.error("[seed] fatal", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
