import AdminApp from './AdminApp';
import PublicApp from './PublicApp';

const appMode = (import.meta.env.VITE_APP_MODE || 'public').toLowerCase();

export default function App() {
  if (appMode === 'admin') {
    return <AdminApp />;
  }

  return <PublicApp />;
}
