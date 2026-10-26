import { useEffect, useRef } from 'react';
import type { LoadedRelease } from '../content/release.ts';
import { useRoute, type Route } from '../navigation/router.ts';
import { DISCLAIMER_VERSION } from '../state/preferences.ts';
import { PreferencesProvider, usePreferences } from '../state/PreferencesContext.tsx';
import type { Preferences } from '../state/preferences.ts';
import { SessionProvider } from '../state/session.tsx';
import { BottomNav, Header, ProfileBanner } from '../components/AppShell.tsx';
import { Icon } from '../components/Icon.tsx';
import { DisclaimerGate } from '../screens/Disclaimer.tsx';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import {
  BrowseScreen,
  ContactsScreen,
  CriticalCategoryScreen,
  ProblemsScreen,
  SettingsScreen,
  SystemScreen,
  ToolsScreen,
} from '../screens/OtherScreens.tsx';
import { EscalationScreen, PresentationScreen } from '../screens/PresentationScreen.tsx';
import { ContentProvider, useContentState, useRelease } from './ContentContext.tsx';

function titleFor(route: Route, release: LoadedRelease): string {
  const store = release.store;
  switch (route.name) {
    case 'home':
      return 'CARPA Reference';
    case 'presentation':
      return 'Pathway';
    case 'escalation':
      return 'Call for help';
    case 'browse':
      return 'Body systems';
    case 'system':
      return store.refs['body-systems'].get(route.id)?.label ?? 'Body system';
    case 'critical':
      return store.refs['critical-categories'].get(route.id)?.label ?? 'Critical';
    case 'tools':
      return 'Tools';
    case 'contacts':
      return 'Contacts';
    case 'settings':
      return 'Settings';
    case 'problems':
      return 'Content problems';
    case 'not-found':
      return 'Not found';
  }
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'presentation':
      return <PresentationScreen key={route.id} id={route.id} />;
    case 'escalation':
      return <EscalationScreen id={route.id} />;
    case 'browse':
      return <BrowseScreen />;
    case 'system':
      return <SystemScreen id={route.id} />;
    case 'critical':
      return <CriticalCategoryScreen id={route.id} />;
    case 'tools':
      return <ToolsScreen />;
    case 'contacts':
      return <ContactsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'problems':
      return <ProblemsScreen />;
    case 'not-found':
      return (
        <div className="screen">
          <p className="empty">Page not found.</p>
        </div>
      );
  }
}

function ReadyApp() {
  const { release } = useRelease();
  const route = useRoute();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = JSON.stringify(route);

  useEffect(() => {
    // New screen: start at the top and move focus for screen-reader users.
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  return (
    <div className={`app${route.name === 'presentation' ? ' app--with-escalate' : ''}`}>
      <ProfileBanner />
      <Header title={titleFor(route, release)} showBack={route.name !== 'home'} />
      <main ref={mainRef} tabIndex={-1} className="app-main">
        <Screen route={route} />
      </main>
      <BottomNav current={route.name} />
    </div>
  );
}

function Gate() {
  const { prefs } = usePreferences();
  const content = useContentState();
  if (prefs.disclaimerAccepted !== DISCLAIMER_VERSION) return <DisclaimerGate />;
  if (content.status === 'loading') {
    return (
      <div className="status-screen" role="status">
        Loading and checking content…
      </div>
    );
  }
  if (content.status === 'error') {
    return (
      <div className="status-screen status-screen--error" role="alert">
        <Icon name="alert" size={40} />
        <h1>{content.message}</h1>
        <p>Use the printed CARPA manual and follow your local procedures.</p>
        <details>
          <summary>Technical detail</summary>
          <p className="mono">{content.detail}</p>
        </details>
      </div>
    );
  }
  return <ReadyApp />;
}

export function App({ release, preferences }: { release?: LoadedRelease; preferences?: Preferences }) {
  return (
    <PreferencesProvider initial={preferences}>
      <SessionProvider>
        <ContentProvider release={release}>
          <Gate />
        </ContentProvider>
      </SessionProvider>
    </PreferencesProvider>
  );
}
