# Acceptance — MIG-021 realtime rooms

- [x] Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
- [x] Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- [x] Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
