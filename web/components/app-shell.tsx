import { Nav } from "@/components/landing/nav";

/**
 * Shared shell for internal app pages. Same Nav as the landing for now,
 * but separated so we can add a sidebar / breadcrumbs later without touching
 * the landing.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-12">{children}</main>
    </>
  );
}
