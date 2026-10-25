# Feature: P1: MIG-501 Großupload-Limit nicht über öffentliches maxBytes umgehbar machen

## Intent
Die Capability-Grenze für große Assets erzwingen: Das erhöhte Byte-Limit gilt ausschließlich über `publishResumableFinalize` (resumable, autorisiert, capability on), nicht über caller-kontrollierbares `PublishInput.maxBytes`.

## Acceptance
- [x] Direkter 17-MiB-Publish wird auch mit manuell gesetztem `maxBytes=64 MiB` verweigert; ≤16-MiB-Direkt-Publish funktioniert.
- [x] Erhöhter Cap nur über internen `publishResumableFinalize` / resumable Path; öffentliches `publish` strippt/ignoriert maxBytes und bleibt DEFAULT.
- [x] Resumable Uploads mit aktiver Capability bis Hard Cap (17 MiB Probe) funktionieren; >64 MiB create weiterhin `bytes-too-large`; fremde Owner denied.
- [x] Negativtests in `scripts/mig-501-resumable-uploads.self-test.mjs` (#939 Abschnitt).
- [x] Touched files: zero type escape hatches.

## Non-Goals
UI, Cloud provider, global default raise, cutover/shutdown/desktop.
