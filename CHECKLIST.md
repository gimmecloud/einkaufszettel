# Anforderungen und Nachweise

Die Tabelle ordnet die Funktionen und Qualitätskriterien ihrer Implementierung und den ausführbaren Prüfungen zu. Testbefehle und Grenzen stehen in der README.

| Anforderung | Implementierung | Nachweis |
| --- | --- | --- |
| React mit TypeScript | `frontend/src/` | `npm run typecheck` |
| Express mit TypeScript | `backend/src/` | `npm run typecheck` |
| MongoDB/Mongoose | `backend/src/models/shopping-item.ts` | API-Tests mit echter MongoDB |
| `_id: ObjectId`, `name: string`, `bought: boolean`, `createdAt: Date` | Mongoose-Schema mit Defaults und Zeitstempel | API-Test für Felder, Defaults und Date-Typ |
| Eingabefeld und Hinzufügen-Button | `components/add-item-form.tsx` | E2E per Enter und Button |
| Produktname, Checkbox, Löschen-Button | `components/item-row.tsx` | E2E des vollständigen Ablaufs |
| Durchstreichen gekaufter Einträge | `styles.css` | E2E prüft `text-decoration-line` |
| GET `/items` | `routes/items.ts` | API-Test: leere und gefüllte Liste |
| POST `/items` mit `{ name }` | `routes/items.ts` | API-Tests: Anlegen, Trimmen, ungültige Eingaben |
| PUT `/items/:id` mit `{ bought }` | `routes/items.ts` | API-Tests: Abhaken, Zurücksetzen, echte Booleans |
| DELETE `/items/:id` | `routes/items.ts` | API-Tests: Entfernen und fehlender Eintrag |
| Clientseitige Zustandsverwaltung | `hooks/use-shopping-list.ts` | E2E inkl. Pending- und Fehlerzuständen |
| Speicherung über Neuladen hinaus | MongoDB | API-Reconnect, Browser-Reload |
| Keine Authentifizierung erforderlich | Gemeinsame Liste | Dokumentierte Architektur |
| Einfache, ansprechende Oberfläche | Eigene HTML/CSS-Komponenten | Desktop-/Mobil-Screenshots |
| Responsive und bedienbar | CSS, native Controls, Fokusführung | E2E: 320/390 px, 200 % Textgröße, Tastatur |
| Sauberer, typsicherer Code | Strict TypeScript, Laufzeitvalidierung | Typecheck, ESLint, API- und E2E-Tests |
| Frontend und Backend getrennt | npm-Workspaces | Verzeichnisstruktur, gemeinsamer Start |
| Setup-Anleitung | `README.md`, `.env.example`, `compose.yaml` | Entwicklungs-/Produktionsstart, Compose mit Healthcheck |
| Angabe externer UI-Bibliotheken | README | Kein UI-Toolkit; Fonts und Backend-Bibliotheken genannt |
| Nachvollziehbare Struktur und React-Patterns | Kleine Komponenten, eigener Hook, API-Modul | `docs/ARCHITECTURE.md` |
