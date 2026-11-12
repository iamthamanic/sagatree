# 🔐 Auth Setup - Fixed!

> **HISTORISCH** — Frühes Supabase-/Anonymous-Auth-Notizblatt.  
> **Aktuell:** Better Auth Cookie-Sessions über den Node-Host (`src/lib/auth-context.tsx`, `src/lib/hostAuthBridge.ts`, `VITE_SAGATREE_HOST_AUTH_URL`). Siehe [`README_SELFHOST.md`](../README_SELFHOST.md).

## ✅ Was wurde gefixt:

### Problem
```
Error: User not authenticated
```

### Lösung

1. **Auth Context erstellt** (`/lib/auth-context.tsx`)
   - Verwaltet User State
   - Lauscht auf Auth-Änderungen
   - Bietet `signInAsDemo()` für schnelles Testing

2. **AuthGate Component** (`/components/auth/AuthGate.tsx`)
   - Wrapper um die ganze App
   - Zeigt Loading-Screen während Auth-Check
   - Loggt automatisch als Demo-User ein

3. **Anonymous Sign-In**
   - Nutzt Supabase Anonymous Auth
   - Keine Email-Verifikation nötig
   - Perfekt für Demos & Prototyping

4. **Theme Provider** (`/lib/theme-provider.tsx`)
   - Ersetzt `next-themes` (das wir nicht haben)
   - Für Dark/Light Mode
   - Kompatibel mit Sonner Toast

## 🚀 Wie es jetzt funktioniert:

```
App startet
   ↓
AuthProvider checked
   ↓
Kein User? → signInAnonymously()
   ↓
User authentifiziert ✅
   ↓
App lädt normal
```

## 📋 Supabase Dashboard: Anonymous Auth aktivieren

⚠️ **WICHTIG:** Ohne diesen Schritt funktioniert nichts!

1. Gehe zu deinem Supabase Project
2. **Authentication** → **Providers**
3. Klicke auf **"Anonymous"**
4. Toggle auf **ON** (Enable anonymous sign-ins)
5. **Save**

## 🧪 Testen

Die App sollte jetzt:
- ✅ Automatisch einloggen beim Start
- ✅ Charaktere erstellen können
- ✅ Sessions erstellen können
- ✅ Keine "User not authenticated" Errors

## 🔍 Debug

Falls weiterhin Probleme:

```typescript
// In Browser Console:
const { data } = await supabase.auth.getSession();
console.log('Current session:', data.session);
```

Wenn `session` null ist → Anonymous Auth noch nicht aktiviert!
