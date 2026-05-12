import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import ChatbotLazy from '@/components/ChatbotLazy';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

export const metadata = {
  title: 'Mon Portail Agent - Chartrettes',
  description: 'Portail agent pour la gestion des congés - Mairie de Chartrettes',
  manifest: '/manifest.json',
  applicationName: 'Portail Agent',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Portail Agent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: '/icons/icon-152x152.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <ServiceWorkerRegister />
          <ChatbotLazy />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
