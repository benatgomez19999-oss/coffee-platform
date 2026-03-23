# Diff Details

Date : 2026-03-23 15:37:54

Directory c:\\Users\\BG420\\coffee-platform

Total : 59 files,  1693 codes, 441 comments, 365 blanks, all 2499 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [app/api/auth/forgot-password/route.ts](/app/api/auth/forgot-password/route.ts) | TypeScript | 55 | 16 | 19 | 90 |
| [app/api/auth/login/route.ts](/app/api/auth/login/route.ts) | TypeScript | 48 | 6 | 16 | 70 |
| [app/api/auth/logout/route.ts](/app/api/auth/logout/route.ts) | TypeScript | 14 | 3 | 4 | 21 |
| [app/api/auth/me/route.ts](/app/api/auth/me/route.ts) | TypeScript | 39 | 16 | 13 | 68 |
| [app/api/auth/resend-verification/route.ts](/app/api/auth/resend-verification/route.ts) | TypeScript | 67 | 21 | 22 | 110 |
| [app/api/auth/reset-password/route.ts](/app/api/auth/reset-password/route.ts) | TypeScript | 61 | 18 | 20 | 99 |
| [app/api/auth/signup/route.ts](/app/api/auth/signup/route.ts) | TypeScript | 99 | 42 | 40 | 181 |
| [app/api/auth/verify/route.ts](/app/api/auth/verify/route.ts) | TypeScript | 73 | 39 | 37 | 149 |
| [app/api/company/me/route.ts](/app/api/company/me/route.ts) | TypeScript | 32 | 2 | 10 | 44 |
| [app/api/company/update/route.ts](/app/api/company/update/route.ts) | TypeScript | 45 | 9 | 12 | 66 |
| [app/api/contracts/amend/route.ts](/app/api/contracts/amend/route.ts) | TypeScript | 58 | 22 | 15 | 95 |
| [app/api/contracts/create/route.ts](/app/api/contracts/create/route.ts) | TypeScript | 7 | 23 | 6 | 36 |
| [app/api/contracts/route.ts](/app/api/contracts/route.ts) | TypeScript | 19 | 10 | -1 | 28 |
| [app/api/contracts/send-otp/route.ts](/app/api/contracts/send-otp/route.ts) | TypeScript | 54 | 17 | 24 | 95 |
| [app/api/signature-legacy/request/route.ts](/app/api/signature-legacy/request/route.ts) | TypeScript | 91 | 42 | 29 | 162 |
| [app/api/signature-legacy/sign/route.ts](/app/api/signature-legacy/sign/route.ts) | TypeScript | 56 | 18 | 20 | 94 |
| [app/api/signature-legacy/verify/route.ts](/app/api/signature-legacy/verify/route.ts) | TypeScript | 48 | 24 | 14 | 86 |
| [app/api/signature/request/route.ts](/app/api/signature/request/route.ts) | TypeScript | -50 | -24 | -34 | -108 |
| [app/api/signature/sign/route.ts](/app/api/signature/sign/route.ts) | TypeScript | -56 | -15 | -27 | -98 |
| [app/api/signature/verify/route.ts](/app/api/signature/verify/route.ts) | TypeScript | -46 | -24 | -41 | -111 |
| [app/contract/create/ContractCreateContent.tsx](/app/contract/create/ContractCreateContent.tsx) | TypeScript JSX | 176 | 22 | 54 | 252 |
| [app/contract/create/page.tsx](/app/contract/create/page.tsx) | TypeScript JSX | -124 | -15 | -64 | -203 |
| [app/contract/create/step1Client.tsx](/app/contract/create/step1Client.tsx) | TypeScript JSX | 3 | 1 | 1 | 5 |
| [app/contract/create/step3Preview.tsx](/app/contract/create/step3Preview.tsx) | TypeScript JSX | -51 | -17 | -37 | -105 |
| [app/contract/pilot/page.tsx](/app/contract/pilot/page.tsx) | TypeScript JSX | 7 | 9 | 4 | 20 |
| [app/forgot-password/page.tsx](/app/forgot-password/page.tsx) | TypeScript JSX | 94 | 4 | 18 | 116 |
| [app/layout.tsx](/app/layout.tsx) | TypeScript JSX | -10 | 9 | -2 | -3 |
| [app/login/page.tsx](/app/login/page.tsx) | TypeScript JSX | 87 | -14 | -7 | 66 |
| [app/page.tsx](/app/page.tsx) | TypeScript JSX | 821 | 39 | 142 | 1,002 |
| [app/platform/contracts/page.tsx](/app/platform/contracts/page.tsx) | TypeScript JSX | 73 | 0 | 16 | 89 |
| [app/platform/page.tsx](/app/platform/page.tsx) | TypeScript JSX | -1,677 | -157 | -449 | -2,283 |
| [app/reset-password/page.tsx](/app/reset-password/page.tsx) | TypeScript JSX | 120 | 20 | 34 | 174 |
| [app/signup/page.tsx](/app/signup/page.tsx) | TypeScript JSX | 70 | 8 | 10 | 88 |
| [app/signup/success/page.tsx](/app/signup/success/page.tsx) | TypeScript JSX | 101 | 21 | 34 | 156 |
| [app/verify-page/page.tsx](/app/verify-page/page.tsx) | TypeScript JSX | 64 | 10 | 11 | 85 |
| [lib/auth.ts](/lib/auth.ts) | TypeScript | -16 | 0 | -3 | -19 |
| [lib/getUserFromRequest.ts](/lib/getUserFromRequest.ts) | TypeScript | -17 | 0 | -5 | -22 |
| [lib/supabase.ts](/lib/supabase.ts) | TypeScript | 0 | 0 | -1 | -1 |
| [next.config.js](/next.config.js) | JavaScript | 2 | 1 | 1 | 4 |
| [next.config.ts](/next.config.ts) | TypeScript | -4 | -1 | -3 | -8 |
| [package-lock.json](/package-lock.json) | JSON | -83 | 0 | 0 | -83 |
| [package.json](/package.json) | JSON | 7 | 0 | 0 | 7 |
| [prisma/migrations/20260321175514\_auth\_upgrade\_v2/migration.sql](/prisma/migrations/20260321175514_auth_upgrade_v2/migration.sql) | MS SQL | 166 | 40 | 55 | 261 |
| [prisma/migrations/20260322195244\_add\_password\_reset\_token/migration.sql](/prisma/migrations/20260322195244_add_password_reset_token/migration.sql) | MS SQL | 20 | 17 | 9 | 46 |
| [prisma/migrations/20260322221841\_add\_company\_onboarding\_fields/migration.sql](/prisma/migrations/20260322221841_add_company_onboarding_fields/migration.sql) | MS SQL | 5 | 2 | 2 | 9 |
| [prisma/migrations/20260323143440\_otp\_signature\_flow/migration.sql](/prisma/migrations/20260323143440_otp_signature_flow/migration.sql) | MS SQL | 5 | 3 | 3 | 11 |
| [src/components/platform/ClientContractsPanel.tsx](/src/components/platform/ClientContractsPanel.tsx) | TypeScript JSX | -27 | -28 | -62 | -117 |
| [src/components/platform/ClientOverviewPanel.tsx](/src/components/platform/ClientOverviewPanel.tsx) | TypeScript JSX | 1 | 0 | 2 | 3 |
| [src/components/platform/Dashboard.tsx](/src/components/platform/Dashboard.tsx) | TypeScript JSX | 776 | 119 | 302 | 1,197 |
| [src/components/platform/OnboardingWizard.tsx](/src/components/platform/OnboardingWizard.tsx) | TypeScript JSX | 155 | 17 | 37 | 209 |
| [src/database/prisma.ts](/src/database/prisma.ts) | TypeScript | 12 | 4 | -1 | 15 |
| [src/lib/auth.ts](/src/lib/auth.ts) | TypeScript | 49 | 18 | 21 | 88 |
| [src/lib/email.ts](/src/lib/email.ts) | TypeScript | 31 | 30 | 15 | 76 |
| [src/lib/emailTemplates.ts](/src/lib/emailTemplates.ts) | TypeScript | 64 | 3 | 1 | 68 |
| [src/lib/getUserFromRequest.ts](/src/lib/getUserFromRequest.ts) | TypeScript | 16 | 9 | 10 | 35 |
| [src/lib/requireAuth.ts](/src/lib/requireAuth.ts) | TypeScript | 28 | 0 | 9 | 37 |
| [src/lib/supabase.ts](/src/lib/supabase.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [tsconfig.json](/tsconfig.json) | JSON with Comments | 13 | 0 | -1 | 12 |
| [📄 middleware.ts](/%F0%9F%93%84%20middleware.ts) | TypeScript | 22 | 2 | 10 | 34 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details