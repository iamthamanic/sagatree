# Migration contracts

90 veröffentlichte, einzeln verlinkte Verträge. Die vier ursprünglichen RPC-Sammeltickets sind Koordinatoren; 18 Untertickets teilen alle 57 RPCs exklusiv auf.

Die vollständigen Issue-Bodies werden aus Quellinventaren und scripts/stack-migration-plan-contracts.mjs gerendert. Änderungen an Abhängigkeiten, Acceptance, Runner und Design sind mit npm run check:stack-migration-prep zu prüfen.

| Reihenfolge | Welle | Issue | Ausführung | Vorgänger |
| --- | --- | --- | --- | --- |
| 1 | 0 | MIG-001 [#782](https://github.com/iamthamanic/sagatree/issues/782) | done | — |
| 2 | 0 | ATLAS-LIVE-E2E [#770](https://github.com/iamthamanic/sagatree/issues/770) | blocked | #782 |
| 3 | 0 | MIG-002 [#783](https://github.com/iamthamanic/sagatree/issues/783) | done | #782 |
| 4 | 0 | GATE-01 [#784](https://github.com/iamthamanic/sagatree/issues/784) | done | #782, #783 |
| 5 | 0 | GATE-02 [#785](https://github.com/iamthamanic/sagatree/issues/785) | done | #782, #783 |
| 6 | 0 | GATE-03 [#786](https://github.com/iamthamanic/sagatree/issues/786) | done | #782, #783 |
| 7 | 0 | GATE-04 [#787](https://github.com/iamthamanic/sagatree/issues/787) | done | #782, #783 |
| 8 | 1 | MIG-010 [#789](https://github.com/iamthamanic/sagatree/issues/789) | done | #782, #783, #784 |
| 9 | 1 | MIG-011 [#790](https://github.com/iamthamanic/sagatree/issues/790) | done | #789, #784, #787 |
| 10 | 1 | MIG-013 [#792](https://github.com/iamthamanic/sagatree/issues/792) | done | #790, #784 |
| 11 | 1 | MIG-012 [#791](https://github.com/iamthamanic/sagatree/issues/791) | done | #790, #792 |
| 12 | 1 | MIG-014 [#793](https://github.com/iamthamanic/sagatree/issues/793) | done | #789, #790, #792, #785 |
| 13 | 1 | MIG-015 [#794](https://github.com/iamthamanic/sagatree/issues/794) | done | #789, #790, #792, #785 |
| 14 | 1 | MIG-500 [#841](https://github.com/iamthamanic/sagatree/issues/841) | done | #790, #792 |
| 15 | 2 | MIG-020 [#795](https://github.com/iamthamanic/sagatree/issues/795) | done | #789, #792, #793, #786 |
| 16 | 2 | MIG-022 [#797](https://github.com/iamthamanic/sagatree/issues/797) | done | #790, #792, #793, #787 |
| 17 | 2 | MIG-023 [#798](https://github.com/iamthamanic/sagatree/issues/798) | done | #795, #797, #785 |
| 18 | 2 | MIG-024 [#799](https://github.com/iamthamanic/sagatree/issues/799) | done | #792, #797, #784 |
| 19 | 2 | MIG-021 [#796](https://github.com/iamthamanic/sagatree/issues/796) | ready | #795, #797, #799, #785, #786 |
| 20 | 2 | MIG-503 [#844](https://github.com/iamthamanic/sagatree/issues/844) | done | #790, #783 |
| 21 | 2 | RPC-MARKETPLACE-COUNT [#878](https://github.com/iamthamanic/sagatree/issues/878) | blocked | #795, #792, #797, #799, #784, #785, #787 |
| 22 | 2 | RPC-SAGA-AUTHORING [#871](https://github.com/iamthamanic/sagatree/issues/871) | ready | #795, #792, #797, #799, #784, #785, #787 |
| 23 | 2 | RPC-SAGA-VERSION-READ [#872](https://github.com/iamthamanic/sagatree/issues/872) | waiting | #795, #792, #797, #799, #784, #785, #787, #871 |
| 24 | 2 | RPC-SAGA-PROVISION [#873](https://github.com/iamthamanic/sagatree/issues/873) | blocked | #795, #792, #797, #799, #784, #785, #787, #872 |
| 25 | 2 | RPC-PROJECT-MEMBERSHIP [#874](https://github.com/iamthamanic/sagatree/issues/874) | waiting | #795, #792, #797, #799, #784, #785, #787, #873 |
| 26 | 2 | RPC-SAGA-GOVERNANCE [#875](https://github.com/iamthamanic/sagatree/issues/875) | waiting | #795, #792, #797, #799, #784, #785, #787, #874 |
| 27 | 2 | RPC-SESSION-RUNTIME [#867](https://github.com/iamthamanic/sagatree/issues/867) | blocked | #795, #792, #797, #799, #784, #785, #787 |
| 28 | 2 | RPC-SESSION-LIFECYCLE [#868](https://github.com/iamthamanic/sagatree/issues/868) | blocked | #795, #792, #797, #799, #784, #785, #787, #867 |
| 29 | 2 | RPC-NPC-INSTANCES [#877](https://github.com/iamthamanic/sagatree/issues/877) | waiting | #795, #792, #797, #799, #784, #785, #787, #868 |
| 30 | 2 | MIG-353 [#816](https://github.com/iamthamanic/sagatree/issues/816) | blocked | #877, #878 |
| 31 | 2 | RPC-SESSION-ACCESS [#869](https://github.com/iamthamanic/sagatree/issues/869) | blocked | #795, #792, #797, #799, #784, #785, #787, #868 |
| 32 | 2 | RPC-SESSION-RECAP [#870](https://github.com/iamthamanic/sagatree/issues/870) | blocked | #795, #792, #797, #799, #784, #785, #787, #868 |
| 33 | 2 | MIG-351 [#814](https://github.com/iamthamanic/sagatree/issues/814) | waiting | #867, #868, #869, #870 |
| 34 | 2 | RPC-SAGA-PROJECTIONS [#876](https://github.com/iamthamanic/sagatree/issues/876) | blocked | #795, #792, #797, #799, #784, #785, #787, #875, #870 |
| 35 | 2 | MIG-352 [#815](https://github.com/iamthamanic/sagatree/issues/815) | waiting | #871, #872, #873, #874, #875, #876 |
| 36 | 2 | RPC-WORLD-MAP [#861](https://github.com/iamthamanic/sagatree/issues/861) | blocked | #795, #792, #797, #799, #784, #785, #787 |
| 37 | 2 | RPC-ATLAS-MAPS [#862](https://github.com/iamthamanic/sagatree/issues/862) | blocked | #795, #792, #797, #799, #784, #785, #787, #861 |
| 38 | 2 | RPC-WORLD-PLACES [#863](https://github.com/iamthamanic/sagatree/issues/863) | blocked | #795, #792, #797, #799, #784, #785, #787, #862 |
| 39 | 2 | RPC-WORLD-CREATE [#864](https://github.com/iamthamanic/sagatree/issues/864) | waiting | #795, #792, #797, #799, #784, #785, #787, #863 |
| 40 | 2 | RPC-WORLD-RESTRUCTURE [#865](https://github.com/iamthamanic/sagatree/issues/865) | waiting | #795, #792, #797, #799, #784, #785, #787, #864 |
| 41 | 2 | RPC-WORLD-DESTRUCTIVE [#866](https://github.com/iamthamanic/sagatree/issues/866) | blocked | #795, #792, #797, #799, #784, #785, #787, #865 |
| 42 | 2 | MIG-350 [#813](https://github.com/iamthamanic/sagatree/issues/813) | waiting | #861, #862, #863, #864, #865, #866 |
| 43 | 3 | MIG-402 [#818](https://github.com/iamthamanic/sagatree/issues/818) | blocked | #795, #792, #793, #791, #841 |
| 44 | 3 | MIG-401 [#817](https://github.com/iamthamanic/sagatree/issues/817) | blocked | #795, #792, #793, #818, #791 |
| 45 | 3 | MIG-403 [#819](https://github.com/iamthamanic/sagatree/issues/819) | blocked | #795, #792, #793 |
| 46 | 3 | MIG-404 [#820](https://github.com/iamthamanic/sagatree/issues/820) | blocked | #795, #792, #793, #818, #791, #841 |
| 47 | 3 | MIG-405 [#821](https://github.com/iamthamanic/sagatree/issues/821) | blocked | #795, #792, #793, #818, #791 |
| 48 | 3 | MIG-406 [#822](https://github.com/iamthamanic/sagatree/issues/822) | blocked | #795, #792, #793 |
| 49 | 3 | MIG-407 [#823](https://github.com/iamthamanic/sagatree/issues/823) | blocked | #795, #792, #793 |
| 50 | 3 | MIG-408 [#824](https://github.com/iamthamanic/sagatree/issues/824) | blocked | #795, #792, #793, #841 |
| 51 | 3 | MIG-409 [#825](https://github.com/iamthamanic/sagatree/issues/825) | blocked | #795, #792, #793, #818, #791, #841 |
| 52 | 3 | MIG-410 [#826](https://github.com/iamthamanic/sagatree/issues/826) | blocked | #795, #792, #793, #818, #791, #841 |
| 53 | 3 | MIG-411 [#827](https://github.com/iamthamanic/sagatree/issues/827) | blocked | #795, #792, #793 |
| 54 | 3 | MIG-412 [#828](https://github.com/iamthamanic/sagatree/issues/828) | blocked | #795, #792, #793, #841 |
| 55 | 3 | MIG-413 [#829](https://github.com/iamthamanic/sagatree/issues/829) | blocked | #795, #792, #793 |
| 56 | 3 | MIG-415 [#831](https://github.com/iamthamanic/sagatree/issues/831) | blocked | #795, #792, #793 |
| 57 | 3 | MIG-416 [#832](https://github.com/iamthamanic/sagatree/issues/832) | blocked | #795, #792, #793, #841 |
| 58 | 3 | MIG-417 [#833](https://github.com/iamthamanic/sagatree/issues/833) | blocked | #795, #792, #793 |
| 59 | 3 | MIG-418 [#834](https://github.com/iamthamanic/sagatree/issues/834) | blocked | #795, #792, #793 |
| 60 | 3 | MIG-419 [#835](https://github.com/iamthamanic/sagatree/issues/835) | blocked | #795, #792, #793 |
| 61 | 3 | MIG-420 [#836](https://github.com/iamthamanic/sagatree/issues/836) | blocked | #795, #792, #793, #791, #841 |
| 62 | 3 | MIG-421 [#837](https://github.com/iamthamanic/sagatree/issues/837) | waiting | #795, #792, #793, #818, #870, #791 |
| 63 | 3 | MIG-414 [#830](https://github.com/iamthamanic/sagatree/issues/830) | blocked | #795, #792, #793, #818, #820, #821, #825, #826, #828, #836, #837 |
| 64 | 3 | MIG-422 [#838](https://github.com/iamthamanic/sagatree/issues/838) | blocked | #795, #792, #793 |
| 65 | 3 | MIG-423 [#839](https://github.com/iamthamanic/sagatree/issues/839) | blocked | #795, #792, #793 |
| 66 | 3 | MIG-424 [#840](https://github.com/iamthamanic/sagatree/issues/840) | blocked | #795, #792, #793 |
| 67 | 4 | MIG-301 [#800](https://github.com/iamthamanic/sagatree/issues/800) | waiting | #791, #792, #795, #818, #793 |
| 68 | 4 | MIG-302 [#801](https://github.com/iamthamanic/sagatree/issues/801) | waiting | #791, #792, #795, #820, #821, #841, #793 |
| 69 | 4 | MIG-303 [#802](https://github.com/iamthamanic/sagatree/issues/802) | waiting | #791, #792, #795, #825, #826, #793 |
| 70 | 4 | MIG-304 [#803](https://github.com/iamthamanic/sagatree/issues/803) | waiting | #791, #792, #795, #828, #793 |
| 71 | 4 | MIG-305 [#804](https://github.com/iamthamanic/sagatree/issues/804) | blocked | #791, #792, #795, #878, #793 |
| 72 | 4 | MIG-306 [#805](https://github.com/iamthamanic/sagatree/issues/805) | ready | #791, #792, #795 |
| 73 | 4 | MIG-307 [#806](https://github.com/iamthamanic/sagatree/issues/806) | waiting | #791, #792, #795, #877, #793 |
| 74 | 4 | MIG-308 [#807](https://github.com/iamthamanic/sagatree/issues/807) | waiting | #791, #792, #795, #868, #873, #875, #876, #874, #793 |
| 75 | 4 | MIG-309 [#808](https://github.com/iamthamanic/sagatree/issues/808) | ready | #791, #792, #795, #793 |
| 76 | 4 | MIG-310 [#809](https://github.com/iamthamanic/sagatree/issues/809) | waiting | #791, #792, #795, #871, #873, #872, #876, #793 |
| 77 | 4 | MIG-311 [#810](https://github.com/iamthamanic/sagatree/issues/810) | blocked | #791, #792, #795, #867, #868, #869, #870, #836, #837, #796, #793 |
| 78 | 4 | MIG-312 [#811](https://github.com/iamthamanic/sagatree/issues/811) | blocked | #791, #792, #795, #841, #793 |
| 79 | 4 | MIG-313 [#812](https://github.com/iamthamanic/sagatree/issues/812) | waiting | #791, #792, #795, #866, #864, #865, #862, #861, #863, #841, #793 |
| 80 | 5 | MIG-501 [#842](https://github.com/iamthamanic/sagatree/issues/842) | ready | #841, #795 |
| 81 | 5 | MIG-502 [#843](https://github.com/iamthamanic/sagatree/issues/843) | ready | #841, #844, #795 |
| 82 | 6 | MIG-600 [#845](https://github.com/iamthamanic/sagatree/issues/845) | waiting | #796, #798, #799, #841, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 |
| 83 | 6 | MIG-601 [#846](https://github.com/iamthamanic/sagatree/issues/846) | waiting | #789, #793, #794, #841, #830 |
| 84 | 6 | MIG-602 [#847](https://github.com/iamthamanic/sagatree/issues/847) | waiting | #845, #846, #770, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 |
| 85 | 6 | MIG-603 [#848](https://github.com/iamthamanic/sagatree/issues/848) | waiting | #843, #844, #846 |
| 86 | 7 | GATE-05 [#788](https://github.com/iamthamanic/sagatree/issues/788) | blocked | #847, #848 |
| 87 | 7 | MIG-700 [#849](https://github.com/iamthamanic/sagatree/issues/849) | waiting | #782, #770, #783, #784, #785, #786, #787, #789, #790, #792, #791, #793, #794, #841, #795, #797, #798, #799, #796, #844, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #843, #845, #846, #847, #848, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 |
| 88 | 7 | MIG-701 [#850](https://github.com/iamthamanic/sagatree/issues/850) | waiting | #849 |
| 89 | 7 | MIG-702 [#851](https://github.com/iamthamanic/sagatree/issues/851) | waiting | #849, #850, #770, #848 |
| 90 | 7 | MIG-703 [#852](https://github.com/iamthamanic/sagatree/issues/852) | waiting | #788, #847, #848 |
