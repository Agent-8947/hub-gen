import AdminPanel from './components/AdminPanel.tsx';
import Widget from './components/Widget.tsx';
import { WidgetConfig } from './config.ts';

declare global {
  interface Window { WIDGET_CONFIG?: WidgetConfig; }
}

export default function App() {
  const isWidgetOnly = !!window.WIDGET_CONFIG || new URLSearchParams(window.location.search).has('widgetOnly');

  if (isWidgetOnly) return <Widget />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-sm">
              <i className="fa-solid fa-comments" />
            </div>
            <span className="text-sm font-black uppercase text-slate-800 tracking-tight">Feedback Hub</span>
          </div>
        </div>
      </header>
      <main className="flex-grow">
        <AdminPanel />
      </main>
    </div>
  );
}
