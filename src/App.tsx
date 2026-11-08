import { useEffect } from 'react';
import { ChatView } from './components/Chat';
import { Forest } from './components/Forest';
import { BrowserChrome, HostSidebar } from './components/Host';
import { Onboarding, Toast } from './components/Overlays';
import { ArborPanel } from './components/Panel';
import { StoreProvider, useStore } from './lib/store';

function Shell() {
  const { state } = useStore();
  const { theme } = state.settings;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <BrowserChrome />
      <div className="viewport">
        <HostSidebar />
        <ChatView />
        {state.panelOpen && <ArborPanel />}
        {state.forest.open && <Forest />}
      </div>
      <Onboarding />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
