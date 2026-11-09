import { useEffect } from 'react';
import { useStore } from '../../lib/store';
import { ChatView } from './components/Chat';
import { Forest } from './components/Forest';
import { BrowserChrome, HostSidebar } from './components/Host';
import { Onboarding, Toast } from './components/Overlays';
import { ArborPanel } from './components/Panel';
import './styles.css';

/** The original design: a mock browser with a host chat app and the Arbor side panel. */
export default function ClassicApp() {
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
