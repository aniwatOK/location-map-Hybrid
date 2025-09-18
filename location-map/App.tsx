import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, FlatList, Alert} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@saved_places_v1";

type LatLng = { latitude: number; longitude: number };

export default function App() {
  const mapRef = useRef<MapView | null>(null);

  const [hasLocationPerm, setHasLocationPerm] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const [region, setRegion] = useState({
    latitude: 17.803266,
    longitude: 102.747888,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [savedPlaces, setSavedPlaces] = useState<
    { id: string; title: string; description: string; latitude: number; longitude: number; ts: number }[]
  >([]);

  // UI states
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [listVisible, setListVisible] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");

  // จุดที่ “กำลังจะบันทึก” (มาจากตำแหน่งปัจจุบัน หรือจากการกดค้างบนแผนที่)
  const [pendingCoord, setPendingCoord] = useState<LatLng | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPerm(status === "granted");

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedPlaces(parsed);
        } catch {}
      }
    })();
  }, []);

  const locateMe = async () => {
    try {
      if (!hasLocationPerm) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        setHasLocationPerm(true);
      }
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      const next = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(next);
      mapRef.current?.animateToRegion(next, 600);
    } catch (e) {
      console.warn("locateMe error:", e);
    }
  };

  // เปิด modal บันทึก โดยใช้พิกัดจาก pendingCoord ถ้ามี, ถ้าไม่มีใช้ตำแหน่งปัจจุบัน
  const openSaveModal = async (coord?: LatLng) => {
    if (coord) {
      setPendingCoord(coord);
    } else {
      if (!userLocation) await locateMe();
      setPendingCoord((prev) => prev ?? userLocation);
    }
    setTitleInput("");
    setDescInput("");
    setSaveModalVisible(true);
  };

  const savePlace = async () => {
    if (!pendingCoord) return;
    const newItem = {
      id: String(Date.now()),
      title: titleInput.trim() || "สถานที่ที่บันทึกไว้",
      description: descInput.trim() || "",
      latitude: pendingCoord.latitude,
      longitude: pendingCoord.longitude,
      ts: Date.now(),
    };
    const updated = [newItem, ...savedPlaces];
    setSavedPlaces(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveModalVisible(false);
    // เคลียร์มาร์คเกอร์ชั่วคราว
    setPendingCoord(null);
  };

  const goToPlace = (p: LatLng) => {
    const next = { ...p, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 600);
    setListVisible(false);
  };

  // 👉 ใหม่: กดค้างบนแผนที่เพื่อบันทึกจุดนั้น
  const handleMapLongPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setPendingCoord(coord);
    openSaveModal(coord);
  };

  const deletePlace = async (id: string) => {
    const updated = savedPlaces.filter((p) => p.id !== id);
    setSavedPlaces(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const confirmDeletePlace = (id: string, title?: string) => {
    Alert.alert(
      "ลบสถานที่",
      `ต้องการลบ “${title || "รายการนี้"}” หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ลบ", style: "destructive", onPress: () => deletePlace(id) },
      ],
      { cancelable: true }
    );
  };

  const clearAllPlaces = () => {
    if (savedPlaces.length === 0) return;
    Alert.alert(
      "ลบทั้งหมด",
      "ต้องการลบสถานที่ที่บันทึกทั้งหมดหรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบทั้งหมด",
          style: "destructive",
          onPress: async () => {
            setSavedPlaces([]);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (hasLocationPerm === null) {
    return (
      <View style={styles.center}>
        <Text>กำลังขอสิทธิ์ตำแหน่ง…</Text>
      </View>
    );
  }

  if (!hasLocationPerm) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 10 }}>จำเป็นต้องอนุญาตการเข้าถึงตำแหน่งเพื่อใช้งานแผนที่</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={locateMe}>
          <Text style={styles.primaryBtnText}>อนุญาตและระบุตำแหน่ง</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onLongPress={handleMapLongPress}       // 👈 กดค้างเพื่อบันทึกจุด
      >
        {/* มาร์คเกอร์สถานที่ที่บันทึก */}
        {savedPlaces.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.title}
            description={p.description}
            pinColor="tomato"
            // ถ้าอยากให้แตะ Marker แล้วเปิด modal เพื่อ "บันทึกใหม่จากจุดนี้" ก็ทำได้ แต่ปกติ Marker นี้คืออันที่บันทึกแล้ว
            // onPress={() => openSaveModal({ latitude: p.latitude, longitude: p.longitude })}
          />
        ))}

        {/* ตัวอย่าง */}
        <Marker
          coordinate={{ latitude: 17.803266, longitude: 102.747888 }}
          title="คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น"
          description="สถานที่เรียนและออกเกรด จ.หนองคาย"
          pinColor="blue"
          // แตะ Marker ตัวอย่างแล้วอยากบันทึกเป็นของเราได้:
          onCalloutPress={() =>
            openSaveModal({ latitude: 17.803266, longitude: 102.747888 })
          }
        />

        {/* มาร์คเกอร์ชั่วคราวสำหรับจุดที่กำลังจะบันทึก (จากการกดค้าง) */}
        {pendingCoord && (
          <Marker
            coordinate={pendingCoord}
            title="จะบันทึกจุดนี้"
            description="แก้ไขชื่อ/คำบรรยายในหน้าถัดไป"
            pinColor="green"
          />
        )}
      </MapView>

      {/* ปุ่มลอย */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={locateMe}>
          <Text style={styles.fabText}>หาฉัน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fab} onPress={() => openSaveModal()}>
          <Text style={styles.fabText}>บันทึก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fab} onPress={() => setListVisible(true)}>
          <Text style={styles.fabText}>รายการ</Text>
        </TouchableOpacity>
      </View>

      {/* Modal บันทึกสถานที่ */}
      <Modal visible={saveModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>บันทึกสถานที่</Text>

            {/* แสดงพิกัดที่เลือกไว้ (อ่านอย่างเดียว) */}
            {pendingCoord && (
              <Text style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                {pendingCoord.latitude.toFixed(6)}, {pendingCoord.longitude.toFixed(6)}
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="ชื่อสถานที่"
              value={titleInput}
              onChangeText={setTitleInput}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="คำบรรยาย"
              multiline
              value={descInput}
              onChangeText={setDescInput}
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => {
                  setSaveModalVisible(false);
                  setPendingCoord(null); // ยกเลิกจุดที่เลือก
                }}
              >
                <Text style={styles.btnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnOK]} onPress={savePlace}>
                <Text style={styles.btnText}>บันทึก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal รายการสถานที่ */}
      <Modal visible={listVisible} transparent animationType="slide">
      <View style={styles.listBackdrop}>
        <View style={styles.listCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.modalTitle}>สถานที่ที่บันทึก</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={clearAllPlaces} disabled={savedPlaces.length === 0}>
                <Text style={[styles.smallAction, savedPlaces.length === 0 && { opacity: 0.4 }]}>ลบทั้งหมด</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setListVisible(false)}>
                <Text style={styles.smallAction}>ปิด</Text>
              </TouchableOpacity>
            </View>
          </View>

          {savedPlaces.length === 0 ? (
            <Text style={{ color: "#666", marginTop: 8 }}>ยังไม่มีข้อมูล</Text>
          ) : (
            <FlatList
              data={savedPlaces}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.placeItem}
                  onPress={() => goToPlace({ latitude: item.latitude, longitude: item.longitude })}
                  onLongPress={() => confirmDeletePlace(item.id, item.title)}   // 👈 ลบด้วยการกดค้าง
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.placeTitle}>{item.title}</Text>
                      {!!item.description && <Text style={styles.placeDesc}>{item.description}</Text>}
                      <Text style={styles.placeCoord}>
                        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                      </Text>
                    </View>

                    {/* ปุ่มลบแบบกดครั้งเดียว */}
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDeletePlace(item.id, item.title)}>
                      <Text style={styles.deleteBtnText}>ลบ</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 24,
    gap: 10,
    alignItems: "flex-end",
  },
  fab: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    elevation: 3,
  },
  fabText: { color: "#fff", fontWeight: "700" },

  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  btnCancel: { backgroundColor: "#64748b" },
  btnOK: { backgroundColor: "#16a34a" },
  btnText: { color: "#fff", fontWeight: "700" },

  listBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  listCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  placeItem: { padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 10 },
  placeTitle: { fontWeight: "700" },
  placeDesc: { marginTop: 4, color: "#555" },
  placeCoord: { marginTop: 6, fontSize: 12, color: "#666" },

  smallAction: { color: "#0f172a", fontWeight: "600" },

  deleteBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "center",
  },
  
  deleteBtnText: { color: "#fff", fontWeight: "700" },
});
