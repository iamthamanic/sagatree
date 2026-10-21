# Migration Execution Contract (preparation authorized; migration runner not activated)

## Cursor / ECC runner MAY

- Implement one clearly specified service/adapter  
- Extend existing tests  
- Swap documented adapters  
- Fix proven bugs  
- Decide small implementation details **inside** an APPROVED contract  

## Cursor / ECC runner MUST NOT

- Choose a different DB, ORM, or auth framework than GATE-approved  
- Redesign tables/product contracts unilaterally  
- Simplify permissions  
- Hide GM secrets only in the frontend  
- Remove assertions to pass CI  
- Delete features as “legacy” without freigabe  
- Shut down Supabase before parity  
- Migrate production data without freigabe  
- Invent architecture because it is easier  

## Activation

This contract activates only after:

1. Prep PR merged  
2. GATE decisions APPROVED where required  
3. Published canonical contracts synchronized with the authoritative issue registry  
4. Explicit freigabe to start `@ecc-runner-loop` on the migration epic (the current preparation authorization does not activate it)  

## Current preparation scope

Source contract repair, independent review, synthetic PostgreSQL/HTTP/browser tests, SQLite PoCs and synchronization of existing/new split issues are authorized. These tasks do not confer human architecture approval or permission to migrate production data. Source-level legacy defects remain explicit blockers until corrected and proven by negative tests.
