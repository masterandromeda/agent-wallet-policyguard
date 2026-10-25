"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner } from "@/components/ui/index";
import { Plug, Info, CheckCircle2, XCircle } from "lucide-react";

const INTEGRATIONS = [
  {
    category: "AI / LLM",
    items: [
      { name: "OpenAI GPT-4o",  envVar: "OPENAI_API_KEY",       status: "not-configured", desc: "Natural language task parsing and intent classification for agent workspace." },
      { name: "Anthropic Claude", envVar: "ANTHROPIC_API_KEY",    status: "not-configured", desc: "Alternative LLM for task understanding." },
    ],
  },
  {
    category: "Blockchain",
    items: [
      { name: "RPC Endpoint",   envVar: "NEXT_PUBLIC_RPC_URL",   status: "not-configured", desc: "Sepolia / Mainnet JSON-RPC for on-chain reads and writes." },
      { name: "EntryPoint",     envVar: "ENTRYPOINT_ADDRESS",    status: "not-configured", desc: "ERC-4337 EntryPoint contract address." },
      { name: "Paymaster",      envVar: "PAYMASTER_ADDRESS",     status: "not-configured", desc: "ERC-4337 Paymaster contract for gas sponsorship." },
      { name: "PolicyEnforcer", envVar: "POLICY_ENFORCER_ADDRESS", status: "not-configured", desc: "On-chain policy validation contract." },
    ],
  },
  {
    category: "Database",
    items: [
      { name: "Prisma / SQLite", envVar: "DATABASE_URL",          status: "demo",  desc: "Persistent storage for agents, policies, transactions. SQLite used in demo mode." },
    ],
  },
  {
    category: "Notifications",
    items: [
      { name: "Email Alerts",   envVar: "SMTP_HOST",             status: "not-configured", desc: "Email notifications for approvals, freeze events, and recovery requests." },
      { name: "Webhook",        envVar: "WEBHOOK_URL",           status: "not-configured", desc: "HTTP webhook for external system notifications." },
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="System"
        title="Integrations & API Configuration"
        subtitle="External service connections and environment variables"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="warning" icon={Info}>
          Add the environment variables below to <code className="font-mono text-amber-300">.env.local</code> to
          enable each integration. No secrets are stored in the database or transmitted to the client.
        </AlertBanner>

        {INTEGRATIONS.map((section) => (
          <Card key={section.category}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-[#22d3ee]" />
                <h2 className="text-sm font-semibold text-white">{section.category}</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.name}
                  className="flex items-start justify-between gap-4 px-4 py-3 rounded-xl"
                  style={{
                    background: item.status === "demo" ? "rgba(34,211,238,0.04)" : "rgba(7,16,32,0.6)",
                    border: `1px solid ${item.status === "demo" ? "rgba(34,211,238,0.12)" : "rgba(56,189,248,0.08)"}`,
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {item.status === "demo" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{item.name}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {item.desc}
                      </p>
                      <code
                        className="text-xs mt-1.5 block font-mono"
                        style={{ color: "var(--text-muted)", fontSize: 10 }}
                      >
                        {item.envVar}=&lt;your-value&gt;
                      </code>
                    </div>
                  </div>
                  <Badge
                    className={item.status === "demo" ? "badge-green flex-shrink-0" : "badge-amber flex-shrink-0"}
                  >
                    {item.status === "demo" ? "Active (demo)" : "Not configured"}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}

        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            The application runs fully in demo mode without any external integrations.
            Server-side policy enforcement, spending limits, and recovery workflows are
            always active regardless of configuration status.
          </p>
        </div>
      </div>
    </div>
  );
}
