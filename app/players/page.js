"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { Modal, Box, Button as MuiButton, Typography } from "@mui/material";
import getCroppedImg from "../utils/cropImage";
import imageCompression from "browser-image-compression";
import { onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";

export default function PlayersPage() {

  const compressAllImages = async () => {
    const snapshot = await getDocs(collection(db, "players"));
    const total = snapshot.docs.length;

    setIsUpdatingMatches(true);
    setUpdateProgress(0);
    setCancelUpdate(false);

    for (let i = 0; i < total; i++) {
      if (cancelUpdate) {
        console.log("⛔ ยกเลิกการบีบรูปกลางทาง");
        break;
      }

      const playerDoc = snapshot.docs[i];
      const data = playerDoc.data();
      const playerId = playerDoc.id;

      try {
        const res = await fetch(data.image);
        const blob = await res.blob();

        const compressed = await imageCompression(blob, {
          maxSizeMB: 0.05,
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });

        const reader = new FileReader();
        reader.readAsDataURL(compressed);

        await new Promise((resolve) => {
          reader.onloadend = async () => {
            const newBase64 = reader.result;

            await updateDoc(doc(db, "players", playerId), {
              image: newBase64,
            });
            await delay(300);
            console.log(`✅ Updated ${data.name} (${i + 1}/${total})`);
            resolve();
          };
        });

        setUpdateProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        console.error(`❌ Failed ${data.name}`, err);
      }
    }

    setIsUpdatingMatches(false);
    alert("🎉 ลดขนาดรูปผู้เล่นทั้งหมดเรียบร้อยแล้ว!");
  };

  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ name: "", image: "" });
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [isUpdatingMatches, setIsUpdatingMatches] = useState(false); // ⭐ เพิ่ม
  const [updateProgress, setUpdateProgress] = useState(0); // ⭐ เปอร์เซ็นต์โหลด
  const [cancelUpdate, setCancelUpdate] = useState(false); // ⭐ ไว้เช็กว่ากดยกเลิกไหม

  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [lockMode, setLockMode] = useState(false); // ⭐ เพิ่มตัวแปรเช็คว่า "อยู่ในโหมดล็อคคู่" มั้ย
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [pairToLock, setPairToLock] = useState(null);
  const [lockSuccessMessage, setLockSuccessMessage] = useState(null);
  const updatePlayerNameInMatches = async (playerId, newName) => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    setIsUpdatingMatches(true);
    setUpdateProgress(0);
    setCancelUpdate(false);

    try {
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      const totalMatches = matchesSnapshot.docs.length;
      let updatedCount = 0;

      for (const docSnap of matchesSnapshot.docs) {
        if (cancelUpdate) {
          console.log("Cancelled name update midway!");
          break;
        }

        const matchData = docSnap.data();
        let updated = false;

        const updatedTeamA = matchData.teamA.map((player) => {
          if (player.id === playerId) {
            updated = true;
            return { ...player, name: newName };
          }
          return player;
        });

        const updatedTeamB = matchData.teamB.map((player) => {
          if (player.id === playerId) {
            updated = true;
            return { ...player, name: newName };
          }
          return player;
        });

        if (updated) {
          const matchRef = doc(db, "matches", docSnap.id);
          await updateDoc(matchRef, {
            teamA: updatedTeamA,
            teamB: updatedTeamB,
          });
          await delay(300);
        }

        updatedCount++;
        setUpdateProgress(Math.round((updatedCount / totalMatches) * 100));
      }

      console.log("Update finished or cancelled.");
    } catch (error) {
      console.error("Error updating player names:", error);
    } finally {
      setIsUpdatingMatches(false);
    }
  };

  const [lockErrorMessage, setLockErrorMessage] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState({});

  const handleGlobalEdit = () => {
    setIsGlobalEditMode(!isGlobalEditMode);
    // ลบการจัดการ editingPlayers ออกจากตรงนี้
    // ถ้ากำลังเปิดโหมดแก้ไข และมีคนถูกเลือกแก้ไขอยู่ ให้ยกเลิกก่อน
    if (!isGlobalEditMode && editingPlayerId) {
      handleCancelEdit();
    }
  };
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const handleEditPlayer = (player) => {
    setEditingPlayerId(player.id);
    setEditingPlayerName(player.name);
  };

  const handleUpdatePlayer = async (playerId) => {
    // <-- รับ playerId มาด้วย
    // ใช้ editingPlayerName แทน editingPlayers[playerId]
    if (!editingPlayerName?.trim()) {
      alert("กรุณากรอกชื่อผู้เล่น");
      return;
    }

    try {
      await updateDoc(doc(db, "players", playerId), {
        name: editingPlayerName.trim(),
      });

      // ✅ อัปเดตในแมตช์เก่าด้วย
      await updatePlayerNameInMatches(playerId, editingPlayerName.trim());

      alert("แก้ไขชื่อผู้เล่นสำเร็จ!");
      handleCancelEdit(); // <-- เรียกใช้เพื่อเคลียร์สถานะหลังบันทึก
      // fetchPlayers(); // อาจจะไม่ต้อง fetch ใหม่ ถ้า state อัพเดทถูกต้อง หรือถ้า onSnapshot ทำงานอยู่แล้ว
    } catch (err) {
      console.error("Error updating player:", err);
      alert("เกิดข้อผิดพลาดในการแก้ไขชื่อผู้เล่น");
    }
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingPlayerName("");
  };

  const [zoom, setZoom] = useState(1);
  const [openCrop, setOpenCrop] = useState(false);
  const [lockedPairs, setLockedPairs] = useState([]);
  const [currentEditingPlayerId, setCurrentEditingPlayerId] = useState(null);
  const fetchLockedPairs = () => {
    const lockedPairsCollection = collection(db, "locked_pairs");
    const unsubscribe = onSnapshot(lockedPairsCollection, (querySnapshot) => {
      const pairs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLockedPairs(pairs);
    });

    return unsubscribe;
  };

  const deleteLockedPair = async (pairId) => {
    if (!pairId) {
      console.error("pairId เป็น undefined!");
      alert("เกิดข้อผิดพลาด: ไม่พบคู่ที่จะลบ");
      return;
    }

    if (!confirm("ยืนยันที่จะยกเลิกคู่ที่ล็อคไว้?")) return;

    try {
      await deleteDoc(doc(db, "locked_pairs", pairId));
      await fetchLockedPairs(); // ดึงข้อมูลใหม่หลังลบ
      alert("ยกเลิกล็อคคู่สำเร็จ!");
    } catch (error) {
      console.error("Error deleting locked pair:", error);
      alert("เกิดข้อผิดพลาดในการยกเลิกคู่");
    }
  };

  const router = useRouter();
  const [selectedForLock, setSelectedForLock] = useState([]);
  const toggleSelectForLock = async (player) => {
    let updatedSelected = [];

    if (selectedForLock.some((p) => p.id === player.id)) {
      updatedSelected = selectedForLock.filter((p) => p.id !== player.id);
    } else {
      if (selectedForLock.length < 2) {
        updatedSelected = [...selectedForLock, player];
      } else {
        return;
      }
    }

    setSelectedForLock(updatedSelected);

    if (updatedSelected.length === 2) {
      setPairToLock({
        player1: updatedSelected[0],
        player2: updatedSelected[1],
      });
      setConfirmLockOpen(true);
    }
  };
  const handleConfirmLock = async () => {
    if (!pairToLock) return;

    try {
      await addDoc(collection(db, "locked_pairs"), {
        player1: pairToLock.player1.id,
        player2: pairToLock.player2.id,
        createdAt: new Date(),
      });
      await fetchLockedPairs();
      setLockSuccessMessage(
        `🎉 ล็อคคู่สำเร็จ: ${pairToLock.player1.name} 🤝 ${pairToLock.player2.name}`
      );
      setSelectedForLock([]);
      setConfirmLockOpen(false);
      setPairToLock(null);

      setTimeout(() => setLockSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error locking pair:", error);
      setLockErrorMessage("เกิดข้อผิดพลาดในการล็อคคู่ กรุณาลองใหม่");
      setTimeout(() => setLockErrorMessage(null), 3000);
    }
  };

  const lockPair = async () => {
    if (selectedForLock.length !== 2) {
      alert("กรุณาเลือกผู้เล่น 2 คนเพื่อทำการล็อคคู่");
      return;
    }

    // ⭐ เพิ่ม popup ยืนยันตรงนี้
    const confirmLock = confirm(
      `ยืนยันที่จะล็อคคู่:\n${selectedForLock[0].name} 🤝 ${selectedForLock[1].name} ?`
    );
    if (!confirmLock) {
      return; // ถ้าไม่ตกลง ก็ไม่ทำอะไร
    }

    try {
      await addDoc(collection(db, "locked_pairs"), {
        player1: selectedForLock[0].id,
        player2: selectedForLock[1].id,
        createdAt: new Date(),
      });
      await fetchLockedPairs();
      alert(
        `🎉 ล็อคคู่สำเร็จ: ${selectedForLock[0].name} 🤝 ${selectedForLock[1].name}`
      );
      setSelectedForLock([]);
    } catch (error) {
      console.error("Error locking pair:", error);
      alert("เกิดข้อผิดพลาดในการล็อคคู่ กรุณาลองใหม่");
    }
  };

  const [selectedPlayersToday, setSelectedPlayersToday] = useState([]);
  const toggleSelectPlayerToday = async (player) => {
    const playersTodayCollection = collection(db, "playersToday");

    const querySnapshot = await getDocs(playersTodayCollection);

    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      const currentData = querySnapshot.docs[0].data().players || [];

      const isAlreadySelected = currentData.some((p) => p.id === player.id);

      let newPlayersToday;

      if (isAlreadySelected) {
        newPlayersToday = currentData.filter((p) => p.id !== player.id);
      } else {
        newPlayersToday = [
          ...currentData,
          { id: player.id, name: player.name },
        ];
      }

      await updateDoc(docRef, { players: newPlayersToday });
    } else {
      await addDoc(playersTodayCollection, {
        players: [player],
        createdAt: new Date(),
      });
    }

    // ✅ หลังจาก update Firestore เสร็จ ต้องโหลด playersToday ใหม่
    fetchPlayersToday();
  };

  const fetchPlayers = () => {
    const playersCollection = collection(db, "players");
    const unsubscribe = onSnapshot(playersCollection, (querySnapshot) => {
      const playerList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPlayers(playerList);
    });

    return unsubscribe; // สำคัญ! สำหรับยกเลิก listener เวลาย้ายหน้า
  };
  const fetchPlayersToday = () => {
    const playersTodayCollection = collection(db, "playersToday");
    const unsubscribe = onSnapshot(playersTodayCollection, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const todayData = querySnapshot.docs[0].data();
        setSelectedPlayersToday(todayData.players || []);
      } else {
        setSelectedPlayersToday([]);
      }
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribePlayers = fetchPlayers();
    const unsubscribeToday = fetchPlayersToday();
    const unsubscribeLockedPairs = fetchLockedPairs(); // ✅ เพิ่ม!

    return () => {
      unsubscribePlayers();
      unsubscribeToday();
      unsubscribeLockedPairs(); // ✅ เพิ่ม!
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.05, // ✅ บีบให้เหลือ ~50KB
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });

        const reader = new FileReader();
        reader.onloadend = () => {
          setCropImageSrc(reader.result);
          setOpenCrop(true);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Error compressing image:", error);
      }
    }
  };
  const showCroppedImage = async () => {
    try {
      const croppedImage = await getCroppedImg(cropImageSrc, croppedAreaPixels); // croppedImage คือ base64
  
      // ✅ เช็กขนาด base64 ก่อนอัปโหลด (100KB = ~100,000 ตัวอักษร)
      if (croppedImage.length > 100000) {
        alert("❌ รูปภาพมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กกว่านี้");
        return;
      }
  
      if (currentEditingPlayerId) {
        // กรณีแก้ไขรูปเดิม
        await updateDoc(doc(db, "players", currentEditingPlayerId), {
          image: croppedImage,
        });
  
        await updatePlayerImageInMatches(currentEditingPlayerId, croppedImage);
  
        setCurrentEditingPlayerId(null);
        fetchPlayers();
      } else {
        // กรณีเพิ่มผู้เล่นใหม่
        setForm((prev) => ({ ...prev, image: croppedImage }));
      }
  
      setOpenCrop(false);
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาดในการบันทึกรูปภาพ");
    }
  };
  
  
  
  
  
  // ✅ ฟังก์ชันอัพเดตรูปในแมตเก่าๆ
  const updatePlayerImageInMatches = async (playerId, newImage) => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    setIsUpdatingMatches(true);
    setUpdateProgress(0);
    setCancelUpdate(false);

    try {
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      const totalMatches = matchesSnapshot.docs.length;
      let updatedCount = 0;

      for (const docSnap of matchesSnapshot.docs) {
        if (cancelUpdate) {
          console.log("Cancelled update midway!");
          break;
        }

        const matchData = docSnap.data();
        let updated = false;

        const updatedTeamA = matchData.teamA.map((player) => {
          if (player.id === playerId) {
            updated = true;
            return { ...player, image: newImage };
          }
          return player;
        });

        const updatedTeamB = matchData.teamB.map((player) => {
          if (player.id === playerId) {
            updated = true;
            return { ...player, image: newImage };
          }
          return player;
        });

        if (updated && docSnap.id) {
          const matchRef = doc(db, "matches", docSnap.id);
          await updateDoc(matchRef, {
            teamA: updatedTeamA,
            teamB: updatedTeamB,
          });
          await delay(600); // อาจเพิ่มเวลาเป็น 400ms ถ้ายัง error
        }
        updatedCount++;
        setUpdateProgress(Math.round((updatedCount / totalMatches) * 100));
      }

      console.log("Update finished or cancelled.");
    } catch (error) {
      console.error("Error updating matches:", error);
    } finally {
      setIsUpdatingMatches(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!form.name || !form.image) {
      alert("กรุณากรอกชื่อและเลือกรูปภาพ");
      return;
    }
    try {
      await addDoc(collection(db, "players"), {
        name: form.name.trim(),
        image: form.image,
      });
      alert("เพิ่มผู้เล่นสำเร็จ!");
      setForm({ name: "", image: "" });
      fetchPlayers();
    } catch (err) {
      console.error("Error adding player:", err);
      alert("เกิดข้อผิดพลาดในการเพิ่มผู้เล่น");
    }
  };

  const handleDeletePlayer = async (id) => {
    if (confirm("แน่ใจว่าต้องการลบผู้เล่นนี้?")) {
      try {
        await deleteDoc(doc(db, "players", id));
        alert("ลบผู้เล่นสำเร็จ!");
        fetchPlayers();
      } catch (err) {
        console.error("Error deleting player:", err);
        alert("เกิดข้อผิดพลาดในการลบผู้เล่น");
      }
    }
  };

  const handleChangeImage = async (e, playerId) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.05, // ✅ บีบให้เหลือ ~50KB
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result);
        setCurrentEditingPlayerId(playerId); // ⭐ บันทึก playerId ไว้
        setOpenCrop(true);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Error compressing image:", error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-yellow-100 p-6">
      <h1 className="text-3xl font-bold text-center text-yellow-800 mb-6">
        🏸 จัดการผู้เล่น
      </h1>

      {isUpdatingMatches && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-2 rounded-md shadow-lg z-50 animate-pulse flex flex-col items-center">
          <div>🔄 กำลังอัปเดตรูปในแมตช์เก่าๆ ({updateProgress}%)</div>
          <button
            onClick={() => setCancelUpdate(true)}
            className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded"
          >
            ❌ ยกเลิก
          </button>
        </div>
      )}

      {/* ฟอร์มเพิ่มผู้เล่น */}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 mb-10 space-y-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🧍‍♂️ เพิ่มผู้เล่นใหม่
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="ชื่อผู้เล่น"
            className="border rounded px-3 py-2 w-full"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="border rounded px-3 py-2 bg-white w-full"
          />

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleAddPlayer}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-md transition font-bold text-xs whitespace-nowrap"
            >
              ➕ เพิ่มผู้เล่น
            </button>

            <button
              onClick={() => {
                router.push("/admin");
                router.refresh(); // ⭐⭐⭐ เพิ่มบรรทัดนี้
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-md transition font-bold text-xs whitespace-nowrap"
            >
              🚀 ไปหน้าแอดมิน
            </button>

            <button
              onClick={() => router.push("/user")}
              className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md transition font-bold text-xs whitespace-nowrap"
            >
              🧍‍♂️ ไปหน้าแรก
            </button>

            {/* 🔍 ช่องค้นหา */}
            <input
              type="text"
              placeholder="🔍 ค้นหาผู้เล่น..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border px-3 py-1 rounded-md text-sm w-40"
            />

            <button
              onClick={() => setLockMode(!lockMode)}
              className={`${
                lockMode
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-purple-500 hover:bg-purple-600"
              } text-white px-2 py-1 rounded-md transition font-bold text-xs whitespace-nowrap`}
            >
              {lockMode ? "❌ ยกเลิกโหมดล็อคคู่" : "🔒 เริ่มล็อคคู่"}
            </button>
          </div>
        </div>
      </div>
      {/* เพิ่มส่วนนี้ก่อนส่วนแสดงรายชื่อผู้เล่น */}
      <div className="flex justify-center mb-4">
        <button
          onClick={handleGlobalEdit}
          className={`px-4 py-2 rounded-md ${
            isGlobalEditMode
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white font-bold`}
        >
          {isGlobalEditMode ? "ปิดโหมดแก้ไขชื่อ" : "เปิดโหมดแก้ไขชื่อ"}
        </button>


        {/* <button
  onClick={compressAllImages}
  className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap"
>
  📉 ลดขนาดรูปทั้งหมด
</button>*/}
      </div>
      {/* แสดงรายชื่อผู้เล่น */}
      {/* แสดงรายชื่อผู้เล่น */}
      <div className="max-w-5xl mx-auto grid grid-cols-5 gap-x-1 gap-y-4 justify-items-center">
        {players
          .filter((player) =>
            player.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((player) => {
            const isSelectedToday = selectedPlayersToday.some(
              (p) => p.id === player.id
            );
            const isLocked = selectedForLock.some((p) => p.id === player.id);
            const isEditing = editingPlayerId === player.id;

            return (
              <div key={player.id} className="flex flex-col items-center w-20">
                {/* รูป + ปุ่มลบ */}
                <div className="relative">
                  {/* อัพโหลดรูปใหม่ */}
                  <input
                    id={`change-image-${player.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleChangeImage(e, player.id)}
                  />
                  <label htmlFor={`change-image-${player.id}`}>
                    <img
                      src={player.image}
                      alt={player.name}
                      className="w-16 h-16 rounded-full object-cover shadow-lg cursor-pointer"
                    />
                  </label>

                  {/* ปุ่มลบ */}
                  <button
                    onClick={() => handleDeletePlayer(player.id)}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    title="ลบผู้เล่น"
                  >
                    ✕
                  </button>
                </div>

                {/* ส่วนแสดงชื่อ/แก้ไข */}
                {editingPlayerId === player.id ? ( // <-- ตรวจสอบว่ากำลังแก้ไขคนนี้หรือไม่ (ไม่เกี่ยวกับ isGlobalEditMode โดยตรงแล้ว)
                  // โหมดแก้ไขรายบุคคล (เมื่อถูกเลือก)
                  <div className="flex flex-col items-center mt-1 w-full">
                    <input
                      type="text"
                      value={editingPlayerName}
                      onChange={(e) => setEditingPlayerName(e.target.value)}
                      className="border rounded px-1 py-0.5 text-xs w-full mb-1"
                    />
                    <div className="flex gap-1 w-full">
                      <button
                        onClick={() => handleUpdatePlayer(player.id)} // <-- ส่ง playerId ไปด้วย
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-0.5 rounded"
                      >
                        บันทึก
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-0.5 rounded"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  // โหมดปกติ หรือ โหมดเลือกแก้ไข (แต่ยังไม่ได้เลือกคนนี้)
                  <div className="flex flex-col items-center mt-1 w-full">
                    <p className="text-center text-xs font-semibold text-gray-800 truncate w-16 h-6 flex items-center justify-center">
                      {" "}
                      {/* ทำให้ความสูงคงที่ */}
                      {player.name}
                    </p>
                    {isGlobalEditMode && ( // <-- แสดงปุ่ม "แก้ไข" เฉพาะเมื่ออยู่ในโหมดเลือกแก้ไข
                      <button
                        onClick={() => handleEditPlayer(player)}
                        className="mt-1 w-16 text-xs font-bold py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        แก้ไข
                      </button>
                    )}
                  </div>
                )}

                {/* ปุ่มเลือกวันนี้ */}
                <button
                  onClick={() => toggleSelectPlayerToday(player)}
                  className={`mt-1 w-16 text-xs font-bold py-1 rounded-full ${
                    isSelectedToday
                      ? "bg-red-500 text-white"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {isSelectedToday ? "ยกเลิก" : "เลือก"}
                </button>

                {lockMode && (
                  <button
                    onClick={() => toggleSelectForLock(player)}
                    className={`mt-1 w-16 text-xs font-bold py-1 rounded-full ${
                      isLocked
                        ? "bg-purple-500 text-white"
                        : "bg-gray-300 text-gray-700"
                    }`}
                  >
                    {isLocked ? "ยกเลิกล็อค" : "ล็อคคู่"}
                  </button>
                )}
              </div>
            );
          })}
      </div>
      {/* 🔒 รายการคู่ที่ล็อคไว้แล้ว */}
      {lockedPairs.length > 0 && (
        <div className="max-w-3xl mx-auto mt-10 p-4 bg-white rounded-xl shadow">
          <h2 className="text-xl font-bold text-purple-700 mb-4 text-center">
            🔒 คู่ที่ล็อคไว้แล้ว
          </h2>
          <ul className="space-y-2">
            {lockedPairs.map((pair, index) => {
              // ✅ เพิ่ม index ตรงนี้
              const player1 = players.find((p) => p.id === pair.player1);
              const player2 = players.find((p) => p.id === pair.player2);
              if (!player1 || !player2) return null;

              return (
                <li
                  key={index}
                  className="flex items-center justify-between text-gray-700 text-sm"
                >
                  <span className="flex-1 text-center">
                    {player1.name} 🤝 {player2.name}
                  </span>
                  <button
                    onClick={() => deleteLockedPair(pair.id)}
                    className="ml-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                  >
                    ยกเลิก
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Crop Modal */}
      <Modal open={openCrop} onClose={() => setOpenCrop(false)}>
        <Box className="absolute top-1/2 left-1/2 w-[90vw] max-w-md bg-white p-4 rounded-xl shadow-lg transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-full h-60 bg-gray-200">
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <MuiButton
            onClick={showCroppedImage}
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            ตกลง
          </MuiButton>
        </Box>
      </Modal>
      {/* Modal ยืนยันการล็อคคู่ */}
      <Modal open={confirmLockOpen} onClose={() => setConfirmLockOpen(false)}>
        <Box className="absolute top-1/2 left-1/2 w-[90vw] max-w-md bg-white p-6 rounded-xl shadow-lg transform -translate-x-1/2 -translate-y-1/2 text-center">
          <Typography variant="h6" className="mb-4">
            ยืนยันที่จะล็อคคู่
          </Typography>
          <Typography className="mb-6 text-lg font-bold">
            {pairToLock?.player1.name} 🤝 {pairToLock?.player2.name}
          </Typography>
          <div className="flex justify-center gap-4">
            <MuiButton
              variant="contained"
              color="error"
              onClick={() => setConfirmLockOpen(false)}
            >
              ยกเลิก
            </MuiButton>
            <MuiButton
              variant="contained"
              color="success"
              onClick={handleConfirmLock}
            >
              ยืนยัน
            </MuiButton>
          </div>
        </Box>
      </Modal>

      {/* ข้อความแสดงสถานะการล็อคคู่ */}
      {lockSuccessMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 transition-all duration-300 animate-fade-in">
          {lockSuccessMessage}
        </div>
      )}
      {lockErrorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {lockErrorMessage}
        </div>
      )}
    </main>
  );
}
