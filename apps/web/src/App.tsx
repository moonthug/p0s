import { Route, Switch } from 'wouter';

import { Header } from './components/Header';
import { useServerEvents } from './hooks/useServerEvents';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { ComposePage } from './pages/ComposePage';
import { JobsPage } from './pages/JobsPage';
import { QuickPrintPage } from './pages/QuickPrintPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { TemplatesPage } from './pages/TemplatesPage';

export function App() {
  const connected = useServerEvents();

  return (
    <div className="flex min-h-screen flex-col">
      <Header reachable={connected} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <Switch>
          <Route path="/" component={ComposePage} />
          <Route path="/quick" component={QuickPrintPage} />
          <Route path="/templates" component={TemplatesPage} />
          <Route path="/templates/new">
            <TemplateEditorPage key="new" name={null} />
          </Route>
          <Route path="/templates/:name">{({ name }) => <TemplateEditorPage key={name} name={name} />}</Route>
          <Route path="/jobs" component={JobsPage} />
          <Route path="/docs" component={ApiDocsPage} />
          <Route>
            <p className="text-secondary">There's nothing at this address.</p>
          </Route>
        </Switch>
      </main>
    </div>
  );
}
