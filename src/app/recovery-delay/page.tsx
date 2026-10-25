"use client";

import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner } from "@/components/ui/index";
import { Clock, Shield, Info, ChevronRight } from "lucide-react";

export default function RecoveryDelayPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Wallet & Recovery"
        title="Recovery Delay & Owner Veto"
        subtitle="48-hour security delay and veto mechanism"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={Clock}>
          The 48-hour security delay gives the owner time to detect and veto any fraudulent
          recovery attempt before it can be executed. Guardian voting must complete before the
          delay timer starts.
        </AlertBanner>

        {/* How the delay works */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Security Delay Flow</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {[
                { step: "1", label: "Recovery Requested",     desc: "Owner or guardian initiates a recovery request with a new owner address.", color: "#22d3ee" },
                { step: "2", label: "Guardian Voting",        desc: "5 designated guardians vote. A quorum of 3-of-5 approvals is required.", color: "#22d3ee" },
                { step: "3", label: "48-Hour Delay Starts",   desc: "Once 3 approvals are collected, a mandatory 48-hour countdown begins.", color: "#f59e0b" },
                { step: "4", label: "Owner Veto Window",      desc: "During the delay, the current owner can veto recovery at any time with a single signature.", color: "#f43f5e" },
                { step: "5", label: "Recovery Executed",      desc: "If not vetoed after 48 hours, the new owner address is activated.", color: "#10b981" },
              ].map(({ step, label, desc, color }) => (
                <div key={step} className="flex items-start gap-4">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: `${color}20`, color }}
                  >
                    {step}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Veto mechanics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-white">Owner Veto</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The owner can veto any active recovery request at any time during the voting or
              delay phase. A veto immediately cancels the recovery and prevents execution.
              Vetoed recoveries are permanently logged on-chain.
            </p>
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.18)" }}
            >
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <p className="text-xs leading-relaxed text-rose-400">
                Veto is a one-time action per recovery request. Once vetoed, the same recovery
                cannot be re-activated. A new recovery request must be submitted.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Link to guardian page */}
        <Link href="/guardians" className="block">
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all hover:border-violet-400/30"
            style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
          >
            <Shield className="w-5 h-5 flex-shrink-0" style={{ color: "#a78bfa" }} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Manage Active Recovery Requests</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Go to Guardian Recovery → approve guardians or veto active requests
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#a78bfa" }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
