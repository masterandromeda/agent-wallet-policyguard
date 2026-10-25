# Agent Wallet – PolicyGuard

> **ERC-4337 Account Abstraction Smart Wallet with AI Agent Policy Enforcement**  
> Owner-defined spending policies enforced at the smart-contract validation layer — not in the UI or AI model.

---

## ⚠ Current Status: Foundation / Dashboard Shell

This is the **Phase 1 foundation build**. The following is working:

| What works now | Status |
|---|---|
| Next.js 15 + TypeScript + Tailwind CSS project | ✅ |
| Premium fintech dashboard UI with dark navy sidebar | ✅ |
| Overview page with stats, charts, activity feed | ✅ |
| AI Agent Management page with budgets, permissions | ✅ |
| Policy Management page with rule visualization | ✅ |
| Owner Approval Center with pending/resolved flows | ✅ |
| Transaction History & Audit Trail with full table | ✅ |
| Risk Monitoring with explainable alerts | ✅ |
| Settings page with wallet/contract configuration | ✅ |
| All TypeScript types for the full domain model | ✅ |
| REST API route scaffolding (`/api/agents`, `/api/transactions`, `/api/policies`) | ✅ |
| SSE endpoint (`/api/events`) for real-time architecture | ✅ |
| Prisma schema (SQLite dev / PostgreSQL prod) | ✅ |
| Solidity contract placeholders (SmartWallet, Paymaster) | ✅ |
| `.env.example` with all required variables | ✅ |

| What is **NOT** yet working | Phase |
|---|---|
| Real blockchain transactions | Phase 2 |
| ERC-4337 smart contracts deployed | Phase 2 |
| Wallet connection (MetaMask / WalletConnect) | Phase 2 |
| Real AI agent integration | Phase 3 |
| Live real-time SSE from blockchain events | Phase 2 |
| Database migrations and real data persistence | Phase 2 |

**All data shown in the dashboard is clearly labeled as SIMULATED DEMO DATA.**

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local

# 3. Run development server
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/        # Dashboard route group (sidebar layout)
│   │   ├── layout.tsx      # Sidebar shell
│   │   ├── page.tsx        # Overview
│   │   ├── agents/         # AI Agent Management
│   │   ├── policies/       # Policy Management
│   │   ├── approvals/      # Owner Approval Center
│   │   ├── transactions/   # Transaction History & Audit Trail
│   │   ├── risk/           # Risk Monitoring
│   │   └── settings/       # Settings
│   └── api/
│       ├── agents/         # GET /api/agents
│       ├── transactions/   # GET /api/transactions
│       ├── policies/       # GET /api/policies
│       └── events/         # GET /api/events (SSE)
├── components/
│   ├── layout/             # Sidebar, TopBar
│   ├── ui/                 # Shared components (Card, Badge, Button, Table…)
│   └── charts/             # Recharts wrappers
├── lib/
│   ├── types.ts            # All TypeScript domain types
│   ├── mock-data.ts        # CLEARLY LABELED simulated data
│   └── utils.ts            # Formatting, color utilities
contracts/
├── SmartWallet.sol         # ERC-4337 account (placeholder)
└── PolicyGuardPaymaster.sol # Policy enforcement (placeholder)
prisma/
└── schema.prisma           # DB schema (ready for migration)
```

---

## Security Architecture

```
AI Agent (UserOperation)
    ↓
ERC-4337 EntryPoint
    ↓
PolicyGuardPaymaster.validatePaymasterUserOp()
    ↓ Checks all policy rules on-chain
    ↓ ─ Agent suspended? → REJECT
    ↓ ─ Amount > per-tx limit? → REJECT
    ↓ ─ Daily limit exceeded? → REJECT
    ↓ ─ Unapproved recipient? → REJECT
    ↓ ─ Unapproved contract? → REJECT
    ↓ ─ Requires owner approval? → REJECT (pending approval)
    ↓
Transaction executed
```

**Key principle:** AI risk scores are advisory signals. They cannot override on-chain policy enforcement.

---

## Phase 2 – Smart Contract Integration

1. Install Hardhat: `npm install --save-dev hardhat`
2. Complete `contracts/SmartWallet.sol` (implement `validateUserOp`)
3. Complete `contracts/PolicyGuardPaymaster.sol` (implement all policy checks)
4. Deploy to Sepolia: `npx hardhat run scripts/deploy.ts --network sepolia`
5. Update `.env.local` with deployed contract addresses
6. Connect ethers.js / viem in frontend

## Phase 3 – AI Agent Integration

1. Define agent execution environment (LangChain / AutoGen / custom)
2. Agents submit ERC-4337 UserOperations to the bundler
3. Frontend connects to bundler for live transaction status
4. SSE endpoint (`/api/events`) receives bundler webhooks

---

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Recharts
- **Backend:** Next.js API Routes (Node.js)
- **Database:** SQLite (dev) / PostgreSQL (prod) via Prisma
- **Blockchain:** Ethereum Sepolia, ERC-4337, Solidity 0.8.23
- **Real-time:** Server-Sent Events (architecture ready)
- **Smart Wallet:** ERC-4337 Account Abstraction + Custom Paymaster
