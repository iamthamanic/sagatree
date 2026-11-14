# ATL2-G01 — GM / Player / Owner atlas scopes

- Issue: #1229
- HEAD: `11efd6ffb5fc80d0324cc72eb0a23495f9a00e3e`
- Verdict: **CLEAR**
- Date: 2026-11-14

## Host evidence

- Stranger write deny: **yes** (status 403)
- Unrevealed map fail-closed: **yes**
- Player secrets redacted: **yes**
- Dungeon meta omitted: **yes**
- Seed keys omitted: **yes**
- Revealed titles: Krypta unter dem Hügel

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
| Foreign / stranger write deny | stranger atlas upsert → 42501/403 | **pass-host** |
| Unrevealed map fail-closed | playerView without reveal / without saga → deny or empty | **pass-host** |
| Party-reveal gating | after party binding, crypt appears; secrets still redacted | **pass-host** |
| Meta whitelist | player generator_meta omits dungeon + golden seed keys | **pass-host** |

## Decision

ATL2-G01 scopes are **CLEAR**.
