"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import H2HSelectionModal from './H2HSelectionModal'; // ⭐ 1. Import Modal Component (ต้องสร้างไฟล์นี้เพิ่ม)

export default function AllPlayersPage() {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]); // ⭐ State สำหรับผู้เล่นที่ Filter แล้ว
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isH2HModalOpen, setIsH2HModalOpen] = useState(false); // ⭐ 2. State ควบคุมการเปิด/ปิด Modal

  useEffect(() => {
    const fetchPlayers = async () => {
      const querySnapshot = await getDocs(collection(db, "players"));
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // เรียงจาก Ranking มาก → น้อย (Optional: ถ้าต้องการ)
      // playersData.sort((a, b) => (b.ranking || 0) - (a.ranking || 0));
      setPlayers(playersData);
      setFilteredPlayers(playersData); // ⭐ ตั้งค่าเริ่มต้นให้แสดงทั้งหมด
    };

    fetchPlayers();
  }, []);

  // Filter ชื่อที่ตรงกับ Search (แยก Logic ออกมา)
  useEffect(() => {
    const results = players.filter(player =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPlayers(results);
  }, [searchTerm, players]);

  // ⭐ 3. Function เปิด Modal
  const handleOpenH2HModal = () => {
    setIsH2HModalOpen(true);
  };

  // ⭐ 4. Function ปิด Modal
  const handleCloseH2HModal = () => {
    setIsH2HModalOpen(false);
  };

  // ⭐ 5. Function ที่จะทำงานเมื่อเลือกผู้เล่นใน Modal ครบ 2 คน
  const handleH2HSelect = (player1Name, player2Name) => {
    router.push(`/h2h?p1=${encodeURIComponent(player1Name)}&p2=${encodeURIComponent(player2Name)}`);
    handleCloseH2HModal(); // ปิด Modal หลังเลือก
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-6">
        {/* --- ปุ่มต่างๆ ด้านบน --- */}
        <div className="flex flex-wrap justify-center gap-4 mb-4">
            {/* ปุ่มกลับหน้าหลัก */}
            <Link href="/">
              <div className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm inline-block cursor-pointer">
                🏠 ไปหน้าหลัก
              </div>
            </Link>

            {/* ⭐ 6. ปุ่มเปิด Modal H2H */}
            <button
              onClick={handleOpenH2HModal}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-full text-sm inline-block"
            >
              📊 เปรียบเทียบ Head-to-Head
            </button>
        </div>

      <h1 className="text-3xl font-bold text-center text-blue-800 mb-2">
        🏸 สมาชิกทั้งหมด ({filteredPlayers.length} คน)
      </h1>

      {/* ช่องค้นหา */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อผู้เล่น..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-4 py-2 w-64 text-sm shadow-sm"
        />
      </div>

      {/* ตารางผู้เล่น */}
      <div className="max-w-5xl mx-auto grid grid-cols-5 gap-x-1 gap-y-4 justify-items-center">
      {filteredPlayers.map((player, index) => (
        <div key={player.id} className="flex flex-col items-center w-16 text-center">
          {/* ทำให้รูปและชื่อคลิกไปหน้า userwin ได้ */}
          <div
            onClick={() => router.push(`/userwin/${encodeURIComponent(player.name)}`)}
            className="cursor-pointer group flex flex-col items-center"
          >
            <img
              src={player.image || '/default-avatar.png'} // ใส่รูป default ถ้าไม่มี
              alt={player.name}
              className="w-14 h-14 rounded-full object-cover shadow-lg group-hover:opacity-80 transition"
            />
            <p className="mt-1 font-semibold text-gray-800 text-[10px] w-full break-words line-clamp-2 h-6"> {/* กำหนดความสูงให้เท่ากัน */}
              {player.name}
            </p>
          </div>
        </div>
      ))}
      </div>

      {/* ⭐ 7. แสดง Modal Component */}
      <H2HSelectionModal
        isOpen={isH2HModalOpen}
        onClose={handleCloseH2HModal}
        players={players} // ส่งรายชื่อผู้เล่นทั้งหมดไปให้ Modal
        onSelect={handleH2HSelect}
      />
    </main>
  );
}