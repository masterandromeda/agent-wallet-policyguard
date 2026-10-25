"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner } from "@/components/ui/index";
import { TestTube, Info, ChevronRight } from "lucide-react";
import Link from "next/link";

const FUZZ_TARGETS = [
  { name: "PolicyEnforcer.validateOp()",    desc: "Fuzz spending amounts, recipients, timestamps against all policy rule combinations.", status: "not-run" },
  { name: "SocialRecovery.executeRecovery()", desc: "Fuzz guardian approval sequences, timing windows, and quorum thresholds.", status: "not-run" },
  { name: "AgentWallet.execute()",           desc: "Fuzz call data, value, and target addresses to discover bypass vectors.", status: "not-run" },
  { name: "SessionKeyManager.isExpired()",   desc: "Fuzz timestamp edge cases around permission expiry boundaries.", status: "not-run" },
  { name: "GasQuota.checkAndDeduct()",       desc: "Fuzz gas amount sequences to detect quota bypass via integer overflow.", status: "not-run" },
];

export default function FuzzPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security Testing"
        title="Fuzz Testing"
        subtitle="Automated property-based testing for smart contracts"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={TestTube}>
          Fuzz tests use <strong>Foundry (forge fuzz)</strong> to generate thousands of random
          inputs against each contract function. Deploy contracts and run{" "}
          <code className="font-mono">forge test --mt fuzz</code> to execute. Results will appear here.
        </AlertBanner>

        {/* What is fuzz testing */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TestTube className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Fuzz Test Targets</h2>
              <Badge className="badge-amber">Contracts not deployed</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {FUZZ_TARGETS.map((target) => (
              <div
                key={target.name}
                className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-[#22d3ee]">{target.name}</code>
                  <Badge className="badge-gray">Not run</Badge>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {target.desc}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* How to run */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">How to Run Fuzz Tests</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {[
              { cmd: "cd contracts/", desc: "Navigate to the Foundry project" },
              { cmd: "forge install",  desc: "Install Foundry dependencies" },
              { cmd: "forge test --mt fuzz -v", desc: "Run all fuzz test targets with verbose output" },
              { cmd: "forge coverage", desc: "Generate coverage report" },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-start gap-3">
                <code
                  className="text-xs font-mono px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", fontSize: 11 }}
                >
                  {cmd}
                </code>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Link href="/invariants" className="block">
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all"
            style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
          >
            <TestTube className="w-5 h-5 flex-shrink-0" style={{ color: "#a78bfa" }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">View Security Invariants</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                See the formal invariant specifications that fuzz tests validate →
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#a78bfa" }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
