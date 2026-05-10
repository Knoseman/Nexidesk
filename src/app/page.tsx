import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { LoginForm } from "./LoginForm";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/app/tickets");

  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${brand.colors.sidebar} 0%, #1e293b 100%)`,
          }}
        >
          <div className="text-sm text-slate-400">Loading…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
