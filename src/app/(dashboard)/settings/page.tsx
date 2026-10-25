import { TopBar } from "@/components/layout/TopBar";
import { Card, CardBody, Badge, Button } from "@/components/ui/index";
import { DEMO_NETWORK, DEMO_USERS } from "@/lib/mock-data";
import { Settings, Wallet, Network, ShieldCheck, Code2, User, ExternalLink, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar title="Settings" />
      <div className="flex-1 p-6 max-w-3xl space-y-6 fade-up">
        {/* Wallet Connect */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-[#22d3ee]" />
              <h3 className="text-sm font-semibold text-white">Wallet Connection</h3>
            </div>
            <div
              className="px-4 py-3 rounded-lg text-xs"
              style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)", color: "#fbbf24" }}
            >
              <strong>Not connected.</strong> Connect your owner wallet (MetaMask / WalletConnect) to enable on-chain policy enforcement.
            </div>
            <div className="flex gap-3">
              <Button variant="primary" size="md">
                <Wallet className="w-3.5 h-3.5" /> Connect MetaMask
              </Button>
              <Button variant="secondary" size="md">WalletConnect</Button>
            </div>
            <p className="text-xs" style={{ color: "#334155" }}>
              ⚠ Never enter or paste your private key or seed phrase here. This application only requests wallet signatures.
            </p>
          </CardBody>
        </Card>

        {/* Network */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="w-4 h-4 text-[#2dd4bf]" />
              <h3 className="text-sm font-semibold text-white">Network Configuration</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: "Network", value: DEMO_NETWORK.name },
                { label: "Chain ID", value: String(DEMO_NETWORK.chainId) },
                { label: "Status", value: "Not connected" },
                { label: "Type", value: "Testnet" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ color: "#475569" }}>{label}</p>
                  <p className="font-medium mt-0.5 text-white">{value}</p>
                </div>
              ))}
            </div>
            <a
              href="https://sepolia.etherscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#22d3ee]"
            >
              Sepolia Etherscan <ExternalLink className="w-3 h-3" />
            </a>
          </CardBody>
        </Card>

        {/* Smart Contracts */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Code2 className="w-4 h-4 text-[#8b5cf6]" />
              <h3 className="text-sm font-semibold text-white">Smart Contract Addresses</h3>
              <Badge className="badge-amber">Not Deployed</Badge>
            </div>
            {[
              { name: "SmartWallet.sol",              desc: "ERC-4337 account abstraction wallet" },
              { name: "PolicyGuardPaymaster.sol",     desc: "Validates UserOps against policy rules" },
              { name: "PolicyRegistry.sol",           desc: "On-chain policy configuration storage" },
              { name: "EntryPoint (ERC-4337 v0.7)",   desc: "Standard ERC-4337 EntryPoint contract" },
            ].map(({ name, desc }) => (
              <div
                key={name}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.10)" }}
              >
                <div>
                  <code className="text-xs text-[#a78bfa]">{name}</code>
                  <p className="text-xs mt-0.5" style={{ color: "#475569" }}>{desc}</p>
                </div>
                <span style={{ color: "#334155" }} className="text-xs">—</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Contracts will be deployed to Sepolia testnet. See <code>contracts/</code> directory.</span>
            </div>
          </CardBody>
        </Card>

        {/* Owner profile */}
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4" style={{ color: "#94a3b8" }} />
              <h3 className="text-sm font-semibold text-white">Owner Profile</h3>
            </div>
            {DEMO_USERS.filter((u) => u.role === "owner").map((user) => (
              <div key={user.id} className="grid grid-cols-2 gap-3 text-xs">
                <div><p style={{ color: "#475569" }}>Name</p><p className="font-medium text-white">{user.name}</p></div>
                <div><p style={{ color: "#475569" }}>Email</p><p style={{ color: "#94a3b8" }}>{user.email}</p></div>
                <div><p style={{ color: "#475569" }}>Role</p><Badge className="badge-cyan">{user.role}</Badge></div>
                <div><p style={{ color: "#475569" }}>Wallet</p><code className="font-mono" style={{ color: "#94a3b8" }}>{user.walletAddress?.slice(0, 10)}…</code></div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
