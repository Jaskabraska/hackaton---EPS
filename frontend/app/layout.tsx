import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Grid Pulse",
  description: "Dispatcher assistant for the IEEE-118 ČEPS grid"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
