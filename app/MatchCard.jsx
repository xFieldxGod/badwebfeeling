"use client";
import { useRouter } from "next/navigation";
import React from "react";

function MatchCard({
  teamA,
  teamB,
  winner,
  onVSClick,
  statusText,
  goToUserWin,
  getSkillIcon,
}) {
  const router = useRouter();

  const handleClickPlayer = (playerName) => {
    if (goToUserWin) {
      goToUserWin(playerName); // ✅ ถ้ามี goToUserWin จาก props ให้เรียกอันนี้
    } else {
      router.push(`/userwin/${encodeURIComponent(playerName)}`); // ✅ fallback เดิม
    }
  };

  return (
    <div className="flex flex-col items-center mb-4">
      <div className="flex items-center gap-6 relative">
        {/* ฝั่งซ้าย */}
        <div className="flex flex-col items-center">
          <div className="flex gap-1 relative">
          {teamA.map((p, i) => (
  <div key={i} className={`relative 
    ${winner === "A" ? "sparkle-border" : winner === "B" ? "lose-heavy smoke-overlay" : ""}`}>
    <img
  src={p.image}
  loading="lazy"
  className="w-16 h-16 rounded-xl object-cover"
  onClick={() => handleClickPlayer(p.name)}
/>

  </div>
))}





          </div>
  
          {/* ชื่อ + รูปสัตว์ + ถ้วยทอง */}
          <div className="flex flex-wrap items-center justify-center mt-2 gap-2">
            {teamA.filter(Boolean).map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                {getSkillIcon && getSkillIcon(p.id) && (
                  <img
                    src={getSkillIcon(p.id)}
                    loading="lazy"
                    alt="สัตว์"
                    className="w-5 h-5"
                  />
                )}
                <p className="text-blue-700 font-medium text-xs">{p.name}</p>
              </div>
            ))}
            {winner === "A" && (
              <span className="text-yellow-500 text-sm ml-1">🏆</span>
            )}
          </div>
        </div>
  
        {/* VS ตรงกลาง */}
        <div className="flex flex-col items-center justify-center">
          {statusText && (
            <div className="text-center text-sm font-semibold mb-1">
              {statusText === "จบแล้ว" ? (
                <span className="text-red-500 whitespace-nowrap">
                  {statusText}
                </span>
              ) : (
                <span className="text-green-500 whitespace-nowrap">
                  {statusText}
                </span>
              )}
            </div>
          )}
          <img
            src="/vs.png"
            alt="VS"
            className="w-12 h-12 object-contain"
            onClick={onVSClick}
          />
        </div>
  
        {/* ฝั่งขวา */}
        <div className="flex flex-col items-center">
          <div className="flex gap-1 relative">
          {teamB.map((p, i) => (
  <div key={i} className={`relative 
    ${winner === "B" ? "sparkle-border" : winner === "A" ? "lose-heavy smoke-overlay" : ""}`}>
    <img
  src={p.image}
  loading="lazy"
  className="w-16 h-16 rounded-xl object-cover"
  onClick={() => handleClickPlayer(p.name)}
/>

  </div>
))}


          </div>
  
          {/* ชื่อ + รูปสัตว์ + ถ้วยทอง */}
          <div className="flex flex-wrap items-center justify-center mt-2 gap-2">
            {teamB.filter(Boolean).map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                {getSkillIcon && getSkillIcon(p.id) && (
                  <img
                    src={getSkillIcon(p.id)}
                    loading="lazy"
                    alt="สัตว์"
                    className="w-5 h-5"
                  />
                )}
                <p className="text-yellow-700 font-medium text-xs">{p.name}</p>
              </div>
            ))}
            {winner === "B" && (
              <span className="text-yellow-500 text-sm ml-1">🏆</span>

            )}
          </div>
        </div>
      </div>
    </div>
  );
  
}
export default React.memo(MatchCard);