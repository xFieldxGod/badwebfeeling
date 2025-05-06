"use client";
import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiX, FiChevronDown, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'; // เพิ่ม icon pack

export default function H2HSelectionModal({ isOpen, onClose, players = [], onSelect }) {
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState(null);
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayer1(null);
      setSelectedPlayer2(null);
      setSearchTerm1('');
      setSearchTerm2('');
    }
  }, [isOpen]);

  const filterPlayers = (term, otherSelectedPlayer) => {
    const lowerCaseTerm = term.toLowerCase();
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerCaseTerm) &&
        p.id !== otherSelectedPlayer?.id
    ).sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredPlayers1 = useMemo(() => filterPlayers(searchTerm1, selectedPlayer2), [searchTerm1, selectedPlayer2, players]);
  const filteredPlayers2 = useMemo(() => filterPlayers(searchTerm2, selectedPlayer1), [searchTerm2, selectedPlayer1, players]);

  const handleSelectPlayer1 = (player) => {
    setSelectedPlayer1(player);
    setSearchTerm1('');
  };

  const handleSelectPlayer2 = (player) => {
    setSelectedPlayer2(player);
    setSearchTerm2('');
  };

  const handleConfirmSelection = () => {
    if (selectedPlayer1 && selectedPlayer2) {
      onSelect(selectedPlayer1.name, selectedPlayer2.name);
    } else {
      // อาจจะเปลี่ยน alert เป็น custom notification ที่สวยงามกว่านี้
      alert('กรุณาเลือกผู้เล่นให้ครบทั้ง 2 คน (Please select both players)');
    }
  };

  if (!isOpen) {
    return null;
  }

  // --- JSX ---
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[999] bg-slate-900/70 backdrop-blur-sm p-4 transition-opacity duration-300 ease-in-out"
         style={{ opacity: isOpen ? 1 : 0 }}>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out"
           style={{ transform: isOpen ? 'scale(1)' : 'scale(0.95)', opacity: isOpen ? 1 : 0 }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
          <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 flex-1 text-center">
            🏸 Head-to-Head Battle
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 text-3xl p-1 rounded-full hover:bg-red-100 transition-colors duration-150"
            aria-label="Close modal"
          >
            <FiX />
          </button>
        </div>

        {/* Player selection section */}
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Player 1 Column */}
          <PlayerSelectionColumn
            playerId="1"
            selectedPlayer={selectedPlayer1}
            setSelectedPlayer={handleSelectPlayer1}
            searchTerm={searchTerm1}
            setSearchTerm={setSearchTerm1}
            filteredPlayers={filteredPlayers1}
            labelColor="text-sky-600"
            focusRingColor="focus:ring-sky-500 focus:border-sky-500"
            selectedBgColor="bg-sky-100"
            selectedTextColor="text-sky-800"
            hoverBgColor="hover:bg-sky-50"
            removeButtonColor="text-red-500 hover:text-red-700"
          />

          {/* Player 2 Column */}
          <PlayerSelectionColumn
            playerId="2"
            selectedPlayer={selectedPlayer2}
            setSelectedPlayer={handleSelectPlayer2}
            searchTerm={searchTerm2}
            setSearchTerm={setSearchTerm2}
            filteredPlayers={filteredPlayers2}
            labelColor="text-pink-600"
            focusRingColor="focus:ring-pink-500 focus:border-pink-500"
            selectedBgColor="bg-pink-100"
            selectedTextColor="text-pink-800"
            hoverBgColor="hover:bg-pink-50"
            removeButtonColor="text-red-500 hover:text-red-700"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors duration-150 flex items-center justify-center gap-2"
          >
            <FiX className="text-base"/> ยกเลิก
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedPlayer1 || !selectedPlayer2}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all duration-150 flex items-center justify-center gap-2
                        ${!selectedPlayer1 || !selectedPlayer2
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg transform hover:scale-105'
                        }`}
          >
            <FiCheckCircle className="text-base"/> เปรียบเทียบ H2H
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable component for player selection column
function PlayerSelectionColumn({
  playerId,
  selectedPlayer,
  setSelectedPlayer,
  searchTerm,
  setSearchTerm,
  filteredPlayers,
  labelColor,
  focusRingColor,
  selectedBgColor,
  selectedTextColor,
  hoverBgColor,
  removeButtonColor
}) {
  return (
    <div className="flex flex-col space-y-4 p-1">
      <label htmlFor={`search${playerId}`} className={`text-lg font-semibold ${labelColor}`}>
        ผู้เล่นคนที่ {playerId}
      </label>

      {selectedPlayer && (
        <div className={`flex items-center gap-3 p-3 ${selectedBgColor} rounded-lg border border-slate-300 shadow-sm`}>
          <img
            src={selectedPlayer.image || '/default-avatar.png'} // ควรมี default image ที่สวยงาม
            alt={selectedPlayer.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
          />
          <span className={`font-medium ${selectedTextColor} truncate flex-grow`}>{selectedPlayer.name}</span>
          <button
            onClick={() => setSelectedPlayer(null)} // Directly pass null, as handleSelectPlayer expects a player object or null
            className={`ml-auto p-1 rounded-full ${removeButtonColor} hover:bg-red-100 transition-colors duration-150`}
            title="ยกเลิกการเลือก"
          >
            <FiX className="w-5 h-5"/>
          </button>
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-slate-400" />
        </div>
        <input
          id={`search${playerId}`}
          type="text"
          placeholder="ค้นหาชื่อผู้เล่น..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2.5 text-sm shadow-sm 
                      focus:outline-none ${focusRingColor} focus:ring-2 transition-colors duration-150`}
        />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-y-auto h-64 p-2 space-y-1.5 custom-scrollbar shadow-inner">
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlayer(p)}
              disabled={selectedPlayer?.id === p.id}
              className={`w-full flex items-center gap-3 p-2.5 rounded-md text-left text-sm transition-all duration-150 ease-in-out
                          ${selectedPlayer?.id === p.id
                            ? `${selectedBgColor} ${selectedTextColor} font-semibold shadow-md`
                            : `${hoverBgColor} text-slate-700 hover:text-slate-900 hover:shadow-sm`}
                          disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed disabled:shadow-none`}
            >
              <img
                src={p.image || '/default-avatar.png'}
                alt={p.name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-slate-200"
              />
              <span className="truncate">{p.name}</span>
              {selectedPlayer?.id === p.id && <FiCheckCircle className={`ml-auto ${selectedTextColor}`} />}
            </button>
          ))
        ) : (
          <div className="text-center text-slate-400 text-sm py-10 flex flex-col items-center">
            <FiAlertCircle className="w-10 h-10 mb-2 text-slate-300"/>
            <p>ไม่พบผู้เล่นที่ค้นหา</p>
            {searchTerm && <p className="text-xs">ลองเปลี่ยนคำค้นหาของคุณ</p>}
          </div>
        )}
      </div>
    </div>
  );
}