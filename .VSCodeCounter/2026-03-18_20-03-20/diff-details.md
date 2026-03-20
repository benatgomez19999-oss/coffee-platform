# Diff Details

Date : 2026-03-18 20:03:20

Directory c:\\Users\\BG420\\coffee-platform

Total : 41 files,  872 codes, 846 comments, 1073 blanks, all 2791 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [app/lab/page.tsx](/app/lab/page.tsx) | TypeScript JSX | 13 | 0 | 4 | 17 |
| [package-lock.json](/package-lock.json) | JSON | -743 | 0 | 0 | -743 |
| [src/AI/advisor/coffeeSupplyAdvisor.ts](/src/AI/advisor/coffeeSupplyAdvisor.ts) | TypeScript | 117 | 53 | 81 | 251 |
| [src/AI/agent/AutonomousStrategyAgent.ts](/src/AI/agent/AutonomousStrategyAgent.ts) | TypeScript | 35 | 8 | 6 | 49 |
| [src/AI/analytics/PnLEngine.ts](/src/AI/analytics/PnLEngine.ts) | TypeScript | 17 | 6 | 10 | 33 |
| [src/AI/analytics/StrategyLeaderboard.ts](/src/AI/analytics/StrategyLeaderboard.ts) | TypeScript | 34 | 11 | 17 | 62 |
| [src/AI/analytics/TradeClosureEngine.ts](/src/AI/analytics/TradeClosureEngine.ts) | TypeScript | 18 | 3 | 14 | 35 |
| [src/AI/evolution/CapitalCompetitionEngine.ts](/src/AI/evolution/CapitalCompetitionEngine.ts) | TypeScript | 37 | 21 | 30 | 88 |
| [src/AI/evolution/StrategyArena.ts](/src/AI/evolution/StrategyArena.ts) | TypeScript | 38 | 24 | 24 | 86 |
| [src/AI/evolution/StrategyEvolutionEngine.ts](/src/AI/evolution/StrategyEvolutionEngine.ts) | TypeScript | 44 | 39 | 31 | 114 |
| [src/AI/evolution/StrategyGenome.ts](/src/AI/evolution/StrategyGenome.ts) | TypeScript | 18 | 9 | 15 | 42 |
| [src/AI/evolution/StrategyMutationEngine.ts](/src/AI/evolution/StrategyMutationEngine.ts) | TypeScript | 14 | 6 | 9 | 29 |
| [src/AI/execution/PositionSizingEngine.ts](/src/AI/execution/PositionSizingEngine.ts) | TypeScript | 36 | 41 | 35 | 112 |
| [src/AI/learning/StrategyLearningEngine.ts](/src/AI/learning/StrategyLearningEngine.ts) | TypeScript | 16 | 6 | 9 | 31 |
| [src/AI/learning/TradeMemory.ts](/src/AI/learning/TradeMemory.ts) | TypeScript | 20 | 9 | 17 | 46 |
| [src/AI/orchestration/runAISystem.ts](/src/AI/orchestration/runAISystem.ts) | TypeScript | 131 | 55 | 82 | 268 |
| [src/AI/risk/CapitalAllocationEngine.ts](/src/AI/risk/CapitalAllocationEngine.ts) | TypeScript | 15 | 23 | 16 | 54 |
| [src/AI/risk/PortfolioExposureEngine.ts](/src/AI/risk/PortfolioExposureEngine.ts) | TypeScript | 26 | 17 | 19 | 62 |
| [src/AI/risk/PortfolioRebalancer.ts](/src/AI/risk/PortfolioRebalancer.ts) | TypeScript | 36 | 17 | 23 | 76 |
| [src/clientLayer/layer/contractScheduler.ts](/src/clientLayer/layer/contractScheduler.ts) | TypeScript | 7 | 39 | 13 | 59 |
| [src/clientLayer/microlots/microLotAuctionEngine.ts](/src/clientLayer/microlots/microLotAuctionEngine.ts) | TypeScript | 60 | 22 | 52 | 134 |
| [src/clientLayer/microlots/microLotDispatcher.ts](/src/clientLayer/microlots/microLotDispatcher.ts) | TypeScript | 18 | 14 | 15 | 47 |
| [src/clientLayer/microlots/microLotMarketEngine.ts](/src/clientLayer/microlots/microLotMarketEngine.ts) | TypeScript | 63 | 25 | 52 | 140 |
| [src/clientLayer/microlots/microLotMarketLearning.ts](/src/clientLayer/microlots/microLotMarketLearning.ts) | TypeScript | 66 | 31 | 53 | 150 |
| [src/clientLayer/microlots/microLotOfferEngine.ts](/src/clientLayer/microlots/microLotOfferEngine.ts) | TypeScript | 51 | 23 | 44 | 118 |
| [src/clientLayer/microlots/microLotPortfolioEngine.ts](/src/clientLayer/microlots/microLotPortfolioEngine.ts) | TypeScript | 81 | 28 | 62 | 171 |
| [src/clientLayer/microlots/microLotPricingEngine.ts](/src/clientLayer/microlots/microLotPricingEngine.ts) | TypeScript | 94 | 30 | 57 | 181 |
| [src/clientLayer/scoring/clientReputationDrift.ts](/src/clientLayer/scoring/clientReputationDrift.ts) | TypeScript | 36 | 26 | 34 | 96 |
| [src/clientLayer/scoring/clientScoreEngine.ts](/src/clientLayer/scoring/clientScoreEngine.ts) | TypeScript | 66 | 64 | 46 | 176 |
| [src/clientLayer/scoring/clientTrustEngine.ts](/src/clientLayer/scoring/clientTrustEngine.ts) | TypeScript | 53 | 21 | 46 | 120 |
| [src/clientLayer/scoring/microLotAllocator.ts](/src/clientLayer/scoring/microLotAllocator.ts) | TypeScript | 15 | 7 | 13 | 35 |
| [src/components/lab/StrategyLeaderboardPanel.tsx](/src/components/lab/StrategyLeaderboardPanel.tsx) | TypeScript JSX | 61 | 6 | 21 | 88 |
| [src/decision/clientScoring.ts](/src/decision/clientScoring.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [src/decision/liveDecision.ts](/src/decision/liveDecision.ts) | TypeScript | 14 | 4 | 5 | 23 |
| [src/engine/runtime.ts](/src/engine/runtime.ts) | TypeScript | 86 | 72 | 58 | 216 |
| [src/events/eventTypes.ts](/src/events/eventTypes.ts) | TypeScript | 4 | 4 | 0 | 8 |
| [src/market/globalMarketState.ts](/src/market/globalMarketState.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [src/services/contracts.service.ts](/src/services/contracts.service.ts) | TypeScript | 45 | 43 | 19 | 107 |
| [src/services/inventory.service.ts](/src/services/inventory.service.ts) | TypeScript | 29 | 0 | 9 | 38 |
| [src/services/roasting.service.ts](/src/services/roasting.service.ts) | TypeScript | 44 | 0 | 10 | 54 |
| [src/signals/marketSignals.ts](/src/signals/marketSignals.ts) | TypeScript | 57 | 39 | 20 | 116 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details