import '../styles/globals.css';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="description" content="Compare responses from multiple LLMs side by side" />
        <title>Quicke - LLM Response Comparison</title>
        
        {/* Script to check dark mode preference before page renders to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Check for saved theme preference or default to system preference
                const isDark = localStorage.getItem('darkMode') === 'true' || 
                  (localStorage.getItem('darkMode') === null && 
                  window.matchMedia('(prefers-color-scheme: dark)').matches);
                
                // Apply dark mode class immediately if needed
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 