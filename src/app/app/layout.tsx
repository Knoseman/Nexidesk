import { redirect } from "next/navigation";
import { auth, getAgentFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { SideNav } from "@/components/nexidesk/SideNav";
import { TopHeader } from "@/components/nexidesk/TopHeader";
import { ThemeProvider } from "@/components/nexidesk/ThemeProvider";
import type { AgentTheme } from "@/lib/schema";

function userInitials(
  email: string | null | undefined,
  name: string | null | undefined,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  if (email) {
    const local = email.split("@")[0].replace(/[._-]/g, " ");
    return local
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }
  return "U";
}

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const inits = userInitials(session.user?.email, session.user?.name);
  const agent = await getAgentFromSession(session);
  const isAdmin = agent?.role === "admin";

  // Fetch theme preference for this agent
  let theme: AgentTheme = "auto";
  if (session.user?.email) {
    const email = session.user.email.toLowerCase().trim();
    const [row] = await db
      .select({ theme: agents.theme })
      .from(agents)
      .where(sql`lower(${agents.email}::text) = ${email}`)
      .limit(1);
    const raw = row?.theme;
    if (raw === "light" || raw === "dark" || raw === "auto") theme = raw;
  }

  // Inline script runs synchronously before hydration to prevent flash
  const themeScript = `(function(){var t=${JSON.stringify(theme)};if(t==="dark"||(t==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}})();`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <ThemeProvider theme={theme}>
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <TopHeader userInitials={inits} />
          <div className="flex flex-1 overflow-hidden">
            <SideNav isAdmin={isAdmin} />
            <main className="flex flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </ThemeProvider>
    </>
  );
}
