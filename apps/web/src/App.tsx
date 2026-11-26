import { Route, Switch } from 'wouter';

import { Header } from '@/components/Header';
import { useServerEvents } from '@/hooks/useServerEvents';
import { ComposePage } from '@/pages/ComposePage';
import { JobsPage } from '@/pages/JobsPage';

export function App() {
  const connected = useServerEvents();

  return (
    <div className="flex min-h-screen flex-col">
      <Header reachable={connected} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <Switch>
          <Route path="/" component={ComposePage} />
          <Route path="/jobs" component={JobsPage} />
          <Route>
            <p className="text-secondary">There's nothing at this address.</p>
          </Route>
        </Switch>
      </main>
    </div>
  );
}
