/**
 * Layout — single shell with CSS desktop/mobile chrome; one children mount.
 * Chrome toggles via Tailwind `md:` so resize does not remount route state.
 * `data-app-shell` tracks viewport for e2e; Radix portals stay unduplicated.
 * Shows a compact logged-in name pill next to Settings (mobile header + desktop sidebar).
 * Page views own their titles — no duplicate desktop chrome title bar.
 * Location: src/app/shell/Layout.tsx
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Books,
  CaretLeft,
  CaretRight,
  Chalkboard,
  SignOut,
  Gear,
  Storefront,
  User
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth-context';
import { toast } from 'sonner';
import { Badge } from '../../shared/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../shared/ui/avatar';
import { isCompactBand, useAdaptiveBand } from '../../shared/ui/adaptive';
import { ImageWithFallback } from '../../shared/ui/figma/ImageWithFallback';
import logoImage from '../../assets/sagatree-logo.png';
import {
  initialsFromDisplayName,
  resolveAccountDisplayName,
} from '../../domains/user-profile';
import { useAccountAvatar } from './useAccountAvatar';


/** Minimal auth shape for chrome identity — avoid app→@supabase import (#94). */
type AuthDisplayUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Prefer display_name → username → email local-part for chrome identity chip. */
function resolveAuthDisplayName(user: AuthDisplayUser | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return resolveAccountDisplayName({
    authDisplayName: typeof meta.display_name === 'string' ? meta.display_name : null,
    authUsername: typeof meta.username === 'string' ? meta.username : null,
    email: user.email ?? null,
  });
}

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

const SIDEBAR_COLLAPSED_KEY = 'sagatree-sidebar-collapsed';
/** Tailwind `md` breakpoint — keep in sync with CSS. */
const DESKTOP_MQ = '(min-width: 768px)';

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userExpandedDesktop, setUserExpandedDesktop] = useState(false);
  const { avatarUrl } = useAccountAvatar();
  const isDesktop = useIsDesktop();
  const viewportBand = useAdaptiveBand();
  const displayName = resolveAuthDisplayName(user);
  const avatarInitial = displayName
    ? initialsFromDisplayName(displayName)
    : '?';

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // ignore storage errors (private mode)
    }
  }, []);

  // Compact viewport bands: keep rail collapsed so Journey content keeps width
  // (IDE split panes / tablet). Desktop restores stored preference unless the
  // user explicitly expanded during this session.
  useEffect(() => {
    if (isCompactBand(viewportBand)) {
      setSidebarCollapsed(true);
      return;
    }
    if (userExpandedDesktop) return;
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      setSidebarCollapsed(false);
    }
  }, [viewportBand, userExpandedDesktop]);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      if (viewportBand === 'desktop' && !next) {
        setUserExpandedDesktop(true);
      }
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Erfolgreich abgemeldet');
  };

  // Editors are reached via Bibliothek (create/edit), not as top-level nav
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Chalkboard },
    { id: 'library', label: 'Bibliothek', icon: Books },
    { id: 'marketplace', label: 'Marktplatz', icon: Storefront },
  ];

  const mobileNavItems = [
    { id: 'dashboard', label: 'Home', icon: Chalkboard },
    { id: 'library', label: 'Bibliothek', icon: Books },
    { id: 'marketplace', label: 'Markt', icon: Storefront },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  const CollapseIcon = sidebarCollapsed ? CaretRight : CaretLeft;

  return (
    <div
      className="min-h-screen bg-background"
      data-app-shell={isDesktop ? 'desktop' : 'mobile'}
    >
      <div className="flex h-screen flex-col md:flex-row">
        <aside
          className={`hidden md:flex bg-sidebar border-r border-sidebar-border flex-col transition-[width] duration-200 ease-out ${
            sidebarCollapsed ? 'w-[4.5rem]' : 'w-64'
          }`}
          data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        >
          <div className={`border-b border-sidebar-border ${sidebarCollapsed ? 'p-3' : 'p-4 pl-6 pr-3'}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
              <div className={`flex items-center min-w-0 ${sidebarCollapsed ? 'justify-center' : 'flex-1 gap-3'}`}>
                <div className={`flex-shrink-0 ${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}>
                  <ImageWithFallback
                    src={logoImage}
                    alt="SagaTree Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <h1 className="text-sidebar-foreground truncate">SagaTree</h1>

                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors flex-shrink-0"
                title={sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
                aria-label={sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
                aria-expanded={!sidebarCollapsed}
              >
                <CollapseIcon className="w-5 h-5" size={20} weight="regular" aria-hidden />
              </button>
            </div>
          </div>

          <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center rounded-lg transition-colors text-sm ${
                      sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
                    } ${
                      isActive
                        ? 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-accent/10 hover:text-accent'
                    }`}
                  >
                    <Icon
                      className="w-5 h-5 flex-shrink-0"
                      size={20}
                      weight="regular"
                      aria-hidden
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className={`border-t border-sidebar-border ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
            <div className={`flex ${sidebarCollapsed ? 'flex-col items-stretch gap-1' : 'items-center gap-2'}`}>
              <button
                type="button"
                onClick={handleLogout}
                title="Abmelden"
                aria-label="Abmelden"
                className={`flex items-center rounded-lg transition-colors text-sm hover:bg-destructive/10 text-destructive ${
                  sidebarCollapsed ? 'justify-center px-2 py-3' : 'flex-1 gap-3 px-4 py-3'
                }`}
              >
                <SignOut className="w-5 h-5 flex-shrink-0" size={20} weight="regular" aria-hidden />
                {!sidebarCollapsed && <span>Abmelden</span>}
              </button>
              {displayName ? (
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className={`min-w-0 ${sidebarCollapsed ? 'flex justify-center' : ''}`}
                  title={displayName}
                  aria-label={`Angemeldet als ${displayName}`}
                  data-shell-user-pill="desktop"
                  data-shell-user-avatar={avatarUrl ? '1' : '0'}
                >
                  {sidebarCollapsed ? (
                    <Avatar className="size-9 rounded-md border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="" data-shell-user-avatar-image />
                      ) : null}
                      <AvatarFallback className="rounded-md bg-sidebar-accent/40 text-xs font-medium uppercase text-sidebar-foreground">
                        {avatarInitial}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Badge
                      variant="outline"
                      className="max-w-[7.5rem] truncate rounded-md border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1 text-sidebar-foreground"
                    >
                      {displayName}
                    </Badge>
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`rounded-lg transition-colors flex-shrink-0 ${
                  sidebarCollapsed ? 'flex justify-center px-2 py-3' : 'p-3'
                } ${
                  currentView === 'profile'
                    ? 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-accent/10 hover:text-accent'
                }`}
                title="Einstellungen"
                aria-label="Einstellungen"
              >
                <Gear
                  className="w-5 h-5"
                  size={20}
                  weight="regular"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="md:hidden bg-card border-b border-border px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex-shrink-0">
                  <ImageWithFallback
                    src={logoImage}
                    alt="SagaTree Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-base">SagaTree</h1>

              </div>
              <div className="flex items-center gap-2">
                {displayName ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('profile')}
                    className="min-w-0"
                    title={displayName}
                    aria-label={`Angemeldet als ${displayName}`}
                    data-shell-user-pill="mobile"
                    data-shell-user-avatar={avatarUrl ? '1' : '0'}
                  >
                    {avatarUrl ? (
                      <Avatar className="size-8 rounded-md border border-border">
                        <AvatarImage src={avatarUrl} alt="" data-shell-user-avatar-image />
                        <AvatarFallback className="rounded-md text-xs font-medium uppercase">
                          {avatarInitial}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Badge
                        variant="outline"
                        className="max-w-[9rem] truncate rounded-md bg-muted/50 px-2.5 py-1"
                      >
                        {displayName}
                      </Badge>
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title="Einstellungen"
                >
                  <Gear className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                  title="Abmelden"
                >
                  <SignOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>

          <main
            className="@container/main min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0"
            data-adaptive-main
            data-adaptive-viewport-band={viewportBand}
          >
            {children}
          </main>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-pb">
          <div className="grid grid-cols-4 gap-1 px-2 py-2">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  <Icon
                    className="w-5 h-5 mb-1"
                    size={20}
                    weight="regular"
                    aria-hidden
                  />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
