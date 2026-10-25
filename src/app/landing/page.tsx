import Link from "next/link";
import { ShieldCheck, Zap, Wallet } from "lucide-react";

export default function LandingPage() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 py-16"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Hero */}
      <div className="text-center max-w-2xl">
        {/* Brand mark */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
            boxShadow: "0 0 40px rgba(34,211,238,0.35)",
          }}
        >
          <Wallet style={{ width: 30, height: 30, color: "#020818" }} />
        </div>

        <p
          className="text-xs font-semibold tracking-widest uppercase mb-3"
          style={{ color: "#22d3ee" }}
        >
          ERC-4337 · Agent Wallet
        </p>

        <h1
          className="text-4xl font-extrabold tracking-tight mb-4"
          style={{ color: "#ffffff", lineHeight: 1.15 }}
        >
          Agent Wallet PolicyGuard
        </h1>

        <p
          className="text-lg mb-8"
          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
        >
          Let AI Agents Pay Safely —<br />
          With Cryptographic Policy Enforcement
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
            color: "#020818",
            boxShadow: "0 0 24px rgba(34,211,238,0.30)",
          }}
        >
          Open Dashboard →
        </Link>
      </div>

      {/* Feature cards */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
        {/* Card 1 – Security Model */}
        <div
          className="px-6 py-6 rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(34,211,238,0.10)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "rgba(34,211,238,0.10)" }}
          >
            <ShieldCheck style={{ width: 20, height: 20, color: "#22d3ee" }} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Security Model</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Session keys with scoped permissions. Guardian multi-sig for social recovery.
            Emergency freeze halts all agent operations instantly.
          </p>
        </div>

        {/* Card 2 – Policy Engine */}
        <div
          className="px-6 py-6 rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(59,130,246,0.10)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "rgba(59,130,246,0.10)" }}
          >
            <Zap style={{ width: 20, height: 20, color: "#60a5fa" }} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Policy Engine</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Declarative spending policies with per-agent limits, allowlisted merchants,
            risk scoring, and human-in-the-loop approval gates.
          </p>
        </div>

        {/* Card 3 – ERC-4337 */}
        <div
          className="px-6 py-6 rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(139,92,246,0.10)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "rgba(139,92,246,0.10)" }}
          >
            <Wallet style={{ width: 20, height: 20, color: "#8b5cf6" }} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">ERC-4337</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Account abstraction with gasless transactions via Paymaster. Batched UserOperations
            and on-chain policy hooks enforced at the EntryPoint level.
          </p>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-12 text-xs" style={{ color: "var(--text-muted)" }}>
        Sepolia Testnet · Demo mode
      </p>
    </div>
  );
}
