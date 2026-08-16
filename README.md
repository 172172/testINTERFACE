# Valkompass 2026 – precisionsversion 0.2

En fristående svensk valkompass byggd för principen: **du behöver inte lita på skaparen – du ska kunna kontrollera allt själv.**

## Viktigt om version 0.2

Frågebanken har byggts om efter att en för bred skattefråga visade ett metodproblem: partier kan stödja samma allmänna rubrik men rikta politiken till helt olika grupper eller använda helt olika styrmedel.

Därför följer alla 64 frågor nu dessa regler:

1. En fråga mäter en huvudsaklig politisk dimension.
2. Målgrupp, instrument eller rättighet anges när det är avgörande för innebörden.
3. Varje fråga har ett `scope` som anger vad som ingår och inte ingår.
4. Ett parti får inte kodas utifrån en närliggande slogan eller allmän inriktning.
5. Avsaknad av en säker källa blir `position: null`, aldrig `0`.
6. +2/+1/0/-1/-2 måste motiveras mot den exakta formuleringen.
7. När en fråga ändras semantiskt nollställs tidigare partipositioner tills de har källgranskats igen.

## Status

- 64 frågor
- 16 politikområden
- 4 frågor per område
- 9 partier
- 576 möjliga parti–fråga-kombinationer
- Samtliga 576 positioner är i version 0.2 markerade `requires-reverification`

Det sista är avsiktligt. Gamla poäng får inte följa med när frågornas innebörd har blivit mer precis.

## Datafiler

- `data/questions.json` – frågor, avgränsningar och kodningsregler
- `data/parties.json` – partier
- `data/positions.json` – partipositioner, källor, verifieringsstatus och motivering
- `data/source-register.json` – officiella källingångar inför valet 2026
- `data/meta.json` – datasetversion och metodinställningar

## Kodningsregel

För varje parti och fråga:

- `+2`: partiet stödjer uttryckligen den exakta reformen eller en tydligt starkare version
- `+1`: stödjer riktningen men med snävare villkor/lägre ambitionsnivå
- `0`: uttrycklig mellanposition eller i huvudsak status quo
- `-1`: motsätter sig riktningen delvis eller driver en mildare motsatt linje
- `-2`: motsätter sig uttryckligen reformen och driver tydligt motsatt ordning
- `null`: källan räcker inte för säker kodning

**0 får aldrig användas som ersättning för ”vi hittade inget”.**

## Poängmodell

Användare och parti kodas på skalan -2 till +2.

Avstånd per fråga:

`d_i = |u_i - p_i|`

Total matchning:

`100 × (1 - Σd_i / (4 × N))`

Prioritetsmatchning:

`100 × (1 - Σ(w_i × d_i) / (4 × Σw_i))`

En okänd partiposition ingår inte i beräkningen. Källtäckningen visas separat och normal ranking kräver minst den täckning som anges i `meta.json`.

## Lokal körning

Eftersom sidan hämtar JSON-filer bör den köras via en lokal webbserver i stället för att enbart dubbelklicka på `index.html`.

Exempel med Python:

```bash
cd valkompass-2026
python3 -m http.server 8080
```

Öppna därefter `http://localhost:8080`.

## Nästa forskningssteg

Varje av de 576 partipositionerna ska nu kodas om mot den precisa frågan. Prioritetsordning för källa:

1. Officiellt valmanifest/valplattform 2026
2. Officiell sakpolitisk sida
3. Partiets egna svar i etablerad valkompass
4. Proposition/motion/votering
5. Tydligt aktuellt uttalande från partiledning eller behörig företrädare

En källa som bara visar att partiet exempelvis ”vill sänka skatten” räcker **inte** för en fråga om huruvida höginkomsttagare över brytpunkten ska omfattas.
