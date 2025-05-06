"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function NavbarClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname !== "/user") return null;

  const handleAdmin = () => {
    const password = prompt("กรุณาใส่รหัสผ่านเพื่อเข้า Admin:");
    if (password === "1234") {
      sessionStorage.setItem("adminAuthenticated", "true"); // ✅ เพิ่มบรรทัดนี้
      router.push("/admin");
    } else {
      alert("รหัสผ่านไม่ถูกต้อง");
    }
    setMenuOpen(false);
  };
  

  const toggleQR = () => {
    const toggleEvent = new CustomEvent("toggleQR");
    window.dispatchEvent(toggleEvent);
    setMenuOpen(false);
  };

  return (
    <div className="w-full p-4 flex justify-end sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-md">
      <div className="relative">
        {/* ปุ่ม ☰ */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-300 shadow-lg"
        >
          ☰
        </button>

        {/* เมนู dropdown */}
        {menuOpen && (
          <div className="absolute right-0 mt-3 w-56 bg-gradient-to-br from-white to-gray-100 border rounded-2xl shadow-2xl p-3 animate-fadeIn">
            <button
              onClick={handleAdmin}
              className="w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-blue-100 hover:scale-105 transition-all duration-200"
            >
              🔒 Admin
            </button>
            <button
              onClick={toggleQR}
              className="w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-blue-100 hover:scale-105 transition-all duration-200 mt-2"
            >
              📱 QR แชร์เว็บ
            </button>
            <button
              onClick={() => router.push("/ranking")}
              className="w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-green-100 hover:scale-105 transition-all duration-200 mt-2"
            >
              🏆 อันดับผู้เล่น
            </button>
            <button
              onClick={() => router.push("/all-players")}
              className="w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-purple-100 hover:scale-105 transition-all duration-200 mt-2"
            >
              🧍‍♂️ สมาชิกทั้งหมด
            </button>
            <button
              onClick={() => router.push("/feedback")}
              className="w-full text-left px-4 py-3 rounded-xl font-semibold text-gray-800 hover:bg-pink-100 hover:scale-105 transition-all duration-200 mt-2"
            >
              📝 ส่งข้อความให้แอด
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
