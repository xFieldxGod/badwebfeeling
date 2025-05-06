"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
// --- เพิ่ม where, limit จาก firebase/firestore ---
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  where,
  limit, // เพิ่ม limit
} from "firebase/firestore";
import MatchCard from "../../MatchCard";

export default function UserWinPage() {
  const [loading, setLoading] = useState(true); // โหลดข้อมูลหลัก
  const [calculatingRank, setCalculatingRank] = useState(false); // กำลังคำนวณ Rank?

  const [playerSkillIcon, setPlayerSkillIcon] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]); // เก็บข้อมูลผู้เล่นทั้งหมด (เผื่อใช้หา partner image)
  const [topPartners, setTopPartners] = useState([]);
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;
  };
  const rawParams = useParams();
  const name = decodeURIComponent(rawParams.name || ""); // เพิ่ม || "" ป้องกัน error ตอนเริ่ม
  const matchesPerPage = 10;
  const router = useRouter();
  const [loseCount, setLoseCount] = useState(0);
  const [rank, setRank] = useState(null); // Rank เริ่มเป็น null

  const [matches, setMatches] = useState([]); // ✅ แมตช์ที่ตัวเองเล่น (ไม่ใช่ทั้งหมดแล้ว)
  const [winCount, setWinCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [playerData, setPlayerData] = useState(null); // <-- เปลี่ยนชื่อจาก playerImage เป็น playerData
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0); // Progress สำหรับโหลดข้อมูลหลัก

  // --- ลบ useState ของ allMatches ออก ---
  // const [allMatches, setAllMatches] = useState([]);

  const currentMatches = useMemo(() => {
    const indexOfLastMatch = currentPage * matchesPerPage;
    const indexOfFirstMatch = indexOfLastMatch - matchesPerPage;
    return matches.slice(indexOfFirstMatch, indexOfLastMatch);
  }, [matches, currentPage]);

  const getSkillIcon = (playerId) => {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player || !player.skillLevel) return null;
    return `/icons/${player.skillLevel}.png`;
  };

  // --- useEffect สำหรับดึงข้อมูลผู้เล่นทั้งหมด (ยังคงไว้เพื่อหา Partner Image) ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snapshot) => {
      const playersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllPlayers(playersData);
      console.log("All players data loaded:", playersData.length); // Log ดูว่าโหลดผู้เล่นครบไหม
    });
    return () => unsub();
  }, []);

  // --- useEffect หลัก: ดึงข้อมูลผู้เล่นคนนี้ + แมตช์ของเขา + คำนวณสถิติเบื้องต้น ---
  useEffect(() => {
    const playerName = decodeURIComponent(rawParams.name || "");
    if (!playerName) {
      setLoading(false); // ถ้าไม่มีชื่อ ก็หยุดโหลด
      return;
    }

    // Reset states เมื่อชื่อผู้เล่นเปลี่ยน
    setLoading(true);
    setCalculatingRank(false); // ยังไม่เริ่มคำนวณ Rank
    setLoadingProgress(0);
    setMatches([]);
    setPlayerData(null);
    setWinCount(0);
    setLoseCount(0);
    setPlayCount(0);
    setTopPartners([]);
    setRank(null); // สำคัญ: Reset Rank เป็น null ทุกครั้งที่เริ่มโหลดใหม่
    setCurrentPage(1);
    setPlayerSkillIcon(null);

    let isMounted = true; // ตัวแปรเช็คว่า component ยัง mount อยู่ไหม

    async function fetchData() {
      console.log(`Workspaceing data for: ${playerName}`);
      try {
        // --- 1. ดึงข้อมูล Player คนนี้ ---
        let playerDocData = null;
        const playerQuery = query(collection(db, "players"), where("name", "==", playerName), limit(1));
        const playerSnapshot = await getDocs(playerQuery);

        if (!isMounted) return; // ถ้า unmount แล้ว ไม่ต้องทำต่อ

        if (!playerSnapshot.empty) {
          playerDocData = { id: playerSnapshot.docs[0].id, ...playerSnapshot.docs[0].data() };
          console.log("Player data found:", playerDocData);
          setPlayerData(playerDocData);
          setPlayerSkillIcon(playerDocData.skillLevel ? `/icons/${playerDocData.skillLevel}.png` : null);
        } else {
          console.error("ไม่พบข้อมูลผู้เล่น:", playerName);
          setLoading(false);
          return;
        }
        setLoadingProgress(20);

        // --- 2. Query แมตช์ที่ผู้เล่นคนนี้เข้าร่วม ---
        console.log(`Querying matches for playerNames containing: ${playerName}`);
        const matchesQuery = query(
          collection(db, "matches"),
          where("playerNames", "array-contains", playerName), // <-- ใช้ field ใหม่ที่เตรียมไว้
          orderBy("createdAt", "desc")
        );

        const matchSnapshot = await getDocs(matchesQuery);
        if (!isMounted) return;
        console.log(`Found ${matchSnapshot.docs.length} matches for ${playerName}`);
        setLoadingProgress(60);

        const fetchedMatches = matchSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setMatches(fetchedMatches);

        // --- 3. คำนวณสถิติต่างๆ จากแมตช์ที่ดึงมา ---
        let wins = 0;
        let plays = fetchedMatches.length;
        const partnerStats = {}; // ใช้ Object เก็บข้อมูล partner { 'partnerName': { count: N, wins: M, image: '...', id: '...' } }

        fetchedMatches.forEach((match) => {
          const inA = match.teamA.some((p) => p.name === playerName);
          const inB = match.teamB.some((p) => p.name === playerName);

          const isWinner = (match.winner === "A" && inA) || (match.winner === "B" && inB);
          if (isWinner) wins++;

          // คู่หู
          const team = inA ? match.teamA : match.teamB;
          team.forEach((p) => {
            if (p.name !== playerName) {
              // หาข้อมูลเต็มของ partner จาก allPlayers state (ถ้ามี)
              const fullPartner = allPlayers.find(ap => ap.id === p.id);
              if (!partnerStats[p.name]) {
                 partnerStats[p.name] = {
                  count: 0,
                  wins: 0,
                  image: fullPartner?.image || p.image || null, // ใช้รูปเต็มถ้ามี, ถ้าไม่มีใช้จาก match, ถ้าไม่มีอีกก็ null
                  id: p.id // เก็บ id ไว้ด้วย
                };
              }
              partnerStats[p.name].count++;
              if (isWinner) partnerStats[p.name].wins++;
            }
          });
        });
        setLoadingProgress(90);

        setPlayCount(plays);
        setWinCount(wins);
        setLoseCount(plays - wins);

        // Top คู่หู
        const sortedPartners = Object.entries(partnerStats)
          .sort(([, a], [, b]) => b.wins - a.wins || b.count - a.count)
          .slice(0, 3); // เอาแค่ 3 คนแรก

        const top3 = sortedPartners.map(([partnerName, data]) => ({
           name: partnerName, // แก้จาก name เป็น partnerName เพื่อความชัดเจน
           ...data
        }));
        setTopPartners(top3);

        console.log("Initial stats calculated:", { wins, losses: plays - wins, plays, topPartners: top3 });

        setLoadingProgress(100);
        setLoading(false); // <--- โหลดข้อมูลหลักเสร็จแล้ว

      } catch (error) {
        console.error("Error fetching initial user win data:", error);
        if (isMounted) {
          setLoading(false); // หยุดโหลดถ้ามี error
        }
      }
    }

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("UserWinPage unmounted or name changed.");
    };

  }, [rawParams.name, allPlayers]); // <--- เพิ่ม allPlayers เป็น dependency เพราะใช้หา partner image

  // --- useEffect สำหรับคำนวณ Rank ทีหลัง ---
  useEffect(() => {
    const playerName = decodeURIComponent(rawParams.name || "");

    // ถ้าโหลดข้อมูลหลักเสร็จแล้ว, ยังไม่ได้คำนวณ Rank, และมีแมตช์ให้เล่น
    if (!loading && rank === null && playCount > 0 && playerName) {
      setCalculatingRank(true); // เริ่มสถานะกำลังคำนวณ Rank
      console.log(`[Rank] Setting timer to calculate rank for ${playerName} in 2 seconds...`);

      const timer = setTimeout(() => {
        console.log(`[Rank] Starting rank calculation for ${playerName}...`);

        async function calculateRank() {
          try {
            // 1. ดึงข้อมูลแมตช์ทั้งหมด (Query เดิมที่เคยใช้)
            const allMatchesQuery = query(collection(db, "matches"), orderBy("createdAt", "desc"));
            const allMatchesSnapshot = await getDocs(allMatchesQuery);
            console.log(`[Rank] Fetched ${allMatchesSnapshot.docs.length} total matches for calculation.`);

            const allMatchList = allMatchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. คำนวณ playerStats สำหรับทุกคน (Logic เดิม)
            const playerStats = {};
            allMatchList.forEach((match) => {
              const teamAPlayers = match.teamA || []; // ป้องกัน error ถ้า teamA ไม่มี
              const teamBPlayers = match.teamB || []; // ป้องกัน error ถ้า teamB ไม่มี

              [...teamAPlayers, ...teamBPlayers].forEach((p) => {
                 if (!p || !p.name) return; // ข้ามถ้าข้อมูลผู้เล่นไม่สมบูรณ์

                if (!playerStats[p.name]) {
                  playerStats[p.name] = { wins: 0, plays: 0, points: 0 };
                }
                playerStats[p.name].plays++;
                if (
                  (match.winner === "A" && teamAPlayers.some((pp) => pp.name === p.name)) ||
                  (match.winner === "B" && teamBPlayers.some((pp) => pp.name === p.name))
                ) {
                  playerStats[p.name].wins++;
                  playerStats[p.name].points += 2;
                } else if (match.winner !== "") { // นับแต้มแพ้ (+1) เฉพาะเมื่อมีผลแพ้ชนะและไม่ใช่แมตช์ที่รอ
                   playerStats[p.name].points += 1;
                }
              });
            });
            console.log("[Rank] Player stats calculated:", Object.keys(playerStats).length, "players");

            // 3. เรียงลำดับและหา Rank (Logic เดิม)
            const sortedPlayers = Object.entries(playerStats)
              .sort(([, a], [, b]) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.wins !== a.wins) return b.wins - a.wins;
                const winRateA = a.plays === 0 ? 0 : a.wins / a.plays;
                const winRateB = b.plays === 0 ? 0 : b.wins / b.plays;
                return winRateB - winRateA;
              })
              .map(([pName]) => pName); // แก้เป็น pName

            const playerRank = sortedPlayers.indexOf(playerName) + 1;
            console.log(`[Rank] Calculation finished for ${playerName}. Rank: ${playerRank}`);

            // 4. อัปเดต State ของ Rank
            setRank(playerRank > 0 ? playerRank : null); // ถ้าหาไม่เจอหรือไม่ติดอันดับ ก็เป็น null

          } catch (error) {
            console.error(`[Rank] Error calculating rank for ${playerName}:`, error);
            setRank(null); // ใส่ null ถ้า error
          } finally {
             setCalculatingRank(false); // คำนวณเสร็จ (ไม่ว่าจะสำเร็จหรือไม่)
          }
        }
        calculateRank();

      }, 2000); // รอ 2 วินาที (2000 ms)

      // Cleanup function ไว้เคลียร์ timeout ถ้า component unmount หรือ state เปลี่ยนก่อน
      return () => {
        console.log(`[Rank] Clearing rank calculation timer for ${playerName}.`);
        clearTimeout(timer);
        setCalculatingRank(false); // หยุดสถานะคำนวณถ้า unmount
      };
    } else if (loading) {
        // ถ้ายังโหลดข้อมูลหลักอยู่ ให้เคลียร์ rank state และสถานะคำนวณ rank
        setRank(null);
        setCalculatingRank(false);
    }
  }, [loading, name, playCount, rawParams.name]); // เพิ่ม name, playCount, rawParams.name เป็น dependencies
  // **เอา rank ออกจาก dependency ของ useEffect นี้ เพื่อไม่ให้มันทำงานซ้ำเมื่อ rank ถูก set**

  // --- ลบฟังก์ชัน processMatches ออก ---

  const goToUserWin = (playerName) => {
    // Clear rank state when navigating away to ensure it recalculates on the new page
    setRank(null);
    setCalculatingRank(false);
    router.push(`/userwin/${encodeURIComponent(playerName)}`);
  };

  // ฟังก์ชันหาลำดับแมตช์ (ใช้ข้อมูล matches ที่ filter แล้ว)
   const findMatchIndexInPersonal = (matchId) => {
     const index = matches.findIndex((m) => m.id === matchId);
     if (index === -1) return "?";
     return matches.length - index; // ลำดับในแมตช์ส่วนตัว (เรียงล่าสุดก่อน)
   };

  // --- ส่วน JSX ---
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-6 flex flex-col items-center">
      {/* --- Loading Indicator หลัก --- */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <div className="h-10 w-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-600 font-medium">
            กำลังโหลดข้อมูลของ {name}... {loadingProgress}%
          </div>
        </div>
      )}

      {/* --- แสดงเนื้อหาเมื่อโหลดเสร็จ --- */}
      {!loading && (
        <>
          {/* ปุ่มกลับหน้าแรก */}
          <div className="w-full flex justify-start mb-6">
            <button
              onClick={() => (window.location.href = "/user")}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded shadow-md"
            >
              🏠 หน้าแรก
            </button>
          </div>

          <h1 className="text-3xl font-bold text-green-700 mb-4 flex items-center gap-2">
            🏆 สถิติของ{" "}
            {playerSkillIcon && (
              <img src={playerSkillIcon} className="w-8 h-8" alt="icon" />
            )}
            {name}
          </h1>

          {/* ใช้ playerData?.image แทน playerImage */}
          {playerData?.image && (
            <img
              src={playerData.image}
              alt={name}
              loading="lazy"
              className="w-28 h-28 rounded-full object-cover mb-6 shadow-md border-4 border-green-400"
            />
          )}

          {/* ส่วนแสดงสถิติ */}
          {playCount === 0 ? (
            <p className="text-gray-500">ยังไม่มีการแข่งขัน</p>
          ) : (
            <div className="text-center space-y-4 mb-10">
              <div className="flex flex-wrap justify-center gap-4 text-2xl font-semibold mt-4">
                <span className="text-green-800">ชนะ {winCount}</span>
                <span className="text-red-800">แพ้ {loseCount}</span>
                <span className="text-blue-800">เล่นทั้งหมด {playCount} ครั้ง</span>
              </div>
              {playCount > 0 && (
                <p className="text-3xl font-bold text-purple-700 mt-4">
                  Win Rate: {((winCount / playCount) * 100).toFixed(1)}%
                </p>
              )}

              {/* --- ส่วนแสดง Rank (เพิ่ม Loading Indicator) --- */}
              {calculatingRank ? (
                <p className="text-lg text-gray-500 mt-4 animate-pulse">
                  กำลังคำนวณอันดับ...
                </p>
              ) : rank !== null ? (
                 <p className="text-2xl text-orange-600 font-bold mt-4">
                   🏅 อันดับที่ {rank}
                 </p>
              ) : (
                 playCount > 0 && <p className="text-lg text-gray-400 mt-4">(ไม่พบข้อมูลอันดับ)</p> // แสดงข้อความเมื่อคำนวณเสร็จแต่ไม่เจอ Rank
              )}

              {/* ส่วนแสดง Top Partners */}
              {topPartners.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-xl font-bold text-green-700 mb-2">
                    🧑‍🤝‍🧑 เล่นด้วยแล้วชนะเยอะสุด (Top 3)
                  </p>
                   <div className="flex flex-col gap-3 items-center">
                     {topPartners.map((partner, index) => (
                       <div
                          key={partner.id || partner.name || index} // ใช้ key ที่ unique
                         className="flex items-center gap-3 bg-white shadow px-4 py-2 rounded-lg w-full max-w-md cursor-pointer hover:bg-gray-100 transition-colors"
                         onClick={() => partner.name && goToUserWin(partner.name)} // เช็คก่อนว่ามีชื่อ partner ไหม
                       >
                         <span className="text-lg font-bold text-gray-500">
                           #{index + 1}
                         </span>
                         {partner.image && (
                           <img
                             src={partner.image}
                             alt={partner.name || 'Partner'} // ใส่ default alt
                             loading="lazy"
                             className="w-10 h-10 rounded-full object-cover border-2 border-green-400"
                           />
                         )}
                          <div className="flex-1 flex flex-col text-left min-w-0"> {/* Added min-w-0 for proper truncation */}
                           <span className="font-semibold truncate">{partner.name || 'ไม่พบชื่อ'}</span>
                           <span className="text-sm text-gray-600">
                              เล่นด้วยกัน {partner.count} ครั้ง, ชนะ {partner.wins} ครั้ง
                           </span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          )}

          {/* รายการแมตช์ */}
           {matches.length > 0 && (
             <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">ประวัติการแข่งขัน</h2>
           )}
          <div className="space-y-2 max-w-5xl w-full">
             {/* Pagination */}
             {Math.ceil(matches.length / matchesPerPage) > 1 && (
                <div className="flex justify-center items-center gap-2 my-6">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {Array.from(
                    { length: Math.ceil(matches.length / matchesPerPage) },
                    (_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(index + 1)}
                        className={`px-3 py-1 rounded ${
                          currentPage === index + 1
                            ? "bg-blue-500 text-white"
                            : "bg-gray-300"
                        }`}
                      >
                        {index + 1}
                      </button>
                    )
                  )}

                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, Math.ceil(matches.length / matchesPerPage))
                      )
                    }
                    disabled={
                      currentPage === Math.ceil(matches.length / matchesPerPage)
                    }
                    className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
             )}

            {/* แสดง MatchCard เฉพาะหน้าปัจจุบัน */}
            {currentMatches.map((match, i) => (
              <div key={match.id} className="space-y-1">
                <div className="text-center font-bold text-green-700">
                   แมตช์ที่ {findMatchIndexInPersonal(match.id)} (ของ {name}) {/* ใช้ findMatchIndexInPersonal */}
                  {match.status === "finished" &&
                    match.startTime?.toDate &&
                    match.endTime?.toDate && (
                      <div className="text-center text-sm text-gray-600 font-normal">
                        เวลาเล่น:{" "}
                        <span className="text-green-700 font-semibold">
                          {formatDuration(
                            (match.endTime.toDate() - match.startTime.toDate()) /
                              1000
                          )}
                        </span>
                      </div>
                    )}
                </div>

                {match.createdAt?.toDate && (
                  <div className="text-center text-sm text-gray-500">
                    วันที่เล่น:{" "}
                    {match.createdAt.toDate().toLocaleString("th-TH", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}

                <MatchCard
                  teamA={match.teamA}
                  teamB={match.teamB}
                  winner={match.winner}
                  statusText={
                    match.status === "finished"
                      ? "จบแล้ว"
                      : match.status === "playing"
                      ? "กำลังเล่นอยู่"
                      : "กำลังรอเล่น"
                  }
                  goToUserWin={goToUserWin}
                  getSkillIcon={getSkillIcon}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}