"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SkillSettingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [players, setPlayers] = useState([]);
  
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // เช็กสิทธิ์ Admin จาก sessionStorage
    if (sessionStorage.getItem("adminAuthenticated") === "true") {
      setAuthorized(true);
    } else {
      router.replace("/user");
    }
  }, []);

  useEffect(() => {
    // โหลดข้อมูล players จาก Firestore
    const unsubscribe = onSnapshot(collection(db, "players"), (snapshot) => {
      const playersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPlayers(playersData);
    });

    return unsubscribe;
  }, []);

  const handleUpdateSkillLevel = async (playerId, skillLevel) => {
    try {
      const playerRef = doc(db, "players", playerId);
      await updateDoc(playerRef, { skillLevel });
  
  
      console.log("✅ อัปเดต skillLevel สำเร็จ");
    } catch (error) {
      console.error("❌ อัปเดต skillLevel ผิดพลาด:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดต skillLevel");
    }
  };
  

  if (!authorized) {
    return (
      <div className="text-center p-10 text-xl text-red-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-blue-100">
      <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
        🦄 จัดการระดับสัตว์ผู้เล่น
      </h1>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 max-w-6xl mx-auto">
  <button
    onClick={() => router.push("/")}
    className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition w-full sm:w-auto"
  >
    🏠 กลับหน้าหลัก
  </button>

  <input
    type="text"
    placeholder="🔍 ค้นหารายชื่อผู้เล่น"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="border border-blue-300 rounded-xl px-4 py-2 w-full sm:w-64"
  />
</div>


      <div className="max-w-6xl mx-auto grid grid-cols-5 gap-6">


      {players
  .filter((player) =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .map((player) => (
    <div
      key={player.id}
      className="flex flex-col items-center justify-between p-2 hover:scale-105 transition-transform h-48"
    >
      {/* รูปผู้เล่น */}
      <img
        src={player.image}
        alt={player.name}
        className="w-12 h-12 rounded-full object-cover shadow mb-2"
      />

      {/* ชื่อผู้เล่น */}
      <p className="text-xs text-center break-words">{player.name}</p>

      {/* ไอคอนสัตว์ */}
      {player.skillLevel && (
        <img
          src={`/icons/${player.skillLevel}.png`}
          alt={player.skillLevel}
          className="w-8 h-8 mt-2"
        />
      )}

      {/* Dropdown เปลี่ยนสัตว์ */}
      <select
        value={player.skillLevel || ""}
        onChange={(e) => handleUpdateSkillLevel(player.id, e.target.value)}
        className="mt-2 border-2 border-blue-300 rounded-lg p-1 text-xs w-18 text-center"
      >
        <option value="">เลือกระดับ</option>
        <option value="หนอน">หนอน</option>
        <option value="หมู">หมู</option>
        <option value="ควาย">ควาย</option>
        <option value="ลิง">ลิง</option>
        <option value="ยูนิคอน">ยูนิคอน</option>
        <option value="เมอเมด">เมอเมด</option>
        <option value="โพนี่">โพนี่</option>
        <option value="โดนัท">โดนัท</option>
      </select>
    </div>
))}

      </div>
    </main>
  );
}
