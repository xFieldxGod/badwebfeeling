"use client";
import { useMemo, useState, useEffect, useCallback } from "react"; // รวม import Hooks ไว้ข้างบน
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDoc,
  onSnapshot, // เพิ่ม onSnapshot ถ้ายังไม่มี
} from "firebase/firestore";
import MatchCard from "../MatchCard";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  // --- 1. เรียกใช้ Hooks ทั้งหมดที่ Top Level ---

  // States
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false); // State สำหรับการยืนยันตัวตน
  const [players, setPlayers] = useState([]); // State เก็บข้อมูลผู้เล่นทั้งหมด
  const [matches, setMatches] = useState([]); // State เก็บข้อมูลแมตช์ทั้งหมด
  const [selectedPlayersToday, setSelectedPlayersToday] = useState([]); // ผู้เล่นที่เลือกสำหรับวันนี้
  const [lockedPairs, setLockedPairs] = useState([]); // คู่ที่ถูกล็อค
  const [teamA, setTeamA] = useState([]); // ผู้เล่นในทีม A ที่กำลังจะสร้างแมตช์
  const [teamB, setTeamB] = useState([]); // ผู้เล่นในทีม B ที่กำลังจะสร้างแมตช์
  const [selectedPlayer, setSelectedPlayer] = useState(null); // ผู้เล่นที่กำลังถูกเลือกเพื่อเพิ่มเข้าทีม
  const [searchTodayTerm, setSearchTodayTerm] = useState(""); // คำค้นหาผู้เล่นวันนี้
  const [openMatchId, setOpenMatchId] = useState(null); // ID ของแมตช์ที่กำลังเปิดดูรายละเอียด/ปุ่ม
  const [currentPage, setCurrentPage] = useState(1); // หน้าปัจจุบันของ Pagination
  const [addingPlayerMatchId, setAddingPlayerMatchId] = useState(null); // ID ของแมตช์ที่กำลังจะเพิ่มผู้เล่น (สำหรับ Popup)
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState(null); // ผู้เล่นที่เลือกใน Popup เพิ่ม/ย้าย
  const [now, setNow] = useState(Date.now()); // State สำหรับเวลาปัจจุบัน (ใช้แสดง timer)
  const [loadingPercent, setLoadingPercent] = useState(0); // เปอร์เซ็นต์การโหลด
  const [isUpdatingPlayerNames, setIsUpdatingPlayerNames] = useState(false); // กำลังอัปเดต playerNames?
  const [updatePlayerNamesProgress, setUpdatePlayerNamesProgress] = useState(0); // % การอัปเดต playerNames
  const [updatePlayerNamesStatus, setUpdatePlayerNamesStatus] = useState(""); // สถานะการอัปเดต playerNames
  const [hideButton, setHideButton] = useState(true); // หรือ true ถ้าต้องการซ่อน
  const [showTodayPlayers, setShowTodayPlayers] = useState(true); // State ควบคุมการแสดงผลสมาชิกวันนี้

  const matchesPerPage = 10; // จำนวนแมตช์ต่อหน้า

  // Hooks อื่นๆ
  const router = useRouter();

  // --- 2. เรียกใช้ useMemo ---

  // คำนวณจำนวนครั้งที่ชนะของผู้เล่น (อาจจะไม่จำเป็นถ้าไม่ได้แสดงผลโดยตรง)
  const winCounts = useMemo(() => {
    const counts = {};
    matches.forEach((match) => {
      if (match.status !== "finished" || !match.winner) return;
      const winnerTeam = match.winner === "A" ? match.teamA : match.teamB;
      (winnerTeam || []).forEach((player) => {
        if (player?.id) {
          counts[player.id] = (counts[player.id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [matches]);

  // เรียงลำดับผู้เล่นวันนี้ โดยให้คู่ที่ล็อคอยู่ติดกัน
  const orderedPlayersToday = useMemo(() => {
    // console.log("Recalculating orderedPlayersToday..."); // Log เพื่อดูว่าคำนวณเมื่อไหร่
    const result = [];
    const visited = new Set();
    const todayPlayerIds = new Set(
      selectedPlayersToday.map((p) => p?.id).filter(Boolean)
    ); // Set ID ผู้เล่นวันนี้

    // ใช้ players state ที่มีข้อมูลเต็ม
    players.forEach((fullPlayer) => {
      if (
        !fullPlayer ||
        !fullPlayer.id ||
        !todayPlayerIds.has(fullPlayer.id) ||
        visited.has(fullPlayer.id)
      )
        return; // เช็คว่าอยู่ใน selectedPlayersToday ด้วย

      const lockedPair = lockedPairs.find(
        (pair) =>
          pair.player1 === fullPlayer.id || pair.player2 === fullPlayer.id
      );

      if (lockedPair) {
        const partnerId =
          lockedPair.player1 === fullPlayer.id
            ? lockedPair.player2
            : lockedPair.player1;
        // หา partner จาก players state และเช็คว่าอยู่ใน selectedPlayersToday ด้วย
        const partner = players.find((p) => p.id === partnerId);
        const isPartnerToday = partner && todayPlayerIds.has(partner.id);

        result.push(fullPlayer);
        visited.add(fullPlayer.id);

        if (partner && isPartnerToday && !visited.has(partner.id)) {
          result.push(partner);
          visited.add(partner.id);
        }
      } else {
        result.push(fullPlayer);
        visited.add(fullPlayer.id);
      }
    });

    // เพิ่มผู้เล่นวันนี้ที่ยังไม่ได้ถูกเพิ่ม (กรณีไม่มีคู่ล็อค หรือคู่ล็อคไม่อยู่ในวันนี้)
    selectedPlayersToday.forEach((playerToday) => {
      const fullPlayer = players.find((p) => p.id === playerToday.id);
      if (fullPlayer && !visited.has(fullPlayer.id)) {
        result.push(fullPlayer);
        visited.add(fullPlayer.id);
      }
    });

    // console.log("Ordered Players Today:", result.map(p => p.name));
    return result;
  }, [selectedPlayersToday, players, lockedPairs]); // Dependencies ถูกต้อง

  // สร้าง Map ลำดับเลขของผู้เล่น
  const playerNumberMap = useMemo(() => {
    // console.log("Recalculating playerNumberMap..."); // Log เพื่อดูว่าคำนวณเมื่อไหร่
    const map = {};
    let currentNumber = 1;
    const assignedIds = new Set();

    // ใช้ orderedPlayersToday ที่คำนวณไว้แล้ว
    orderedPlayersToday.forEach((fullPlayer) => {
      if (!fullPlayer || !fullPlayer.id || assignedIds.has(fullPlayer.id))
        return;

      const lockedPair = lockedPairs.find(
        (pair) =>
          pair.player1 === fullPlayer.id || pair.player2 === fullPlayer.id
      );

      if (lockedPair) {
        const partnerId =
          lockedPair.player1 === fullPlayer.id
            ? lockedPair.player2
            : lockedPair.player1;
        // หา partner จาก orderedPlayersToday เพื่อความแน่ใจ
        const partner = orderedPlayersToday.find((p) => p.id === partnerId);

        map[fullPlayer.id] = currentNumber;
        assignedIds.add(fullPlayer.id);

        if (partner && !assignedIds.has(partner.id)) {
          map[partner.id] = currentNumber;
          assignedIds.add(partner.id);
        }
      } else {
        map[fullPlayer.id] = currentNumber;
        assignedIds.add(fullPlayer.id);
      }
      currentNumber++;
    });
    // console.log("Player Number Map:", map);
    return map;
  }, [orderedPlayersToday, lockedPairs]); // Dependency ถูกต้อง

  // --- 3. เรียกใช้ useEffect ---

  // useEffect สำหรับอัปเดตเวลา 'now'
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // useEffect สำหรับการยืนยันตัวตน
  useEffect(() => {
    const checkAuth = async () => {
      if (sessionStorage.getItem("adminAuthenticated") === "true") {
        setAuthorized(true);
        return;
      }
      // ... (ส่วน prompt รหัสผ่าน เหมือนเดิม) ...
      try {
        let attempts = 0;
        const maxAttempts = 3;
        let authenticated = false;
        while (!authenticated && attempts < maxAttempts) {
          const password = prompt(
            attempts === 0
              ? "กรุณาใส่รหัสผ่านเพื่อเข้า Admin:"
              : `รหัสผ่านไม่ถูกต้อง (เหลือโอกาส ${
                  maxAttempts - attempts
                } ครั้ง):`
          );
          if (password === null) {
            alert("การเข้าสู่ระบบถูกยกเลิก");
            await router.replace("/user");
            return;
          }
          if (password === "1234") {
            sessionStorage.setItem("adminAuthenticated", "true");
            setAuthorized(true);
            authenticated = true;
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              alert("⚠️ กรอกผิดเกินจำนวนครั้งที่กำหนด");
              await router.replace("/user");
            }
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
        router.replace("/user");
      }
    };
    checkAuth();
  }, [router]); // ใส่ router เป็น dependency

  // useEffect สำหรับแสดง % การโหลด
  useEffect(() => {
    let intervalId;
    if (loading) {
      let percent = 0;
      intervalId = setInterval(() => {
        percent += Math.floor(Math.random() * 5) + 3;
        if (percent >= 95) {
          percent = 95; // ค้างไว้ที่ 95 ถ้ายังโหลดไม่เสร็จจริง
          // clearInterval(intervalId); // ไม่ควร clear ที่นี่ เพราะอาจจะยังโหลดไม่เสร็จ
        }
        setLoadingPercent(percent);
      }, 150); // หน่วงเวลาเพิ่มเล็กน้อย
    } else {
      setLoadingPercent(100); // ถ้าโหลดเสร็จแล้ว ให้เป็น 100
    }
    // Cleanup function จะทำงานเมื่อ loading เปลี่ยนค่า หรือ component unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loading]);

  // useEffect สำหรับดึงข้อมูลเริ่มต้น (เมื่อ authorized แล้ว)
  useEffect(() => {
    if (!authorized) return; // รอให้ authorized ก่อน

    console.log("Fetching initial data (players, today, locked, matches)...");

    // ใช้ onSnapshot เพื่อ real-time update
    const unsubPlayers = onSnapshot(
      collection(db, "players"),
      (snapshot) => {
        const playerList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPlayers(playerList);
        // console.log("Players updated:", playerList.length);
      },
      (error) => console.error("Error fetching players:", error)
    );

    const unsubToday = onSnapshot(
      collection(db, "playersToday"),
      (snapshot) => {
        if (!snapshot.empty) {
          const todayData = snapshot.docs[0].data();
          const validPlayersToday = (todayData.players || []).filter(
            (p) => p && p.id
          );
          setSelectedPlayersToday(validPlayersToday);
          // console.log("PlayersToday updated:", validPlayersToday.length);
        } else {
          setSelectedPlayersToday([]);
          // console.log("PlayersToday cleared.");
        }
      },
      (error) => console.error("Error fetching playersToday:", error)
    );

    const unsubLocked = onSnapshot(
      collection(db, "locked_pairs"),
      (snapshot) => {
        const pairs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLockedPairs(pairs);
        // console.log("LockedPairs updated:", pairs.length);
      },
      (error) => console.error("Error fetching lockedPairs:", error)
    );

    const unsubMatches = onSnapshot(
      query(collection(db, "matches"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const matchList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMatches(matchList);
        setLoading(false); // ตั้งค่า loading เป็น false เมื่อได้ข้อมูลแมตช์ครั้งแรก
        // console.log("Matches updated:", matchList.length);
      },
      (error) => {
        console.error("Error fetching matches:", error);
        setLoading(false); // หยุด loading ถ้า error
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลแมตช์");
      }
    );

    // Cleanup function
    return () => {
      console.log("Cleaning up initial data listeners.");
      unsubPlayers();
      unsubToday();
      unsubLocked();
      unsubMatches();
    };
  }, [authorized]); // ทำงานเมื่อ authorized เป็น true

  // --- 4. ฟังก์ชัน Helpers และ Handlers (ประกาศหลัง Hooks) ---

  const formatDuration = useCallback((seconds) => {
    if (isNaN(seconds) || seconds < 0) return "N/A"; // Handle invalid input
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;
  }, []); // ไม่ขึ้นกับ state ใดๆ

  const getSkillIcon = useCallback(
    (playerId) => {
      const player = players.find((p) => p.id === playerId);
      return player?.skillLevel ? `/icons/${player.skillLevel}.png` : null;
    },
    [players]
  ); // ขึ้นอยู่กับ players

  const getPlayerNameWithPartner = useCallback(
    (player) => {
      if (!player?.id) return "";
      const number = playerNumberMap[player.id];
      const lockedPair = lockedPairs.find(
        (p) => p.player1 === player.id || p.player2 === player.id
      );
      if (!lockedPair)
        return `${number ? number + ". " : ""}${player.name || ""}`;
      const partnerId =
        lockedPair.player1 === player.id
          ? lockedPair.player2
          : lockedPair.player1;
      const partner = players.find((p) => p.id === partnerId);
      return `${number ? number + ". " : ""}${player.name || ""}${
        partner ? ` [${partner.name || ""}]` : ""
      }`;
    },
    [playerNumberMap, lockedPairs, players]
  ); // ขึ้นอยู่กับ state เหล่านี้

  const isPlayerInTeam = useCallback(
    (player) => {
      if (!player) return false;
      return (
        teamA.some((p) => p?.id === player.id) ||
        teamB.some((p) => p?.id === player.id)
      );
    },
    [teamA, teamB]
  ); // ขึ้นอยู่กับ teamA, teamB

  // --- Handlers (ใช้ useCallback ตามความเหมาะสม) ---

  const handleSwapTeamsBetweenMatches = useCallback(async (match1, match2) => {
    try {
      await updateDoc(doc(db, "matches", match1.id), {
        teamA: match2.teamA || [],
        teamB: match2.teamB || [],
        playerNames: [
          ...(match2.teamA || []).map((p) => p.name),
          ...(match2.teamB || []).map((p) => p.name),
        ].filter(Boolean),
      });
      await updateDoc(doc(db, "matches", match2.id), {
        teamA: match1.teamA || [],
        teamB: match1.teamB || [],
        playerNames: [
          ...(match1.teamA || []).map((p) => p.name),
          ...(match1.teamB || []).map((p) => p.name),
        ].filter(Boolean),
      });
      alert("✅ สลับทีมเรียบร้อย!");
    } catch (err) {
      console.error("❌ Error swapping teams:", err);
      alert("เกิดข้อผิดพลาดในการสลับทีม");
    }
  }, []);

  const handleAdvanceIfEligible = useCallback(async (fromMatch, nextMatch) => {
    try {
      if (fromMatch.winner === "") {
        alert("ยังไม่มีผู้ชนะ");
        return;
      }
      if (!confirm("ต้องการส่งผู้ชนะไปทีมถัดไปหรือไม่?")) {
        return;
      }
      const winnerTeam =
        fromMatch.winner === "A" ? fromMatch.teamA : fromMatch.teamB;
      const nextTeam = [...(nextMatch.teamA || []), ...(nextMatch.teamB || [])];
      if (winnerTeam.length !== 2 || nextTeam.length !== 2) {
        alert("ทั้งสองแมตต้องมีผู้เล่นครบ 2 คน");
        return;
      }
      const allPlayerNames = [
        ...winnerTeam.map((p) => p.name),
        ...nextTeam.map((p) => p.name),
      ].filter(Boolean);
      const newMatch = {
        teamA: winnerTeam,
        teamB: nextTeam,
        playerNames: allPlayerNames,
        winner: "",
        status: "waiting",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "matches"), newMatch);
      alert("สร้างแมตช์รอบถัดไปสำเร็จ!");
    } catch (err) {
      console.error("Error advancing team:", err);
      alert("เกิดปัญหาในการส่งทีมไปแข่งต่อ");
    }
  }, []);

  const handleMovePlayersIntoMatch = useCallback(async (fromMatch, toMatch) => {
    try {
      const playersFrom = [
        ...(fromMatch.teamA || []),
        ...(fromMatch.teamB || []),
      ];
      const playersTo = [...(toMatch.teamA || []), ...(toMatch.teamB || [])];
      if (
        playersFrom.length === 2 &&
        playersTo.length === 2 &&
        fromMatch.status === "waiting" &&
        toMatch.status === "waiting"
      ) {
        const newPlayerNames = [
          ...playersFrom.map((p) => p.name),
          ...playersTo.map((p) => p.name),
        ].filter(Boolean);
        await updateDoc(doc(db, "matches", toMatch.id), {
          teamA: playersFrom,
          teamB: playersTo,
          playerNames: newPlayerNames,
          winner: "",
          status: "waiting",
        });
        await deleteDoc(doc(db, "matches", fromMatch.id));
        alert("ย้ายผู้เล่นสำเร็จแล้ว!");
      } else {
        alert("ต้องเป็นแมตที่รอเล่นและมี 2 คนเท่านั้นถึงจะย้ายได้");
      }
    } catch (err) {
      console.error("Error moving players into match:", err);
      alert("เกิดข้อผิดพลาดในการย้ายผู้เล่น");
    }
  }, []);

  const handleResetMatch = useCallback(async (matchId) => {
    try {
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        winner: "",
        status: "waiting",
        startTime: null,
        endTime: null,
      });
      alert("รีเซ็ตผลเรียบร้อย!");
    } catch (err) {
      console.error("Error resetting match:", err);
      alert("เกิดข้อผิดพลาดในการรีเซ็ตผล");
    }
  }, []);

  const handleAddPlayerToMatch = useCallback(
    async (player, team) => {
      if (!addingPlayerMatchId) return;
      const matchRef = doc(db, "matches", addingPlayerMatchId);
      try {
        const matchSnapshot = await getDoc(matchRef);
        if (!matchSnapshot.exists()) {
          alert("ไม่พบแมตช์");
          return;
        }
        const matchData = matchSnapshot.data();
        let updatedTeamA = matchData.teamA || [];
        let updatedTeamB = matchData.teamB || [];
        const isInTeamA = updatedTeamA.some((p) => p.id === player.id);
        const isInTeamB = updatedTeamB.some((p) => p.id === player.id);
        const teamASize = updatedTeamA.length;
        const teamBSize = updatedTeamB.length;
        if (team === "A" && !isInTeamA && teamASize >= 2) {
          alert("ทีม A ครบแล้ว");
          return;
        }
        if (team === "B" && !isInTeamB && teamBSize >= 2) {
          alert("ทีม B ครบแล้ว");
          return;
        }
        if (isInTeamA && team === "B") {
          if (teamBSize >= 2) {
            alert("ทีม B ครบแล้ว");
            return;
          }
          updatedTeamA = updatedTeamA.filter((p) => p.id !== player.id);
          updatedTeamB.push(player);
        } else if (isInTeamB && team === "A") {
          if (teamASize >= 2) {
            alert("ทีม A ครบแล้ว");
            return;
          }
          updatedTeamB = updatedTeamB.filter((p) => p.id !== player.id);
          updatedTeamA.push(player);
        } else if (!isInTeamA && !isInTeamB) {
          if (team === "A") updatedTeamA.push(player);
          else updatedTeamB.push(player);
        } else {
          return;
        }
        const newPlayerNames = [
          ...updatedTeamA.map((p) => p.name),
          ...updatedTeamB.map((p) => p.name),
        ].filter(Boolean);
        await updateDoc(matchRef, {
          teamA: updatedTeamA,
          teamB: updatedTeamB,
          playerNames: newPlayerNames,
        });
        setSelectedPlayerToAdd(null);
      } catch (err) {
        console.error("Error adding player to match:", err);
        alert("เกิดข้อผิดพลาด");
      }
    },
    [addingPlayerMatchId]
  );

  const handleRemovePlayerFromMatch = useCallback(
    async (player) => {
      if (!addingPlayerMatchId) return;
      const matchRef = doc(db, "matches", addingPlayerMatchId);
      try {
        const matchSnapshot = await getDoc(matchRef);
        if (!matchSnapshot.exists()) {
          alert("ไม่พบแมตช์");
          return;
        }
        const matchData = matchSnapshot.data();
        let updatedTeamA = (matchData.teamA || []).filter(
          (p) => p.id !== player.id
        );
        let updatedTeamB = (matchData.teamB || []).filter(
          (p) => p.id !== player.id
        );
        const newPlayerNames = [
          ...updatedTeamA.map((p) => p.name),
          ...updatedTeamB.map((p) => p.name),
        ].filter(Boolean);
        await updateDoc(matchRef, {
          teamA: updatedTeamA,
          teamB: updatedTeamB,
          playerNames: newPlayerNames,
        });
        setSelectedPlayerToAdd(null);
      } catch (err) {
        console.error("Error removing player from match:", err);
        alert("เกิดข้อผิดพลาด");
      }
    },
    [addingPlayerMatchId]
  );

  const handleAddToTeam = useCallback(
    (team) => {
      if (!selectedPlayer) return;
      const lockedPair = lockedPairs.find(
        (p) =>
          p.player1 === selectedPlayer.id || p.player2 === selectedPlayer.id
      );
      let playersToAdd = [];
      if (lockedPair) {
        const p1 = players.find((p) => p.id === lockedPair.player1);
        const p2 = players.find((p) => p.id === lockedPair.player2);
        const isP1Today = selectedPlayersToday.some((pt) => pt.id === p1?.id);
        const isP2Today = selectedPlayersToday.some((pt) => pt.id === p2?.id);
        if (p1 && isP1Today && !isPlayerInTeam(p1)) playersToAdd.push(p1);
        if (p2 && isP2Today && !isPlayerInTeam(p2)) playersToAdd.push(p2);
      } else {
        if (!isPlayerInTeam(selectedPlayer)) playersToAdd.push(selectedPlayer);
      }
      if (team === "A" && teamA.length + playersToAdd.length <= 2)
        setTeamA((prev) => [...prev, ...playersToAdd]);
      else if (team === "B" && teamB.length + playersToAdd.length <= 2)
        setTeamB((prev) => [...prev, ...playersToAdd]);
      else alert("ทีมเต็มแล้ว");
      setSelectedPlayer(null);
    },
    [
      selectedPlayer,
      lockedPairs,
      players,
      selectedPlayersToday,
      isPlayerInTeam,
      teamA,
      teamB,
    ]
  );

  const handleAddMatch = useCallback(async () => {
    if (teamA.length === 0 && teamB.length === 0) {
      alert("ต้องมีผู้เล่นอย่างน้อย 1 คน");
      return;
    }
    const allPlayerNames = [
      ...teamA.map((p) => p.name),
      ...teamB.map((p) => p.name),
    ].filter(Boolean);
    const newMatch = {
      teamA,
      teamB,
      playerNames: allPlayerNames,
      winner: "",
      status: "waiting",
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, "matches"), newMatch);
      alert("เพิ่มแมตช์สำเร็จ!");
      setTeamA([]);
      setTeamB([]);
    } catch (err) {
      console.error("Error adding match:", err);
      alert("เกิดข้อผิดพลาด");
    }
  }, [teamA, teamB]);

  const handleClearPlayersToday = useCallback(async () => {
    if (!confirm("แน่ใจว่าต้องการล้างผู้เล่นวันนี้?")) return;
    try {
      const qSnap = await getDocs(collection(db, "playersToday"));
      if (!qSnap.empty) await updateDoc(qSnap.docs[0].ref, { players: [] });
      setSelectedPlayersToday([]);
      alert("ล้างผู้เล่นวันนี้เรียบร้อย!");
    } catch (err) {
      console.error("Error clearing players today:", err);
      alert("เกิดข้อผิดพลาด");
    }
  }, []);

  const handleClearMatches = useCallback(async () => {
    const playingCount = matches.filter((m) => m.status === "playing").length;
    const confirmMsg =
      playingCount > 0
        ? `มี ${playingCount} แมตช์กำลังเล่นอยู่ แน่ใจว่าต้องการลบแมตช์ทั้งหมด?`
        : "แน่ใจว่าต้องการลบแมตช์ทั้งหมด?";
    if (!confirm(confirmMsg)) return;
    try {
      const qSnap = await getDocs(collection(db, "matches"));
      const deletePromises = qSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      alert("ลบแมตช์ทั้งหมดเรียบร้อย!");
    } catch (err) {
      console.error("Error clearing matches:", err);
      alert("เกิดข้อผิดพลาด");
    }
  }, [matches]);

  const setWinner = useCallback(async (matchId, winner) => {
    const matchRef = doc(db, "matches", matchId);
    try {
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists() || matchSnap.data().status !== "playing") {
        alert("ไม่สามารถกำหนดผู้ชนะได้ (แมตช์ไม่พบ หรือไม่ได้กำลังเล่น)");
        return;
      }
      await updateDoc(matchRef, {
        winner,
        status: "finished",
        endTime: new Date(),
      });
    } catch (err) {
      console.error("Error setting winner:", err);
      alert("เกิดข้อผิดพลาด");
    }
  }, []);

  const handleRemoveFromTeam = useCallback((playerName) => {
    setTeamA((prev) => prev.filter((p) => p.name !== playerName));
    setTeamB((prev) => prev.filter((p) => p.name !== playerName));
  }, []);

  const handleDeleteMatch = useCallback(
    async (matchId) => {
      const matchToDelete = matches.find((m) => m.id === matchId);
      const confirmMsg =
        matchToDelete?.status === "playing"
          ? "แมตช์นี้กำลังเล่นอยู่ แน่ใจว่าต้องการลบ?"
          : "แน่ใจว่าต้องการลบแมตช์นี้?";
      if (!confirm(confirmMsg)) return;
      try {
        await deleteDoc(doc(db, "matches", matchId));
      } catch (err) {
        console.error("Error deleting match:", err);
        alert("เกิดข้อผิดพลาด");
      }
    },
    [matches]
  );

  const togglePlayStatus = useCallback(async (matchId, currentStatus) => {
    const matchRef = doc(db, "matches", matchId);
    try {
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists()) {
        alert("ไม่พบแมตช์");
        return;
      }
      const matchData = matchSnap.data();
      const newStatus = currentStatus === "waiting" ? "playing" : "waiting";
      const updateData = { status: newStatus };
      if (newStatus === "playing" && !matchData.startTime)
        updateData.startTime = new Date();
      // if (newStatus === 'waiting') { updateData.startTime = null; updateData.endTime = null; } // Optional reset
      await updateDoc(matchRef, updateData);
    } catch (err) {
      console.error("Error toggling play status:", err);
      alert("เกิดข้อผิดพลาด");
    }
  }, []);

  const handleSendWinnerToNextMatch = useCallback(
    async (fromMatch) => {
      try {
        if (!fromMatch || fromMatch.winner === "") {
          alert("ยังไม่มีทีมชนะ");
          return;
        }
        const winnerTeam =
          fromMatch.winner === "A" ? fromMatch.teamA : fromMatch.teamB;
        if (!winnerTeam || winnerTeam.length !== 2) {
          alert("ทีมชนะต้องมี 2 คน");
          return;
        }

        const currentMatchIndex = matches.findIndex(
          (m) => m.id === fromMatch.id
        );
        if (currentMatchIndex === -1) return;

        const nextWaitingMatchIndex = matches.findIndex(
          (m, idx) =>
            idx > currentMatchIndex &&
            m.status === "waiting" &&
            ((m.teamA || []).length < 2 || (m.teamB || []).length < 2)
        );

        let nextMatch = null;
        let targetMatchNumber = matches.length + 1;

        if (nextWaitingMatchIndex !== -1) {
          nextMatch = matches[nextWaitingMatchIndex];
          targetMatchNumber = matches.length - nextWaitingMatchIndex;
        }

        const confirmMove = confirm(
          `ส่งทีมชนะไปแมต ${nextMatch ? `ที่ ${targetMatchNumber}` : "ใหม่"}?`
        );
        if (!confirmMove) return;

        if (!nextMatch) {
          const allPlayerNames = [...winnerTeam.map((p) => p.name)].filter(
            Boolean
          );
          await addDoc(collection(db, "matches"), {
            teamA: winnerTeam,
            teamB: [],
            playerNames: allPlayerNames,
            winner: "",
            status: "waiting",
            createdAt: serverTimestamp(),
          });
          alert(`สร้างแมตใหม่เรียบร้อย`);
        } else {
          const nextMatchRef = doc(db, "matches", nextMatch.id);
          const currentTeamA = nextMatch.teamA || [];
          const currentTeamB = nextMatch.teamB || [];
          let updateData = {};
          let targetTeam = "";
          if (currentTeamA.length < 2) {
            updateData.teamA = [...currentTeamA, ...winnerTeam];
            targetTeam = "A";
          } else if (currentTeamB.length < 2) {
            updateData.teamB = [...currentTeamB, ...winnerTeam];
            targetTeam = "B";
          } else {
            alert(`แมต ${targetMatchNumber} เต็ม`);
            return;
          }
          const finalTeamA = updateData.teamA || currentTeamA;
          const finalTeamB = updateData.teamB || currentTeamB;
          updateData.playerNames = [
            ...finalTeamA.map((p) => p.name),
            ...finalTeamB.map((p) => p.name),
          ].filter(Boolean);
          updateData.status = "waiting";
          updateData.winner = "";
          await updateDoc(nextMatchRef, updateData);
          alert(
            `ส่งทีมชนะไปทีม ${targetTeam} ของแมต ${targetMatchNumber} แล้ว`
          );
        }
      } catch (err) {
        console.error("❌ Error sending winner:", err);
        alert("เกิดข้อผิดพลาด");
      }
    },
    [matches]
  );

  // --- ฟังก์ชันอัปเดต playerNames ---
  const handleUpdateMissingPlayerNames = useCallback(async () => {
    if (
      !confirm(
        "ต้องการเริ่มอัปเดต field 'playerNames' ให้กับแมตช์เก่าทั้งหมดหรือไม่? (อาจใช้เวลาสักครู่และมีค่าใช้จ่าย Firestore)"
      )
    )
      return;
    setIsUpdatingPlayerNames(true);
    setUpdatePlayerNamesProgress(0);
    setUpdatePlayerNamesStatus("กำลังดึงข้อมูลแมตช์ทั้งหมด...");
    try {
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      const totalMatches = matchesSnapshot.docs.length;
      let updatedCount = 0,
        skippedCount = 0,
        errorCount = 0;
      setUpdatePlayerNamesStatus(
        `พบ ${totalMatches} แมตช์, กำลังเริ่มอัปเดต...`
      );
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        const matchId = matchDoc.id;
        if (matchData.playerNames && Array.isArray(matchData.playerNames)) {
          skippedCount++;
        } else {
          const teamA = matchData.teamA || [];
          const teamB = matchData.teamB || [];
          const newPlayerNames = [
            ...teamA.map((p) => p?.name).filter(Boolean),
            ...teamB.map((p) => p?.name).filter(Boolean),
          ];
          try {
            await updateDoc(doc(db, "matches", matchId), {
              playerNames: newPlayerNames,
            });
            updatedCount++;
          } catch (updateError) {
            console.error(`Error updating match ${matchId}:`, updateError);
            errorCount++;
          }
          await delay(50);
        }
        const currentProgress = Math.round(
          ((updatedCount + skippedCount + errorCount) / totalMatches) * 100
        );
        setUpdatePlayerNamesProgress(currentProgress);
        setUpdatePlayerNamesStatus(
          `กำลังอัปเดต... ${updatedCount} สำเร็จ, ${errorCount} ผิดพลาด (${
            updatedCount + skippedCount + errorCount
          }/${totalMatches})`
        );
      }
      const finalMessage = `อัปเดตเสร็จสิ้น! อัปเดต ${updatedCount} แมตช์, ข้าม ${skippedCount} แมตช์, ผิดพลาด ${errorCount} แมตช์.`;
      setUpdatePlayerNamesStatus(finalMessage);
      alert(finalMessage);
    } catch (error) {
      console.error("Error updating playerNames:", error);
      const errMsg = `เกิดข้อผิดพลาด: ${error.message}`;
      setUpdatePlayerNamesStatus(errMsg);
      alert(errMsg);
    } finally {
      setIsUpdatingPlayerNames(false);
    }
  }, []);

  // --- 5. เงื่อนไขการ Return ---
  if (!authorized) {
    return (
      <div className="text-center p-10 text-xl text-red-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="h-10 w-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-gray-600 font-medium">
          กำลังโหลดข้อมูล Admin... {loadingPercent}%
        </div>
      </div>
    );
  }

  // --- 6. Return JSX หลัก ---
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-6">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">
        🏸 จัดการแมตช์ (Admin)
      </h1>

      {/* แสดง Team A/B */}
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A */}
        <div>
          <h2 className="text-xl font-bold text-blue-700 mb-2">
            ทีม A ({teamA.length}/2)
          </h2>
          {teamA.length === 0 && (
            <p className="text-gray-500">ยังไม่มีผู้เล่น</p>
          )}
          {teamA.map((p) => (
            <div key={p.id || p.name} className="flex items-center gap-2 mb-2">
              <img
                src={p.image || "/default-avatar.png"}
                loading="lazy"
                alt={p.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="truncate flex-1">{p.name}</span>
              <button
                onClick={() => handleRemoveFromTeam(p.name)}
                className="text-sm text-red-600 ml-2 flex-shrink-0"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
        {/* Team B */}
        <div>
          <h2 className="text-xl font-bold text-yellow-700 mb-2">
            ทีม B ({teamB.length}/2)
          </h2>
          {teamB.length === 0 && (
            <p className="text-gray-500">ยังไม่มีผู้เล่น</p>
          )}
          {teamB.map((p) => (
            <div key={p.id || p.name} className="flex items-center gap-2 mb-2">
              <img
                src={p.image || "/default-avatar.png"}
                loading="lazy"
                alt={p.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="truncate flex-1">{p.name}</span>
              <button
                onClick={() => handleRemoveFromTeam(p.name)}
                className="text-sm text-red-600 ml-2 flex-shrink-0"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      </div>
{/* ปุ่มเปิด/ปิด สมาชิกวันนี้ (แบบไอคอน) */}
<div className="flex justify-center mb-4">
  <button
    onClick={() => setShowTodayPlayers(!showTodayPlayers)}
    className="p-2 rounded-full hover:bg-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
    aria-label={showTodayPlayers ? "ซ่อนสมาชิกวันนี้" : "แสดงสมาชิกวันนี้"}
  >
    {showTodayPlayers ? (
      // ไอคอนลูกศรชี้ขึ้น (ซ่อน)
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
      </svg>
    ) : (
      // ไอคอนลูกศรชี้ลง (แสดง)
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    )}
  </button>
</div>
      {/* Search Today's Players (จะแสดง/ซ่อนตาม showTodayPlayers) */}
{showTodayPlayers && ( // <-- เพิ่มบรรทัดนี้
  <div className="flex justify-center mb-4">
    <input
      type="text"
      placeholder="🔍 ค้นหาสมาชิกวันนี้..."
      value={searchTodayTerm}
      onChange={(e) => setSearchTodayTerm(e.target.value)}
      className="border px-3 py-1.5 rounded-md text-sm w-64 shadow-sm focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
)} {/* <-- เพิ่มบรรทัดนี้ */}

      {/* เลือกผู้เล่น (จะแสดง/ซ่อนตาม showTodayPlayers) */}
 {showTodayPlayers && (
      <div className="max-w-5xl mx-auto grid grid-cols-5 gap-x-2 gap-y-4 justify-items-center mb-6">
        {orderedPlayersToday
          .filter((fp) =>
            fp?.name?.toLowerCase().includes(searchTodayTerm.toLowerCase())
          )
          .map((fullPlayer) => {
            if (!fullPlayer?.id) return null;
            const isUsed = isPlayerInTeam(fullPlayer);
            const isSelected = selectedPlayer?.id === fullPlayer.id;
            return (
              <div
                key={fullPlayer.id}
                className="flex flex-col items-center w-20 text-center"
              >
                {/* Div หลักที่ครอบรูปและชื่อ/ไอคอน */}
                <div
                  onClick={() => !isUsed && setSelectedPlayer(fullPlayer)}
                  className={`flex flex-col items-center p-1.5 rounded-lg transition-all duration-200 w-full ${
                    isUsed
                      ? "opacity-40 pointer-events-none bg-gray-100"
                      : "hover:scale-105 cursor-pointer hover:bg-blue-50"
                  } ${isSelected ? "scale-105" : ""}`}
                >
                  <img
                    src={fullPlayer.image || "/default-avatar.png"}
                    loading="lazy"
                    alt={fullPlayer.name || "Player"}
                    // --- ลบ mb-1 ออก ---
                    className="w-14 h-14 rounded-full object-cover shadow-md"
                  />
                  {/* Div ครอบไอคอนและชื่อ */}
                  {/* --- ลบ h-12 และเพิ่ม mt-1 --- */}
                  <div className="flex flex-col items-center justify-start w-full gap-0.5 mt-1">
                    {getSkillIcon(fullPlayer.id) && (
                      <img
                        src={getSkillIcon(fullPlayer.id)}
                        alt="Skill"
                        className="w-5 h-5 object-contain flex-shrink-0"
                      />
                    )}
                    <p className="font-medium text-gray-700 text-[10px] leading-tight w-full break-words px-1 line-clamp-2">
                      {getPlayerNameWithPartner(fullPlayer)}
                    </p>
                  </div>
                </div>

                {/* Div ครอบปุ่ม A, B, X */}
                {isSelected && !isUsed && (
                  // --- เพิ่ม mt-1 เพื่อให้มีช่องว่างเล็กน้อยใต้ชื่อ ---
                  <div className="flex flex-row items-center justify-center space-x-1 w-full mt-1">
                    <button
                      onClick={() => handleAddToTeam("A")}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] px-1 py-0.5 rounded-full"
                      title="เพิ่มเข้าทีม A"
                    >
                      A
                    </button>
                    <button
                      onClick={() => handleAddToTeam("B")}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-[9px] px-1 py-0.5 rounded-full"
                      title="เพิ่มเข้าทีม B"
                    >
                      B
                    </button>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="flex-shrink-0 bg-gray-400 hover:bg-gray-500 text-white text-[9px] px-1 py-0.5 rounded-full"
                      title="ยกเลิก"
                    >
                      ❌
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
)}
      {/* ปุ่มจัดการหลัก + ปุ่มยต playerNames */}
      <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-5xl mx-auto items-start">
        {" "}
        {/* Use items-start */}
        <button
          onClick={() => router.push("/players")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          ➕ จัดการผู้เล่น
        </button>
        <button
          onClick={handleAddMatch}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          ➕ เพิ่มแมตช์
        </button>
        <button
          onClick={handleClearPlayersToday}
          className="bg-red-400 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          🧹 ล้างผู้เล่นวันนี้
        </button>
        <button
          onClick={handleClearMatches}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          🗑️ ลบแมตช์ทั้งหมด
        </button>
        <button
          onClick={() => router.push("/user")}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          👀 ไปหน้า User
        </button>
        <button
          onClick={() => router.push("/admin/skill")}
          className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors"
        >
          🦄 ตั้งระดับสัตว์
        </button>
        {/* --- ปุ่มสำหรับอัปเดต playerNames --- */}
        <div
          className={`w-full sm:w-auto flex flex-col items-center gap-1 mt-2 sm:mt-0 ${
            hideButton ? "hidden" : "" // เพิ่มเงื่อนไขตรงนี้
          }`}
        >
          <button
            onClick={handleUpdateMissingPlayerNames}
            disabled={isUpdatingPlayerNames}
            className={`w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow transition-colors ${
              isUpdatingPlayerNames ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isUpdatingPlayerNames
              ? `⏳ กำลังอัปเดต (${updatePlayerNamesProgress}%)`
              : "🛠️ อัปเดต playerNames เก่า"}
          </button>
          {isUpdatingPlayerNames && (
            <p className="text-xs text-orange-700 mt-1">
              {updatePlayerNamesStatus}
            </p>
          )}
        </div>
        {/* --- จบส่วนปุ่มอัปเดต --- */}
      </div>

      {/* แสดงแมตช์ */}
      <div id="popup-anchor" className="h-1"></div>
      <div className="max-w-5xl mx-auto w-full">
        {/* Popup เพิ่มผู้เล่น */}
        {addingPlayerMatchId && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-4 md:p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl transform transition-transform duration-300 scale-100 animate-popup">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold text-center text-yellow-700 flex-1">
                  ➕ เพิ่ม/ย้ายผู้เล่นในแมตช์
                </h2>
                <button
                  onClick={() => setAddingPlayerMatchId(null)}
                  className="text-gray-500 hover:text-red-600 text-2xl"
                >
                  &times;
                </button>
              </div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 ค้นหาผู้เล่น..."
                  // ใช้ state แยกสำหรับ popup search หรือใช้ searchTodayTerm ก็ได้
                  onChange={(e) => setSearchTodayTerm(e.target.value)}
                  className="border px-3 py-1.5 rounded-md text-sm w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                {selectedPlayersToday
                  .filter((player) =>
                    player?.name
                      ?.toLowerCase()
                      .includes(searchTodayTerm.toLowerCase())
                  )
                  .map((playerToday) => {
                    const fullPlayer = players.find(
                      (p) => p.id === playerToday.id
                    );
                    if (!fullPlayer) return null;
                    const isSelected =
                      selectedPlayerToAdd?.id === fullPlayer.id;
                    return (
                      <div
                        key={fullPlayer.id}
                        className="flex flex-col items-center w-full"
                      >
                        <div
                          onClick={() => setSelectedPlayerToAdd(fullPlayer)}
                          className={`cursor-pointer hover:scale-105 transition-all p-1 rounded-lg ${
                            isSelected ? "ring-2 ring-green-400" : ""
                          }`}
                        >
                          <img
                            src={fullPlayer.image || "/default-avatar.png"}
                            loading="lazy"
                            alt={fullPlayer.name}
                            className="w-14 h-14 rounded-full object-cover shadow-lg border border-gray-200"
                          />
                          <p className="text-xs font-medium mt-1 text-center truncate w-full px-1">
                            {fullPlayer.name}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="flex flex-col sm:flex-row flex-wrap gap-1 mt-1.5 justify-center items-center w-full">
                            <button
                              onClick={() =>
                                handleAddPlayerToMatch(fullPlayer, "A")
                              }
                              className="flex-1 min-w-[50px] h-6 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-semibold rounded flex items-center justify-center px-1"
                            >
                              ทีม A
                            </button>
                            <button
                              onClick={() =>
                                handleAddPlayerToMatch(fullPlayer, "B")
                              }
                              className="flex-1 min-w-[50px] h-6 bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] font-semibold rounded flex items-center justify-center px-1"
                            >
                              ทีม B
                            </button>
                            <button
                              onClick={() =>
                                handleRemovePlayerFromMatch(fullPlayer)
                              }
                              className="flex-1 min-w-[50px] h-6 bg-red-500 hover:bg-red-600 text-white text-[10px] font-semibold rounded flex items-center justify-center px-1"
                              title={`ลบ ${fullPlayer.name}`}
                            >
                              ลบออก
                            </button>
                            <button
                              onClick={() => setSelectedPlayerToAdd(null)}
                              className="flex-1 min-w-[50px] h-6 bg-gray-400 hover:bg-gray-500 text-white text-[10px] font-semibold rounded flex items-center justify-center px-1"
                              title="ยกเลิก"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Match List */}
        {matches.length === 0 && !loading && (
          <p className="text-center text-gray-500 mt-10">ยังไม่มีแมตช์ในระบบ</p>
        )}
        {matches
          .slice(
            (currentPage - 1) * matchesPerPage,
            currentPage * matchesPerPage
          )
          .map((match, index) => {
            const overallIndex =
              matches.length - ((currentPage - 1) * matchesPerPage + index);
            const currentMatchIndexInState = matches.findIndex(
              (m) => m.id === match.id
            ); // หา index ใน state ปัจจุบัน
            const prevMatchInState =
              currentMatchIndexInState > 0
                ? matches[currentMatchIndexInState - 1]
                : null; // แมตช์ก่อนหน้า (ใหม่กว่า)
            const nextMatchInState =
              currentMatchIndexInState < matches.length - 1
                ? matches[currentMatchIndexInState + 1]
                : null; // แมตช์ถัดไป (เก่ากว่า)

            return (
              <div
                key={match.id}
                className="mb-6 bg-white p-3 rounded-lg shadow-md"
              >
                {/* Match Header */}
                <div className="text-center font-bold text-lg text-green-800 mb-1">
                  แมตช์ที่ {overallIndex}
                </div>

                {/* Timestamp */}
                {match.createdAt?.toDate && (
                  <div className="text-center text-xs text-gray-500 mb-2">
                    {match.createdAt.toDate().toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                )}

                {/* Duration */}
                {match.status === "finished" &&
                  match.startTime?.toDate &&
                  match.endTime?.toDate && (
                    <div className="text-center text-sm mb-2 text-gray-600">
                      เวลาเล่น:{" "}
                      <span className="text-indigo-700 font-semibold">
                        {formatDuration(
                          (match.endTime.toDate().getTime() -
                            match.startTime.toDate().getTime()) /
                            1000
                        )}
                      </span>
                    </div>
                  )}

                {/* Timer */}
                {match.status === "playing" && match.startTime?.toDate && (
                  <div className="text-center text-sm mb-2 text-orange-600 font-semibold animate-pulse">
                    ⏱️ กำลังเล่น:{" "}
                    {formatDuration(
                      (now - match.startTime.toDate().getTime()) / 1000
                    )}
                  </div>
                )}

                {/* Match Card */}
                <MatchCard
                  teamA={match.teamA || []}
                  teamB={match.teamB || []}
                  winner={match.winner}
                  statusText={
                    match.status === "finished"
                      ? "🏁 จบแล้ว"
                      : match.status === "playing"
                      ? "▶️ กำลังเล่น"
                      : "⏳ รอเล่น"
                  }
                  onVSClick={() =>
                    setOpenMatchId(openMatchId === match.id ? null : match.id)
                  }
                  getSkillIcon={getSkillIcon}
                />

                {/* Action Buttons */}
                {openMatchId === match.id && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    {/* ... Set Winner Buttons ... */}
                    {match.status === "playing" && (
                      <>
                        <button
                          onClick={() => setWinner(match.id, "A")}
                          className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded font-semibold bg-blue-500 hover:bg-blue-600 text-white shadow"
                        >
                          🏆 A ชนะ
                        </button>
                        <button
                          onClick={() => setWinner(match.id, "B")}
                          className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-white shadow"
                        >
                          🏆 B ชนะ
                        </button>
                      </>
                    )}
                    {/* ... Toggle Play/Wait Button ... */}
                    {match.status !== "finished" && (
                      <button
                        onClick={() => togglePlayStatus(match.id, match.status)}
                        disabled={
                          (match.teamA?.length ?? 0) +
                            (match.teamB?.length ?? 0) !==
                          4
                        }
                        className={`flex-1 min-w-[90px] text-xs px-2 py-2 rounded font-semibold text-white shadow transition-colors ${
                          (match.teamA?.length ?? 0) +
                            (match.teamB?.length ?? 0) !==
                          4
                            ? "bg-gray-400 opacity-50 cursor-not-allowed"
                            : match.status === "waiting"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-yellow-400 hover:bg-yellow-500"
                        }`}
                      >
                        {match.status === "waiting"
                          ? "▶️ เริ่มเล่น"
                          : "⏸️ พัก/รอ"}
                      </button>
                    )}
                    {/* ... Reset Button ... */}
                    {match.status === "finished" && (
                      <button
                        onClick={() => handleResetMatch(match.id)}
                        className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-gray-400 hover:bg-gray-500 text-white font-semibold shadow"
                      >
                        🔄 รีเซ็ตผล
                      </button>
                    )}

                    {/* Move Players Button */}
                    {nextMatchInState &&
                      nextMatchInState.status === "waiting" &&
                      (match.teamA?.length ?? 0) +
                        (match.teamB?.length ?? 0) ===
                        2 &&
                      (nextMatchInState.teamA?.length ?? 0) +
                        (nextMatchInState.teamB?.length ?? 0) ===
                        2 && (
                        <button
                          onClick={() =>
                            handleMovePlayersIntoMatch(match, nextMatchInState)
                          }
                          className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow"
                          title="ย้ายทีมจากแมตช์นี้ไปใส่แมตช์ถัดไป (ที่เก่ากว่า)"
                        >
                          ⏬ ย้ายไปแมตช์ล่าง
                        </button>
                      )}

                    {/* Send Winner Button */}
                    {match.status === "finished" && match.winner && (
                      <button
                        onClick={() => handleSendWinnerToNextMatch(match)}
                        className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-pink-500 hover:bg-pink-600 text-white font-semibold shadow"
                        title="ส่งทีมชนะไปรอแข่งในแมตช์ถัดไป"
                      >
                        ⏩ ส่งผู้ชนะ
                      </button>
                    )}

                    {/* Swap with Above Button */}
                    {prevMatchInState && (
                      <button
                        onClick={() =>
                          handleSwapTeamsBetweenMatches(match, prevMatchInState)
                        }
                        className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-orange-400 hover:bg-orange-500 text-white font-semibold shadow"
                        title="สลับคิว/ทีมกับแมตช์ก่อนหน้า (ที่ใหม่กว่า)"
                      >
                        🔁 สลับคิวบน
                      </button>
                    )}

                    {/* Delete Match Button */}
                    <button
                      onClick={() => handleDeleteMatch(match.id)}
                      className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-red-500 hover:bg-red-600 text-white font-semibold shadow"
                    >
                      🗑️ ลบแมตช์นี้
                    </button>
                    {/* Add Player Button */}
                    {match.status !== "finished" && (
                      <button
                        onClick={() => {
                          setAddingPlayerMatchId(match.id);
                          setTimeout(() => {
                            document
                              .getElementById("popup-anchor")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }, 100);
                        }}
                        className="flex-1 min-w-[90px] text-xs px-2 py-2 rounded bg-green-400 hover:bg-green-500 text-white font-semibold shadow"
                      >
                        ➕ เพิ่ม/ย้ายผู้เล่น
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 mt-6">
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-sm"
          >
            ก่อนหน้า
          </button>
          <div className="flex items-center gap-1">
            <span className="text-sm">หน้า</span>
            <input
              type="number"
              min="1"
              max={Math.ceil(matches.length / matchesPerPage)}
              value={currentPage}
              onChange={(e) => {
                const page = Number(e.target.value);
                if (
                  page >= 1 &&
                  page <= Math.ceil(matches.length / matchesPerPage)
                ) {
                  setCurrentPage(page);
                }
              }}
              className="w-12 px-1 py-0.5 rounded border text-center text-sm"
            />
            <span className="text-sm">
              / {Math.ceil(matches.length / matchesPerPage)}
            </span>
          </div>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(prev + 1, Math.ceil(matches.length / matchesPerPage))
              )
            }
            disabled={currentPage >= Math.ceil(matches.length / matchesPerPage)}
            className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-sm"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </main>
  );
}
