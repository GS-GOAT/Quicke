import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <Head>
        <meta name="theme-color" content="#111111" />
        <meta name="color-scheme" content="dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = '#111111';
                document.documentElement.style.colorScheme = 'dark';
                
                const media = window.matchMedia('(prefers-color-scheme: dark)');
                media.addListener = media.addEventListener = () => {};
                media.removeListener = media.removeEventListener = () => {};
                media.matches = true;

                Object.defineProperty(document.documentElement, 'className', {
                  get: function() { return 'dark'; },
                  set: function() { return 'dark'; }
                });
              })();
            `,
          }}
        />
      </Head>
      <body className="bg-gray-900 dark" style={{ colorScheme: 'dark' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
