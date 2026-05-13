import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RepoGaze — Architecture Forensics Studio',
  description: 'Transform tangled codebases into readable architectural maps. A studio for understanding the code you inherited.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen paper-texture overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
