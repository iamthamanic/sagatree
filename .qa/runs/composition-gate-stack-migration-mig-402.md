# Composition Gate — stack-migration-mig-402 (#818)

- HEAD_SHA: cd8b4cbff502acb923d5027b72271be0c92592d1
- BASE_SHA: d6569a1df1071b93aa3cfbad1906263e3cc1a3a6
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Authenticated actor manages own Meshy BYOK / Ollama prefs; ciphertext never projected; rate limit shared across mutating credential actions.

## Hop chain

1. Producer: ai-provider-credentials / ollama-settings use-cases
2. Authorize: actor.actorId only (no project membership); foreign user cannot read/mutate
3. Persist: user_ai_provider_credentials + rate_limits (module ai); AES-GCM via CREDENTIALS_ENCRYPTION_KEY
4. Consumer: public views (keyHint/credits/hasApiKey only)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | O CRUD; X empty | self-test | pass |
| Invalid/missing | 400 key; 503 enc; SSRF 400; 429 rate | self-test | pass |
| Two consumers / crash | refresh persist_failed explicit; list db_error 500 | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP mount → MIG-600; FEATURE → MIG-602/#847
- Co-ownership ollama + credentials stays on #818 until human allocates MIG-4xx

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
