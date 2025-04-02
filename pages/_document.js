import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Always use dark theme - no toggle or preference check
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = '#111111';
                document.documentElement.style.colorScheme = 'dark';
              })();
            `,
          }}
        />
      </Head>
      <body className="bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
