import '../styles/globals.css';
import Head from 'next/head';
import Script from 'next/script';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add('dark');
    document.documentElement.style.backgroundColor = '#111111';
    document.documentElement.style.colorScheme = 'dark';
    
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
        <title>Quicke - The AI ChatHub</title>
        
        {/* Always use dark mode - light mode removed */}
        <Script id="dark-mode-enforcer" strategy="beforeInteractive">
          {`
            (function() {
              document.documentElement.classList.add('dark');
              document.documentElement.style.backgroundColor = '#111111';
              document.documentElement.style.colorScheme = 'dark';
            })();
          `}
        </Script>
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </SessionProvider>
  );
}

export default MyApp;