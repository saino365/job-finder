"use client";
import { useState, useEffect, createContext, useContext } from 'react';
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
const CompanyStatusGate = dynamic(() => import('./CompanyStatusGate'), { ssr: false });
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const ThemeContext = createContext({ theme: 'light', toggle: () => {} });
export function useTheme() { return useContext(ThemeContext); }

export default function Providers({ children }) {
  const [client] = useState(() => new QueryClient());
  // Start with a stable default to avoid SSR/CSR mismatch; hydrate actual value on mount
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('jf_theme');
      if (stored && (stored === 'dark' || stored === 'light')) {
        setTheme(stored);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jf_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const algorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;
  const tokens = theme === 'dark'
    ? { colorBgLayout: '#0b1220', colorBgContainer: '#111827', colorText: '#e5e7eb', colorTextSecondary: '#9ca3af', colorBorder: '#1f2937', colorPrimary: '#1677ff' }
    : { colorBgLayout: '#f7f9fc', colorBgContainer: '#ffffff', colorText: '#0f172a', colorTextSecondary: '#475569', colorBorder: '#e5e7eb', colorPrimary: '#1677ff' };

  const pathname = usePathname();
  const showCompanyGate = pathname?.startsWith('/company');
  return (
    <ConfigProvider theme={{ algorithm, token: tokens }}>
      <AntdApp>
        <QueryClientProvider client={client}>
          <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
            {/* Only enforce company flow on /company/* routes to avoid global overhead */}
            {showCompanyGate && (
              <div suppressHydrationWarning>
                <CompanyStatusGate />
              </div>
            )}
            {/* D109: Session management for browser close */}
            <SessionManager />
            {children}
          </ThemeContext.Provider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

