# Security Baseline Findings (2026-02-21)

## Critical
- Hardcoded production-like credentials and tokens are present in tracked files (`lib/db.ts`, `.env.local.example`, `DEPLOY_NOW.md`, `RENDER_DEPLOYMENT.md`, fallback literals in API routes).
- OAuth callback flow does not validate an anti-CSRF `state` token.
- Legacy endpoint `/api/accounts` reads from an absolute local credentials file path and returns fallback account data.

## High
- No distributed rate limiting on auth callback and sensitive write endpoints.
- Middleware enforces redirect-based auth for API paths, producing non-JSON semantics and inconsistent route protection.
- `lib/db/pool.ts` calls `process.exit(-1)` on pool error (availability risk).
- Status route shells out with `child_process.exec` to inspect local process state.
- Core market endpoint returns synthetic fallback data instead of fail-closed errors.

## Medium
- Session parsing inconsistency: `/api/user/stats` attempts JSON parse of JWT cookie.
- Dynamic SQL update parameter ordering bug in `/api/user/accounts` PATCH path.
- Direction/status normalization mismatch across API and UI (`long/short` vs `LONG/SHORT`; `running` vs `online`).
- Frontend polling duplicates network fetches across consumers and logs sensitive context in some flows.

## Dependency baseline (`npm audit`)
- 14 high, 0 critical, 1 moderate vulnerabilities.
- Dominant chain is lint toolchain (`eslint`, `minimatch`, `typescript-eslint`) with semver-major remediation paths.
