# FluxCommerce

> Enterprise Commerce & Order Management Platform — a production-oriented showcase of reliable, event-driven backend engineering with a Modular Monolith architecture.

[![.NET](https://img.shields.io/badge/.NET-8-512BD4)](#)
[![Architecture](https://img.shields.io/badge/architecture-modular--monolith-blue)](#)
[![Status](https://img.shields.io/badge/backend-phase%2012%20complete-success)](#)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

---

## What is FluxCommerce?

FluxCommerce is **not** a simple CRUD online store. It's an engineering-focused simulation of a real-world enterprise commerce platform, built to demonstrate how to design and implement reliable, distributed-style business workflows without prematurely reaching for microservices.

The system models the full e-commerce lifecycle — browsing, cart, checkout, payment, and fulfillment — while explicitly handling the hard parts: partial failures, message duplication, consumer crashes, payment gateway timeouts, and eventual consistency across modules.

```text
Customer → Browse → Cart → Checkout → Order → Reserve Inventory
   → Initiate Payment → Pay → Webhook → Confirm Order → Fulfillment
```

Failure paths are treated as first-class scenarios, not edge cases — inventory release on payment failure, retries and DLQ on confirmation failure, idempotent handling of duplicate messages, and full Saga-based compensation.

## Why this project exists

FluxCommerce is built as a portfolio-grade demonstration of:

- Domain-Driven Design & Clean Architecture
- Modular Monolith design (with a real path to service extraction)
- Event-Driven Architecture (Outbox pattern, at-least-once delivery, idempotent consumers)
- Saga Orchestration & Compensating Transactions
- Inventory reservation under concurrency
- Distributed tracing & observability
- Production-grade concerns: security, validation, retries, localization

If it can't answer "what happens if Payment succeeds but Order confirmation fails?" with actual code and tests — it isn't done.

## Architecture

FluxCommerce starts as a **Modular Monolith** and is designed to evolve toward independently deployable services only when justified — not by default.

```text
                    Angular Applications
                 /                       \
       Customer Storefront            Admin Portal
                  \                    /
                   ▼                  ▼
              ASP.NET Core API Host
                       │
              Modular Monolith
        ┌──────────────┼───────────────┐
        ▼              ▼               ▼
      Catalog        Orders         Inventory
                       │
                    Payments
                       │
                 SQL Server ── Redis
                       │
                    Outbox
                       │
                   RabbitMQ
                       │
              Background Workers
                       │
                    Stripe
```

**Business modules:** Catalog · Cart · Orders · Inventory · Payments
**Platform capabilities:** Identity · Observability · Cross-Cutting Infrastructure

Each module owns its domain, application logic, persistence, and public contracts. Cross-module communication happens only through explicit contracts and integration events — never direct database access.

📄 Full specification: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md)

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core (.NET), C# |
| Persistence | SQL Server, EF Core |
| Caching | Redis |
| Messaging | RabbitMQ (Outbox + Idempotent Consumers) |
| Payments | Stripe |
| Observability | OpenTelemetry (tracing, metrics, structured logging) |
| Localization | `en`, `fr`, `de`, `es`, `ar` |
| Frontend | Angular (Storefront — SSR, Admin Portal — CSR) |

## Key patterns demonstrated

- **Modular Monolith** with enforced module boundaries (architecture tests)
- **Transactional Outbox** for reliable event publication
- **Idempotent Consumers** for safe at-least-once message processing
- **Saga Orchestration** for the Order → Inventory → Payment workflow
- **Compensating Transactions** for failure recovery (release inventory, cancel order, refund)
- **Result/Error pattern** for expected business failures vs. exceptions for unexpected technical failures
- **Correlation & Causation IDs** for tracing one business operation across async boundaries

## Project structure

```text
src/
├── ApiHost/                  # ASP.NET Core entry point
├── Modules/
│   ├── Catalog/
│   ├── Cart/
│   ├── Orders/
│   ├── Inventory/
│   └── Payments/
│       └── {Domain, Application, Infrastructure, Contracts}
├── Platform/
│   └── Identity/
└── BuildingBlocks/
    ├── Domain / Application / Infrastructure
    ├── Messaging / Outbox / Idempotency
    ├── Persistence / Observability
    └── Localization / Web

docs/
├── PROJECT_CONTEXT.md        # master specification
├── ARCHITECTURE.md           # architecture specification
├── adr/                      # architecture decision records
├── phases/                   # phase implementation plans
└── completed/                # phase completion reports
```

## Getting started

### Prerequisites

- .NET SDK (see `global.json`)
- Docker (SQL Server, Redis, RabbitMQ)
- Stripe test API keys

### Setup

```bash
# clone
git clone https://github.com/<your-org>/fluxcommerce.git
cd fluxcommerce

# start infrastructure
docker compose up -d

# apply migrations
dotnet ef database update --project src/ApiHost

# run
dotnet run --project src/ApiHost
```

> See [`docs/current/LOCAL_DEVELOPMENT.md`](./docs/current/LOCAL_DEVELOPMENT.md) for full local setup and [`docs/current/EF_CORE_COMMANDS.md`](./docs/current/EF_CORE_COMMANDS.md) for migration workflows.

Swagger/OpenAPI is available at `/swagger` once the API is running, including `Accept-Language` support for all localized culture.

## Roadmap status

| Phase | Scope | Status |
|---|---|---|
| 0 – 11 | Architecture foundation → Reservation Expiry Orchestration | ✅ Complete |
| 12 | Identity roles, authorization & seeding hardening | ✅ Complete |
| Angular Storefront & Admin | Frontend implementation (15-phase plan) | 🚧 In progress |

Full phase-by-phase history: [`docs/completed/INDEX.md`](./docs/completed/INDEX.md)

## Testing

```text
Unit Tests          → Domain rules, Value Objects, Application logic
Integration Tests   → EF Core, SQL Server, Redis, RabbitMQ, Stripe
Architecture Tests  → Module isolation, dependency & layer rules
End-to-End Tests    → Full order lifecycle, including failure paths
```

## Documentation

- [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) — master specification & AI implementation guide
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — architecture specification
- [`docs/adr/`](./docs/adr) — architecture decision records
- [`AGENTS.md`](./AGENTS.md) — AI agent execution protocol for this repo

## License

MIT — see [`LICENSE`](./LICENSE).