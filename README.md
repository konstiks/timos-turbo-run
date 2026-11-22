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
