# Architektur

## Datenfluss

`App` verwendet `useShoppingList` zum Laden und Ändern der Liste. Die API-Schicht sendet Requests an Express und prüft die Antworten zur Laufzeit. Zod validiert die Eingaben an den vier REST-Endpunkten; Mongoose speichert die Einträge in MongoDB.

Eine Änderung wird erst nach erfolgreicher Serverantwort im React-State übernommen. Währenddessen bleibt der bestehende Datenstand sichtbar. Ein synchroner Lock verhindert weitere Requests für denselben Eintrag, während andere Einträge unabhängig bearbeitet werden können. Die Steuerelemente bleiben fokussierbar und kennzeichnen den Wartezustand mit `aria-disabled`.

## Entscheidungen

- **React-Hooks:** Für eine Ansicht mit einer Liste genügen `useState`, `useEffect` und ein eigener Hook. Die Übersicht wird aus den Einträgen berechnet.
- **Laufzeitvalidierung:** TypeScript allein prüft keine Netzwerkdaten. Zod lehnt falsche Typen und zusätzliche Eingabefelder ab. Die Client-API prüft empfangene Einträge ebenfalls.
- **Mongoose-Schema:** Die Typen werden aus dem Schema abgeleitet. Im JSON werden `ObjectId` und `Date` als Strings übertragen.
- **Expliziter Status:** `PUT { bought }` setzt einen Wert. Wiederholte identische Requests kehren den Status nicht versehentlich um.
- **Stabile Reihenfolge:** Die Sortierung nach `createdAt` und `_id` verhindert, dass ein Eintrag beim Abhaken seine Position wechselt.
- **Fokus:** Beim Abhaken bleibt der Fokus erhalten. Nach dem Löschen erhält der nächste, sonst der vorherige Eintrag oder das Eingabefeld den Fokus. Ein inzwischen bewusst verschobener Fokus wird nicht zurückgeholt.
- **Eine Origin:** Vite leitet in der Entwicklung die API weiter; Express liefert im Produktionsstart Frontend und API aus. Zusätzliche CORS-Konfiguration ist damit nicht notwendig.
- **HTTP lokal:** Helmet setzt Sicherheitsheader, ohne lokale Asset-Requests auf HTTPS hochzustufen. HTTPS für einen gehosteten Betrieb wird am jeweiligen Server/Proxy eingerichtet.
- **Testbarkeit:** `app.ts` ist vom Start und der Datenbankverbindung in `server.ts` getrennt. Tests verwenden eine eigene MongoDB-Instanz.

## Grenzen

Es gibt eine gemeinsame Liste ohne Authentifizierung, keine Echtzeitsynchronisierung und keine Offline-Warteschlange. Andere Browser übernehmen Änderungen nach dem Neuladen. Ein Request-Timeout beweist nicht, dass die Speicherung fehlgeschlagen ist; vor einer Wiederholung sollte die Liste neu geladen werden. Bei gleichzeitigen Änderungen mehrerer Clients gilt der zuletzt gespeicherte Status.
