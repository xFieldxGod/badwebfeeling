"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import MatchCard from '../MatchCard'; // ตรวจสอบ Path ให้ถูกต้อง อาจจะเป็น ../MatchCard.jsx

// Component แสดง Loading
function LoadingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="h-10 w-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <div className="text-sm text-gray-600 font-medium">
        กำลังโหลดข้อมูล H2H...
      </div>
    </div>
  );
}

// Component หลักสำหรับเนื้อหา H2H (แยกออกมาเพื่อให้ใช้ useSearchParams ได้)
function H2HContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State สำหรับเก็บข้อมูล
  const [player1Data, setPlayer1Data] = useState(null);
  const [player2Data, setPlayer2Data] = useState(null);
  const [h2hMatches, setH2hMatches] = useState([]);
  const [player1Wins, setPlayer1Wins] = useState(0);
  const [player2Wins, setPlayer2Wins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ดึงชื่อจาก URL
  const player1Name = searchParams.get('p1');
  const player2Name = searchParams.get('p2');

  // Function ดึงข้อมูลโปรไฟล์ผู้เล่นคนเดียว
  const fetchPlayerData = async (playerName) => {
    if (!playerName) return null;
    try {
      const q = query(collection(db, "players"), where("name", "==", playerName), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }
      return null; // ไม่พบผู้เล่น
    } catch (err) {
      console.error(`Error fetching player ${playerName}:`, err);
      return null;
    }
  };

  // Function ดึงและกรองแมตช์ H2H
  const fetchAndProcessMatches = async (p1Name, p2Name) => {
    if (!p1Name || !p2Name) return { matches: [], p1Wins: 0, p2Wins: 0 };

    try {
      // ดึงแมตช์ที่ผู้เล่น 1 เข้าร่วม (เรียงจากใหม่ไปเก่า)
      const q = query(
        collection(db, "matches"),
        where("playerNames", "array-contains", p1Name),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const allP1Matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // กรองเฉพาะแมตช์ H2H ที่แข่งกันเอง
      let p1WinCount = 0;
      let p2WinCount = 0;
      const filteredMatches = allP1Matches.filter(match => {
        const p1InA = match.teamA?.some(p => p.name === p1Name);
        const p1InB = match.teamB?.some(p => p.name === p1Name);
        const p2InA = match.teamA?.some(p => p.name === p2Name);
        const p2InB = match.teamB?.some(p => p.name === p2Name);

        // เช็คว่าทั้งคู่อยู่ในแมตช์ และอยู่คนละทีม
        if ((p1InA && p2InB) || (p1InB && p2InA)) {
          // นับคะแนน H2H
          if (match.winner === "A" && p1InA) {
            p1WinCount++;
          } else if (match.winner === "B" && p1InB) {
            p1WinCount++;
          } else if (match.winner === "A" && p2InA) {
            p2WinCount++;
          } else if (match.winner === "B" && p2InB) {
            p2WinCount++;
          }
          return true; // เก็บแมตช์นี้ไว้
        }
        return false; // ไม่ใช่แมตช์ H2H
      });

      return { matches: filteredMatches, p1Wins: p1WinCount, p2Wins: p2WinCount };

    } catch (err) {
      console.error("Error fetching H2H matches:", err);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลแมตช์");
      return { matches: [], p1Wins: 0, p2Wins: 0 };
    }
  };

  useEffect(() => {
    // Reset ค่าเริ่มต้น
    setLoading(true);
    setError(null);
    setPlayer1Data(null);
    setPlayer2Data(null);
    setH2hMatches([]);
    setPlayer1Wins(0);
    setPlayer2Wins(0);

    if (!player1Name || !player2Name) {
      setError("ไม่ได้ระบุชื่อผู้เล่นครบ 2 คน");
      setLoading(false);
      return;
    }

    if (player1Name === player2Name) {
      setError("กรุณาเลือกผู้เล่น 2 คนที่ไม่ซ้ำกัน");
      setLoading(false);
      return;
    }

    const loadAllData = async () => {
      const [p1Data, p2Data, h2hData] = await Promise.all([
        fetchPlayerData(player1Name),
        fetchPlayerData(player2Name),
        fetchAndProcessMatches(player1Name, player2Name)
      ]);

      if (!p1Data || !p2Data) {
        setError(`ไม่พบข้อมูลผู้เล่น: ${!p1Data ? player1Name : ''} ${!p2Data ? player2Name : ''}`);
      } else {
        setPlayer1Data(p1Data);
        setPlayer2Data(p2Data);
        setH2hMatches(h2hData.matches);
        setPlayer1Wins(h2hData.p1Wins);
        setPlayer2Wins(h2hData.p2Wins);
      }
      setLoading(false);
    };

    loadAllData();

  }, [player1Name, player2Name]); // ทำงานใหม่เมื่อชื่อผู้เล่นใน URL เปลี่ยน

  // --- ส่วนแสดงผล ---

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50">
        <p className="text-red-600 text-xl mb-4">{error}</p>
        <Link href="/all-players">
          <div className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            กลับไปเลือกผู้เล่น
          </div>
        </Link>
      </main>
    );
  }

  if (!player1Data || !player2Data) {
     return ( // เพิ่มกรณีที่อาจจะยังหาข้อมูลผู้เล่นไม่เจอหลัง loading เสร็จ
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-yellow-50">
        <p className="text-yellow-700 text-xl mb-4">กำลังตรวจสอบข้อมูลผู้เล่น...</p>
         <Link href="/all-players">
           <div className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
             กลับไปเลือกผู้เล่น
           </div>
         </Link>
      </main>
     );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 p-6 flex flex-col items-center">
      {/* ปุ่มกลับ */}
       <div className="w-full flex justify-start mb-6 max-w-4xl">
         <Link href="/all-players">
           <div className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded shadow-md">
             ⬅️ กลับหน้ารายชื่อ
           </div>
         </Link>
       </div>

      <h1 className="text-3xl font-bold text-purple-800 mb-6">
        Head-to-Head
      </h1>

      {/* ส่วนแสดงผล H2H */}
      <div className="flex items-center justify-center gap-6 md:gap-12 mb-8 bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl">
        {/* ผู้เล่นคนที่ 1 */}
        <div className="flex flex-col items-center text-center w-1/3">
          <img
            src={player1Data.image || '/default-avatar.png'}
            alt={player1Data.name}
            className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover mb-2 border-4 border-blue-400 shadow-md"
          />
          <p className="font-semibold text-lg text-blue-700 break-words">{player1Data.name}</p>
           {/* เพิ่มแสดง skill icon ถ้ามี */}
           {player1Data.skillLevel && (
             <img src={`/icons/${player1Data.skillLevel}.png`} alt="icon" className="w-6 h-6 mt-1"/>
           )}
        </div>

        {/* คะแนน H2H */}
        <div className="flex flex-col items-center text-center">
          <p className="text-4xl md:text-6xl font-bold text-gray-700">
            <span className="text-blue-600">{player1Wins}</span>
            <span className="mx-2">-</span>
            <span className="text-red-600">{player2Wins}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
           เจอกัน {h2hMatches.length}
          </p>
        </div>

        {/* ผู้เล่นคนที่ 2 */}
        <div className="flex flex-col items-center text-center w-1/3">
          <img
            src={player2Data.image || '/default-avatar.png'}
            alt={player2Data.name}
            className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover mb-2 border-4 border-red-400 shadow-md"
          />
          <p className="font-semibold text-lg text-red-700 break-words">{player2Data.name}</p>
           {/* เพิ่มแสดง skill icon ถ้ามี */}
           {player2Data.skillLevel && (
             <img src={`/icons/${player2Data.skillLevel}.png`} alt="icon" className="w-6 h-6 mt-1"/>
           )}
        </div>
      </div>

      {/* ประวัติการแข่งขัน (Optional) */}
      {h2hMatches.length > 0 && (
        <div className="w-full max-w-4xl mt-8">
          <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">
            ประวัติการเจอกัน
          </h2>
          <div className="space-y-4">
            {h2hMatches.map((match, index) => (
              <div key={match.id} className="bg-white p-3 rounded-lg shadow">
                <div className="text-center text-sm text-gray-500 mb-2">
                  {match.createdAt?.toDate ?
                    match.createdAt.toDate().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'ไม่มีข้อมูลวันที่'}
                </div>
                <MatchCard
                  teamA={match.teamA || []}
                  teamB={match.teamB || []}
                  winner={match.winner}
                  statusText={match.status === 'finished' ? 'จบแล้ว' : match.status}
                  goToUserWin={(name) => router.push(`/userwin/${encodeURIComponent(name)}`)} // ทำให้คลิกชื่อได้
                  getSkillIcon={(id) => { // Function หา skill icon (ถ้าต้องการ)
                     const p1 = player1Data?.id === id ? player1Data : null;
                     const p2 = player2Data?.id === id ? player2Data : null;
                     const player = p1 || p2; // หาจากข้อมูลที่โหลดมาแล้ว
                     return player?.skillLevel ? `/icons/${player.skillLevel}.png` : null;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
       {h2hMatches.length === 0 && !loading && (
          <p className="text-center text-gray-500 mt-8">ยังไม่เคยแข่งกัน</p>
       )}
    </main>
  );
}

// Component หลักที่ใช้ Suspense ครอบ H2HContent
export default function H2HPage() {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <H2HContent />
    </Suspense>
  );
}