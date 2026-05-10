import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Session } from "next-auth";
import { db } from "./db";
import { agents } from "./schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Restrict sign-in to agents listed in the roster.
      // Entra ID surfaces email as preferred_username; fall back to email field.
      const raw =
        (profile?.preferred_username as string | undefined) ??
        (profile?.email as string | undefined);
      const email = raw?.toLowerCase().trim();
      if (!email) return false;
      let [row] = await db
        .select({
          id: agents.id,
          isActive: agents.isActive,
          deletedAt: agents.deletedAt,
        })
        .from(agents)
        .where(sql`lower(${agents.email}::text) = ${email}`)
        .limit(1);

      // If the UPN doesn't match, try the explicit email claim.
      // This handles cases where Entra UPN differs from the agent's stored email
      // (e.g. when AZURE_AD_UPN_DOMAIN is configured).
      if (
        !row &&
        profile?.email &&
        profile.email !== profile.preferred_username
      ) {
        const alt = (profile.email as string).toLowerCase().trim();
        if (alt) {
          [row] = await db
            .select({
              id: agents.id,
              isActive: agents.isActive,
              deletedAt: agents.deletedAt,
            })
            .from(agents)
            .where(sql`lower(${agents.email}::text) = ${alt}`)
            .limit(1);
        }
      }

      if (!row || !row.isActive || row.deletedAt != null) return false;
      return true;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});

const emailFromSession = (session: Session | null): string | null => {
  const raw = session?.user?.email?.toLowerCase().trim();
  return raw || null;
};

export async function getAgentIdFromSession(
  session: Session | null,
): Promise<number | null> {
  const email = emailFromSession(session);
  if (!email) return null;
  const [row] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(
      and(
        sql`lower(${agents.email}::text) = ${email}`,
        eq(agents.isActive, true),
        isNull(agents.deletedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export interface SessionAgent {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export async function getAgentFromSession(
  session: Session | null,
): Promise<SessionAgent | null> {
  const email = emailFromSession(session);
  if (!email) return null;
  const [row] = await db
    .select({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      role: agents.role,
      isActive: agents.isActive,
    })
    .from(agents)
    .where(
      and(
        sql`lower(${agents.email}::text) = ${email}`,
        eq(agents.isActive, true),
        isNull(agents.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function requireAdmin(
  session: Session | null,
): Promise<SessionAgent | null> {
  const agent = await getAgentFromSession(session);
  if (!agent || agent.role !== "admin") return null;
  return agent;
}
