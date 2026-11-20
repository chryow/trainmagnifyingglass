import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/lib/auth';
import { DialogsProvider } from '@/components/Dialogs';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DialogsProvider>
        <App />
      </DialogsProvider>
    </AuthProvider>
  </StrictMode>
);
