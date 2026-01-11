// ===============================
// CHAT FUNCTIONS (Doctor ↔ Patient)
// ===============================

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { verifyAnyRole } = require("./auth");


// ---------------- FIREBASE INIT ----------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =======================================================
// 1️⃣ CREATE OR GET CHAT (Doctor ↔ Patient)
// =======================================================
exports.createOrGetChat = async (req, res) => {
  try {
    const { doctorId, patientId } = req.body;

    if (!doctorId || !patientId) {
      return res.status(400).json({ error: "DoctorId & PatientId required" });
    }

    // Auth: doctor OR patient can initiate
    const { uid, role } = await verifyAnyRole(req, ["doctor", "patient"]);

    // Ensure only doctor-patient pairing
    if (
      (role === "doctor" && uid !== doctorId) ||
      (role === "patient" && uid !== patientId)
    ) {
      return res.status(403).json({ error: "Unauthorized chat access" });
    }

    const doctorSnap = await db.collection("doctors").doc(doctorId).get();
    const patientSnap = await db.collection("patients").doc(patientId).get();

    if (!doctorSnap.exists || !patientSnap.exists) {
      return res.status(404).json({ error: "Doctor or Patient not found" });
    }

    // Check existing chat
    const existing = await db
      .collection("chats")
      .where("doctorId", "==", doctorId)
      .where("patientId", "==", patientId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.json({
        success: true,
        chatId: existing.docs[0].id,
      });
    }

    const chatRef = db.collection("chats").doc();

    await chatRef.set({
      chatId: chatRef.id,
      doctorId,
      doctorName: `${doctorSnap.data().firstName} ${doctorSnap.data().lastName || ""}`,
      patientId,
      patientName: `${patientSnap.data().firstName} ${patientSnap.data().lastName || ""}`,
      lastMessage: "",
      lastSenderRole: null,
      unreadForDoctor: 0,
      unreadForPatient: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, chatId: chatRef.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 2️⃣ SEND MESSAGE
// =======================================================
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ error: "ChatId & text required" });
    }

    const { uid, role } = await verifyAnyRole(req, ["doctor", "patient"]);

    const chatRef = db.collection("chats").doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const chat = chatSnap.data();

    // Enforce correct sender
    if (
      (role === "doctor" && uid !== chat.doctorId) ||
      (role === "patient" && uid !== chat.patientId)
    ) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const msgRef = chatRef.collection("messages").doc();

    await msgRef.set({
      messageId: msgRef.id,
      senderId: uid,
      senderRole: role,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update chat meta
    await chatRef.update({
      lastMessage: text,
      lastSenderRole: role,
      unreadForDoctor:
        role === "patient"
          ? FieldValue.increment(1)
          : chat.unreadForDoctor,
      unreadForPatient:
        role === "doctor"
          ? FieldValue.increment(1)
          : chat.unreadForPatient,
      updatedAt: FieldValue.serverTimestamp(),
    });


    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 3️⃣ GET MESSAGES
// =======================================================
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.query;

    if (!chatId) {
      return res.status(400).json({ error: "ChatId required" });
    }

    const { uid, role } = await verifyAnyRole(req, ["doctor", "patient"]);

    const chatSnap = await db.collection("chats").doc(chatId).get();
    if (!chatSnap.exists) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const chat = chatSnap.data();

    if (
      (role === "doctor" && uid !== chat.doctorId) ||
      (role === "patient" && uid !== chat.patientId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const snap = await db
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    return res.json({
      success: true,
      messages: snap.docs.map(d => d.data()),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 4️⃣ GET CHATS FOR DOCTOR
// =======================================================
exports.getDoctorChats = async (req, res) => {
  try {
    const { uid } = await verifyAnyRole(req, ["doctor"]);

    const snap = await db
      .collection("chats")
      .where("doctorId", "==", uid)
      .orderBy("updatedAt", "desc")
      .get();

    return res.json({
      success: true,
      chats: snap.docs.map(d => d.data()),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 5️⃣ GET CHATS FOR PATIENT
// =======================================================
exports.getPatientChats = async (req, res) => {
  try {
    const { uid } = await verifyAnyRole(req, ["patient"]);

    const snap = await db
      .collection("chats")
      .where("patientId", "==", uid)
      .orderBy("updatedAt", "desc")
      .get();

    return res.json({
      success: true,
      chats: snap.docs.map(d => d.data()),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
