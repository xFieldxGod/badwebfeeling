"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import MatchCard from "../MatchCard";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { getDocs, startAfter } from "firebase/firestore";
import { getCountFromServer } from "firebase/firestore";

export default function UserPage() {
  
  const [inputPage, setInputPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);

  const [totalMatches, setTotalMatches] = useState(0);
  const matchesPerPage = 10;

  const [lastVisible, setLastVisible] = useState(null); // ⭐ เก็บ doc สุดท้ายของหน้า
  const [pageStack, setPageStack] = useState([]); // ⭐ เก็บ history ย้อนกลับ
  const currentPageNumber = pageStack.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / matchesPerPage));
  const fetchMatches = async (afterDoc = null, direction = "next") => {
    setLoading(true);            // เริ่มโหลด
    setLoadingPercent(0);        // เริ่มจาก 0%
  
    let q = query(
      collection(db, "matches"),
      orderBy("createdAt", "desc"),
      ...(afterDoc ? [startAfter(afterDoc)] : []),
      limit(matchesPerPage)
    );
  
    setLoadingPercent(20);       // หลังเตรียม query
    
    const snapshot = await getDocs(q);
  
    setLoadingPercent(60);       // หลัง getDocs เสร็จ
  
    const newMatches = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  
    setLoadingPercent(80);       // หลังแปลงข้อมูล
    
    if (direction === "next") {
      setPageStack((prev) => {
        const updated = [...prev, afterDoc];
        return updated;
      });
    } else if (direction === "prev") {
      setPageStack((prev) => {
        const updated = prev.slice(0, -1);
        return updated;
      });
    } else if (direction === "goto") {
      // ไม่แก้ pageStack เพราะ set ไว้จากข้างนอก
    }
  
    setMatches(newMatches);
    
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    setLastVisible(lastDoc);
  
    setLoadingPercent(100);   // โหลดครบ
    setLoading(false);           // ปิด loading
  };
  

  const [matches, setMatches] = useState([]);
  const [playersToday, setPlayersToday] = useState([]);

  const [url, setUrl] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lockedPairs, setLockedPairs] = useState([]);
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;
  };
  const [allPlayers, setAllPlayers] = useState([]); // ⭐ เพิ่ม state เก็บ players
  useEffect(() => {
    if (loading) {
      let percent = 0;
      const interval = setInterval(() => {
        percent += Math.floor(Math.random() * 5) + 3; // เพิ่มแบบสุ่ม 3–7%
        if (percent >= 95) {
          clearInterval(interval); // อย่าถึง 100% จนโหลดเสร็จจริง
        }
        setLoadingPercent(Math.min(percent, 95));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loading]);
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snapshot) => {
      const playersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllPlayers(playersData);
    });
    return () => unsub();
  }, []);

  const router = useRouter();
  const getSkillIcon = (playerId) => {
    const player = allPlayers.find((p) => p.id === playerId);
    if (!player || !player.skillLevel) return null;
    return `/icons/${player.skillLevel}.png`; // เช่น /icons/หนอน.png
  };

  // 👉 ย้าย currentMatches เข้ามาในตัวแปรตรงนี้
  const indexOfLastMatch = currentPage * matchesPerPage;
  const indexOfFirstMatch = indexOfLastMatch - matchesPerPage;
  const currentMatches = matches.slice(indexOfFirstMatch, indexOfLastMatch);

  // ฟังก์ชันกดไปหน้า userwin
  const goToUserWin = (playerName) => {
    router.push(`/userwin/${encodeURIComponent(playerName)}`);
  };
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "locked_pairs"), (snapshot) => {
      const pairs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLockedPairs(pairs);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const fetchTotal = async () => {
      const snapshot = await getCountFromServer(collection(db, "matches"));
      setTotalMatches(snapshot.data().count);
    };

    fetchTotal();
    fetchMatches(); // โหลดหน้าแรก
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.origin + "/user");
      const toggleQR = () => setShowQR((prev) => !prev);
      window.addEventListener("toggleQR", toggleQR);
      return () => {
        window.removeEventListener("toggleQR", toggleQR);
      };
    }
  }, []);
  useEffect(() => {
    if (allPlayers.length === 0) return;

    const unsub = onSnapshot(collection(db, "playersToday"), (snapshot) => {
      if (!snapshot.empty) {
        const todayData = snapshot.docs[0].data();
        const todayIds = todayData.players || [];

        const fullPlayersToday = todayIds.map((p) => {
          const full = allPlayers.find((fp) => fp.id === p.id);
          return full ? { ...full } : p;
        });

        setPlayersToday(fullPlayersToday);
      } else {
        setPlayersToday([]);
      }
    });

    return () => unsub();
  }, [allPlayers.length]); // ✅ ใช้แค่ length ก็พอ ไม่ทำให้ error

  const orderedPlayersToday = [];
  const visited = new Set();

  playersToday.forEach((playerToday) => {
    if (!playerToday || visited.has(playerToday.id)) return;

    const lockedPair = lockedPairs.find(
      (pair) =>
        pair.player1 === playerToday.id || pair.player2 === playerToday.id
    );

    if (lockedPair) {
      const partnerId =
        lockedPair.player1 === playerToday.id
          ? lockedPair.player2
          : lockedPair.player1;
      const partner = playersToday.find((p) => p.id === partnerId);

      orderedPlayersToday.push(playerToday);
      visited.add(playerToday.id);

      if (partner && !visited.has(partner.id)) {
        orderedPlayersToday.push(partner);
        visited.add(partner.id);
      }
    } else {
      orderedPlayersToday.push(playerToday);
      visited.add(playerToday.id);
    }
  });

  const playerNumberMap = {};

  let currentNumber = 1;
  const assignedIds = new Set();

  for (const player of orderedPlayersToday) {
    if (!player || assignedIds.has(player.id)) continue;

    const lockedPair = lockedPairs.find(
      (pair) => pair.player1 === player.id || pair.player2 === player.id
    );

    if (lockedPair) {
      const partnerId =
        lockedPair.player1 === player.id
          ? lockedPair.player2
          : lockedPair.player1;
      const partner = playersToday.find((p) => p.id === partnerId);

      playerNumberMap[player.id] = currentNumber;
      assignedIds.add(player.id);

      if (partner && !assignedIds.has(partner.id)) {
        playerNumberMap[partner.id] = currentNumber;
        assignedIds.add(partner.id);
      }
    } else {
      playerNumberMap[player.id] = currentNumber;
      assignedIds.add(player.id);
    }

    currentNumber++;
  }

  const getDisplayName = (player) => {
    const lockedPair = lockedPairs.find(
      (pair) => pair.player1 === player.id || pair.player2 === player.id
    );

    if (lockedPair) {
      const partnerId =
        lockedPair.player1 === player.id
          ? lockedPair.player2
          : lockedPair.player1;
      const partner = playersToday.find((p) => p.id === partnerId);

      if (partner) {
        return `${player.name} [${partner.name}]`;
      }
    }

    return player.name;
  };
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-green-50 p-6 flex flex-col items-center">
      {/* แสดง QR ถ้ากดปุ่มใน Navbar */}
      {showQR && url && (
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={() => setShowQR(false)}
            className="mt-2 text-red-500 hover:text-red-700 text-2xl font-bold"
          >
            ปิด ❌
          </button>
          <QRCodeCanvas
            value={url}
            size={180}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
            includeMargin={true}
          />
          <p className="mt-2 text-sm text-gray-600">
            ใช้กล้องมือถือสแกน QR เพื่อเปิดหน้านี้
          </p>
        </div>
      )}
      {/* 🔥 แสดงผู้เล่นวันนี้ */}
      {playersToday.length > 0 && (
        <div className="max-w-5xl w-full mb-6">
          <h2 className="text-xl font-bold text-green-700 mb-2">
            👥 สมาชิกวันนี้
          </h2>
          <div className="flex flex-wrap gap-2">
            {orderedPlayersToday.map((p) => (
              <div key={p.id} className="flex flex-col items-center w-16">
                <img
  src={p.image}
  loading="lazy"
  className="w-12 h-12 rounded-full object-cover shadow"
  alt={p.name}
/>

                {/* 🔥 เพิ่มโชว์รูปสัตว์ข้างชื่อ */}
                <div className="flex flex-col items-center mt-1">
                  {/* รูปสัตว์ */}
                  {getSkillIcon(p.id) && (
                    <img
                      src={getSkillIcon(p.id)}
                      alt="สัตว์"
                      className="w-5 h-5 mb-1"
                    />
                  )}

                  {/* ชื่อผู้เล่น */}
                  <p className="text-xs text-center break-words">
                    {playerNumberMap[p.id]}. {getDisplayName(p)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* หัวข้อการแข่งขัน */}

      <h2 className="text-3xl font-bold text-center text-green-700 mb-8">
        🏸 การแข่งขันล่าสุด
      </h2>

      {/* แสดงรายการแมตช์ */}
      <div className="space-y-2 max-w-5xl w-full">
        {loading ? (
          <div className="flex flex-col items-center py-8 gap-2">
          <div className="h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-600 font-medium">
          เน็ตกากป่าวจ๊ะพี่... {loadingPercent}%
          </div>
        </div>
        ) : currentMatches.length === 0 ? (
          <p className="text-center text-gray-500">ยังไม่มีแมตช์ในระบบ</p>
        ) : (
          currentMatches.map((match, index) => {
            const overallIndex =
              totalMatches - ((pageStack.length - 1) * matchesPerPage + index);

            return (
              <div key={match.id} className="space-y-1">
                <div className="text-center font-bold text-green-800">
                  แมตช์ที่ {overallIndex}
                </div>

                {/* ✅ เวลาเล่น */}
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
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 mt-6">
        <button
         onClick={() => {
          const prev = pageStack[pageStack.length - 2] || null;
          fetchMatches(prev, "prev");
          setInputPage((prev) => String(Math.max(Number(prev) - 1, 1))); // ✅ ลดเลขหน้าอย่างปลอดภัย
        }}
        
          disabled={pageStack.length <= 1}
          className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm">หน้า</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={inputPage}
            onChange={(e) => {
              setInputPage(e.target.value);
            }}
            onBlur={() => {
              const val = Number(inputPage);
              if (!val || val < 1) {
                setInputPage("1");
              }
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                const page = Number(inputPage);
                if (page >= 1 && page <= totalPages) {
                  const steps = page - 1;
                  let doc = null;

                  for (let i = 0; i < steps; i++) {
                    const q = query(
                      collection(db, "matches"),
                      orderBy("createdAt", "desc"),
                      ...(doc ? [startAfter(doc)] : []),
                      limit(matchesPerPage)
                    );
                    const snapshot = await getDocs(q);
                    doc = snapshot.docs[snapshot.docs.length - 1];
                  }

                  setPageStack(
                    Array.from({ length: page }, (_, i) =>
                      i === 0 ? null : "placeholder"
                    )
                  );

                  await fetchMatches(doc, "goto");
                  setInputPage(String(page)); // ✅ ใส่ไว้หลังสุด
                } else {
                  setInputPage("1");
                }
              }
            }}
            className="w-12 px-2 py-1 rounded border text-center text-sm"
          />
          <span className="text-sm">จาก {totalPages}</span>
        </div>

        <button
          onClick={() => {
            if (lastVisible && currentPageNumber < totalPages) {
              fetchMatches(lastVisible, "next");
              setInputPage((prev) => String(Number(prev) + 1)); // ✅ update ตรงนี้แทน
            }
          }}
          disabled={currentPageNumber >= totalPages}
          className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* เวอร์ชัน */}
      <div className="w-full text-end pr-4 mt-2 text-gray-400 text-[10px]">
       อุอิอา อัปเดตล่าสุด 6/5/2025
      </div>
    </main>
  );
}
