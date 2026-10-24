# Acceptance — MIG-021 realtime rooms

- [x] Jeder erhält einen konsistenten Snapshot ohne Lücke oder doppelte Anwendung der bereits im Tip enthaltenen Deltas.
- [x] Fan-out re-resolves membership; revoked occupants are evicted; demoted writers lose GM projection.
- [x] Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- [x] Der Resync rekonstruiert das bestätigte Tip-Ergebnis aus der Persistenz ohne doppelte Delta-Anwendung.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
