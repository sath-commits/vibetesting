import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'VibeCheck — Pre-launch QA for vibe-coded apps',
  description: 'Paste your staging URL. We run 100 pre-launch checks. Ship without embarrassment.',
  openGraph: {
    title: 'VibeCheck',
    description: 'Paste your staging URL. We run 100 pre-launch checks. Ship without embarrassment.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeCheck',
    description: 'Paste your staging URL. We run 100 pre-launch checks. Ship without embarrassment.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#0a0a0a] text-[#fafafa] antialiased`}>
        {children}
      </body>
    </html>
  )
}
