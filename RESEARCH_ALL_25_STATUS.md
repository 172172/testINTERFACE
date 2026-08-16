# Status – alla 25 precisionsfrågor

Verifierad 2026-08-16.

Alla r001–r025 har nu genomgått en första systematisk källgranskning i tre batcher. Det betyder **inte** att alla är redo att påverka matchningsresultatet. Regeln är fortfarande: ingen gissning, ingen proxy mellan närliggande frågor och `null` när exakt underlag saknas.

- Batch 1: r001–r010 – `data/research-batch-01.json` och `RESEARCH_BATCH_01.md`
- Batch 2: r011–r020 – `data/research-batch-02.json` och `RESEARCH_BATCH_02.md`
- Batch 3: r021–r025 – `data/research-batch-03.json` och `RESEARCH_BATCH_03.md`

## Nästa publiceringsregel
För att en precisionsfråga ska få `score:true` bör den:
1. ha en entydig formulering som exakt motsvarar källorna,
2. ha en direkt verifierad position för varje jämfört riksdagsparti, eller uttryckligen undantas från huvudrankingen tills täckningen är tillräcklig,
3. inte vara en ren konsensusfråga som i praktiken inte skiljer partier,
4. ha källa, verifieringsdatum, motivering och säkerhetsgrad per position,
5. aldrig konvertera `null` till 0.

Örebropartiet behandlas med samma beviskrav. Eftersom partiets nationella 2026-program publiceras successivt lämnas flera positioner korrekt som `null` tills det finns direkt officiellt stöd.
