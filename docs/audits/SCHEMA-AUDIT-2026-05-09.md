# Auditoría exhaustiva del codebase `coffee-platform`

> Audit fecha: 2026-05-09. Read-only. Citas se refieren a paths absolutos en `c:\Users\benat\coffee-platform\` y a líneas concretas. Donde haya ambigüedad que no pude resolver, lo marco explícitamente.

---

## 1. Tabla de entidades principales

| Entidad | Propósito | Campos clave | Relaciones clave | Notas de mutabilidad |
|---|---|---|---|---|
| `Producer` ([prisma/schema.prisma:14](prisma/schema.prisma#L14)) | Onboarding del productor real (1:1 con `User`). | `id`, `userId @unique`, `name`, `country`. | `User` (1:1), `Farm[]`, `ProducerFulfilment[]`. | Inmutable post-creación en práctica; no hay route de update. |
| `Farm` ([prisma/schema.prisma:34](prisma/schema.prisma#L34)) | Granja física. Lleva `altitude` (input crítico de pricing). | `name`, `altitude`, `region`. | `Producer`, `GreenLot[]`, `FarmStory[]`. | Mutable libremente — sin event log. Romper `altitude` rompe pricing. |
| `ProducerLotDraft` ([prisma/schema.prisma:50](prisma/schema.prisma#L50)) | Draft del productor antes de verificación. | `lotNumber @unique`, `parchmentKg`, `estimatedGreenKg`, `conversionRate (0.8)`, `status: LotDraftStatus`, `greenLotId? @unique`. | `GreenLot?` 1:1. | `status` y `greenLotId` cambian en `verifyLotService`. |
| `GreenLot` ([prisma/schema.prisma:116](prisma/schema.prisma#L116)) | Lote verde marketplace-ready. | `lotNumber @unique`, `totalKg`, `availableKg`, `pricePerKg`, `currency=EUR`, `status: LotStatus`, `shipmentId?`. | `Farm`, `PricingSnapshot` 1:1, `Shipment?`, `Contract[]`, `DemandIntent[]`. | `availableKg` **nunca se decrementa por contratos** — ver §14. `status` cambia en publish/shipment. `shipmentId` exclusivo (1 lot ↔ 1 shipment). |
| `PricingSnapshot` ([prisma/schema.prisma:265](prisma/schema.prisma#L265)) | Foto del precio al verificar el lot. | `producerPricePerKg`, `clientPricePerKg` (legacy GREEN), `marginPerKg=0`, `clientB2BPricePerKg?`, `clientB2BPricingVersion?`, `clientB2BPricingMode?`, `breakdown Json?`. | `GreenLot` 1:1. | Campos B2B se actualizan por `clientB2BPriceRefresh.service.ts`. Producer/legacy fields nunca se reescriben tras la primera verificación. |
| `Contract` ([prisma/schema.prisma:375](prisma/schema.prisma#L375)) | Compromiso B2B mensual. | `monthlyVolumeKg` (ROASTED), `monthlyGreenKg?` (GREEN), `lockedPricePerKg?`, `roastYieldAtCreation?`, `pricePerBag`, `bagsPerDelivery`, `monthlyPrice`, `status`. | `Company`, `GreenLot?`, `RoastedBatch?`, `Order[]`, `DemandIntent[]`. | `lockedPricePerKg` y `roastYieldAtCreation` se reescriben en switch-coffee amend; `monthlyVolumeKg`/`monthlyGreenKg`/`pricePerBag`/`bagsPerDelivery`/`monthlyPrice` también. `status` cambia en webhook + signature flow. |
| `DemandIntent` ([prisma/schema.prisma:455](prisma/schema.prisma#L455)) | Reserva probabilística antes de Contract. | `requestedKg` (ROASTED), `deltaKg` (GREEN), `offeredKg?`, `roastYieldAtEval?`, `previewPricePerKg?`, `priceLocked`, `semaphore`, `status: OPEN/COUNTERED/WAITING/CONSUMED/EXPIRED/REJECTED/CANCELLED`, `expiresAt`. | `Company`, `GreenLot?`, `Contract?`. | `status`, `deltaKg`, `requestedKg` mutables vía service. No hay ningún job que ponga `EXPIRED` automáticamente. |
| `MarketSignalSnapshot` ([prisma/schema.prisma:741](prisma/schema.prisma#L741)) | Señal de mercado (cPrice + demandIndex). | `cPrice`, `demandIndex`, `source: MarketSignalSource`, `isActive: Boolean default(true)`, `validFrom`, `expiresAt?`. | Sin FK a otras entidades. | `isActive=true` debería ser único, pero **no hay índice único** que lo garantice (ver §3 y §4). |
| `MarketSignalTick` ([prisma/schema.prisma:777](prisma/schema.prisma#L777)) | Tabla append-only de muestreos de proveedores. | `providerId`, `providerKind`, `cPrice`, `demandIndex?`, `confidence?`, `rawValue?`, `capturedAt`. | Sin FK. | Append-only por contrato (documentado), no enforced en DB. |
| `Shipment` ([prisma/schema.prisma:974](prisma/schema.prisma#L974)) | Bridge Origin → EU. | `reference @unique`, `status: ShipmentStatus`, `currentStage: DestinationTrackingStage?`, `destinationCountry?`, `requiresDestinationCustoms`. | `GreenLot[]` (1:N). | Status y currentStage mutables. No hay enforce de orden de stages. |
| `ProducerFulfilment` ([prisma/schema.prisma:832](prisma/schema.prisma#L832)) | Tarea física productor. | `greenLotId @unique`, `orderId`, `producerId`, `status`. | `GreenLot` 1:1, `Order`, `Producer`. | Una fulfilment por GreenLot (ENFORCED via `@unique`). |
| `Order` / `OrderItem` ([prisma/schema.prisma:423](prisma/schema.prisma#L423)) | Pedido + items (legacy roasted-batch). | `status`, `bags`, `pricePerBag`. | `Company`, `Contract?`, `RoastedBatch`. | Sin pipeline activo en MVP — los contratos van por monthlyPrice no por OrderItem. |
| `RoastBatch` / `RoastedBatch` ([prisma/schema.prisma:232](prisma/schema.prisma#L232)) | Tostado físico (legacy). | `inputKg`, `outputKg`, `bagCount`, `bagSizeKg=20`. | `GreenLot`, `RoastBatch?`. | `bagCount` decrementado por `inventory.service.ts:42`. |
| `CommitmentHealthSnapshot` ([prisma/schema.prisma:875](prisma/schema.prisma#L875)) | Audit append-only del monitor de salud. | `runId @unique`, `inputFingerprint`, `metrics Json`. | Sin FK. | Append-only por contrato. |
| `Company` / `User` / `OTPCode` / `SignatureToken` / `VerificationToken` / `PasswordResetToken` | Multi-tenant + auth. | — | — | Estándar. |

---

## 2. Significado de cada campo crítico

### `PricingSnapshot.clientPricePerKg` ([prisma/schema.prisma:278](prisma/schema.prisma#L278))

- **Tipo**: `Float` (no nullable).
- **Unidad**: **EUR / kg GREEN** (a pesar del nombre).
- **Escrito por**:
  - [src/services/partner/lotVerification.service.ts:262](src/services/partner/lotVerification.service.ts#L262) — `clientPricePerKg: pricing.finalPrice` (igual a `producerPricePerKg`, `marginPerKg = 0`).
  - [src/services/dev/scenarios/devLotScenario.service.ts:464](src/services/dev/scenarios/devLotScenario.service.ts#L464) — idéntico.
  - El refresh service ([src/services/pricing/clientB2BPriceRefresh.service.ts:251](src/services/pricing/clientB2BPriceRefresh.service.ts#L251)) **NO toca** este campo (documentado en cabecera).
- **Leído por**:
  - Resolver canónico [src/services/pricing/clientB2BPrice.ts:88](src/services/pricing/clientB2BPrice.ts#L88) como fallback legacy.
  - [src/services/clients/market.service.ts:105](src/services/clients/market.service.ts#L105) directamente como green price (NO pasa por el resolver — branch heredado).
  - [src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts:237](src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts#L237) como `greenPricePerKg` autoritativo.
  - [src/services/pricing/clientB2BPriceRefresh.pure.ts:197](src/services/pricing/clientB2BPriceRefresh.pure.ts#L197) para construir `legacyGreenEquivalentPricePerKg`.
- **Comentario en schema** lo documenta como GREEN legacy.
- **Riesgo de nombre**: ALTO — código nuevo asume "client = roasted"; el schema fuerza a leerlo siempre vía resolver.

### `PricingSnapshot.clientB2BPricePerKg` ([prisma/schema.prisma:299](prisma/schema.prisma#L299))

- **Tipo**: `Float?` (nullable post-migración).
- **Unidad**: **EUR / kg ROASTED** (autoritativo target-anchored adaptive).
- **Cómo se calcula**: `calculateMarketplaceB2BPricing` (target table → adaptive bands → clamp) en [src/engine/pricing/client/calculateMarketplaceB2BPricing.ts:380](src/engine/pricing/client/calculateMarketplaceB2BPricing.ts#L380).
- **Escrito por**:
  - [src/services/partner/lotVerification.service.ts:271](src/services/partner/lotVerification.service.ts#L271) en verificación (best-effort try/catch).
  - [src/services/dev/scenarios/devLotScenario.service.ts:470](src/services/dev/scenarios/devLotScenario.service.ts#L470) en dev seed con `marketData=null`.
  - [src/services/pricing/clientB2BPriceRefresh.service.ts:254](src/services/pricing/clientB2BPriceRefresh.service.ts#L254) en refresh (manual via `/api/internal/pricing/client-b2b-refresh`).
- **Leído por**:
  - [src/services/pricing/clientB2BPrice.ts:78](src/services/pricing/clientB2BPrice.ts#L78) (preferred path).
  - [src/services/clients/contracts.service.ts:100](src/services/clients/contracts.service.ts#L100) y [307](src/services/clients/contracts.service.ts#L307) — **fuente del `lockedPricePerKg`** post-PRICING-B2B-3.
  - [src/services/clients/demandIntent.service.ts:77](src/services/clients/demandIntent.service.ts#L77) — fuente del `previewPricePerKg`.
  - Mappers de marketplace y catalog hacen un check inline (no via resolver para mantenerlos Prisma-free): [src/services/allocation/marketplace/marketplaceLot.mapper.ts:464](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L464), [src/services/allocation/contracts/contractCatalog.mapper.ts:299](src/services/allocation/contracts/contractCatalog.mapper.ts#L299).
- **Relación con `clientPricePerKg`**: documentada en schema y en `docs/pricing/PRICING-B2B-3.md`. Se escriben juntos en verificación y dev seed; pueden divergir si el refresh se ejecuta después.

### `GreenLot.pricePerKg` ([prisma/schema.prisma:160](prisma/schema.prisma#L160))

- **Tipo**: `Float` (no nullable, sin default).
- **Unidad**: EUR / kg GREEN. Currency en `GreenLot.currency` (default `"EUR"`).
- **Escrito por** verificación y dev seed: igual a `pricing.finalPrice` (= `producerPricePerKg`).
- **Leído por** [src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts:238](src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts#L238) **sólo como fallback** cuando no hay `pricingSnapshot.clientPricePerKg`.
- **Inmutable después de creación** — no encontré ningún update de este campo. Pero no enforced.

### `Contract.lockedPricePerKg` ([prisma/schema.prisma:393](prisma/schema.prisma#L393))

- **Tipo**: `Float?` (nullable). Comentario: "per ROASTED kg, frozen at contract creation".
- **Quién "lockea"**:
  - Creation: [src/services/clients/contracts.service.ts:101](src/services/clients/contracts.service.ts#L101) — `resolveClientB2BPriceForLot(lot).pricePerKgRoasted`.
  - Switch-coffee amend: [src/services/clients/contracts.service.ts:267](src/services/clients/contracts.service.ts#L267) — **se reescribe** con el resolver del nuevo lot.
  - Same-coffee amend: NO se reescribe (línea 341 — usa el `contract.lockedPricePerKg` existente; sólo derive volumes).
- **Quién lo recompute**: nadie post-creation excepto switch-coffee. Pero **el comentario de schema dice "frozen"** → la mutabilidad en switch-coffee no es nunca documentada al usuario.
- **Estado al activar**: el webhook Stripe ([app/api/stripe/webhook/route.ts:79](app/api/stripe/webhook/route.ts#L79)) sólo cambia `status` a `ACTIVE` — el price NO se vuelve a tocar. Pero **no hay guard** que prohíba un switch-coffee amend sobre un `ACTIVE`.

### `DemandIntent.previewPricePerKg` ([prisma/schema.prisma:474](prisma/schema.prisma#L474))

- **Tipo**: `Float?`.
- **Unidad**: EUR / kg ROASTED (igual al `clientB2BPricePerKg` resuelto).
- **Escrito por** [src/services/clients/demandIntent.service.ts:145](src/services/clients/demandIntent.service.ts#L145) en CREATE. **Nunca se actualiza** en accept/wait/confirm/cancel.
- **Transición a `Contract.lockedPricePerKg`**: el flujo es `intent.consumedAt` → `contract.create()`. Pero **`createContractWithSupplyValidation` no lee `previewPricePerKg`** ([src/services/clients/contracts.service.ts:130](src/services/clients/contracts.service.ts#L130)) — sólo invalida y consume el intent. **Recompute el precio desde el lot** vía `resolveClientB2BPriceForLot`. Si el lot ha sido refrescado (B2B refresh) entre intent.create y contract.create, intent.previewPricePerKg ≠ contract.lockedPricePerKg sin ningún warning.

### `monthlyVolumeKg` vs `monthlyGreenKg` ([prisma/schema.prisma:385](prisma/schema.prisma#L385))

- **`monthlyVolumeKg`**: ROASTED kg. Compromiso del cliente. NO nullable.
- **`monthlyGreenKg`**: GREEN kg. `Float?` nullable (legacy contracts pre-PRICING-B2B-3 lo tienen NULL). Computed: `roastedToGreen(monthlyVolumeKg, roastYieldAtCreation)`.
- **Confusión potencial**:
  - [src/components/platform/client/ClientContractsPanel.tsx:268](src/components/platform/client/ClientContractsPanel.tsx#L268): `{contract.monthlyVolumeKg} kg / month` — dice "kg" sin especificar roasted.
  - [src/components/platform/client/ContractTimelineModal.tsx:108](src/components/platform/client/ContractTimelineModal.tsx#L108) — idem.
  - [src/components/platform/client/ClientOverviewPanel.tsx:77](src/components/platform/client/ClientOverviewPanel.tsx#L77): suma `monthlyVolumeKg` (ROASTED) y la presenta sin label de unit.
  - El hero KPI llama a este número `monthlyGreenKg` ([src/components/platform/client/ClientDashboardHero.tsx:25](src/components/platform/client/ClientDashboardHero.tsx#L25)) — pero el cómputo en [src/services/client-dashboard/contractPortfolioMetrics.ts:74](src/services/client-dashboard/contractPortfolioMetrics.ts#L74) hace fallback de `monthlyGreenKg ?? monthlyVolumeKg`, lo que mezcla GREEN y ROASTED si hay contratos legacy. **Bug silencioso confirmado** — ver §14.

### `availableKg` / `totalKg` / `estimatedGreenKg`

- **`GreenLot.totalKg` y `GreenLot.availableKg`** ([prisma/schema.prisma:153-154](prisma/schema.prisma#L153)): GREEN kg. Sin default.
- **Asumido** `availableKg <= totalKg` — pero **no hay check constraint** ni invariante en código que lo garantice; la única vez que `availableKg` se setea es en `verifyLotService` igualándolo a `totalKg`.
- **`availableKg` NUNCA SE DECREMENTA POR CONTRATOS** — confirmado con grep en §14. La "disponibilidad real" se calcula bajo demanda en `getContractableSupply` restando `committedKg` (sum de contratos activos) y `reservedByIntentsKg` (sum de OPEN intents). Esto es por diseño (snapshot point-in-time), pero combinado con el campo persisted en DB crea confusión: el campo `GreenLot.availableKg` siempre miente al alza si hay contratos.
- **`ProducerLotDraft.estimatedGreenKg`** ([prisma/schema.prisma:77](prisma/schema.prisma#L77)): green estimado pre-conversion. En verificación se sobrescribe con `parchmentKg * conversionRate` final ([src/services/partner/lotVerification.service.ts:131](src/services/partner/lotVerification.service.ts#L131)) y se persiste en el `GreenLot.totalKg`.

### `shipmentId` y status `RESERVED` ([prisma/schema.prisma:177](prisma/schema.prisma#L177), [205](prisma/schema.prisma#L205))

- **Quién pone `RESERVED`**: `createShipment` ([src/services/logistics/shipment.service.ts:190](src/services/logistics/shipment.service.ts#L190)) — sólo si lot está en `PUBLISHED` y `shipmentId IS NULL`. Validación in-tx.
- **Quién quita `RESERVED`**: **NADIE** en la rama actual. `receiveShipment` ([src/services/logistics/shipment.service.ts:249](src/services/logistics/shipment.service.ts#L249)) sólo flipa `Shipment.status` — los lots se quedan `RESERVED` para siempre. Comentario en cabecera de schema lo confirma: "GreenLots remain RESERVED for now".
- **Puede un lot estar `RESERVED` para 2 shipments**: NO en flujo prod — la creación re-checkea `shipmentId !== null`. PERO el dev reset ([src/services/dev/scenarios/devLotScenario.service.ts:739](src/services/dev/scenarios/devLotScenario.service.ts#L739)) hace `shipmentId: null` sin tocar `status`. Si el reset falla parcialmente, te quedan lots con `status = RESERVED` y `shipmentId = null` — estado inconsistente que NO es enforced por DB.

### `MarketSignalSnapshot.isActive` semantics ([prisma/schema.prisma:754](prisma/schema.prisma#L754))

- "Only one snapshot should be active at a time" — comentario en schema.
- **Enforce**: sólo en código ([src/services/pricing/marketSignalIngestion.service.ts:183](src/services/pricing/marketSignalIngestion.service.ts#L183)) — `updateMany({ where: { isActive: true }, data: { isActive: false } })` antes del `create`. Hecho dentro de `$transaction`.
- **Quién flipa**: solamente `applyMarketSignalIngestion` (single entry point). El `partner/market-signal/route.ts` ahora delega aquí después de PRICING-FEED-1B.
- **Riesgo**: sin índice único parcial `WHERE isActive = true`, dos transacciones concurrentes pueden crear dos rows activas. Probable de reproducir bajo carga.

### Allocation snapshots: point-in-time vs live

- `buildAllocationSnapshots` ([src/services/allocation/snapshot/lotAllocationSnapshot.service.ts:67](src/services/allocation/snapshot/lotAllocationSnapshot.service.ts#L67)) hace **3 queries** y stitcha en memoria. NO persistido — recompute en cada llamada.
- Riesgo de staleness: `marketplaceView.service` y `contractCatalogView.service` invocan `buildAllocationSnapshots` + `decideLotAllocation` por request. Cada render puede ver intents + contratos diferentes. No hay caching.
- Para el dashboard del cliente esto significa que un usuario que ve "10 lots disponibles" puede crear contrato y descubrir que sólo hay 5 — la `getContractableSupply` corre dentro de `$transaction` así que el contrato sí se valida atomic, pero la UI mostraba un valor stale. Aceptable según diseño actual pero no documentado.

---

## 3. Invariantes que deberían cumplirse siempre

| # | Invariante | Justificación |
|---|---|---|
| I1 | `GreenLot.availableKg <= GreenLot.totalKg` | Definicional. |
| I2 | `sum(activeContracts.monthlyGreenKg * remainingMonths) + sum(openIntents.deltaKg) + safetyBuffer ≤ GreenLot.availableKg` para cada lot | Anti over-commit. |
| I3 | A lo sumo un `MarketSignalSnapshot` con `isActive = true` en cualquier instante | Comentario explícito en schema, base del algoritmo. |
| I4 | `Contract.lockedPricePerKg` no cambia después de `status = ACTIVE` | Comentario en schema dice "frozen". |
| I5 | `Contract.greenLotId IS NOT NULL` para todos los contratos creados después de PRICING-B2B-3 | El nuevo flow lo requiere; `createContractWithSupplyValidation` lo demanda en input. |
| I6 | `Contract.monthlyGreenKg = roastedToGreen(monthlyVolumeKg, roastYieldAtCreation)` para todos los contratos creados después de PRICING-B2B-3 | Garantía de consistencia roasted↔green. |
| I7 | A lo sumo un `Shipment` puede tener un `GreenLot` dado | "While shipmentId is set, the lot is RESERVED for that shipment" — schema doc. |
| I8 | `GreenLot.status = RESERVED` ⟺ `GreenLot.shipmentId IS NOT NULL` | Implicación bidireccional en doc del schema. |
| I9 | `DemandIntent.deltaKg = 0` cuando `status ∈ {COUNTERED, REJECTED, WAITING, EXPIRED, CANCELLED, CONSUMED}` | Sólo `OPEN` reserva; doc del service. |
| I10 | `DemandIntent.expiresAt > createdAt` y `DemandIntent.consumedAt IS NULL` cuando `status != CONSUMED` | Modelo de TTL. |
| I11 | `PricingSnapshot.clientB2BPricePerKg > 0` cuando no es null (la columna acepta 0/negativo en DB) | Consumidores asumen `> 0`. |
| I12 | `ProducerFulfilment` 1:1 con `GreenLot` | Enforced via `@unique` — schema correcto. |
| I13 | `Order.contractId IS NULL` o `Order.companyId == Contract.companyId` | Multi-tenant safety. |
| I14 | `MarketSignalTick` rows nunca se actualizan (append-only) | Doc del service y del modelo. |
| I15 | `CommitmentHealthSnapshot` rows nunca se actualizan (append-only) | Doc del schema. |

---

## 4. Invariantes que hoy sólo dependen de la app (no DB)

| Invariante | Enforcement actual | Gap |
|---|---|---|
| I1 (`available <= total`) | Ningún check; se setea igual en verificación. | **Sin CHECK constraint**. Cualquier update directo podría romperlo. |
| I2 (no over-commit) | [src/services/system/supply.service.ts:38](src/services/system/supply.service.ts#L38) calcula bajo demanda; [src/services/clients/contracts.service.ts:113](src/services/clients/contracts.service.ts#L113) valida antes de crear. | **No hay lock pesimista en la lectura de `getContractableSupply`** dentro de la transacción. Aunque corre con `tx`, otra transacción concurrente que lea el mismo snapshot puede pasar el check. Postgres default isolation (READ COMMITTED) no bloquea el conjunto. Riesgo real bajo concurrencia. |
| I3 (1 active snapshot) | [src/services/pricing/marketSignalIngestion.service.ts:182](src/services/pricing/marketSignalIngestion.service.ts#L182) — `updateMany` + `create` en tx. | **No hay índice único parcial** `WHERE isActive=true`. Concurrencia puede meter 2 active. |
| I4 (locked price frozen) | Lectura: solamente switch-coffee branch reescribe ([src/services/clients/contracts.service.ts:289](src/services/clients/contracts.service.ts#L289)). | **No hay guard de status** — puede reescribirse en `ACTIVE` si la UI llama a amend con greenLotId distinto. Comentario en schema lo afirma falsamente. |
| I7 (1 shipment por lot) | [src/services/logistics/shipment.service.ts:159](src/services/logistics/shipment.service.ts#L159) check antes de crear. | **`Shipment.greenLots` es relación FK simple** — no hay constraint que diga "1:1 cuando ese lot tiene shipmentId IS NOT NULL". Si se cambia `shipmentId` directamente vía Prisma, no hay protección. |
| I8 (RESERVED ⟺ shipmentId set) | Solamente `createShipment` lo hace consistente. | **Reset dev** ([src/services/dev/scenarios/devLotScenario.service.ts:741](src/services/dev/scenarios/devLotScenario.service.ts#L741)) limpia `shipmentId` sin tocar `status` → estado inconsistente posible. |
| I9 (deltaKg=0 en status no-OPEN) | Servicios ponen `deltaKg: 0` al transicionar (e.g. [demandIntent.service.ts:121](src/services/clients/demandIntent.service.ts#L121), [371](src/services/clients/demandIntent.service.ts#L371)). | Sin CHECK constraint. WAITING podría tener deltaKg > 0 si alguien edita por Prisma Studio. |
| I11 (B2B price > 0 cuando no null) | Sólo el resolver ([src/services/pricing/clientB2BPrice.ts:58](src/services/pricing/clientB2BPrice.ts#L58)) descarta valores ≤ 0; no lo enforce el writer. | DB acepta `0.0` y negativos. |
| I14 / I15 (append-only) | Convención en service. | DB no impide UPDATE. |
| Auto-expiración de DemandIntent | **No hay scheduled job ni cron** que ponga `EXPIRED`. | Solamente el filtro `expiresAt: { gt: new Date() }` en `getContractableSupply` los ignora. Pero `getIntentsByCompany` también filtra — entonces no se renderiza, pero el row queda OPEN para siempre. Estado lógico vs DB diverge. |

---

## 5. Riesgos de migración

1. **Renombrar `clientPricePerKg` → `legacyGreenPricePerKg`** romperá:
   - [src/services/clients/market.service.ts:105](src/services/clients/market.service.ts#L105) (lectura directa).
   - El resolver fallback ([src/services/pricing/clientB2BPrice.ts:88](src/services/pricing/clientB2BPrice.ts#L88)).
   - Mappers ([src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts:237](src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts#L237)).
   - El refresh service ([src/services/pricing/clientB2BPriceRefresh.service.ts:162](src/services/pricing/clientB2BPriceRefresh.service.ts#L162)).
   - El inspector ([src/services/pricing/clientB2BPricingInspector.service.ts:259](src/services/pricing/clientB2BPricingInspector.service.ts#L259)).
   - La tabla legacy `PricingRule.clientPricePerKg` ([prisma/schema.prisma:336](prisma/schema.prisma#L336)) — campo definicionalmente distinto pero con el mismo nombre.

2. **Splitting `Contract.monthlyVolumeKg`**: cualquier separación entre roasted/green requiere actualizar:
   - 8 componentes UI que muestran "monthlyVolumeKg" como "kg/month" sin label (ver §6).
   - El supply.service que falls back de `monthlyGreenKg ?? monthlyVolumeKg` ([src/services/system/supply.service.ts:83](src/services/system/supply.service.ts#L83)) — esa rama trata roasted como green silenciosamente (legacy contracts pre-PRICING-B2B-3).

3. **Hacer `MarketSignalSnapshot.isActive` un índice único parcial**: el mismo proceso ya se asegura programáticamente. **Antes** de la migración, hay que hacer SELECT + DELETE de duplicates por seguridad. Riesgo bajo pero **el enforcement actual depende de READ COMMITTED**, así que en producción ya pueden existir filas duplicadas no detectadas.

4. **Borrar `PricingRule`** ([prisma/schema.prisma:321](prisma/schema.prisma#L321)): tabla **completamente sin uso** que descubrí — grep de `pricingRule` no devuelve usos en código (sólo schema y migration). Su `clientPricePerKg` puede confundir auditores futuros.

5. **Renombrar `Contract.lockedPricePerKg` a `Contract.contractPricePerKgRoasted`**: esto requiere coordinar con webhook stripe (no toca el campo) y con el flujo de signature legacy. Ver §11.

6. **Backfill de `clientB2BPricePerKg` en filas viejas**: documentado como gap en `docs/pricing/PRICING-B2B-3.md` §13. Sin backfill, marketplace para un Geisha viejo muestra adaptive recompute (€140) y contrato vía resolver hace fallback green/yield (€23) — exactamente el bug que motivó B2B-3 sigue presente para filas pre-migración.

7. **`Order` y `RoastedBatch`** son legacy: `OrderItem.pricePerBag`, `RoastedBatch.bagCount`. Ningún flujo activo los usa, pero existen. Borrarlos sin migración previa rompería el webhook de Stripe que sólo cambia `Contract.status`, pero el seed dev `app/api/dev/orders/seed/route.ts` sí los crea.

---

## 6. Campos confusos o peligrosos (ranked)

| Severidad | Campo | Por qué |
|---|---|---|
| **Crítico** | `PricingSnapshot.clientPricePerKg` | Nombre dice "client" pero almacena GREEN. Un consumidor naive (cualquier dev nuevo) escribirá `pricingSnapshot.clientPricePerKg` para mostrar al cliente y entregará green×6 más caro. Existe doc + comentario en schema, pero el campo legacy sigue siendo leído directamente sin pasar por resolver en al menos `market.service.ts:105`. |
| **Crítico** | `GreenLot.availableKg` (nombrado, persistido, **nunca se decrementa**) | Sugiere "live" pero refleja sólo el momento de verificación. El cálculo real está en `getContractableSupply`. **Ningún consumidor que lea `lot.availableKg` directamente está obteniendo lo que cree** ([app/api/partner/export-ready/route.ts:16](app/api/partner/export-ready/route.ts#L16) usa `availableKg: { gt: 0 }` como filter — pero un lot 100% comprometido sigue pasando). |
| **Alto** | `Contract.monthlyVolumeKg` (sin label de unit en UI) | ROASTED kg renderizado como "kg" en 4 componentes. `ContractPortfolioPanel` también suma `metrics.monthlyGreenKg` que en realidad puede ser roasted via fallback. |
| **Alto** | `DemandIntent.previewPricePerKg` (no se compara con lockedPricePerKg final) | Cliente acepta intent en €23 (preview), refresh corre, contrato bloquea en €140 al consumir. **Sin warning** ([src/services/clients/contracts.service.ts:130](src/services/clients/contracts.service.ts#L130) consume el intent sin checkear que el price todavía coincide). |
| **Alto** | `Contract.lockedPricePerKg` con comentario "frozen" | El comentario miente: switch-coffee amend lo reescribe. Y no hay status guard sobre `ACTIVE`. |
| **Medio** | `MarketSignalSnapshot.isActive` no único | Comentario implica unicidad pero schema permite duplicados. |
| **Medio** | `monthlyGreenKg` opcional pero a veces fallbackea a `monthlyVolumeKg` (roasted) | [src/services/system/supply.service.ts:83](src/services/system/supply.service.ts#L83) hace `c.monthlyGreenKg ?? c.monthlyVolumeKg`. Para contratos legacy esto cuenta roasted como green → sub-estima la presión. |
| **Medio** | `PricingRule.clientPricePerKg` (tabla sin uso pero presente) | Doble confusión vía nombre idéntico al de `PricingSnapshot`. |
| **Medio** | `GreenLot.totalKg` vs `GreenLot.availableKg` (ambos en mismo enum semantics, sin invariant DB) | Si una migración o seed pone `availableKg > totalKg`, nada lo detecta. |
| **Bajo** | `roastYieldAtEval` vs `roastYieldAtCreation` (intent vs contract) | Pueden divergir si yield del lote se actualiza entre intent y contract. Aceptado por diseño pero sin warning. |
| **Bajo** | `bagSizeKg @default(20)` en Contract pero también en RoastedBatch | Ambas tablas tienen su propio default. Si alguna vez hay que cambiarlo, hay que tocar dos sitios. |

---

## 7. Lugares donde se duplica lógica

1. **Selección de "use persisted B2B if > 0, else fallback"**:
   - Resolver canónico: [src/services/pricing/clientB2BPrice.ts:62](src/services/pricing/clientB2BPrice.ts#L62) (`resolveClientB2BPriceForLot`).
   - Inline en marketplace mapper: [src/services/allocation/marketplace/marketplaceLot.mapper.ts:464](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L464).
   - Inline en contract catalog mapper: [src/services/allocation/contracts/contractCatalog.mapper.ts:299](src/services/allocation/contracts/contractCatalog.mapper.ts#L299).
   - Inline en inspector: [src/services/pricing/clientB2BPricingInspector.service.ts:308](src/services/pricing/clientB2BPricingInspector.service.ts#L308).
   - Inline en refresh.pure: [src/services/pricing/clientB2BPriceRefresh.pure.ts:196](src/services/pricing/clientB2BPriceRefresh.pure.ts#L196).
   - Documentado como deuda en `docs/pricing/PRICING-B2B-3.md` §13.

2. **`computeRoastedPriceFromGreen` (green/yield)**:
   - Canónico: [src/lib/roastYield.ts:38](src/lib/roastYield.ts#L38) (`computeRoastedPrice`).
   - Inlinado en marketplace mapper: [src/services/allocation/marketplace/marketplaceLot.mapper.ts:230](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L230) ("KEEP IN SYNC" comment).
   - Inlinado en contract catalog mapper: [src/services/allocation/contracts/contractCatalog.mapper.ts:177](src/services/allocation/contracts/contractCatalog.mapper.ts#L177).
   - Inlinado en `calculateMarketplaceB2BPricing.ts:201` con `ROAST_YIELD_FLOOR = 0.5`.

3. **Validación de range cPrice (50–600) y demandIndex (0.8–1.2)**:
   - [src/services/partner/lotVerification.service.ts:108](src/services/partner/lotVerification.service.ts#L108).
   - [src/services/pricing/marketSignal.service.ts:38](src/services/pricing/marketSignal.service.ts#L38).
   - [src/services/pricing/clientB2BPriceRefresh.service.ts:78](src/services/pricing/clientB2BPriceRefresh.service.ts#L78).
   - [src/services/pricing/clientB2BPricingInspector.service.ts:191](src/services/pricing/clientB2BPricingInspector.service.ts#L191).
   - 4 sitios; debería ser un único helper en `marketSignal.service.ts`.

4. **Adapter `buildProducerPricingFn`**: producer engine se inyecta vía closure idéntica en 3 sitios:
   - [src/services/pricing/clientB2BPriceRefresh.service.ts:107](src/services/pricing/clientB2BPriceRefresh.service.ts#L107).
   - [src/services/allocation/marketplace/marketplaceView.service.ts:50](src/services/allocation/marketplace/marketplaceView.service.ts#L50).
   - [src/services/allocation/contracts/contractCatalogView.service.ts:49](src/services/allocation/contracts/contractCatalogView.service.ts#L49).
   - [src/services/pricing/clientB2BPricingInspector.service.ts:152](src/services/pricing/clientB2BPricingInspector.service.ts#L152).
   - [src/services/dev/scenarios/devLotScenario.service.ts:362](src/services/dev/scenarios/devLotScenario.service.ts#L362).
   - [src/services/partner/lotVerification.service.ts:182](src/services/partner/lotVerification.service.ts#L182).
   - 6 copias del mismo wrapper.

5. **`stripBracketedPrefix` (quita `[DEV] `)**:
   - [src/services/allocation/marketplace/marketplaceLot.mapper.ts:341](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L341).
   - [src/services/allocation/contracts/contractCatalog.mapper.ts:186](src/services/allocation/contracts/contractCatalog.mapper.ts#L186).

6. **`buildName` para mostrar lote**: idénticos en marketplace + catalog mappers.

7. **Cálculo `buildAllocationSnapshots` + `decideLotAllocation` per-lot**: marketplaceView, contractCatalogView, allocation/run e inspector hacen el mismo loop. El inspector incluso lo invoca para 1 lote ([src/services/pricing/clientB2BPricingInspector.service.ts:432](src/services/pricing/clientB2BPricingInspector.service.ts#L432)) — invocando un build que carga **todos los lots** filtrados sólo por id. Eficiente porque tiene `where: { id: greenLotId }`, pero carga el conjunto completo de contratos/intents igualmente (siempre filtrado por `lotIds`).

---

## 8. Servicios que deberían compartir helper

1. **`extractMarketSignal()`** — centralizar la lectura del active snapshot + validación (50–600 / 0.8–1.2 / not expired) que hoy vive en 4 sitios. Sugerencia: ampliar `getLatestMarketSignalForPricing` para retornar también el ID y metadata de provenance, y consumirlo desde verificación, refresh e inspector.

2. **`buildProducerPricingFn()` exportado** — extraer el adapter producer→engine a un módulo único en `src/engine/pricing/client/producerPricingAdapter.ts`. Hoy se duplica la closure 6 veces.

3. **`B2BPricingFromLot(lot, marketData)` orquestador** — un wrapper que dado un lot row + market data devuelva ` { pricePerKgRoasted, pricingMode, breakdown }`. Consume `calculateMarketplaceB2BPricing` con yield resolved. Eliminaría boilerplate en `lotVerification`, `devLotScenario`, `clientB2BPriceRefresh.pure` e inspector.

4. **Mapper de display name + bracketed prefix** — extraer `buildName()` y `stripBracketedPrefix()` a `src/lib/displayHelpers.ts`. Hoy duplicado en 2 mappers.

5. **`resolveLotForB2BResolution(prismaLot)`** — los call sites del resolver necesitan un shape `{ pricingSnapshot: { clientB2BPricePerKg, clientPricePerKg }, process, estimatedRoastYield }`. Pequeño helper pero usado en 5 sitios.

6. **`MarketSignalReader` con caching por request** — para no hacer N reads del active snapshot en marketplace/catalog/inspector cuando se procesan muchos lots en serie (en N+1 risk: ya hay caching ad-hoc en marketplaceView via `Promise.all`, pero no es uniforme).

---

## 9. Qué campos deberían ser inmutables (y no lo están)

| Campo | Estado | Mutación oculta |
|---|---|---|
| `Contract.lockedPricePerKg` | Schema dice "frozen" | Switch-coffee amend lo reescribe ([contracts.service.ts:289](src/services/clients/contracts.service.ts#L289)). Sin guard sobre `ACTIVE`. |
| `Contract.roastYieldAtCreation` | Implícitamente "at creation" | Idem — switch-coffee también lo reescribe. |
| `Contract.startDate` | "Frozen at creation" intuitivamente | Sin protección — un service podría cambiarlo. |
| `PricingSnapshot.producerPricePerKg`, `clientPricePerKg`, `marginPerKg`, `pricingVersion`, `breakdown` | "Snapshot" en nombre | El refresh service no los toca, pero nada lo enforce. |
| `GreenLot.totalKg` y `pricePerKg` | Set en verificación | Sin enforce de inmutabilidad. Un dev tool podría editarlos. |
| `GreenLot.lotNumber` | Tracker traceability — `@unique` | Sin update guards. Si cambias el lotNumber post-shipping, rompes traceability. |
| `MarketSignalTick` rows | Append-only por contrato | DB acepta `UPDATE`. |
| `CommitmentHealthSnapshot` rows | Append-only por contrato | Idem. |
| `ProducerLotDraft.lotNumber` | Traceability | Sin enforce. |
| `Producer.userId` | `@unique` 1:1 | Si cambia se rompe identidad — pero técnicamente Prisma permite update. |

---

## 10. Qué campos deberían ser derived/read-model (denormalizados hoy)

| Campo | Hoy | Debería ser |
|---|---|---|
| `Contract.monthlyPrice` | Persistido = `pricePerBag * bagsPerDelivery`. Sólo se computa en service. | Derived. Si `pricePerBag` o `bagsPerDelivery` cambian (en amend), `monthlyPrice` se reescribe — pero invariante no enforced por DB. |
| `Contract.bagsPerDelivery` | Persistido = `round(monthlyVolumeKg / bagSizeKg)`. | Derivable trivialmente. |
| `Contract.monthlyGreenKg` | Persistido = `roastedToGreen(monthlyVolumeKg, roastYieldAtCreation)`. | Computable on-demand. Hoy almacenado por performance pero introduce el riesgo I6. |
| `GreenLot.availableKg` | Persistido pero **no decrementado** → engaño. | Eliminar y exponer sólo via `getContractableSupply`. O mantener como "stock físico" claramente separado de "contractable". |
| `LotAllocationDecision` (todo) | Computado per-request, nunca persisted. | Probablemente bien así para v0; pero ALLOC docs mencionan posible persistencia para audit. |
| `PricingSnapshot.clientPricePerKg` | Persistido = `producerPricePerKg`. | Eliminar — siempre igual al producer. |
| `RoastedBatch.bagCount` | Decrementado por `inventory.service.ts:42`. | Persistido OK; pero "stock real disponible" es la única invariante y nada lo cap inferior. |
| Métricas del dashboard del cliente (`monthlyGreenKg`, `availableRoastedKg`, etc.) | Computadas en cliente vía `computePortfolioMetrics`. OK. | — |

---

## 11. Recomendaciones de rename futuro

| Old | Proposed | Riesgo / pasos |
|---|---|---|
| `PricingSnapshot.clientPricePerKg` | `legacyGreenPricePerKg` (o `producerGreenSnapshotPricePerKg`) | Riesgo ALTO. Tocará `market.service.ts`, refresh.pure, mappers, inspector, tests. Mejor hacerlo **después** de un sprint de backfill `clientB2BPricePerKg` que haga obsoleto el fallback legacy en producción. |
| `PricingSnapshot.clientB2BPricePerKg` | `clientPriceRoastedPerKg` (más simétrico) o dejar como está hasta nombrar todo coherente | Riesgo MEDIO. Mejor renombrar al conjunto entero. |
| `Contract.monthlyVolumeKg` | `monthlyRoastedKg` | Riesgo ALTO. 4+ componentes UI usan el campo. Pero es el rename de mayor valor pedagógico. |
| `Contract.lockedPricePerKg` | `contractPriceRoastedPerKg` | Riesgo MEDIO. Y revisar el comentario "frozen". |
| `Contract.roastYieldAtCreation` | `roastYieldAtSign` (más coherente con DemandIntent.roastYieldAtEval) | Riesgo BAJO. |
| `GreenLot.availableKg` | `physicalStockGreenKg` y exponer `contractableGreenKg` derivado | Riesgo ALTO si se promueve a campo persistido; bajo si se elimina (sólo está en UI partner export). |
| `MarketSignalSnapshot.isActive` | `active` o índice único parcial directo | Cosmético. |
| `PricingRule` (tabla entera) | **Borrar** | Tabla completamente sin uso. Migración drop. |
| `OrderItem` / `RoastedBatch` (legacy roasted-bag flow) | Potencialmente borrar si MVP no lo usa | Riesgo MEDIO — `Contract.roastedBatchId` es FK opcional, dev/orders/seed los crea. |

---

## 12. Roadmap de hardening por sprints

### Sprint 1 — Datos íntegros y B2B price source unificado

| # | Ticket | Why | Blockers |
|---|---|---|---|
| 1.1 | **HARDEN-1: Backfill `clientB2BPricePerKg` en filas verified pre-PRICING-B2B-3** | Garantiza I11 en todas las filas, elimina la rama legacy fallback como path activo. | Ninguno — requiere `applyClientB2BRefresh({ includeStatuses: PUBLISHED, RESERVED, SOLD, DRAFT })`. |
| 1.2 | **HARDEN-2: Índice único parcial `MarketSignalSnapshot WHERE isActive`** | Cierra I3 contra concurrencia. | 1.1 no, son independientes. Pre-check duplicados. |
| 1.3 | **HARDEN-3: Extraer resolveClientB2BPriceForLot inline → módulo Prisma-free** | Elimina las 5 duplicaciones de "persisted > 0 ? else fallback" (§7.1). | 1.1 (porque entonces el fallback sería raro). |
| 1.4 | **HARDEN-4: Centralizar validación rangos cPrice/demandIndex** | Cierra §7.3. | Ninguno. |
| 1.5 | **HARDEN-5: Consolidar `buildProducerPricingFn` y exportarlo** | Cierra §7.4. | Ninguno. |

### Sprint 2 — Invariantes en DB y ciclo de vida

| # | Ticket | Why | Blockers |
|---|---|---|---|
| 2.1 | **HARDEN-6: CHECK constraint `availableKg <= totalKg`** | Cierra I1. | 1.x para datos limpios. |
| 2.2 | **HARDEN-7: CHECK + trigger: `RESERVED ⟺ shipmentId NOT NULL`** | Cierra I8. Y revisar reset dev. | 2.1. |
| 2.3 | **HARDEN-8: Auto-expire job `DemandIntent`** (cron + transición OPEN/COUNTERED/WAITING → EXPIRED si `expiresAt <= now()`) | Cierra desincronía DB ↔ filtro. | Ninguno. |
| 2.4 | **HARDEN-9: Status guard en switch-coffee amend** — prohibir si `Contract.status ∈ {ACTIVE, COMPLETED, PAST_DUE}` | Cierra I4 y reconcilia con comentario "frozen". | Ninguno. |
| 2.5 | **HARDEN-10: Test concurrencia sobre `getContractableSupply`** — ¿se respeta I2 bajo carga? Si no, añadir `SELECT FOR UPDATE` sobre `GreenLot` row. | Cierra I2 contra race conditions. | 2.1. |
| 2.6 | **HARDEN-11: Validar al consumir DemandIntent que `previewPricePerKg` ≈ `lockedPricePerKg`** y warnear divergencia | Cierra el risk del §6 ("preview vs lock"). | 1.3. |

### Sprint 3 — Renombres seguros y limpieza

| # | Ticket | Why | Blockers |
|---|---|---|---|
| 3.1 | **HARDEN-12: Rename `Contract.monthlyVolumeKg` → `monthlyRoastedKg`** | Elimina la confusión más frecuente en UI. | 2.x para que el schema esté limpio. |
| 3.2 | **HARDEN-13: Rename `clientPricePerKg` → `legacyGreenPricePerKg` + drop columns una vez backfill total** | Paso definitivo para eliminar la deuda. | 1.1 (backfill 100%) + 3.1 (no rompe simultáneamente). |
| 3.3 | **HARDEN-14: Borrar `PricingRule` table** | Tabla muerta en código. | Ninguno. |
| 3.4 | **HARDEN-15: Sustituir `GreenLot.availableKg` → derived view o renombrar a `physicalStockGreenKg`** | Cierra el bug silencioso del §14. | 2.5 (concurrencia) + 1.x. |
| 3.5 | **HARDEN-16: Documentar / refactor `OrderItem` + `RoastedBatch`** — decidir borrar o mantener. | Aclara el dominio. | Decidir alcance de B2B futuro. |

---

## 13. Tests que faltan

### Pricing
- **Test "marketplace card price === contract.lockedPricePerKg"** end-to-end (Geisha SCA 91 → ambos paths producen el mismo número). Existen tests del mapper pero no del round-trip create-contract → response.
- **Test "switch-coffee amend en contract status=ACTIVE"** — debería fallar pero hoy NO existe guard ni test.
- **Test "previewPricePerKg vs lockedPricePerKg cuando un B2B refresh corre entre intent y contract"** — confirmar el bug silencioso.
- **Test "lot pre-PRICING-B2B-3 con clientB2BPricePerKg=NULL → marketplace usa adaptive recompute, contract usa green/yield, números divergen"** — confirmar regresión documentada.
- **Test "B2B pricing for SCA decimal (e.g. 87.5)"** — la canonical doc llama esto out un risk. Hoy `getScaRange` throw para `< 80`, pero `87.5` cae en `87-90` correctamente; sin embargo `bucketScaForNormal` hace `Math.round(input.scaScore)` ([src/engine/pricing/client/marketTargetPricing.ts:646](src/engine/pricing/client/marketTargetPricing.ts#L646)) — los dos buckets son inconsistentes en boundaries.

### Allocation
- **Test "lot RESERVED + shipmentId NULL"** (estado inconsistente) → ¿qué hace `decideLotAllocation`? Hoy emitiría `SHIPMENT_ALREADY_RESERVED` por `status === "RESERVED"` ([src/services/allocation/engine/lotAllocationEngine.ts:151](src/services/allocation/engine/lotAllocationEngine.ts#L151)) — quizás OK pero no testeado.
- **Test "concurrent contract creation"** — dos creates en paralelo sobre mismo lot que juntos exceden la supply. Hoy con READ COMMITTED uno debería pasar y otro fallar; pero no hay test que lo confirme.
- **Test "long-horizon contract: 12-month × 100kg"** — verificar que el snapshot mapper computa `committedContractHorizonGreenKg = 1200`, no 100. Existe el mapper pero no lo veo cubierto por test (revisar `lotAllocationSnapshot.mapper.test.ts`).
- **Test "intent expired pero no purgado en DB"** → ¿`getContractableSupply` lo excluye correctamente vía `expiresAt: { gt: now }`? Probablemente sí, pero borderline.

### Reservation lifecycle
- **Test "createShipment → receiveShipment → ¿qué status quedan los lots?"** — confirmar la doc dice "remain RESERVED" y testear que efectivamente. El día que se cambie esto, romperá silenciosamente.
- **Test "shipment con DISCREPANCY status → no se puede recibir"** — ya en el service pero confirm.
- **Test "reset dev cleans `shipmentId` pero NO cambia status"** → test que detecte el estado inconsistente.

### Market signal
- **Test "concurrent applyMarketSignalIngestion"** — dos POSTs paralelos: ¿queda 1 o 2 active? Hoy probable bug de consistencia.
- **Test "MarketSignalTick es append-only"** — añadir guard test.
- **Test "expiresAt en MarketSignalSnapshot"** — confirmar que tras expirar, lectura `getLatestMarketSignalForPricing()` devuelve null y todo el adaptive engine cae a deterministic.
- **Test "barchart parser"** ya existe (`marketSignalBarchart.parser.test.ts`) — bien.

### Dev scenarios
- **Test "scenario reset deja DB en estado consistente"** — si reset sólo borra rows con prefix DEV-SCENARIO-, ¿deja huérfanos en otras tablas? Por ejemplo `Order` con `contractId` → contrato dev borrado. El comentario en code lo asume aceptable pero no hay test.
- **Test "dev seed no rompe los invariantes I1–I8"**.
- **Test "dev variety not in pricing table → throw"** — existe en el suite del scenario types.

### Otros
- **`ProducerFulfilment` lifecycle** sin tests específicos.
- **Webhook stripe**: parece sin tests dedicados; cualquier cambio de `Contract.status` es un riesgo no cubierto.

---

## 14. Posibles bugs silenciosos (con evidencia)

### Bug-1: `GreenLot.availableKg` nunca se decrementa al firmar contratos

- Evidencia: grep de `greenLot.update` en producción solamente muestra:
  - [app/api/dev/partner/publish-green-lot/route.ts:30](app/api/dev/partner/publish-green-lot/route.ts#L30) (dev only, `data: { status: "PUBLISHED" }`).
  - [app/api/partner/lots/[id]/publish/route.ts:63](app/api/partner/lots/[id]/publish/route.ts#L63) (`data: { status: "PUBLISHED" }`).
  - [src/services/dev/scenarios/devLotScenario.service.ts:739](src/services/dev/scenarios/devLotScenario.service.ts#L739) (`data: { shipmentId: null }` en reset).
  - [src/services/logistics/shipment.service.ts:190](src/services/logistics/shipment.service.ts#L190) (`status: RESERVED, shipmentId`).
- Ningún path decrementa `availableKg`.
- Pero `app/api/partner/export-ready/route.ts:16` lo filtra como `availableKg: { gt: 0 }` — lots 100% comprometidos a contratos siguen apareciendo.
- **Severidad**: alta — la export-ready list muestra lots que no tienen verde libre.

### Bug-2: `monthlyGreenKg ?? monthlyVolumeKg` mezcla unidades

- [src/services/system/supply.service.ts:83](src/services/system/supply.service.ts#L83): `(c.monthlyGreenKg ?? c.monthlyVolumeKg)`. Para contratos legacy donde `monthlyGreenKg` está NULL, `monthlyVolumeKg` es ROASTED y se trata como GREEN.
- Resultado: para lotes con contratos legacy, `committedKg` está sub-estimado en `1/yield ≈ 18%`. Eso significa que `getContractableSupply` devuelve un número inflado y se podría sobre-comprometer.
- Mismo patrón en [src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts:127](src/services/allocation/snapshot/lotAllocationSnapshot.mapper.ts#L127) (`c.monthlyGreenKg ?? c.monthlyVolumeKg ?? 0`).
- Mismo patrón en [src/services/client-dashboard/contractPortfolioMetrics.ts:74-81](src/services/client-dashboard/contractPortfolioMetrics.ts#L74) (`safeMonthlyGreenKg`).
- **Severidad**: media-alta para lotes legacy.

### Bug-3: `previewPricePerKg` puede divergir de `lockedPricePerKg` sin warning

- [src/services/clients/demandIntent.service.ts:145](src/services/clients/demandIntent.service.ts#L145) escribe el preview en intent.create.
- [src/services/clients/contracts.service.ts:130-154](src/services/clients/contracts.service.ts#L130-L154) consume el intent (status → CONSUMED) pero **recompute el price desde el lot vía resolver**, no compara contra `previewPricePerKg`.
- Si entre intent.create y contract.create alguien corre `applyClientB2BRefresh` (manual via `/api/internal/pricing/client-b2b-refresh`), el preview ya no coincide con lo lockeado.
- **Severidad**: media — flujo que requiere acción operativa entre intent y contract.

### Bug-4: switch-coffee amend reescribe `lockedPricePerKg` sobre contracts ACTIVE sin guard

- [src/services/clients/contracts.service.ts:285](src/services/clients/contracts.service.ts#L285) — el `tx.contract.update` no checkea `contract.status`.
- Schema dice "frozen" ([prisma/schema.prisma:393](prisma/schema.prisma#L393)).
- Si un cliente ACTIVE pide amend con greenLotId distinto, el contrato se reescribe sin advertencia.
- **Severidad**: alta semánticamente, aunque baja en práctica si la UI no lo permite (no verifiqué la UI a fondo).

### Bug-5: Reset de scenarios deja `RESERVED + shipmentId=NULL`

- [src/services/dev/scenarios/devLotScenario.service.ts:738](src/services/dev/scenarios/devLotScenario.service.ts#L738) hace `shipmentId: null` antes de borrar shipments, pero **no tocan `status`**.
- Después se borran los GreenLots, pero si el reset falla a mitad (por ejemplo, fallo en step 8), quedan lots con `status = RESERVED` y `shipmentId = NULL`.
- El allocation engine los manda a HOLD con `SHIPMENT_ALREADY_RESERVED` ([src/services/allocation/engine/lotAllocationEngine.ts:151](src/services/allocation/engine/lotAllocationEngine.ts#L151)) — el message será incorrecto pero comportamiento cauto.
- **Severidad**: baja (sólo afecta dev), pero el patrón es feo.

### Bug-6: `MarketSignalSnapshot.isActive` puede tener duplicados bajo concurrencia

- [src/services/pricing/marketSignalIngestion.service.ts:182-199](src/services/pricing/marketSignalIngestion.service.ts#L182): `updateMany({where: {isActive: true}, data: {isActive: false}}); create({isActive: true})` dentro de `$transaction`.
- Postgres default isolation = READ COMMITTED. Dos transacciones simultáneas pueden ver las filas activas del momento, marcarlas false, y ambas crear nuevas active rows.
- Lectura subsecuente con `findFirst({isActive: true, orderBy: createdAt desc})` siempre devuelve UNA fila pero la tabla tiene dos.
- **Severidad**: baja en práctica (POST manual), alta si se conecta provider feed automatizado.

### Bug-7: `lockedPricePerKg ?? (pricePerBag / bagSizeKg)` para legacy contracts pierde el roast yield

- [src/services/clients/contracts.service.ts:341](src/services/clients/contracts.service.ts#L341): `const lockedPrice = contract.lockedPricePerKg ?? (contract.pricePerBag / bagSizeKg)`.
- Pero `pricePerBag` se calculó en su día como `lockedPricePerKg * bagSizeKg`. Si `lockedPricePerKg` era roasted, dividir por bagSizeKg devuelve roasted/kg correcto.
- Sin embargo si en algún contrato pre-PRICING-B2B-3 `pricePerBag = greenPrice * bagSizeKg`, este fallback genera un precio green tratado como roasted. **Incertidumbre**: no pude confirmar al 100% que ningún contrato legacy tenga ese estado — depende de lo que lotVerification escribía antes. Marcar como POSIBLE bug.

### Bug-8: `marketplaceLot.mapper` divide por roastYield "floor 0.5" pero `roastYield` ya viene resolved (≥ 0.5) del snapshot

- [src/services/allocation/marketplace/marketplaceLot.mapper.ts:228-236](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L228) — duplica el floor (0.5) que ya enforce `resolveRoastYield`.
- No es un bug — sólo es código defensivo redundante. El comentario lo flag como "KEEP IN SYNC". Riesgo: si el floor cambia en `roastYield.ts`, el mapper diverge.

### Bug-9: `PricingSnapshot.clientPricePerKg = pricing.finalPrice` igual a `producerPricePerKg`, con `marginPerKg = 0`

- [src/services/partner/lotVerification.service.ts:261-263](src/services/partner/lotVerification.service.ts#L261). El comentario lo llama "documentado Phase-1 stance".
- Significa que `producerPricePerKg` y `clientPricePerKg` son idénticos en DB. **El campo `marginPerKg` carece de sentido**. La doc canonical lo confirma.
- **Severidad**: baja, pero distorsiona el sentido del schema.

### Bug-10: Inspector / refresh corren `calculateMarketplaceB2BPricing` con `marketplaceGreenKg = lot.availableKg`

- [src/services/pricing/clientB2BPricingInspector.service.ts:368](src/services/pricing/clientB2BPricingInspector.service.ts#L368) usa `availableGreenKg = lot.availableKg`.
- Pero `availableKg` no descuenta contratos. Por tanto, scarcity modifier (que depende de `marketplaceGreenKg <= 50/100/250...`) usa stock total no disponible. Esto INFLA el resultado para lots con contratos viejos.
- En el verdadero marketplace path ([marketplaceLot.mapper.ts:489](src/services/allocation/marketplace/marketplaceLot.mapper.ts#L489)) se usa `marketplaceGreenKg = isExclusive ? exclusive : marketplace` — sí descuenta.
- **Inconsistencia**: el inspector reporta una "recomputación" diferente de la que el marketplace muestra realmente. Para audits es engañoso.

### Bug-11: `Contract.greenLotId` es `String?` (opcional) pero después de PRICING-B2B-3 todo contrato nuevo lo tiene

- Schema permite null ([prisma/schema.prisma:381](prisma/schema.prisma#L381)) por compatibilidad. Pero `getContractableSupply` ([src/services/system/supply.service.ts:74](src/services/system/supply.service.ts#L74)) cuando se le pasa `greenLotId` opt sólo cuenta contratos con `greenLotId === <ese id>`. Contratos legacy con `null` están en limbo: cuentan en la sumatoria total pero **no en la sumatoria por-lot**. Resultado: la supply per-lot no se ajusta por contratos legacy.
- **Severidad**: media para lots con contratos legacy.

### Bug-12: `Order.contractId` set null on contract delete

- En reset dev se borran contratos pero los `Order` no se actualizan ni borran ([src/services/dev/scenarios/devLotScenario.service.ts:719](src/services/dev/scenarios/devLotScenario.service.ts#L719)). El comentario lo asume aceptable. Schema no tiene cascade — `Order.contractId` queda apuntando a row inexistente. **Posible FK violation** depending on Prisma's default referential action; si está en `onDelete: NO_ACTION` se rompe la transacción.
- **Severidad**: incierto. Confirmar con tests del reset.

### Bug-13: `processedPricePerKg` and `clientB2BPricingMode` strings vs enum

- `clientB2BPricingMode` es `String?` ([prisma/schema.prisma:301](prisma/schema.prisma#L301)) pero `MarketplacePricingMode` es un literal union TS estricto. Si un futuro modo se añade en TypeScript pero los valores legacy en DB no se migran, el inspector y mappers no detectan inconsistencias.
- **Severidad**: baja — sin enforcement enum-side.

---

### Notas finales sobre ambigüedades sin resolver

- **Bug-7** (lockedPrice fallback para contratos legacy): no pude confirmar empíricamente cuántos contratos legacy hay y qué unidad lleva su `pricePerBag`. Es solamente sospecha.
- **Bug-12** (Order.contractId huérfano): no validé el FK action de Prisma en el schema generado. Schema dice `Order.contract Contract? @relation(...)` sin onDelete explicitado — Prisma default es `SetNull` para optional FKs, lo que dejaría el order válido pero apuntando a null. Probablemente seguro, pero no testeado.
- **Doc canonical PRICING-ENGINE-CANONICAL.md** dice que PRICING-B2B-3 NO está implementado, pero el código actual sí lo implementa. **El doc está desactualizado** — esto es exactamente el tipo de drift que pediste flaggar. Cualquier persona leyendo `docs/pricing/PRICING-ENGINE-CANONICAL.md` §1 hoy creerá que la divergencia marketplace ↔ contract sigue activa, cuando ya está cerrada para nuevos lots.
- **Doc PRICING-B2B-3 §13** documenta que `clientPricePerKg` sigue siendo legacy GREEN, que el adaptive recompute fallback nunca se elimina, y que los rows pre-migración necesitan re-verificación. Esto es coherente con el código pero implica una deuda permanente hasta que se haga el backfill.