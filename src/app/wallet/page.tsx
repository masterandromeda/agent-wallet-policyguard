"use client";

import { useState } from "react";
import {
  Wallet, Copy, CheckCircle2, ExternalLink, AlertTriangle,
  Network, Info, Lock, Key,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, AlertBanner,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";

const ENV_VARS = [
  { key: "NEXT_PUBLIC_RPC_URL",      desc: "Ethereum Sepolia RPC endpoint (e.g. Infura / Alchemy)",      required: true  },
  { key: "ENTRYPOINT_ADDRESS",       desc: "ERC-4337 EntryPoint v0.7 contract address",                  required: true  },
  { key: "SMART_WALLET_FACTORY",     desc: "Account factory contract address",                            required: true  },
  { key: "POLICY_ENFORCER_ADDRESS",  desc: "On-chain PolicyEnforcer contract address",                    required: true  },
  { key: "PAYMASTER_ADDRESS",        desc: "ERC-4337 Verifying Paymaster contract address",               required: false },
  { key: "BUNDLER_URL",              desc: "ERC-4337 Bundler RPC URL (Pimlico / Alchemy AA)",             required: true  },
  { key: "OWNER_PRIVATE_KEY",        desc: "Owner signing key — NEVER expose in frontend. Server only.",  required: true  },
];

const ERC4337_STACK = [
  {
    name: "EntryPoint v0.7",
    desc: "Global singleton. Validates and executes UserOperations.",
    address: process.env.NEXT_PUBLIC_ENTRYPOINT ?? null,
    docsUrl: "https://eips.ethereum.org/EIPS/eip-4337",
  },
  {
    name: "Smart Account",
    desc: "Per-owner ERC-4337 account with session key support and policy hooks.",
    address: null,
    docsUrl: "https://eips.ethereum.org/EIPS/eip-4337",
  },
  {
    name: "PolicyEnforcer",
    desc: "On-chain spending limit and allowlist validation — final security authority.",
    address: process.env.NEXT_PUBLIC_POLICY_ENFORCER ?? null,
    docsUrl: null,
  },
  {
    name: "Paymaster",
    desc: "Sponsors gas fees for approved agent UserOperations.",
    address: process.env.NEXT_PUBLIC_PAYMASTER ?? null,
    docsUrl: null,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: "error", title: "Copy failed" });
    }
  };
  return (
    <button
      onClick={copy}
      className="flex-shrink-0 p-1 rounded transition-colors hover:bg-white/5"
      style={{ color: copied ? "#22d3ee" : "var(--text-muted)" }}
      title="Copy"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function WalletPage() {
  const rpcConnected = false; // will be true once NEXT_PUBLIC_RPC_URL is set

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Blockchain"
        title="Wallet & ERC-4337 Setup"
        subtitle="Smart account configuration and contract status"
      />

      <div className="page-content space-y-6 fade-up">
        {/* Connection status */}
        <AlertBanner variant={rpcConnected ? "success" : "warning"} icon={rpcConnected ? CheckCircle2 : AlertTriangle}>
          {rpcConnected ? (
            "Connected to Sepolia testnet. Smart account deployment available."
          ) : (
            <>
              Not connected to a live network.{" "}
              Set <code className="font-mono text-amber-300">NEXT_PUBLIC_RPC_URL</code> and the other
              required environment variables below to enable on-chain features.
            </>
          )}
        </AlertBanner>

        {/* Connection tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Network",       value: "Sepolia Testnet", status: "demo",  color: "#94a3b8" },
            { label: "Chain ID",      value: "11155111",        status: "info",  color: "#22d3ee" },
            { label: "RPC",           value: rpcConnected ? "Connected" : "Not configured", status: rpcConnected ? "ok" : "warn", color: rpcConnected ? "#10b981" : "#f59e0b" },
            { label: "Bundler",       value: "Not configured",  status: "warn",  color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="px-4 py-4 rounded-xl"
              style={{ background: "rgba(7,16,32,0.8)", border: "1px solid rgba(56,189,248,0.10)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-sm font-bold mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ERC-4337 Contract Stack */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">ERC-4337 Contract Stack</h2>
              <Badge className="badge-amber" dot>Not deployed</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {ERC4337_STACK.map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-4 px-4 py-3 rounded-xl"
                style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    {item.docsUrl && (
                      <a href={item.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs" style={{ color: "var(--text-muted)" }}>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  {item.address ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="text-xs text-[#22d3ee]">{item.address.slice(0, 20)}…</code>
                      <CopyButton text={item.address} />
                    </div>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Address not configured
                    </p>
                  )}
                </div>
                <Badge className={item.address ? "badge-green" : "badge-amber"} dot>
                  {item.address ? "Configured" : "Not deployed"}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Environment Variables */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Required Environment Variables</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {ENV_VARS.map(({ key, desc, required }) => (
              <div
                key={key}
                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <code className="text-xs font-mono text-[#22d3ee]">{key}</code>
                    <Badge className={required ? "badge-red" : "badge-slate"}>
                      {required ? "Required" : "Optional"}
                    </Badge>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                </div>
                {key.includes("PRIVATE_KEY") && (
                  <Lock className="w-3.5 h-3.5 flex-shrink-0 text-rose-400 mt-0.5" aria-label="Server-side only — never expose in frontend" />
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Connect wallet section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Owner Wallet Connection</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Connect your owner wallet to deploy smart accounts, sign policy updates, and authorize
              agent permissions on-chain. The private key is never stored in the frontend.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" size="md" onClick={() => toast({ type: "info", title: "MetaMask integration requires ethers.js or wagmi — see README" })}>
                <Wallet className="w-3.5 h-3.5" /> Connect MetaMask
              </Button>
              <Button variant="secondary" size="md" onClick={() => toast({ type: "info", title: "WalletConnect integration — see README for setup" })}>
                WalletConnect
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Security note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-400">Security architecture</p>
            <p className="text-xs leading-relaxed text-blue-400">
              Policy enforcement is enforced at the <strong>smart contract layer</strong> (PolicyEnforcer), not
              just the UI or AI model. AI/LLM risk scores are advisory signals only — the on-chain validator
              is the final authority. Never expose signing credentials in client-side code.
              See <code className="font-mono">/contracts/</code> for Foundry deployment scripts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
