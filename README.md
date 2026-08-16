# Öppen Valkompass 2026

En fristående statisk svensk valkompass för riksdagsvalet 2026. Ingen server eller ChatGPT krävs för att köra webbplatsen.

## Kör lokalt

På grund av JSON-filerna bör sidan serveras via en enkel lokal webbserver:

```bash
cd valkompass-2026
python3 -m http.server 8080
```

Öppna sedan `http://localhost:8080`.

## Struktur

- `index.html` – skalet
- `styles.css` – mobilanpassad presentation
- `app.js` – navigation, frågeflöde, scoring, export och granskning
- `data/questions.json` – 64 frågor, fyra per politikområde
- `data/parties.json` – nio partier
- `data/positions.json` – en rad per parti/fråga, inklusive `null` för okänd position
- `data/meta.json` – datasetversion och täckningströskel

## Datamodell för partiposition

```json
{
  "party": "m",
  "question": "q01",
  "position": null,
  "confidence": "unknown",
  "source": null,
  "sourceTitle": null,
  "sourceDate": null,
  "verified": "2026-08-16",
  "rationale": "..."
}
```

`position` får bara vara `-2`, `-1`, `0`, `1`, `2` eller `null`. Använd `null` hellre än en uppskattning.

## Poängmodell

Total matchning:

`100 × (1 − Σ|uᵢ − pᵢ| / (4 × N))`

Prioritetsmatchning:

`100 × (1 − Σ wᵢ|uᵢ − pᵢ| / (4 × Σwᵢ))`

Okända partipositioner exkluderas från båda formlerna. Källtäckningen redovisas separat och full ranking kräver för närvarande minst 70 % viktad täckning.

## Viktigt före publik lansering

Den medföljande positionsdatabasen är en **research preview**, inte en färdig politisk kodning. Endast ett mindre antal positioner har seedats med källor. Fyll på och dubbelgranska samtliga parti–fråga-kombinationer före skarp lansering. Det är avsiktligt att resten står som okända.
