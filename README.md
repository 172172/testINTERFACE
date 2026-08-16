# Öppen valkompass 2026

En fristående svensk valkompass byggd för att kunna granskas, exporteras och räknas om utan att användaren behöver lita på skaparen.

## Öppna webbplatsen

Det enklaste alternativet är filen:

```text
valkompass-2026-standalone-v0.4.html
```

Den innehåller HTML, CSS, JavaScript och hela datasetet i en enda fil och kan öppnas genom dubbelklick.

Den modulära projektversionen körs lokalt så här:

```bash
cd valkompass-2026-v0.4
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000/` i webbläsaren. Att dubbelklicka på projektets `index.html` fungerar normalt inte, eftersom webbläsare brukar blockera inläsning av lokala JSON-filer från `file://`.

## Vad version 0.4 faktiskt innehåller

- 60 preciserade sakfrågor i databasen.
- 35 aktiva frågor med en komplett gemensam positionsmatris för de åtta riksdagspartierna.
- 25 öppna forskningsfrågor med `score: false`; de påverkar inte resultatet.
- 280 av 280 verifierade kärnpositioner: 35 frågor × 8 riksdagspartier.
- Örebropartiet med sju exakt källbelagda nationella positioner och övriga positioner som `null`.
- Separat preliminär ÖP-jämförelse med täckning och bästa–sämsta-fall-intervall, aldrig en falskt jämförbar placering i huvudrankningen.
- Total matchning, prioritetsmatchning, områdesresultat, fråga-för-fråga-förklaring och källänk för varje använd position.
- JSON- och CSV-export.
- Lokal lagring i användarens webbläsare; inga svar skickas av appen.
- En dataspärr i webbläsaren som stoppar rankningen om den jämförbara kärnmatrisen är trasig eller ofullständig.

## Varför bara 35 frågor påverkar poängen

Det tidigare utkastet hade fler precisa frågor men saknade en färdig, jämförbar och källbelagd position för varje parti i varje fråga. Det kan skapa en skenbart exakt verklighetsbild.

Den aktiva kärnan använder därför 35 sakfrågor där samtliga åtta riksdagspartier har svarat på samma nationella 2026-frågebatteri. Frågorna på webbplatsen är självständiga neutrala parafraser med bevarad riktning och avgränsning. Varje aktiv fråga har ett synligt källfrågenummer och varje parti har en direktlänk till sin källsida.

De ytterligare 33 frågorna ligger kvar öppet för fortsatt granskning, varav åtta nya frågor fördjupar klimat- och miljöområdet. En sådan fråga får inte aktiveras förrän alla partier har kontrollerats mot exakt samma avgränsning.

## Positionsskala

| Kod | Betydelse |
|---:|---|
| `+2` | Instämmer helt / mycket bra förslag / mycket mer |
| `+1` | Instämmer delvis / ganska bra förslag / lite mer |
| `0` | Verklig neutral eller uttryckligen dagens nivå |
| `-1` | Tar delvis avstånd / ganska dåligt förslag / lite mindre |
| `-2` | Tar helt avstånd / mycket dåligt förslag / mycket mindre |
| `null` | Positionen är inte tillräckligt exakt belagd |

`null` får aldrig ersättas med `0`. Okänt är inte samma sak som politiskt neutralt.

## Poängmodell

För fråga `i` är användarens svar `uᵢ`, partiets position `pᵢ` och användarens vikt `wᵢ`.

```text
sᵢ = 1 − |uᵢ − pᵢ| / 4
```

Likheten är därmed 100 procent vid samma svar, 75 procent vid ett stegs skillnad, 50 procent vid två steg, 25 procent vid tre steg och 0 procent vid motsatta ytterlägen.

För att ett område med fler frågor inte automatiskt ska väga mer får varje besvarad fråga grundfaktorn `1/nₐ`, där `nₐ` är antalet besvarade frågor i politikområde `a`.

```text
Total = 100 × Σ[(1/nₐ) × sᵢ] / Σ(1/nₐ)
```

Prioritetsmatchningen använder användarens vikt 0, 1, 2, 3 eller 5:

```text
Prioritet = 100 × Σ[(wᵢ/nₐ) × sᵢ] / Σ(wᵢ/nₐ)
```

Vikt 0 påverkar inte prioritetsmatchningen men frågan finns kvar i totalmatchningen. Att hoppa över en fråga är ett separat val och tar bort frågan från båda beräkningarna.

Den exakta implementationen finns i `scoring.js`.

## Källprincip

Prioriteringsordningen är:

1. Officiellt valmanifest eller partiprogram.
2. Partiets officiella webbplats.
3. Partiets egna svar i en etablerad valkompass.
4. Propositioner, motioner och voteringar.
5. Tydliga uttalanden från partiledning eller officiella företrädare.

För den kompletta åttapartikärnan används partiernas egna 2026-svar i SVT:s nationella valkompass. Det ger samma frågor, samma svarsskala och samma insamlingsform för samtliga åtta riksdagspartier. Kodningen görs mekaniskt; kommentarer används som kontrollunderlag men ger inga dolda extrapoäng.

Örebropartiets kända positioner kommer från partiets officiella nationella 2026-program. Eftersom programmet publiceras successivt hålls partiet utanför huvudrankningen tills ett tillräckligt komplett gemensamt underlag finns.

## Projektstruktur

```text
valkompass-2026-v0.4/
├── index.html
├── styles.css
├── app.js
├── scoring.js
├── README.md
├── data/
│   ├── questions.json
│   ├── parties.json
│   ├── positions.json
│   ├── source-register.json
│   ├── meta.json
│   └── schema.json
└── scripts/
    ├── generate_dataset.py
    ├── validate_dataset.py
    ├── build_standalone.py
    └── browser_smoke_test.py
```

## Uppdatera politiken utan att skriva om appen

1. Ändra `scripts/generate_dataset.py` eller de separata JSON-filerna.
2. Lämna en position som `null` när källan inte täcker frågans exakta avgränsning.
3. Spara källa, källtyp, verifieringsdatum, källans svar eller linje, motivering och säkerhetsgrad.
4. Kör valideringen:

```bash
python3 scripts/validate_dataset.py
```

5. Bygg om den fristående filen:

```bash
python3 scripts/build_standalone.py
```

6. Kör webbläsartestet:

```bash
python3 scripts/browser_smoke_test.py
```

En dataändring ger ett nytt SHA-256-fingeravtryck i `data/meta.json`. Gamla lokalt sparade användarsvar separeras även med hjälp av fingeravtrycket.

## Vad valideringen kontrollerar

- unika fråge-, parti- och käll-ID:n;
- exakt en positionsrad per parti och fråga;
- giltiga värden `-2…+2` eller `null`;
- fullständig källa för varje känd position;
- exakt 280 verifierade kärnpositioner;
- att forskningsfrågor inte har aktiva positioner och har `score: false`;
- två till tre aktiva frågor per politikområde;
- att datasetets SHA-256-fingeravtryck stämmer;
- att appens webbläsarspärr är godkänd och att hela frågeflödet kan slutföras.

## Begränsningar som ska stå kvar öppet

En matchningsprocent visar likhet i de frågor som ingår. Den bedömer inte regeringsalternativ, förtroende, historiskt agerande, genomförbarhet eller alla politiska frågor som kan påverka ett partival.

Partier kan också ändra eller precisera sin politik när nya valmanifest publiceras. `verified` anger därför när raden senast kontrollerades. En tekniskt godkänd databas ersätter inte återkommande politisk sakgranskning.

## Licens och vidarepublicering

Applikationskoden kan återanvändas och granskas. Kontrollera alltid rättigheter och citeringsvillkor för externa källor. Datasetet återger kategoriserade partipositioner, korta källbeteckningar och självständigt formulerade frågor; externa källsidor ägs av respektive utgivare.

## Pågående precisionsgranskning

`RESEARCH_BATCH_01.md` och `data/research-batch-01.json` innehåller första källgranskningen av r001–r010. Dessa arbetsrader används inte i poängberäkningen förrän en komplett jämförbar kärnmatris finns. Detta förhindrar att närliggande men semantiskt olika partipositioner smygs in som svar.
