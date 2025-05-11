import '../styles/globals.css';
import Head from 'next/head';
import Script from 'next/script';
import { SessionProvider } from 'next-auth/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SplitPanelProvider } from '../components/SplitPanelContext';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <SplitPanelProvider>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#0ea5e9" />
          <meta name="description" content="Get responses from multiple LLMs side by side" />
          <title>Quicke - The AI ChatHub</title>
          
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
        <SpeedInsights/>
      </SplitPanelProvider>
    </SessionProvider>
  );
}