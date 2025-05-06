"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // ⭐ เพิ่มตรงนี้


export default function AllPlayersPage() {
  const [players, setPlayers] = useState([]);
  const router = useRouter(); 
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchPlayers = async () => {
      const querySnapshot = await getDocs(collection(db, "players"));
      const playersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // เรียงจาก Ranking มาก → น้อย
      playersData.sort((a, b) => (b.ranking || 0) - (a.ranking || 0));
      setPlayers(playersData);
    };

    fetchPlayers();
  }, []);

  // Filter ชื่อที่ตรงกับ Search
  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-6">
        <div className="flex justify-center mb-4">
        <Link href="/">
  <div className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm inline-block">
    🏠 ไปหน้าหลัก
  </div>
</Link>
</div>

      <h1 className="text-3xl font-bold text-center text-blue-800 mb-2">
        🏸 สมาชิกทั้งหมด ({filteredPlayers.length} คน)
      </h1>

      {/* ช่องค้นหา */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="ค้นหาชื่อผู้เล่น..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-4 py-2 w-64 text-sm"
        />
      </div>

      {/* ตารางผู้เล่น */}
      <div className="max-w-5xl mx-auto grid grid-cols-5 gap-x-1 gap-y-4 justify-items-center">
      {filteredPlayers.map((player, index) => (
  <div key={player.id} className="flex flex-col items-center w-16">
    <div
  onClick={() => router.push(`/userwin/${encodeURIComponent(player.name)}`)}
  className="cursor-pointer"
>
  <img
    src={player.image}
    alt={player.name}
    className="w-14 h-14 rounded-full object-cover shadow-lg hover:opacity-80 transition"
  />
</div>
    <p className="mt-1 font-semibold text-gray-800 text-[10px] text-center truncate w-16">
      {player.name}
    </p>
    
  </div>
))}


      </div>
    </main>
  );
}
