'use client'
import Navbar from './components/Navbar'

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-green-50 min-h-screen">
        <Navbar /> {/* ✅ Navbar อยู่ทุกหน้า */}
        {children} {/* ✅ เนื้อหาแต่ละหน้า */}
      </body>
    </html>
  )
}
