import '../styles/globals.css';
import Head from 'next/head';
import Script from 'next/script';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Add global API key manager toggle
    window.__apiKeyManagerToggle = (show) => {
      window.dispatchEvent(new CustomEvent('toggleApiKeyManager', { 
        detail: { show } 
      }));
    };
  }, []);

  return (
    <SessionProvider session={pageProps.session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="description" content="Get responses from multiple LLMs side by side" />
        <title>Quicke - LLM Response Comparison</title>
        
        {/* Script to check dark mode preference before page renders to prevent flash */}
        <Script id="dark-mode-check" strategy="beforeInteractive">
          {`
            (function() {
              const isDark = localStorage.getItem('darkMode') === 'true' || 
                (localStorage.getItem('darkMode') === null && 
                window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (isDark) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            })();
          `}
        </Script>
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}

export default MyApp;