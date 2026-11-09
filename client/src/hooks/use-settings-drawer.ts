import { useLocation, useSearch } from 'wouter';

const PARAM = 'settings';
const OPEN = 'open';

/**
 * Settings drawer state, kept in the URL (?settings=open) so the current page
 * stays mounted underneath, the drawer can be linked to, and the browser Back
 * button closes it.
 */
export function useSettingsDrawer() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const isOpen = new URLSearchParams(search).get(PARAM) === OPEN;

  const open = () => {
    if (isOpen) return;
    const params = new URLSearchParams(search);
    params.set(PARAM, OPEN);
    navigate(`${location}?${params.toString()}`, { state: { settingsDrawer: true } });
  };

  const close = () => {
    if (!isOpen) return;
    // Opened from within the app: step back so Back/Forward stay natural.
    if ((window.history.state as { settingsDrawer?: boolean } | null)?.settingsDrawer) {
      window.history.back();
      return;
    }
    // Opened from a direct link: drop the parameter in place.
    const params = new URLSearchParams(search);
    params.delete(PARAM);
    const query = params.toString();
    navigate(query ? `${location}?${query}` : location, { replace: true });
  };

  return { isOpen, open, close };
}
