# Supabase Setup für SagaTree

> **HISTORISCH / ARCHIVIERT** — Cloud-/Self-Host-Supabase-Setup ist nicht der Produktpfad (CUT-21/22).  
> Archiv: `archive/supabase-legacy/`. Aktueller Start: [`README_SELFHOST.md`](../README_SELFHOST.md).

## 🚀 Quick Start

### 1. Datenbank-Schema erstellen

Gehe zu deinem Supabase-Projekt → **SQL Editor** und führe folgende Datei aus:

```sql
-- Kopiere den Inhalt von /supabase/schema.sql
```

### 2. Auth konfigurieren

Gehe zu **Authentication** → **Providers**:

#### ✅ Anonymous Sign-Ins aktivieren (WICHTIG!)

1. Klicke auf **Anonymous**
2. Aktiviere **"Enable anonymous sign-ins"**
3. Speichern

Das erlaubt Demo-User ohne Email-Verifikation!

#### Optional: Email Auth

Falls du später echte Email-Auth willst:
1. **Email** Provider aktivieren
2. **Confirm email** DEAKTIVIEREN (für Development)
3. SMTP konfigurieren (optional)

### 3. API Keys prüfen

Die Keys sollten bereits in `/utils/supabase/info.tsx` verfügbar sein:
- `projectId` 
- `publicAnonKey`

Figma Make verbindet sich automatisch.

## 📊 Datenbank-Struktur

Nach dem Setup hast du folgende Tabellen:

- **characters** - Alle Charaktere mit Attributen, Inventar, etc.
- **sessions** - Spielsessions mit Codes
- **session_players** - Spieler in Sessions (Many-to-Many)
- **adventures** - Abenteuer und Kampagnen
- **marketplace_items** - Community-geteilte Inhalte

Alle Tabellen haben **Row Level Security (RLS)** aktiviert!

## 🔐 Authentifizierung

### Development/Demo Mode

Die App nutzt **Anonymous Sign-In** für schnelles Testen:

```typescript
await supabase.auth.signInAnonymously();
```

Jeder neue Besuch = neuer anonymer User (gut für Demos!)

### Production Mode (später)

Wenn du echte User-Accounts willst:

1. Email/Password Sign-Up aktivieren
2. Magic Link Auth (passwortlos)
3. OAuth (Google, GitHub, etc.)

Siehe: https://supabase.com/docs/guides/auth

## 🧪 Testing

### Manuell testen:

1. App öffnen → automatisch als Demo-User eingeloggt
2. Gehe zur **Bibliothek** → "Neuer Charakter"
3. Erstelle einen Charakter
4. Check in Supabase Dashboard → **Table Editor** → `characters`

### Auth Status prüfen:

```typescript
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.id);
```

## ⚠️ Troubleshooting

### "User not authenticated"

**Lösung:** Anonymous Sign-In aktivieren (siehe oben)

### "Failed to fetch"

**Check:**
- Ist Supabase-Projekt online?
- API Keys korrekt in `info.tsx`?
- CORS in Project Settings erlaubt?

### RLS Policies verweigern Zugriff

**Check:**
- Sind alle RLS Policies aus `schema.sql` erstellt?
- User ist authentifiziert? (auch anonymous)

## 📚 Weitere Infos

- [Supabase Docs](https://supabase.com/docs)
- [Auth Guide](https://supabase.com/docs/guides/auth)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
