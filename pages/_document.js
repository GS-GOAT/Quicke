import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Immediately set dark theme to prevent flash
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = '#111111';
                document.documentElement.style.colorScheme = 'dark';
              })();
            `,
          }}
        />
      </Head>
      <body className="bg-gray-100 dark:bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
