# Migration Execution Contract (draft — not activated)

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
3. Explicit freigabe to publish GitHub issues  
4. Explicit freigabe to start `@ecc-runner-loop` on the migration epic  
