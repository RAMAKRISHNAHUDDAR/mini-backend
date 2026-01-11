const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "samagra-nutricare-backend",
  });
}

const db = admin.firestore();

/**
 * Utility: Verify Firebase ID token
 */
async function verifyAuth(req) {
  // 🔥 EMULATOR BYPASS
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return {
      uid: req.headers["x-test-uid"],
      role: req.headers["x-test-role"],
    };
  }

  // 🔐 PRODUCTION AUTH
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.substring(7);
  return await admin.auth().verifyIdToken(token);
}


/**
 * =======================================================
 * CREATE REPORT (Doctor only)
 * =======================================================
 */
exports.createReport = onRequest(async (req, res) => {
  try {
    const decoded = await verifyAuth(req);

    if (decoded.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can create reports" });
    }
    console.log("Decoded token:", decoded);


    const {
      patientId,
      basicInfo,
      dietaryHistory,
      measurements,
      bloodReports,
      notes,
      visitNumber
    } = req.body;

    if (!patientId || !basicInfo || !visitNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const reportRef = db.collection("reports").doc();

    const reportData = {
      reportId: reportRef.id,
      patientId,
      doctorId: decoded.uid,

      basicInfo: {
        age: basicInfo.age ?? null,
        gender: basicInfo.gender ?? null,
        heightCm: basicInfo.heightCm ?? null,
        weightKg: basicInfo.weightKg ?? null,
        bmi: basicInfo.bmi ?? null
      },

      dietaryHistory: Array.isArray(dietaryHistory) ? dietaryHistory : [],

      measurements: {
        bicepsCm: measurements?.bicepsCm ?? null,
        forearmCm: measurements?.forearmCm ?? null,
        chestCm: measurements?.chestCm ?? null,
        waistCm: measurements?.waistCm ?? null,
        hipCm: measurements?.hipCm ?? null,
        thighCm: measurements?.thighCm ?? null,
        calfCm: measurements?.calfCm ?? null
      },

      bloodReports: {
        hb: bloodReports?.hb ?? null,
        fbs: bloodReports?.fbs ?? null,
        ppbs: bloodReports?.ppbs ?? null,
        hba1c: bloodReports?.hba1c ?? null,
        t3: bloodReports?.t3 ?? null,
        t4: bloodReports?.t4 ?? null,
        tsh: bloodReports?.tsh ?? null,
        vitaminD: bloodReports?.vitaminD ?? null,
        vitaminB12: bloodReports?.vitaminB12 ?? null,
        serumFerritin: bloodReports?.serumFerritin ?? null,
        totalCholesterol: bloodReports?.totalCholesterol ?? null,
        triglycerides: bloodReports?.triglycerides ?? null,
        hdl: bloodReports?.hdl ?? null,
        ldl: bloodReports?.ldl ?? null,
        lft: bloodReports?.lft ?? null,
        renalProfile: bloodReports?.renalProfile ?? null,
        uricAcid: bloodReports?.uricAcid ?? null
      },

      notes: notes || "",
      visitNumber,

      createdBy: "doctor",
      isArchived: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await reportRef.set(reportData);

    res.json({
      success: true,
      message: "Report created successfully",
      reportId: reportRef.id
    });

  } catch (err) {
    console.error("createReport error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * =======================================================
 * GET REPORTS (Doctor or Patient)
 * =======================================================
 */
exports.getReports = onRequest(async (req, res) => {
  try {
    const decoded = await verifyAuth(req);

    let query = db.collection("reports");

    if (decoded.role === "doctor") {
      query = query.where("doctorId", "==", decoded.uid);
    } else {
      query = query.where("patientId", "==", decoded.uid);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();

    const reports = snapshot.docs.map(doc => doc.data());

    res.json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (err) {
    console.error("getReports error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * =======================================================
 * UPDATE REPORT (Doctor only)
 * =======================================================
 */
exports.updateReport = onRequest(async (req, res) => {
  try {
    const decoded = await verifyAuth(req);

    if (decoded.role !== "doctor") {
      return res.status(403).json({ error: "Only doctors can update reports" });
    }

    const { reportId, updates } = req.body;

    if (!reportId || !updates) {
      return res.status(400).json({ error: "reportId and updates required" });
    }

    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();

    if (!reportSnap.exists) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (reportSnap.data().doctorId !== decoded.uid) {
      return res.status(403).json({ error: "Unauthorized to update this report" });
    }

    await reportRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: "Report updated successfully"
    });

  } catch (err) {
    console.error("updateReport error:", err);
    res.status(500).json({ error: err.message });
  }
});
