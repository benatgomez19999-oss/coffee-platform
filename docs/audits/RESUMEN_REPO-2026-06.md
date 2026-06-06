# RESUMEN_REPO — coffee-platform

> Inspección forense, read-only. Fecha del corte: rama `main`, working tree sucio.
> Destino: orquestador que diseñó la arquitectura en abril 2026 y no ha visto el código desde entonces.

---

## 1. Estructura

- **Mono-repo, no workspace**. Una sola `package.json` en raíz.
- **Gestor**: `npm` (no `pnpm`/`yarn`; existe `package-lock.json` de 287 KB).
- **Lenguaje**: TypeScript 5.x (`strict`). Node con `--experimental-strip-types` para tests pure (no ts-node, no jest).
- **Framework**: Next.js 14.2.5 App Router + React 18.3.1.
- **ORM**: Prisma 5.22 (postgres).
- **Estilos**: Tailwind 4 + estilos inline.

Árbol 2 niveles relevante:

```
coffee-platform/
├── app/                    ← Next.js App Router (rutas + page.tsx + api/)
│   ├── api/                ← 104 route.ts (REST handlers)
│   ├── platform/           ← 14 page.tsx (client/partner/producer/eu-partner/marketplace/contracts)
│   ├── contract/           ← /contract/create wizard, OTP, payment
│   ├── dev/                ← UI dev tools (logistics, pricing, scenarios, market-signal)
│   ├── lab/ legacy/ login/ signup/ onboarding/ ...
│   └── 📄 middleware.ts    ← (sí, el nombre del archivo tiene un emoji)
├── src/
│   ├── services/           ← capa principal de negocio (allocation, clients, contract-request, logistics, lot-media, pricing, producer-*, system, partner, dev, client-dashboard)
│   ├── decision/           ← semaphore, riskModel, decisionPipeline, supplyPlanner, capacityFrontier, etc. (19 archivos)
│   ├── engine/             ← pricing/{producer, client}; market signal feeds
│   ├── brain/              ← cognitiveMemory, regimeLearning (consumido sólo por decisionPipeline)
│   ├── signals/            ← signalRegistry (pluggable signal sources)
│   ├── spatialMarket/      ← REGION_REGISTRY (Brazil, Colombia, …)
│   ├── internal/           ← monitors (supplyCommitmentHealth), agents (founder-briefing)
│   ├── components/         ← React (platform/, dev/, shared/)
│   ├── lib/                ← auth, requireAuth, getUserFromRequest, sendSMS, twilio, email, dev/requireDevRoute
│   ├── database/prisma.ts  ← cliente singleton
│   ├── events/             ← eventBus + EVENTS enum (in-process)
│   ├── AI/ market/ websocket/ clientLayer/ hooks/ utils/  ← módulos auxiliares
├── prisma/                 ← schema.prisma + 24 migraciones + init.sql
├── docs/                   ← documentación viva por sprint
└── public/ styles/ .vscode/ .claude/ node_modules/ .next/
```

Notas: el archivo `📄 middleware.ts` en raíz tiene un emoji literal en el nombre — confirmado por `ls` (probable error de copy/paste en commit antiguo, sigue cargando porque Next.js lo lee por el path tal cual). Hay un archivo `void` vacío en raíz.

## 2. Git

- Rama actual: **`main`** (sin ramas locales adicionales). Remoto: `origin/main`.
- Stashes: **0**.
- Working tree: **86 entradas modificadas** (32 `M`, 54 untracked entre directorios y archivos sueltos). 205 archivos no-trackeados visibles vía `git ls-files --others`.
- Diff sin commitear: **+2 470 / −986** sobre 32 ficheros.
- 6 directorios de migración pendientes (en disco, no en git): `add_client_b2b_price_to_pricing_snapshot`, `add_market_signal_tick_history`, `add_lot_media_log`, `add_farm_media`, `add_lot_media_visibility`, `add_demand_intent_request_persistence`. **El último commit en `prisma/migrations/` fue `a563250 add destination tracking stages`**; todo lo posterior está sin commitear.

Últimos 15 commits (HEAD primero):

```
7d564d3 feat: polish unified logistics tracking panel
8a47a6b feat: FIX 404 ERROR ON DEV BYPASS LOGISTICS PANEL
395debc feat: add unified logistics tracking panel
a563250 feat: add destination tracking stages for shipments
ce86fd4 chore: harden dev logistics tooling and add tracking helpers
eb9d431 feat: add origin to EU shipment bridge
0f3cfdc feat(eu-partner): dashboard + dev bypass route
32d898d feat: implement EU Partner operational dashboard and roast control panel
0071d3d dasboard new design concept
269069a dasboard reinterpretation
0065ec7 fix animation skip bug
31e5aec fix dasboard entry bug
7499a5e fix: restore shared header on client dashboard
cb9f097 fix window location ref on partner wizrad platform
6dd6a1f fix window location ref on partner wizrad
```

> ⚠️ **Toda la cadena BUYER-PROOF-* / PARTNER-MEDIA-UI-1 / CONTRACT-REQUEST-3 / ALLOC-* / LOT-MEDIA-* / STORAGE-MEDIA-1 / PRICING-B2B-3 vive en working tree sin commitear.** Para reproducir el estado actual hay que aplicar el diff + las 6 migraciones pendientes.

## 3. Stack y datos

- **Auth**: JWT propio (`jsonwebtoken`) + cookies `auth_token`. `bcryptjs` para passwords. OTP por SMS (`twilio`) + correo (`@sendgrid/mail` o `resend`).
- **Pagos**: Stripe (`stripe` v20). Webhook en `app/api/stripe/webhook/route.ts` flipa `Contract.status → ACTIVE`.
- **Storage**: Supabase Storage v2 (`@supabase/supabase-js`). Dos buckets: `lot-media-public` y `lot-media-private` (BUYER-PROOF-1).
- **PDF**: `@react-pdf/renderer` (etiquetas de lot).
- **OpenAI**: `openai` v6 — sólo en `internal/agents/founder-briefing` y `assistant/` (chat/story).
- **DB**: PostgreSQL via Prisma; un único `provider = "postgresql"` en `migration_lock.toml`.

### Modelos del esquema (prisma/schema.prisma, 1173 líneas)

Entidades principales (con docs/audits/SCHEMA-AUDIT-2026-05-09.md como referencia profunda):

| Modelo | Rol | Relaciones clave | Estado |
|---|---|---|---|
| `User`, `Company`, `Producer`, `Farm` | Auth + multi-tenancy + onboarding productor | `User—Company` n:1; `Producer—User` 1:1; `Farm—Producer` n:1 | Estable |
| `ProducerLotDraft` → `GreenLot` | Lote del productor antes/después de verificación | `ProducerLotDraft.greenLotId? @unique` 1:1; `GreenLot.farmId`; `GreenLot.shipmentId?` | `verifyLotService` crea `GreenLot` desde draft |
| `GreenLot` | Lote verde marketplace-ready | `pricingSnapshot` 1:1; `media` (GreenLotMedia); `fulfilment` 1:1; `contracts[]`; `demandIntents[]`; `shipment?` | `availableKg` **nunca se decrementa por contratos** — el saldo se calcula sumando compromisos en `supply.service.ts` |
| `PricingSnapshot` | Foto del precio al verificar lot | `lot @unique` 1:1 | Lleva `clientB2BPricePerKg` (PRICING-B2B-3) además del legacy `clientPricePerKg` (GREEN) |
| `Contract` | Compromiso B2B mensual | `company`, `greenLot?`, `roastedBatch?`, `orders[]`, `demandIntents[]`, `signatureTokens[]` | Estados: PENDING/AWAITING_SIGNATURE/SIGNED/PAYMENT_PENDING/ACTIVE/PAST_DUE/COMPLETED/CANCELLED |
| `DemandIntent` | Reserva probabilística pre-contrato | `company`, `greenLot?`, `contract?` | Estados: OPEN/COUNTERED/WAITING/CONSUMED/EXPIRED/REJECTED/CANCELLED. **+ `requestedDurationMonths`, `requestedStartDate` (CONTRACT-REQUEST-3, sin commitear)** |
| `Order` / `OrderItem` / `RoastBatch` / `RoastedBatch` | Pipeline de tostado (legacy) | — | Casi inerte; `Order.contractId?` es nullable y no se usa por `monthlyPrice`-based contracts |
| `Shipment` (LOG-1) | Bridge Origin → EU | `greenLots[]` 1:N; `currentStage: DestinationTrackingStage?` (LOG-3A) | Estados: IN_TRANSIT/ARRIVED/RECEIVED/DISCREPANCY |
| `ProducerFulfilment` | Tarea física productor | `greenLotId @unique` 1:1 | Estados: AWAITING_CONFIRMATION/CONFIRMED/SACKS_MARKED_CONFIRMED/COURIER_VERIFIED — **`COURIER_VERIFIED` nunca se escribe en producción** |
| `GreenLotMedia`, `FarmMedia` | Media por lot y por farm | `role`, `source`, `visibility (PUBLIC_MARKET/BUYER_PRIVATE/INTERNAL_ONLY)` | LOT-MEDIA-1/2 + BUYER-PROOF-1. `url` puede ser un URL público o `supabase://<bucket>/<path>` |
| `MarketSignalSnapshot`, `MarketSignalTick` | Señales C-price / demanda | sin FK | Append-only por contrato (no enforced); `isActive=true` debería ser único pero **no hay índice** |
| `CommitmentHealthSnapshot` | Audit del monitor de salud (append-only) | sin FK | Estable |
| `SignatureToken`, `OTPCode`, `VerificationToken`, `PasswordResetToken` | Tokens | — | Estable |
| `FarmStory` | Story IA del productor | `farm` | Aux (assistant) |

24 migraciones en disco. **Las últimas 6 NO están commiteadas** (ver §2). La última en disco (`20260514000000_add_demand_intent_request_persistence`) sólo añade dos columnas nullables en `DemandIntent`.

## 4. Dominio — entidades pedidas

| Entidad | Archivo | Estado |
|---|---|---|
| **GreenLot** | `prisma/schema.prisma:127` + `src/services/allocation/snapshot/*.ts` + `app/api/marketplace/lots/route.ts` | **Completo**. Producción de lots vía `verifyLotService`; lifecycle DRAFT→PUBLISHED→RESERVED. **SOLD nunca se escribe en producción** (`grep` confirma 0 writes). |
| **Contract** | `src/services/clients/contracts.service.ts` (401 LOC) | **Completo**. `createContractWithSupplyValidation`, `amendContractWithSupplyValidation` (3 ramas: increase/decrease/switch-coffee). Drift guard CONTRACT-REQUEST-2 integrado. Activation por Stripe webhook. |
| **DemandIntent** | `src/services/clients/demandIntent.service.ts` (~520 LOC tras CONTRACT-REQUEST-3) | **Completo**. `createDemandIntent` + `acceptCounteroffer` + `waitForSupply` + `confirmWaiting` (con drift guard) + `cancelIntent` + queries. |
| **SupplyService** | `src/services/system/supply.service.ts` (288 LOC) | **Completo**. `getContractableSupply({ greenLotId?, excludeIntentId?, tx? })`. SAFETY_BUFFER_KG=400 hard-coded; única autoridad de buffer. |
| **SemaphoreService** | `src/decision/semaphoreEvaluator.ts` + `semaphoreLogic.ts` | **Completo** como helper puro. Sólo se invoca desde `demandIntent.service.ts:145` para una sola decisión (CREATE intent). `decisionPipeline.ts` existe pero **no se llama desde ningún route ni service productivo** — sólo desde un endpoint interno (`/api/internal/monitors/...`) y desde scripts del brain. |
| **RiskSignal** | `src/signals/signalRegistry.ts` + `src/decision/riskModel.ts` + `src/decision/supplyCascadeRisk.ts` + `src/decision/regionalRiskDiagnostics.ts` + `src/decision/anticipatoryShortage.ts` | **Parcial / no conectado**. La infra existe (registry + 6 evaluadores de riesgo) pero `riskScore = 0.2` hard-coded en `demandIntent.service.ts:148`. El pipeline real no alimenta `evaluateSemaphore`. |

## 5. Capas — Real Supply / Risk-Simulation / Decision-Semaphore / Execution-Contract

| Capa | Estado | Notas |
|---|---|---|
| **Real Supply** | ✅ Implementada y autoritativa. `src/services/system/supply.service.ts` deduce `contractableKg = grossAvailable − committedByContracts − reservedByIntents − SAFETY_BUFFER`. Lee `GreenLot.availableKg` + `Contract.monthlyGreenKg` activos + `DemandIntent` OPEN. Único punto que aplica SAFETY_BUFFER_KG (400). |
| **Risk-Simulation** | ⚠️ Aislada. `src/decision/` y `src/brain/` simulan estados (`decisionPipeline`, `decisionMemory`, `cognitiveMemory`, `regimeLearning`) pero **no escriben en `Supply` ni en `GreenLot`** — viven en memoria del proceso. No hay ningún route de producción que llame a `decisionPipeline`. Las simulaciones que sí ejecutan son `internal/monitors/supplyCommitmentHealth` (lectura + escritura append-only en `CommitmentHealthSnapshot`) y `internal/agents/founder-briefing` (sólo lectura). **No detecto violaciones** de simulación → supply real. |
| **Decision-Semaphore** | ✅ Helper puro `evaluateSemaphore(input)`. Recibe `availableNow` calculado por SupplyService dentro de una `prisma.$transaction`. El semáforo no consulta el frontend; el frontend sólo lee el resultado en la response. |
| **Execution-Contract** | ✅ `contracts.service.ts` re-valida supply dentro de `prisma.$transaction` (líneas 96, 267, 311, 365) antes de cualquier insert/update. Drift de precio (CONTRACT-REQUEST-2) corre en la misma tx. `createShipment` (`src/services/logistics/shipment.service.ts`) re-valida también: lote PUBLISHED + no reservado + proof `BUYER_PRIVATE TRACEABILITY_BAG` (BUYER-PROOF-2B) — todo dentro de una `$transaction`. |

**Violaciones detectadas: ninguna grave.** Un detalle:

- `riskScore = 0.2` literal en `demandIntent.service.ts` → el semáforo nunca recibe riesgo real del Risk-Simulation layer. Es una decisión consciente (el pipeline existe pero está desconectado a propósito).
- `availableKg` en `GreenLot` no se decrementa nunca al firmar contratos. Esto es **diseño**, no bug: la verdad de supply se recomputa cada vez vía `supply.service.ts`. Pero implica que cualquier consumidor que lea `GreenLot.availableKg` directamente está leyendo gross supply, no contractable. (`/api/marketplace/lots` usa allocation snapshot, no este campo crudo — está bien.)

## 6. API

104 `route.ts`. Autenticación dominante: cookie `auth_token` (JWT propio) leída por `requireAuth` o `getUserFromRequest`. Validación: helpers `*pure.ts` por dominio.

Bloques principales (con auth resumida):

- **auth**: `/api/auth/{signup,login,logout,me,verify,resend-verification,forgot-password,reset-password}` — públicos donde corresponde, JWT en login/me.
- **company**: `/api/company/{me,update}` — `requireAuth`.
- **contracts**: `/api/contracts/{route,create,amend,catalog,create-payment-session,send-otp,verify-otp,[contractId]/proof-media}` — CLIENT-scoped, multi-tenant por `companyId`.
- **demand-intent**: `/api/demand-intent/{route, [id]/route, [id]/accept, [id]/wait, [id]/confirm, [id]/cancel}` — CLIENT only.
- **partner**: `/api/partner/{dashboard,export-ready,lots,lots/[id],lots/[id]/verify,lots/[id]/publish,lots/[id]/media*,farms/[farmId]/media*,shipments,orders/[id]/prepare,orders/[id]/ready,market-signal}` — PARTNER/ADMIN.
- **producer**: `/api/producer/{route,dashboard,settings,farms,farms/[farmId]/media*,farms/[farmId]/media-readiness,lots/[id]/media*,lot-draft,lot-draft/[id]/send-to-lab,fulfilment/[id]/confirm,fulfilment/[id]/confirm-sacks-marked}` — PRODUCER (ownership-checked).
- **eu-partner**: `/api/eu-partner/shipments`, `.../[id]/receive` — EU_PARTNER role.
- **internal**: `/api/internal/{allocation/run, allocation/lot/[id], pricing/*, monitors/supply-commitment-health/run, agents/founder-briefing/run}` — gated por `INTERNAL_DEV_TOOLS_ENABLED=true` + no producción.
- **dev**: `/api/dev/{login-as,logistics/*,partner/*,scenarios/*,orders/seed,reset-contracts}` — todos vía `requireDevRoute()` (`NODE_ENV==="development"` + `INTERNAL_DEV_TOOLS_ENABLED=true`).
- **stripe**: `/api/stripe/webhook` — firma Stripe.
- **marketplace**: `/api/marketplace/lots` — `requireAuth`.
- **pricing**: `/api/pricing/{client/preview, producer/preview}` — auth básica.

**Verificación transaccional de supply en creación de contratos**: ✅. `src/services/clients/contracts.service.ts:96` abre `prisma.$transaction` y dentro llama `getContractableSupply({greenLotId, excludeIntentId, tx})`. Si `monthlyGreenKg > supply.contractableKg` → `INSUFFICIENT_SUPPLY` (409). El mismo patrón se replica en `amendContractWithSupplyValidation` y en `createShipment`.

## 7. Frontend

App Router con 14 `page.tsx` bajo `/platform/*` + páginas auxiliares.

Páginas clave:

- `/platform/client` (`Dashboard.tsx`) — vista de cliente: catalog de lots contratables + `ConfigureMonthlySupplyModal` + `SupplyContractsPanel` (con `ContractProofMediaPanel` expandible por contrato).
- `/platform/marketplace` — feed marketplace driven por allocation engine (ALLOC-3).
- `/platform/partner` + `/platform/partner/lots` (incluye `ExportReadyPanel` con badge proof + CTA) + `/platform/partner/lots/[id]/label` + `/platform/partner/media` (PARTNER-MEDIA-UI-1).
- `/platform/producer` + `/platform/producer/lots/new` + `/platform/producer/media`.
- `/platform/eu-partner` — dashboard EU partner + roast control.
- `/contract/create` (con wizard 3+ pasos, `intentId`/`duration`/`volume` params), `/contract/payment`, `/contract/pilot`, `/contract/verify-otp`.
- `/dev/*` — pricing inspector, market-signal admin, scenarios, logistics tracking.

**Flujo GREEN/YELLOW/RED en UI**: conectado a backend real. `ConfigureMonthlySupplyModal` POSTea `/api/demand-intent`, recibe `{intent, semaphore}` y `formatDemandIntentOutcome` (pure helper) lo mapea a `approved`/`counter`/`rejected` con CTAs reales (continuar contrato / aceptar contraoferta / unirse a waitlist). El `semaphore.status` viene del backend, no es mock. Las decisiones del decisionPipeline/brain **no llegan al UI**.

**Mockeado vs real**:

- Mock que queda visible: `/lab` (sandbox de animaciones), `/legacy`, partes del onboarding decorativo.
- Real: marketplace, dashboard de cliente, contratos, partner-lots, partner-media, producer-media, EU partner, contract wizard, shipment tracking, proof endpoints.

## 8. Tests

- **Framework**: `node --test` (built-in) con `--experimental-strip-types` para correr TypeScript directamente. **Sin Jest, sin Vitest, sin Playwright**.
- **Suite**: `npm run test:allocation` corre todos los `__tests__/*.test.ts` en estas carpetas:
  - `src/services/allocation/{,contracts/}__tests__/`
  - `src/services/client-dashboard/__tests__/`
  - `src/services/dev/scenarios/__tests__/`
  - `src/services/pricing/__tests__/`
  - `src/engine/pricing/client/__tests__/`
  - `src/services/lot-media/__tests__/`
  - `src/components/platform/media/__tests__/`
  - `src/services/producer-settings/__tests__/`
  - `src/services/producer-onboarding/__tests__/`
  - `src/services/contract-request/__tests__/`
- **Cuántos**: **40 ficheros de test**, **~901 casos** (corrida más reciente: `901 / 901 pass` tras CONTRACT-REQUEST-3).
- **Qué cubren**: helpers puros (mappers, validadores, drift, semaphore inputs, media readiness, label renderers, allocation engine, snapshot mapping, pricing engine, market signal). **Sin tests de integración Prisma**: no hay harness para `$transaction`. Los servicios que tocan DB se validan manualmente (cada doc trae sección §Manual validation).
- **Test no incluido en la suite**: `src/internal/monitors/supplyCommitmentHealth/__tests__/integration.skipped.ts` — saltado deliberadamente, requeriría DB.
- **Seguridad de ejecución**: la suite es 100% pure (no escribe a BD). **Seguro de ejecutar**. La última corrida observada en sesión devuelve `901 / 901 pass` en ~6.3 s.

## 9. Riesgo y deuda

- **TODOs/FIXMEs**: sólo **3 ocurrencias en src/**: 1 en `engine/pricing/client/calculateMarketplaceB2BPricing.ts`, 2 en el test saltado `supplyCommitmentHealth/__tests__/integration.skipped.ts`. Más algunas en routes internas (`/api/internal/agents/founder-briefing/run`, `/api/internal/monitors/...`, `/api/signature-legacy/request`). **No hay deuda inflamada**.
- **Secretos**: `.env` y `.env.local` **no trackeados** (gitignore `.env*`). El `.env` local contiene placeholders explícitos (`super_secret_ultra_long_random_string`, `tu_secret_largo`); fuera del repo, riesgo cero. No hay claves hardcoded en código.
- **Código muerto / legacy adyacente a dinero**:
  - `/api/signature-legacy/*` — firma legacy aún expuesta.
  - `Order` / `OrderItem` / `RoastBatch` modelos casi inertes; contratos monetizan por `monthlyPrice` directo. Confunde a quien lea schema cold.
  - `ProducerFulfilment.COURIER_VERIFIED` enum value nunca se escribe.
  - `LotStatus.SOLD` nunca se escribe.
  - `app/legacy/`, `app/lab/`, archivo raíz `void` (vacío) y `📄 middleware.ts` (con emoji en el nombre).
- **Riesgo de pago / dinero**:
  - Stripe webhook (`/api/stripe/webhook`) flipa `Contract.status → ACTIVE`. **Idempotencia presente** (`if (existing.status === "ACTIVE") return`). Sin reentry test.
  - `Contract.lockedPricePerKg` se reescribe en switch-coffee amend — documentado pero implica que el "precio firmado" no es inmutable cuando hay amend.
  - `previewPricePerKg` en `DemandIntent` ahora invariante post-creación (CONTRACT-REQUEST-3 lo refuerza); `confirmWaiting` ya no lo muta.
  - Pricing engine v1 (`pricingVersion: "v1"`) hard-coded en `lotVerification.service.ts:377` y `clientPricePerKg` legacy y `clientB2BPricePerKg` nuevo coexisten — el resolver `clientB2BPrice.ts` decide. Espacio real para divergencia hasta que se haga el rename.
- **Migraciones pendientes en disco no commiteadas**: 6 directorios. Bloquearán cualquier despliegue limpio si el deploy parte de `git pull`. Hay que commitear o aplicar manual + commit antes de soltarlo al orquestador.
- **`__middleware.ts` con emoji** en raíz: nombre no portable, riesgo en Linux/CI si el filesystem no soporta el codepoint (Vercel lo tolera, pero no apuesto a ello tras un upgrade).

## 10. Plan vs realidad

`README.md` es el boilerplate stock de `create-next-app` — **sin valor arquitectónico**. No hay `ARCHITECTURE.md`. La doc viva está en `docs/`:

- `docs/audits/SCHEMA-AUDIT-2026-05-09.md` (481 líneas) — auditoría exhaustiva de esquema + mutabilidad + semáforo + supply. **Es la fuente fiable para el orquestador.**
- `docs/contracts/` — CONTRACT-REQUEST-1 / 2 / 3 (modal → intent → drift guard creación → persistencia duración / drift wait-confirm).
- `docs/allocation/` — ALLOC-1 / 2 / 3 / 4-CONTRACT-CATALOG-1 (motor de allocation, snapshots, marketplace API + UI, contract catalog).
- `docs/lot-media/` — 10 sprints: LOT-MEDIA-1/2, FARM-MEDIA-1, PARTNER-MEDIA-2A, STORAGE-MEDIA-1, DASHBOARD-IMAGES-1, BUYER-PROOF-1/2B, PRODUCER-PROOF-POLISH, PARTNER-MEDIA-UI-1.
- `docs/pricing/`, `docs/client-dashboard/`, `docs/dev-tools/`, `docs/producer-settings/`, `docs/producer-onboarding/`.

**Lo planificado en abril 2026 vs lo hecho**:

- Capa de supply real + semáforo + ejecución transaccional: **hecho**.
- Allocation engine + snapshots + marketplace + catálogo contractable: **hecho** (ALLOC-1..4).
- Pricing B2B roasted con resolver canónico + breakdown persistido: **hecho** (PRICING-B2B-3, refresh service).
- Demand intent end-to-end (semaphore green/yellow/red + waitlist + counteroffer + cancel + persistencia duración + drift guards): **hecho** (CONTRACT-REQUEST-1/2/3).
- Lot media (público/privado) + storage Supabase + buyer proof gating + UI partner: **hecho** (LOT-MEDIA-*, BUYER-PROOF-*, PARTNER-MEDIA-UI-1).
- Shipment bridge Origin→EU + destination tracking + proof-gated createShipment: **hecho** (LOG-1, LOG-3A, BUYER-PROOF-2B).
- Risk-Simulation + Decision Pipeline + brain learning: **infra existe, no conectada** a flujos transaccionales. Decisión consciente.
- Final export bag role separado, override admin, audit log de gates, denormalización proofReady, notificaciones: **no hecho** (recomendaciones recurrentes en docs).

---

## 5 cosas que el orquestador debe saber antes de planificar el siguiente sprint

1. **El working tree es la verdad, no `main`.** 6 migraciones + ~32 archivos modificados + 50+ untracked llevan toda la cadena BUYER-PROOF / PARTNER-MEDIA-UI-1 / CONTRACT-REQUEST-3 / ALLOC / LOT-MEDIA / STORAGE-MEDIA-1. Antes de planificar nada en `main`, hay que decidir cómo commitear (probable: una serie de commits por sprint usando los docs de `docs/` como guía). Sin ese commit, cualquier deploy regresa el sistema a abril 2026.

2. **El semáforo está vivo pero el risk pipeline está desconectado a propósito.** `evaluateSemaphore` se llama con `riskScore = 0.2` literal desde `demandIntent.service.ts:148`. `src/decision/decisionPipeline.ts` + `src/brain/*` existen y compilan pero ningún route de producción los invoca. Si el siguiente sprint quiere "encender el risk", hay un módulo entero (`signals/signalRegistry`, `riskModel`, `supplyCascadeRisk`, `anticipatoryShortage`, `regionalRiskDiagnostics`) listo para conectar — pero hacerlo cambia las decisiones del semáforo en producción y no hay tests de regresión que cubran esa derivada.

3. **`GreenLot.availableKg` y `LotStatus.SOLD` son trampas de lectura.** `availableKg` NO se decrementa al firmar contratos — la verdad de supply se recomputa siempre vía `supply.service.ts:getContractableSupply`. Y `SOLD` no se escribe nunca en producción (`PUBLISHED → RESERVED` es el último write real). Cualquier consumidor que toque estos campos directos sin pasar por la pipeline está leyendo basura. El próximo sprint que toque inventario debe respetar este contrato.

4. **Tests: 40 ficheros / 901 casos, 100% pure.** No hay harness Prisma. Cada sprint nuevo que toque transacciones DB cierra el ciclo con manual validation documentada en su `docs/`. Si el orquestador necesita verificar regresiones de allocation/pricing/drift/media, los tests pure responden en ~6 s. Para regresiones transaccionales (contratos, shipment, fulfilment, stripe), no hay automatismo: o se construye harness Prisma (sprint propio) o se acepta validation manual.

5. **Capas separadas, transacciones limpias, sin puentes mock.** Real Supply + Decision Semaphore + Execution Contract corren dentro de la misma `prisma.$transaction`, sin que el frontend influya en la decisión y sin que la Risk Simulation alimente datos vivos. Drift de precio (CONTRACT-REQUEST-2/3) y proof gate (BUYER-PROOF-2B) son los dos guardrails atómicos. Cualquier sprint que rompa una de estas tres reglas (frontend en el semáforo, simulación escribiendo supply, gate fuera de transacción) introduce el primer agujero estructural de la plataforma — hasta hoy no existe ninguno. Mantener esa invariante es probablemente más valioso que cualquier feature nueva del próximo sprint.
