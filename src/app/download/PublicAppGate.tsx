/**
 * PublicAppGate — renders marketing routes (e.g. /download) without AuthGate.
 * Location: src/app/download/PublicAppGate.tsx
 */
import { useEffect, useState, type ReactNode } from 'react';
import { isPublicDownloadPath } from '../../domains/desktop-release';
import { DownloadScreen } from './DownloadScreen';

function readPathname(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function PublicAppGate({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(readPathname);

  useEffect(() => {
    const sync = () => setPathname(readPathname());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (isPublicDownloadPath(pathname)) {
    return <DownloadScreen />;
  }

  return <>{children}</>;
}
