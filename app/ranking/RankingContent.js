"use client"; // ✅ ต้องใช้เมื่อมี useState/useEffect ใน app/
import { Suspense } from "react";
import RankingContent from "./RankingContent";
export const dynamic = "force-dynamic";
import Link from "next/link";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import Image from "next/image";
import { useSearchParams } from "next/navigation"; // ✅ ใช้แทน context.query

export default function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const playersPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const playersSnapshot = await getDocs(query(collection(db, "players")));
      const matchesSnapshot = await getDocs(collection(db, "matches"));

      const players = playersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const matches = matchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const playerStats = {};

      players.forEach((player) => {
        playerStats[player.id] = {
          id: player.id,
          name: player.name,
          image: player.image,
          wins: 0,
          losses: 0,
          points: 0,
        };
      });

      matches.forEach((match) => {
        if (!match.winner) return;
        const winnerTeam = match.winner === "A" ? match.teamA : match.teamB;
        const loserTeam = match.winner === "A" ? match.teamB : match.teamA;

        winnerTeam.forEach((player) => {
          if (playerStats[player.id]) {
            playerStats[player.id].wins += 1;
            playerStats[player.id].points += 2;
          }
        });

        loserTeam.forEach((player) => {
          if (playerStats[player.id]) {
            playerStats[player.id].losses += 1;
            playerStats[player.id].points += 1;
          }
        });
      });

      const rankingArray = Object.values(playerStats).map((player) => {
        const totalGames = player.wins + player.losses;
        const winRate = totalGames === 0 ? 0 : (player.wins / totalGames) * 100;
        return {
          ...player,
          played: totalGames,
          winRate,
        };
      });

      rankingArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      });

      rankingArray.forEach((player, index) => {
        player.rank = index + 1;
      });

      setRanking(rankingArray);
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredRanking = ranking
    .filter((player) =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.rank - b.rank);

  const indexOfLastPlayer = page * playersPerPage;
  const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage;
  const currentPlayers = filteredRanking.slice(
    indexOfFirstPlayer,
    indexOfLastPlayer
  );

  useEffect(() => {
    let interval;
    setLoadingPercent(0);

    if (!ranking || ranking.length === 0) {
      setLoading(true);
      let percent = 0;
      interval = setInterval(() => {
        percent += Math.floor(Math.random() * 5) + 3;
        if (percent >= 95) clearInterval(interval);
        setLoadingPercent(Math.min(percent, 95));
      }, 100);
    } else {
      setLoading(false);
      setLoadingPercent(100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ranking]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 md:p-6">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <button
          onClick={() => (window.location.href = "/user")}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded shadow-md"
        >
          🏠 หน้าแรก
        </button>
        <input
          type="text"
          placeholder="🔎 ค้นหาชื่อผู้เล่น..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2 w-full md:w-80"
        />
      </div>
      <h1 className="text-2xl md:text-4xl font-extrabold text-center mb-4 md:mb-8 text-blue-700">
        🏸 อันดับสมาชิก.ชนะ+2 แพ้+1
      </h1>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 w-full">
          <div className="w-full max-w-md">
            <p className="text-sm text-center text-gray-600 font-medium mb-2">
              กำลังโหลด... {loadingPercent}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
              <div
                className="bg-blue-500 h-4 transition-all duration-300 ease-out"
                style={{ width: `${loadingPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="shadow-xl rounded-xl bg-white mb-8 overflow-x-auto">
            <table className="min-w-full text-center table-auto text-xs md:text-sm">
              <thead className="bg-blue-100 text-blue-800 uppercase">
                <tr>
                  <th className="py-2 px-2 md:py-4 md:px-6">อันดับ</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">รูปภาพ</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">ชื่อผู้เล่น</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">แข่งทั้งหมด</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">ชนะ</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">แพ้</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">แต้ม</th>
                  <th className="py-2 px-2 md:py-4 md:px-6">อัตราชนะ (%)</th>
                </tr>
              </thead>
              <tbody>
              {currentPlayers.map((player, index) => {
  const rank = player.rank; // ✅ ใช้อันดับจากข้อมูลโดยตรง

  let rowClass = "";
  if (rank === 1) rowClass = "bg-yellow-100";
  else if (rank === 2) rowClass = "bg-gray-200";
  else if (rank === 3) rowClass = "bg-orange-100";
  

  const isEven = index % 2 === 0;
const backgroundAlt = isEven ? "bg-white" : "bg-gray-50"; // ✅ สี交錯

return (
  <tr
    key={index}
    className={`${rowClass} ${backgroundAlt} hover:bg-blue-50 transition-transform duration-700 ease-out`}
    style={{ transform: `translateY(${index * 5}px)` }}
  >
      <td className="py-2 px-2 md:py-4 md:px-6 font-bold">
        {player
          ? player.rank === 1
            ? "🥇"
            : player.rank === 2
            ? "🥈"
            : player.rank === 3
            ? "🥉"
            : player.rank
          : "-"}
      </td>

      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? (
          <Link href={`/userwin/${encodeURIComponent(player.name)}`}>
            <Image
              src={player.image}
              alt={player.name}
              title={`ดูโปรไฟล์ของ ${player.name}`}
              width={56}
              height={56}
              className="w-10 h-10 md:w-14 md:h-14 object-cover rounded-full mx-auto shadow-md border-2 border-blue-300 hover:scale-105 transition-transform duration-200"
            />
          </Link>
        ) : (
          "-"
        )}
      </td>

      <td className="py-2 px-2 md:py-4 md:px-6 font-semibold text-gray-700">
        {player ? player.name : "-"}
      </td>
      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? player.played : "-"}
      </td>
      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? player.wins : "-"}
      </td>
      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? player.losses : "-"}
      </td>
      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? player.points : "-"}
      </td>
      <td className="py-2 px-2 md:py-4 md:px-6">
        {player ? player.winRate.toFixed(1) + "%" : "-"}
      </td>
    </tr>
  );
})}

              </tbody>
            </table>
          </div>

          <div className="flex justify-center mb-8 space-x-2">
            {Array.from(
              { length: Math.ceil(ranking.length / playersPerPage) },
              (_, i) => (
                <a
                  key={i + 1}
                  href={`/ranking?page=${i + 1}`}
                  className={`px-3 py-1 md:px-4 md:py-2 rounded ${
                    page === i + 1
                      ? "bg-blue-500 text-white"
                      : "bg-gray-300 text-gray-700"
                  }`}
                >
                  {i + 1}
                </a>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
