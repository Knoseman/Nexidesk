"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { brand, BrandLogo } from "@/lib/brand";
import { ArrowLeft } from "lucide-react";

function MicrosoftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app/tickets";
  const error = searchParams.get("error");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "registerSuccess">(
    "login",
  );

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    await signIn("microsoft-entra-id", { callbackUrl });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    if (!regName.trim()) {
      setRegError("Name is required");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setRegError("Valid email is required");
      return;
    }
    setRegSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setMode("registerSuccess");
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: `linear-gradient(135deg, ${brand.colors.sidebar} 0%, #1e293b 100%)`,
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-xl bg-white px-5 py-3">
            <BrandLogo height={36} />
          </div>
          <p className="text-xs text-slate-400">{brand.tagline}</p>
        </div>

        {mode === "login" && (
          <>
            {error && (
              <div
                className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300"
                role="alert"
              >
                {error === "AccessDenied"
                  ? "Access denied — your email is not in the agents roster. Contact an admin."
                  : `Sign-in error: ${error}. Check Entra ID app registration and tenant configuration.`}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignIn()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <MicrosoftIcon size={18} />
              {busy ? "Redirecting…" : "Sign in with Microsoft"}
            </button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setRegError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Request access
              </button>
            </div>
          </>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mb-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft size={12} />
              Back to sign in
            </button>

            <div>
              <label
                htmlFor="reg-name"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Full name *
              </label>
              <input
                id="reg-name"
                name="name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="reg-email"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Work email *
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="reg-phone"
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Phone number
              </label>
              <input
                id="reg-phone"
                name="phone"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {regError && <p className="text-xs text-red-300">{regError}</p>}

            <p className="text-[11px] text-slate-500">
              An admin must approve your account before you can sign in.
            </p>

            <button
              type="submit"
              disabled={regSubmitting}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: brand.colors.primary }}
            >
              {regSubmitting ? "Submitting…" : "Request access"}
            </button>
          </form>
        )}

        {mode === "registerSuccess" && (
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-sm font-semibold text-white">
              Request submitted
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Your request has been submitted. An admin must approve your
              account before you can sign in.
            </p>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-4 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
