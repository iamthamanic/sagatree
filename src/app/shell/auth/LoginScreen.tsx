import { useState, type FormEvent } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { useTheme } from '../../../lib/theme-provider';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Switch } from '../../../shared/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import { Alert, AlertDescription } from '../../../shared/ui/alert';
import {
  CircleNotch,
  DownloadSimple,
  Eye,
  EyeSlash,
  WarningCircle,
  Moon,
  Sun,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { pathForDownload } from '../../../domains/desktop-release';
import { SagaTreeLogo } from '../SagaTreeLogo';
import { isHostLibraryEnabled } from '../../../infrastructure/host/host-library-http';

/** Map Kong/GoTrue / Better Auth responses to a clear DE message. */
function authErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const status = 'status' in err ? Number((err as { status?: number }).status) : NaN;
    const raw = err instanceof Error ? err.message : '';
    if (status === 429 || /rate limit|too many requests|429/i.test(raw)) {
      return 'Zu viele Anmeldeversuche. Bitte warte kurz und versuche es erneut.';
    }
    // Match credentials failure before bare "Invalid email" (substring trap).
    if (/invalid email or password/i.test(raw)) {
      return 'E-Mail oder Passwort falsch. DEV: admin oder player1 / 1234.';
    }
    if (/password too short/i.test(raw)) {
      return 'Passwort zu kurz. DEV Demo: 1234 (Host muss minPasswordLength ≥ 4 haben).';
    }
    if (/^invalid email$/i.test(raw.trim()) || /code["']?\s*:\s*["']?INVALID_EMAIL\b/i.test(raw)) {
      return 'Ungültige E-Mail. Bitte eine E-Mail eingeben — DEV: admin oder player1 / 1234.';
    }
    if (raw) return raw;
  }
  return fallback;
}

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hostFirst = isHostLibraryEnabled();
  const isDarkMode = theme === 'dark' || (
    theme === 'system' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(loginIdentifier.trim(), password);
      toast.success('Erfolgreich eingeloggt!');
    } catch (err) {
      const message = authErrorMessage(err, 'Login fehlgeschlagen');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signUp(signupEmail.trim(), password);
      toast.success('Account erstellt! Bitte logge dich ein.');
      // Auto switch to login tab after signup
      setPassword('');
    } catch (err) {
      const message = authErrorMessage(err, 'Registrierung fehlgeschlagen');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen justify-center bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] items-start sm:items-center overflow-y-auto"
      data-au-surface="login"
      data-au-pattern="page"
    >
      <div className="absolute right-4 top-4 z-10">
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={isDarkMode}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Dark Mode umschalten"
          />
          <Moon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="w-full max-w-md space-y-6 py-6 sm:py-0">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-2">
            <SagaTreeLogo className="h-24 w-24 sm:h-32 sm:w-32" />
          </div>
          <div>
            <h1 className="text-3xl">SagaTree</h1>

            <p className="text-muted-foreground mt-2">
              Erstelle epische Rollenspiel-Abenteuer
            </p>
          </div>
        </div>

        {/* Login/Signup Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Willkommen</CardTitle>
            <CardDescription>
              Melde dich an oder erstelle einen Account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
                <TabsTrigger value="login" className="min-h-11">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="min-h-11">
                  Registrieren
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <WarningCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">
                      {hostFirst ? 'E-Mail' : 'Benutzername oder E-Mail'}
                    </Label>
                    <Input
                      id="login-identifier"
                      type="text"
                      autoComplete="username"
                      placeholder={hostFirst ? 'deine@email.de' : 'admin oder deine@email.de'}
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    {import.meta.env.DEV ? (
                      <p className="text-xs text-muted-foreground" data-dev-demo-login-hint>
                        DEV Demo-Login:{' '}
                        <span className="font-mono">admin</span> oder{' '}
                        <span className="font-mono">player1</span> /{' '}
                        <span className="font-mono">1234</span>
                        {hostFirst ? (
                          <>
                            {' '}
                            (Host mappt auf{' '}
                            <span className="font-mono">admin@sagatree.local</span>)
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showLoginPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        aria-pressed={showLoginPassword}
                        onClick={() => setShowLoginPassword((v) => !v)}
                        disabled={isLoading}
                      >
                        {showLoginPassword ? (
                          <EyeSlash className="h-4 w-4" weight="regular" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" weight="regular" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                        Lädt...
                      </>
                    ) : (
                      'Einloggen'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <WarningCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-Mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="deine@email.de"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Passwort</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={hostFirst ? 4 : 6}
                        disabled={isLoading}
                        className="pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showSignupPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        aria-pressed={showSignupPassword}
                        onClick={() => setShowSignupPassword((v) => !v)}
                        disabled={isLoading}
                      >
                        {showSignupPassword ? (
                          <EyeSlash className="h-4 w-4" weight="regular" aria-hidden />
                        ) : (
                          <Eye className="h-4 w-4" weight="regular" aria-hidden />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mindestens {hostFirst ? 4 : 6} Zeichen
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                        Lädt...
                      </>
                    ) : (
                      'Account erstellen'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              window.history.pushState(null, '', pathForDownload());
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <DownloadSimple className="h-4 w-4" aria-hidden />
            Desktop herunterladen
          </Button>
        </div>

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Mit dem Login akzeptierst du unsere{' '}
            <a href="#" className="underline hover:text-primary">
              Nutzungsbedingungen
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
