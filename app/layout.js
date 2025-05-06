import './globals.css'
import NavbarClient from './components/NavbarClient'
import Script from 'next/script' // ✅ เพิ่มตรงนี้

export const metadata = {
  title: 'ระบบจัดแมตช์แบด',
  description: 'เวอร์ชันแสดงผู้เล่น',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        {/* ✅ โหลด Lottie Player แบบถูกต้อง */}
        <Script
          src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-green-50 min-h-screen">
        <NavbarClient />
        {children}
      </body>
    </html>
  )
}
