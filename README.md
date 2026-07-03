# diff-review-axi — projektsammanfattning & spec

Ett verktyg för att granska ocommittade git-ändringar i ett webbfönster, skriva
kommentarer på olika nivåer, och lämna tillbaka dem strukturerat till en
AI-agent (Claude Code). Byggs som en **AXI** (Agent eXperience Interface).

---

## 1. Bakgrund & varför

Nuvarande arbetsflöde: när Claude Code gjort ändringar behöver man commita och
kolla i git (eller läsa långa svar/skärmdumpar) för att se vad som ändrats.
Önskemålet är att slippa det — se alla diffar direkt i en bra vy, kommentera, och
skicka tillbaka kommentarerna till agenten.

Idén är inspirerad av **lavish-axi** (`github.com/kunchenguid/lavish-axi`), som gör
exakt detta mönster fast för HTML-artefakter: en CLI öppnar ett lokalt
webbfönster, människan annoterar, agenten hämtar feedback. Vårt verktyg gör samma
grundidé fast riktat mot **git-diffar** istället för HTML.

## 2. Vad AXI är (kort)

AXI = Agent eXperience Interface. En designfilosofi för CLI-verktyg som är
byggda för att drivas av AI-agenter snarare än människor. Kärnprinciper som är
relevanta här:

- **TOON-output** på stdout (Token-Oriented Object Notation) istället för JSON —
  ~40 % färre tokens. Fältnamn deklareras en gång i ett huvud, sedan bara värden
  per rad. Format: `namn[N]{fält}:` följt av indenterade värderader.
- **Strukturerade fel** till stdout (inte stderr), med actionable förslag.
- **Exit-koder**: 0 = success, 1 = error, 2 = usage error.
- **Inga interaktiva prompts** — allt via flaggor.
- **Kontextuell disclosure** — föreslå nästa-steg-kommandon efter output.
- **Home-vy** utan argument: visar verktygets sökväg (med `~`), en rads
  beskrivning, och ev. aktivt state.

## 3. Vald arkitektur (Väg 2, förenklad)

Under diskussionen övervägdes tre vägar:

- **Väg 1** — bygg ovanpå lavish-axi (rendera diff som HTML, öppna med
  `lavish-axi`). Minst jobb, ärver allt "svårt" (server, poll, annoteringar), men
  lavishs annoteringsmodell pekar på DOM-element, inte `fil:rad`, vilket skaver
  för diff-review.
- **Väg 2** — bygg en egen fristående AXI. Mer kod, full kontroll över
  datamodellen.
- **Mellanväg** — prototypa Väg 1 först, bygg Väg 2 om annoteringsmodellen skaver.

**Beslut: Väg 2**, men med ett **medvetet lättat krav** — agenten behöver INTE
blocka och vänta på review (ingen long-poll). Det tar bort den svåraste delen.

Flödet blir asynkront via filsystemet:

1. Agenten kör `diff-review <mål>` → startar en kortlivad lokal server på
   `127.0.0.1`, öppnar browsern, visar diffarna. Agenten hänger inte kvar.
2. Människan granskar när den vill, skriver kommentarer, trycker "review klar".
3. "Review klar" gör `POST /save` → servern skriver kommentarerna till disk
   (t.ex. `~/.diff-review/<hash>/comments.toon`) och stänger sig.
4. Nästa gång agenten körs läser den `diff-review comments <mål>` → läser filen →
   renderar som TOON.

Ingen long-lived server, ingen session-liveness, ingen feedback-kö. Servern gör
bara "ta emot ett POST och dö".

> Alternativ utan server alls: en "Exportera"-knapp i HTML:en laddar ner en
> `.toon`/`.json`-fil via blob (`URL.createObjectURL`). Enklare men kräver ett
> manuellt nedladdnings-steg. Den lilla servern ger bättre UX för ~20 rader
> Express-kod, så den föredras.

## 4. Funktionskrav (låsta)

### Diff-vy
- **Side-by-side som i VS Code**: gammal kod till vänster, ny kod till höger.
- Utgår från **ocommittade git-ändringar** — `git diff HEAD` (working tree +
  ev. staged mot senaste commit). Se not nedan om exakta varianter.
- **Radnummer ska visas** (båda sidor).

### Vyval — hur mycket kontext som visas per diff
Man ska kunna välja vilken diff man tittar på och hur mycket omgivande kod som
visas runt en ändring, så man får en uppfattning om koden runtomkring. Nivåer:

1. **Bara hunkarna** (default) — det git ger, med några rader kontext.
2. **Mer kontext** — utöka antalet oförändrade rader som visas runt varje hunk
   (t.ex. via `git diff -U<n>` med större `n`, eller expandera stegvis i UI:t
   med "visa fler rader"-knappar mellan/omkring hunkarna).
3. **Hela filen** — visa hela filinnehållet med ändringarna markerade.

Alla tre är enkla att bygga — det handlar bara om hur många oförändrade rader
som renderas, inte om att förstå kodens struktur.

### Filtrering (rent frontend, ingen backend)
- Filtrera vad man vill *se*: t.ex. bara vissa filer, path-sökning, dölj
  oförändrat. (Exakt uppsättning ej låst — designas i frontend.)

### Kommentarer — tre scopes
Mappar direkt till datamodellen (exempelfiler nedan är illustrativa):

| scope    | har file | har line | betydelse                                  |
|----------|----------|----------|--------------------------------------------|
| `change` | ja       | ja       | kommentar på en specifik rad/ändring        |
| `file`   | ja       | nej      | kommentar på en hel fil                      |
| `global` | nej      | nej      | kommentar på hela review:n (alla diffar)     |

## 5. Datamodell (TOON)

Kommentarer som lämnas tillbaka till agenten:

```
comments[3]{scope,file,line,body}:
  change,src/models.py,42,"Saknar index på FK"
  file,src/views.py,,"Hela filen behöver en refaktor"
  global,,,"Migrationen ser bra ut, en fråga om timezone-hanteringen"
```

- `scope` ∈ `change` | `file` | `global`
- `change` → fil + rad ifyllda
- `file` → bara fil
- `global` → varken fil eller rad
- Renderas av SDK:ts `renderOutput()` — man håller dicts/objekt i koden och
  kodar till TOON vid utskrift.

## 6. Byggstenar & beroenden

### axi-sdk-js (`^0.1.8`) — ger gratis:
Inspekterat innehåll (moduler: `cli`, `errors`, `hooks`, `output`, `update`):

- `runAxiCli(options)` — kommando-router. Man ger `commands`-map, `home`-handler,
  `topLevelHelp`; den sköter argv, okända kommandon, hjälp, exit-koder.
- `output`-modulen — `renderOutput()`, `errorOutput()`, `homeHeaderOutput()`,
  `collapseHomeDirectory()`, `renderHomeHeader()`. TOON-formatering + home-vy.
- `errors`-modulen — `AxiError(message, code, suggestions)` +
  `exitCodeForError()`. Strukturerade fel med rätt exit-koder.
- `hooks`-modulen — `installSessionStartHooks()` skriver SessionStart-hooks till
  Claude Code / Codex / OpenCode, idempotent, path-repair. (= `setup hooks`.)
- `update`-modulen — hela self-update-flödet (`runUpdate`, `fetchLatestVersion`,
  `detectInstallMethod`, `planUpgrade`).
- Enda dependency: `@toon-format/toon` (`^2.1.0`).

### VIKTIGT — vad SDK:t INTE ger:
**Ingen server, ingen long-poll, ingen session-modell, inget browser-SDK, ingen
feedback-kö.** Allt sådant byggde lavish själv ovanpå SDK:t. För oss spelar det
mindre roll eftersom vi medvetet skippat poll/väntan — men save-servern (POST →
skriv fil → stäng) och hela frontend skriver vi själva.

### diff2html
Moget JS-bibliotek som renderar unified diff till snygg vy. Stödjer
**side-by-side** och inline. Detta löser merparten av diff-renderingen. Man matar
in `git diff`-output (unified format) och får HTML.
- Repo: `github.com/rtfpessoa/diff2html`
- Kolla att side-by-side + radnummer + "expandera context"/visa hela filen
  stöds i den version som väljs; annars komplettera med egen logik för att hämta
  hela filinnehållet och visa oförändrade rader.

### TOON
- Spec: `github.com/toon-format/spec` (working draft, var v3.2 vid diskussion).
- SDK:t drar in `@toon-format/toon`. **Lås versionen** — specen är ung och
  implementationer kan vara inkompatibla mellan spec-versioner.

## 7. Kommando-yta (förslag)

| Kommando                         | Beskrivning                                         |
|----------------------------------|-----------------------------------------------------|
| `diff-review`                    | Home-vy: sökväg, beskrivning, ev. senaste review.   |
| `diff-review <mål>`              | Rendera ocommittade diffar → öppna browser + server.|
| `diff-review comments <mål>`     | Läs tillbaka sparade kommentarer som TOON.          |
| `diff-review setup hooks`        | Installera SessionStart-hooks (via SDK).            |
| `diff-review update`             | Self-update (via SDK, inbyggt).                     |

Flaggor att överväga: `--staged` / `--base <ref>` för vad diffen jämförs mot,
`--no-open` (skapa utan att öppna browser), `--port`.

## 7b. Distribution som Agent Skill

Primärt leveranssätt. En AXI är bara en CLI, och skill:en lär agenten att köra
den (t.ex. via `npx -y <paket>`), så CLI:n följer med on demand utan npm-install.

- **SKILL.md** med frontmatter (namn, beskrivning, `use_when`-triggers) som lär
  agenten arbetsflödet: kör `<verktyg> <mål>` för att öppna review, kör
  `<verktyg> comments <mål>` för att läsa tillbaka kommentarer.
- Skill:en ska genereras från samma källa som home-vyn (single source of truth),
  så guidningen inte driver isär från CLI:ns egen output. Lägg ett
  `--check`-bygg­steg i CI som failar om den committade SKILL.md är stale.
- Skill:en är statisk — utelämna dynamiskt state (öppna sessioner etc.).
- Installeras i projektets skills-katalog som default (`.claude/skills/`), eller
  globalt (`~/.claude/skills/`) med `-g`.
- Valfri SessionStart-hook (via SDK:ts `installSessionStartHooks()`) för ambient
  kontext i varje session; hook + skill är komplementära.

## 8. Att reda ut innan/under kodning

- **Exakt git-diff-källa**: `git diff` (working tree vs index), `git diff HEAD`
  (allt ocommittat vs senaste commit), eller `git diff --staged`? Kravet säger
  "ocommittade" → troligen `git diff HEAD`, men bekräfta om staged ska ingå.
  Överväg en flagga för att välja bas.
- **Nivå 3 — "visa hela filen"**: diff2html visar bara hunkar; att expandera till
  hela filen kräver att man läser filinnehållet (nya sidan från working tree,
  gamla från `git show HEAD:<path>`) och fyller i oförändrade rader med radnummer.
  Enkelt.
- **Nivå 2 — "mer kontext"**: två sätt, båda enkla. Antingen kör `git diff` med
  större `-U<n>` (fler kontextrader per hunk) och rendera om, eller — smidigast i
  UI:t — lägg "visa fler rader"-knappar i gapen mellan/omkring hunkarna som
  hämtar de saknade oförändrade raderna från filinnehållet (samma källor som
  nivå 3). Ingen förståelse av kodstruktur behövs; det är bara fler rader.
- **Radnummer-mappning för `change`-kommentarer**: lägg `data-file` och
  `data-line` (och ev. `data-side` för gammal/ny) på varje rad-element i DOM:en,
  så en klickad rad kan översättas till `fil:rad` för kommentaren.
- **Binära filer / renames / borttagna filer**: hantera i diff-parsningen.
- **Stora diffar**: prestanda i renderingen; ev. lazy-render per fil.

## 9. Säkerhet (viktigt — intern/kundnära kod)

- **Bind bara till loopback** (`127.0.0.1`). En wildcard-bind (`0.0.0.0`)
  exponerar en oautentiserad server som kan läsa/servera lokala filer — olämpligt
  för intern eller känslig kod. (Samma varning gäller lavish.)
- **Ingen extern delning** av diffar (motsvarande `lavish-axi share` → tredjepart
  ht-ml.app är uteslutet för intern kod).
- Servern ska vara kortlivad och stänga sig efter save / idle.

## 10. Stack-kontext

- Node för AXI:n (SDK:t är Node/TS).
- Diffar hämtas från git i det repo där verktyget körs.
- Distribueras som **Agent Skill** (Agent Skills-format), plus valfri global
  npm-install för SessionStart-hooks — likt övriga AXI:er (t.ex. lavish).

## 11. Nästa steg när kodning påbörjas

1. Skelett: `runAxiCli()` med `home` + `<mål>` + `comments` + `setup hooks`.
2. Git-lagret: hämta unified diff + (för hela-filen) fullt innehåll gammal/ny.
3. Frontend: diff2html side-by-side, radnummer, `data-file`/`data-line`,
   filtrering. Vyval i tre nivåer: hunk (default) / mer kontext (större `-U<n>`
   eller "visa fler rader"-knappar) / hela filen.
4. Kommentars-UI: tre scopes (change / file / global).
5. Save-server: `POST /save` → skriv `comments.toon` → stäng.
6. `comments`-kommandot: läs fil → `renderOutput()` som TOON.
7. Säkerhet: loopback-bind, kortlivad server.
