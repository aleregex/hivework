import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ActiveCampaigns } from "@/components/landing/active-campaigns";
import { Footer } from "@/components/landing/footer";

// Public landing page. Renders server-side except for the wallet button (which is dynamically
// imported with ssr: false in WalletConnectButton) and a few framer-motion sections.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <ActiveCampaigns />
      </main>
      <Footer />
    </>
  );
}
