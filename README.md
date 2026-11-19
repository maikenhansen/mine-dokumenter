# Mine dokumenter

Skriveprogrammet Mine dokumenter for Maiken og Olav. Programmet kjører som en nettside på GitHub Pages. Dokumentene lagres i det private arkivet `maikenhansen/mine-dokumenter-data`.

- **Delte dokumenter:** alt i mappene Operations og Felles. Alle brukerne ser og redigerer dem.
- **Egne dokumenter:** alt i Concessions og mapper du lager selv. Bare du ser dem i programmet.

Et dokument flyttes mellom egne og delte ved å bytte mappe i feltet «Mappe».

## Innlogging
Brukerne logger inn med navn og passord. Olav trenger ikke GitHub.

Programmet bruker én GitHub-nøkkel som bare gir tilgang til dokumentarkivet. Nøkkelen ligger i `config.js`, kryptert én gang per bruker med brukerens passord. Uten passordet kan den ikke leses.

### Nye passord eller ny nøkkel
1. Lag en ny nøkkel på github.com hvis den gamle er utløpt (se under).
2. Åpne `oppsett.html` på nettsiden, lim inn nøkkelen og skriv nye passord.
3. Legg det som kommer ut, inn i `users` i `config.js`.

### GitHub-nøkkelen
Profilbildet → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
- Repository access: Only select repositories → `mine-dokumenter-data`
- Permissions → Contents: Read and write

## Godt å vite
- Dokumentene lagres 3 sekunder etter siste endring. Hver lagring blir en versjon i historikken til dokumentarkivet, så eldre versjoner kan hentes fram der.
- Endringer fra en annen bruker vises innen 30 sekunder, eller når vinduet får fokus igjen.
- Hvis to skriver i det samme felles dokumentet samtidig, er det den siste lagringen som gjelder.
- Egne dokumenter skjules i programmet, men ligger i samme arkiv. Den som kan logge inn i programmet, har teknisk sett tilgang til hele arkivet.
- Bruk lange passord. Krypteringen er bare så sterk som passordet.
