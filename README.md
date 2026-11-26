# Timos Turbo Run

Ein Endlos-Lauf-Spiel im Pixel-Look mit Timo als Held. Dr. Spritz, der Tierarzt, ist hinter ihm her!

- Level: Stadtpark → Bürgeramt → Sofa-Paradies → und wieder von vorn, nur schneller
- Hundekroketten sammeln und im Krokettengeschäft für Upgrades ausgeben
- Kurzes Tutorial beim ersten Start, Chiptune-Musik pro Level
- Power-Ups: Magnet, Schild, Turbo-Leckerli und die Faxmaschine
- Game Over: Timo stellt eine Anzeige aus, danach Eintrag in die Bestenliste

## Steuerung
- Handy/Tablet: wischen (hoch = springen, runter = rutschen, links/rechts = abbiegen oder Spur wechseln)
- Handy kippen: Spur wechseln (im Menü abschaltbar)
- Computer: Pfeiltasten oder WASD, Leertaste springt, P pausiert

Reines HTML5/JavaScript, kein Build nötig: `index.html` im Browser öffnen.

## Online-Bestenliste

Läuft über dasselbe Supabase-Projekt wie Schnitzis Shake Bar, aber in einer eigenen Tabelle `ttr_scores`.
Die Tabelle und Zugriffsregeln stehen in `supabase.sql` (einmal im Supabase-Dashboard unter "SQL Editor" ausführen).
Ohne Verbindung oder ohne Tabelle nutzt das Spiel eine Liste auf dem eigenen Gerät.

## iPhone-App (iOS)

Im Ordner `ios/` liegt ein kleines Xcode-Projekt, das das Spiel als echte App verpackt (WKWebView, kein Node/npm nötig).
Beim Bauen werden `index.html`, `game.js`, `sprites.js`, `style.css` und `assets/` automatisch ins App-Bundle kopiert, das Spiel läuft also komplett offline.
Spielstand und lokale Bestenliste liegen wie im Browser im `localStorage`, die Online-Bestenliste läuft weiter über Supabase.

- `ios/TimosTurboRun.xcodeproj` in Xcode öffnen, oben das iPhone auswählen, ▶︎ drücken.
- Bundle-ID `de.konsti.timosturborun`, Team `Y256T3J63G`, automatisches Signing.
- Nach Änderungen am Spiel einfach in Xcode neu bauen.
