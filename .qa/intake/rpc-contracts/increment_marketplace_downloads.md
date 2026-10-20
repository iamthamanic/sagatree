# RPC `increment_marketplace_downloads`

## VORHER
- SQL: `src/supabase/deploy_marketplace.sql`, `src/supabase/add_marketplace_rpc.sql` (not in supabase/migrations — **investigate**)
- Call sites: `src/infrastructure/marketplace/marketplace-service.ts`

## NACHHER
- Module: `server/src/application/commands/increment_marketplace_downloads.ts`
- Status: BLOCKED until deploy path clarified

## TESTS
- Happy path increments download count
- Authz negative
- Idempotent or documented non-idempotent behavior

## GRENZEN
- No silent drop of marketplace metrics
