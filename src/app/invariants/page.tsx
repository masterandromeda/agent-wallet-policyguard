"use client";

import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner } from "@/components/ui/index";
import { ShieldAlert, CheckCircle2, Info, ChevronRight } from "lucide-react";

const INVARIANTS = [
  {
    id: "INV-01",
    name: "Spending Limit Never Exceeded",
    desc: "An agent may never spend more than its configured daily or monthly limit across all transactions.",
    status: "pending",
    contract: "PolicyEnforcer.sol",
  },
  {
    id: "INV-02",
    name: "Unapproved Recipient Blocked",
    desc: "Any transaction to an address not in the allowlist must be blocked when the allowlist rule is active.",
    status: "pending",
    contract: "PolicyEnforcer.sol",
  },
  {
    id: "INV-03",
    name: "Expired Permission Rejected",
    desc: "A permission past its expiry timestamp must not allow any new transactions.",
    status: "pending",
    contract: "SessionKeyManager.sol",
  },
  {
    id: "INV-04",
    name: "Frozen Agent Fully Blocked",
    desc: "A suspended/frozen agent must not be able to submit any UserOperation to the EntryPoint.",
    status: "pending",
    contract: "AgentWallet.sol",
  },
  {
    id: "INV-05",
    name: "Recovery Requires Quorum",
    desc: "Owner change must require ≥ 3-of-5 guardian approvals and the 48-hour delay.",
    status: "pending",
    contract: "SocialRecovery.sol",
  },
  {
    id: "INV-06",
    name: "Per-Tx Limit Enforced",
    desc: "No single transaction may exceed the configured per-transaction USD limit.",
    status: "pending",
    contract: "PolicyEnforcer.sol",
  },
];

export default function InvariantsPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security Testing"
        title="Security Invariants"
        subtitle="On-chain invariant specifications and test status"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={ShieldAlert}>
          Security invariants are formal properties that must hold for all possible contract states.
          These run as <strong>Foundry invariant tests</strong> against the deployed contracts.
          Deploy contracts and run <code className="font-mono">forge test --mt invariant</code> to execute.
        </AlertBanner>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Invariant Specifications</h2>
              <Badge className="badge-amber">Contracts not deployed</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {INVARIANTS.map((inv) => (
              <div
                key={inv.id}
                className="flex items-start gap-4 px-4 py-3 rounded-xl"
                style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(245,158,11,0.12)" }}
                  >
                    <span className="text-xs font-bold" style={{ color: "#fbbf24", fontSize: 9 }}>
                      {inv.id.split("-")[1]}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-xs font-semibold text-white">{inv.name}</p>
                    <code className="text-xs" style={{ color: "var(--text-muted)", fontSize: 10 }}>{inv.contract}</code>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{inv.desc}</p>
                </div>
                <Badge className="badge-amber flex-shrink-0">Pending deploy</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Link href="/simulator" className="block">
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all"
            style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0" style={{ color: "#a78bfa" }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Run Off-Chain Invariant Tests Now</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Use the Hijack Attack Simulator to validate policy enforcement against attack scenarios →
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#a78bfa" }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
