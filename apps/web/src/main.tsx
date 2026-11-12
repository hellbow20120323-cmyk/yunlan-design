import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SupportApplicationPage } from './components/SupportApplicationPage.tsx';
import './index.css';
import { migrateLegacyStorage } from './utils/storage';

migrateLegacyStorage();

const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
const root = createRoot(document.getElementById('root')!);

const toolsMatch = /^\/tools(?:\/([a-z0-9-]+))?$/.exec(pathname);
if (toolsMatch) {
  root.render(<App initialTab="tools" initialTool={toolsMatch[1]} />);
} else {
  root.render(pathname === '/support' ? <SupportApplicationPage /> : <App />);
}
