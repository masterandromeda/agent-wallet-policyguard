"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner } from "@/components/ui/index";
import { Network, Info, Wifi, WifiOff, Clock, Database } from "lucide-react";

const CHAIN_INFO = [
  { label: "Network",        value: "Sepolia Testnet",    status: "demo" },
  { label: "Chain ID",       value: "11155111",           status: "info" },
  { label: "EntryPoint",     value: "Not deployed",       status: "warn" },
  { label: "PolicyEnforcer", value: "Not deployed",       status: "warn" },
  { label: "Paymaster",      value: "Not configured",     status: "warn" },
  { label: "RPC Endpoint",   value: "Not connected",      status: "warn" },
  { label: "Latest Block",   value: "—",                  status: "demo" },
  { label: "Block Explorer", value: "sepolia.etherscan.io", status: "info" },
];

export default function BlockchainPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Wallet & Recovery"
        title="Blockchain Status"
        subtitle="Network connectivity and on-chain contract status"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="warning" icon={WifiOff}>
          Not connected to a live network. Set <code className="font-mono text-amber-300">NEXT_PUBLIC_RPC_URL</code> and{" "}
          <code className="font-mono text-amber-300">ENTRYPOINT_ADDRESS</code> in{" "}
          <code className="font-mono text-amber-300">.env.local</code> to enable on-chain features.
        </AlertBanner>

        {/* Connection status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Network & Contract Status</h2>
              <Badge className="badge-amber" dot>Demo mode</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHAIN_INFO.map(({ label, value, status }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(7,16,32,0.6)",
                    border: "1px solid rgba(56,189,248,0.08)",
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{
                      color:
                        status === "warn" ? "#fbbf24" :
                        status === "info" ? "var(--text-primary)" :
                        "var(--text-secondary)",
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* ERC-4337 stack */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">ERC-4337 Stack</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {[
              { name: "EntryPoint v0.7", desc: "Global singleton contract for UserOperation processing", deployed: false },
              { name: "Smart Account (ERC-4337)", desc: "Per-owner account abstraction with session key support", deployed: false },
              { name: "PolicyEnforcer", desc: "On-chain spending limit and allowlist validation", deployed: false },
              { name: "Paymaster", desc: "ERC-4337 gas sponsorship contract", deployed: false },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-4 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(7,16,32,0.6)",
                  border: "1px solid rgba(56,189,248,0.08)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
                <Badge className="badge-amber flex-shrink-0">Not deployed</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            All policy enforcement currently runs server-side in demo mode. Configure blockchain
            environment variables to deploy smart contracts and enable on-chain validation.
            See <code>/contracts/</code> for the Foundry deployment scripts.
          </p>
        </div>
      </div>
    </div>
  );
}
