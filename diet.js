// ===============================
// DIET PLAN FUNCTIONS
// ===============================

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { verifyRole, verifyAnyRole } = require("./auth");

const db = admin.firestore();

// =======================================================
// 1️⃣ CREATE OR UPDATE DIET PLAN (DOCTOR)
// =======================================================
exports.saveDietPlan = async (req, res) => {
  try {
    const { patientId, weekStartDate, diet } = req.body;

    if (!patientId || !weekStartDate || !diet) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const doctorId = await verifyRole(req, "doctor");
    console.log("doctor found");


    // 🔎 Check patient exists
    const patientSnap = await db.collection("patients").doc(patientId).get();
    if (!patientSnap.exists) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // 🔎 Check doctor exists
    const doctorSnap = await db.collection("doctors").doc(doctorId).get();
    if (!doctorSnap.exists) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // 🔎 Check existing active plan for same week
    const existingSnap = await db
      .collection("diet_plans")
      .where("patientId", "==", patientId)
      .where("weekStartDate", "==", weekStartDate)
      .limit(1)
      .get();

    // ❌ Deactivate previous plan if exists
    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update({
        isActive: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ✅ Create new diet plan
    const dietRef = db.collection("diet_plans").doc();

    await dietRef.set({
      dietId: dietRef.id,
      doctorId,
      doctorName: `${doctorSnap.data().firstName} ${doctorSnap.data().lastName || ""}`,
      patientId,
      patientName: `${patientSnap.data().firstName} ${patientSnap.data().lastName || ""}`,
      weekStartDate,
      diet, // 🔥 weekly table structure
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: "Diet plan saved successfully",
      dietId: dietRef.id,
    });

  } catch (err) {
    console.error("❌ saveDietPlan:", err.message);
    return res.status(500).json({ error: err.message });
  }
};


// =======================================================
// 2️⃣ GET PATIENT DIET (PATIENT)
// =======================================================
exports.getMyDietPlan = async (req, res) => {
  try {
    const patientId = await verifyRole(req, "patient");

    const { weekStartDate } = req.query;

    let query = db
      .collection("diet_plans")
      .where("patientId", "==", patientId);

    if (weekStartDate) {
      query = query.where("weekStartDate", "==", weekStartDate);
    } 
    else {
      query = query.where("isActive", "==", true);
    }

    const snap = await query
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({
        success: true,
        diet: null,
      });
    }

    return res.json({
      success: true,
      diet: snap.docs[0].data(),
    });

  } catch (err) {
    console.error("❌ getMyDietPlan:", err.message);
    return res.status(500).json({ error: err.message });
  }
};


// =======================================================
// 3️⃣ GET PATIENT DIET (DOCTOR)
// =======================================================
exports.getPatientDiet = async (req, res) => {
  try {
    // 🔐 Doctor only
    await verifyRole(req, "doctor");

    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: "patientId required" });
    }

    const snap = await db
      .collection("diet_plans")
      .where("patientId", "==", patientId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({
        success: true,
        diet: null,
      });
    }

    return res.json({
      success: true,
      diet: snap.docs[0].data(),
    });

  } catch (err) {
    console.error("❌ getPatientDiet:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
