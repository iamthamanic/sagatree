/**
 * Profile — Account settings under `/settings/:tab` + AI sub-tabs (Organize/Bild/3D/Video/Audio).
 * Location: src/app/profile/Profile.tsx
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Switch } from '../../shared/ui/switch';
import { Separator } from '../../shared/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import {
  User,
  Bell,
  Palette,
  Volume2,
  Languages,
  LogOut,
  Sparkles,
  ImageIcon,
  Box,
  Video,
  AudioLines,
  AlertTriangle,
  Check,
  Copy,
  Folders,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useTheme } from '../../lib/theme-provider';
import { toast } from 'sonner';
import {
  pathForSettingsTab,
  parseSettingsTabFromPathname,
  useAppLocation,
  type SettingsTabId,
} from '../shell';
import { AiProviderCredentialsPanel } from './AiProviderCredentialsPanel';
import { OllamaOrganizePanel } from './OllamaOrganizePanel';
import { AccountAvatarSection } from './AccountAvatarSection';
import { DEFERRED_SETTING_HINT_DE } from '../../domains/session/contracts/production-ux-integrity';

type AiSubTab = 'organize' | 'bild' | '3d' | 'video' | 'audio';

function readSettingsTabFromLocation(): SettingsTabId {
  if (typeof window === 'undefined') return 'profile';
  return parseSettingsTabFromPathname(window.location.pathname) ?? 'profile';
}

export function Profile() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { pathname, navigateToPath } = useAppLocation();
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>(readSettingsTabFromLocation);
  const [aiSubTab, setAiSubTab] = useState<AiSubTab>('organize');
  const [userIdCopied, setUserIdCopied] = useState(false);

  // Keep tab + URL in sync (`/settings/ai`, legacy `/profile`, bare `/settings`).
  useEffect(() => {
    const tab = parseSettingsTabFromPathname(pathname) ?? 'profile';
    setSettingsTab(tab);
    const canonical = pathForSettingsTab(tab);
    if (pathname !== canonical) {
      navigateToPath(canonical, { replace: true });
    }
  }, [pathname, navigateToPath]);

  const handleCopyUserId = async () => {
    const id = user?.id?.trim();
    if (!id) {
      toast.error('User ID nicht verfügbar');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = id;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setUserIdCopied(true);
      toast.success('User ID kopiert');
      window.setTimeout(() => setUserIdCopied(false), 2000);
    } catch {
      toast.error('User ID konnte nicht kopiert werden');
    }
  };

  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Erfolgreich abgemeldet');
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:space-y-6 md:p-8">
        <div>
          <h1 className="text-xl md:text-2xl">Profil & Einstellungen</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Verwalte dein Konto und Präferenzen
          </p>
        </div>

        <Tabs
          value={settingsTab}
          onValueChange={(value) => {
            const tab = value as SettingsTabId;
            setSettingsTab(tab);
            navigateToPath(pathForSettingsTab(tab));
          }}
          className="gap-4"
          data-settings-tabs
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="profile" className="gap-1.5" data-settings-tab="profile">
              <User className="size-3.5" aria-hidden="true" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5" data-settings-tab="appearance">
              <Palette className="size-3.5" aria-hidden="true" />
              Darstellung
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="gap-1.5"
              data-settings-tab="notifications"
            >
              <Bell className="size-3.5" aria-hidden="true" />
              Benachrichtigungen
            </TabsTrigger>
            <TabsTrigger value="audio-video" className="gap-1.5" data-settings-tab="audio-video">
              <Volume2 className="size-3.5" aria-hidden="true" />
              Audio & Video
            </TabsTrigger>
            <TabsTrigger value="language" className="gap-1.5" data-settings-tab="language">
              <Languages className="size-3.5" aria-hidden="true" />
              Sprache
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5" data-settings-tab="ai" data-settings-tab-ai>
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-1.5 text-destructive"
              data-settings-tab="danger"
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Gefahrenbereich
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <User className="size-5" />
                  Profil
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Deine persönlichen Informationen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AccountAvatarSection />

                <Separator />

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input id="email" type="email" defaultValue={user?.email} disabled />
                    <p className="text-xs text-muted-foreground">E-Mail kann nicht geändert werden</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-id">User ID</Label>
                    <div className="flex min-w-0 items-center gap-2">
                      <Input
                        id="user-id"
                        defaultValue={user?.id}
                        disabled
                        className="min-w-0 flex-1 font-mono text-xs sm:text-sm"
                        data-account-user-id
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 shrink-0 px-0"
                        onClick={() => void handleCopyUserId()}
                        disabled={!user?.id}
                        aria-label="User ID kopieren"
                        data-account-user-id-copy
                      >
                        {userIdCopied ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full"
                  data-profile-sign-out
                >
                  <LogOut className="mr-2 size-4" />
                  Abmelden
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Palette className="size-5" />
                  Darstellung
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Passe das Aussehen der App an
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium md:text-base">Dark Mode</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      Dunkles Farbschema verwenden
                    </p>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    aria-label="Dark Mode umschalten"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium md:text-base">Kompakte Ansicht</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {DEFERRED_SETTING_HINT_DE}
                    </p>
                  </div>
                  <Switch
                    disabled
                    aria-label="Kompakte Ansicht umschalten"
                    title={DEFERRED_SETTING_HINT_DE}
                    data-settings-deferred="compact"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Bell className="size-5" />
                  Benachrichtigungen
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Verwalte deine Benachrichtigungen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium md:text-base">Session-Einladungen</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {DEFERRED_SETTING_HINT_DE}
                    </p>
                  </div>
                  <Switch
                    disabled
                    aria-label="Session-Einladungen"
                    title={DEFERRED_SETTING_HINT_DE}
                    data-settings-deferred="session-invites"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium md:text-base">Community-Updates</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {DEFERRED_SETTING_HINT_DE}
                    </p>
                  </div>
                  <Switch
                    disabled
                    aria-label="Community-Updates"
                    title={DEFERRED_SETTING_HINT_DE}
                    data-settings-deferred="community-updates"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audio-video">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Volume2 className="size-5" />
                  Audio & Video
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Einstellungen für Sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium md:text-base">Mikrofon aktivieren</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {DEFERRED_SETTING_HINT_DE}
                    </p>
                  </div>
                  <Switch
                    disabled
                    aria-label="Mikrofon aktivieren"
                    title={DEFERRED_SETTING_HINT_DE}
                    data-settings-deferred="mic-auto"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3 opacity-70">
                  <div>
                    <p className="text-sm font-medium md:text-base">Kamera aktivieren</p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {DEFERRED_SETTING_HINT_DE}
                    </p>
                  </div>
                  <Switch
                    disabled
                    aria-label="Kamera aktivieren"
                    title={DEFERRED_SETTING_HINT_DE}
                    data-settings-deferred="camera-auto"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="language">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Languages className="size-5" />
                  Sprache
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">App-Sprache ändern</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="app-language" className="sr-only">
                  App-Sprache
                </Label>
                <select
                  id="app-language"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 opacity-70"
                  defaultValue="de"
                  disabled
                  title={DEFERRED_SETTING_HINT_DE}
                  data-settings-deferred="language"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
                <p className="text-xs text-muted-foreground">{DEFERRED_SETTING_HINT_DE}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Sparkles className="size-5" />
                  AI
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  LLM (Organize) und generative Medien (Bild, 3D, Video, Audio)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={aiSubTab}
                  onValueChange={(value) => setAiSubTab(value as AiSubTab)}
                  className="gap-4"
                  data-settings-ai-tabs
                >
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="organize" className="gap-1.5" data-settings-ai-tab="organize">
                      <Folders className="size-3.5" aria-hidden="true" />
                      Organize
                    </TabsTrigger>
                    <TabsTrigger value="bild" className="gap-1.5" data-settings-ai-tab="bild">
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                      Bild
                    </TabsTrigger>
                    <TabsTrigger value="3d" className="gap-1.5" data-settings-ai-tab="3d">
                      <Box className="size-3.5" aria-hidden="true" />
                      3D
                    </TabsTrigger>
                    <TabsTrigger value="video" className="gap-1.5" data-settings-ai-tab="video">
                      <Video className="size-3.5" aria-hidden="true" />
                      Video
                    </TabsTrigger>
                    <TabsTrigger value="audio" className="gap-1.5" data-settings-ai-tab="audio">
                      <AudioLines className="size-3.5" aria-hidden="true" />
                      Audio
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="organize" className="space-y-4">
                    <OllamaOrganizePanel />
                  </TabsContent>

                  <TabsContent value="bild" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Provider für 2D-Bildgenerierung (z. B. Item-Thumbnails).
                    </p>
                    <AiProviderCredentialsPanel tab="bild" />
                  </TabsContent>

                  <TabsContent value="3d" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Provider für Image-to-3D (GLB-Upload braucht keinen Key).
                    </p>
                    <AiProviderCredentialsPanel tab="3d" />
                  </TabsContent>

                  <TabsContent value="video" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Provider für KI-Video.
                    </p>
                    <AiProviderCredentialsPanel tab="video" />
                  </TabsContent>

                  <TabsContent value="audio" className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Provider für KI-Audio und Stimmen.
                    </p>
                    <AiProviderCredentialsPanel tab="audio" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger">
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-destructive md:text-lg">
                  Gefahrenbereich
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Irreversible Aktionen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="destructive" className="w-full">
                  Konto löschen
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
