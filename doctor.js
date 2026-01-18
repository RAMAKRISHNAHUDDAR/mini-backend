// ===============================
// DOCTOR FUNCTIONS
// ===============================

require("dotenv").config();
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { verifyRole } = require("./auth");
const { onRequest } = require("firebase-functions/v2/https");


// ---------------- FIREBASE INIT ----------------
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ---------------- EMAIL TRANSPORTER ----------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------- HELPERS ----------------
function validatePassword(password) {
  const rules = [/[A-Z]/, /\d/, /[!@#$%^&*]/];
  return password.length >= 8 && rules.every(r => r.test(password));
}

function formatPhone(phone) {
  if (!/^[6-9]\d{9}$/.test(phone)) return null;
  return "+91" + phone;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// =======================================================
// SEND EMAIL OTP
// =======================================================
exports.sendDoctorEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const otp = generateOTP();

    await db.collection("doctorEmailOTP").doc(email).set({
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Doctor Email Verification OTP",
      html: `<h2>Your OTP is ${otp}</h2><p>Valid for 5 minutes</p>`,
    });

    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =======================================================
// VERIFY OTP + RESET PASSWORD
// =======================================================
exports.verifyDoctorEmailOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const snap = await db.collection("doctorEmailOTP").doc(email).get();
    if (!snap.exists) return res.status(400).json({ error: "OTP not found" });

    const data = snap.data();
    if (data.expiresAt < Date.now())
      return res.status(400).json({ error: "OTP expired" });

    if (data.otp !== otp)
      return res.status(400).json({ error: "Invalid OTP" });

    if (!validatePassword(newPassword))
      return res.status(400).json({ error: "Weak password" });

    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });

    await db.collection("doctors").doc(user.uid).update({
      password: await bcrypt.hash(newPassword, 10),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("doctorEmailOTP").doc(email).delete();

    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 3️⃣ REGISTER DOCTOR (SETS ROLE CLAIM)
// =======================================================
exports.registerDoctor = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      phone,
      email,
      gender,
      password,
      specialisation,
    } = req.body;

    if (!firstName || !email || !gender || !password || !specialisation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["male", "female"].includes(gender.toLowerCase())) {
      return res.status(400).json({ error: "Invalid gender" });
    }

    const fullPhone = formatPhone(phone);
    if (!fullPhone) return res.status(400).json({ error: "Invalid phone" });

    if (!validatePassword(password))
      return res.status(400).json({ error: "Weak password" });

    const user = await admin.auth().createUser({
      email,
      phoneNumber: fullPhone,
      password,
      displayName: `${firstName} ${lastName || ""}`,
    });

    // ✅ SET CUSTOM CLAIM (CRITICAL)
    await admin.auth().setCustomUserClaims(user.uid, {
      role: "doctor",
    });

    await db.collection("doctors").doc(user.uid).set({
      uid: user.uid,
      firstName,
      middleName: middleName || "",
      lastName: lastName || "",
      phone: fullPhone,
      email,
      gender,
      specialisation,
      password: await bcrypt.hash(password, 10),
      role: "doctor",
      profileCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: "Doctor registered successfully",
      uid: user.uid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =======================================================
// LOGIN DOCTOR (WITH TOKEN) ✅ REQUIRED
// =======================================================
exports.loginDoctor = onRequest(async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password required" });
    }

    const fullPhone = formatPhone(phone);
    if (!fullPhone) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    // 1️⃣ Get Firebase Auth user
    const user = await admin
      .auth()
      .getUserByPhoneNumber(fullPhone)
      .catch(() => null);

    if (!user) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // 2️⃣ Firestore doctor record
    const snap = await db.collection("doctors").doc(user.uid).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Doctor record missing" });
    }

    // 3️⃣ Password check
    const isMatch = await bcrypt.compare(password, snap.data().password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // ✅ CREATE FIREBASE CUSTOM TOKEN (CRITICAL)
    const customToken = await admin.auth().createCustomToken(user.uid);

    return res.json({
      success: true,
      uid: user.uid,
      role: "doctor",
      token: customToken, // 🔑 THIS WAS MISSING
      message: "Login successful",
    });

  } catch (err) {
    console.error("loginDoctor error:", err);
    return res.status(500).json({ error: err.message });
  }
});


// =======================================================
// 5️⃣ UPDATE DOCTOR PROFILE (AUTH PROTECTED)
// =======================================================
exports.updateDoctorProfile = async (req, res) => {
  try {
    const uid = await verifyRole(req, "doctor");
    const { dob, address, age, profilePicture } = req.body;

    await db.collection("doctors").doc(uid).update({
      dob,
      address,
      age,
      profilePicture: profilePicture || null,
      profileCompleted: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/// =======================================================
// 6️⃣ GET DOCTOR PROFILE (AUTH PROTECTED)
// =======================================================
exports.getDoctorProfile = async (req, res) => {
  try {
    const uid = await verifyRole(req, "doctor");

    const snap = await db.collection("doctors").doc(uid).get();
    if (!snap.exists)
      return res.status(404).json({ error: "Doctor not found" });

    res.json({ success: true, data: snap.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 7️⃣ SET DOCTOR AVAILABILITY (AUTH PROTECTED)
// =======================================================
exports.setDoctorAvailability = async (req, res) => {
  try {
    const uid = await verifyRole(req, "doctor");
    const { weeklySchedule, slotDuration } = req.body;

    await db.collection("doctors").doc(uid).update({
      availability: {
        weeklySchedule,
        slotDuration,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, message: "Availability updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =======================================================
// 8️⃣ DOCTOR DASHBOARD STATS (AUTH PROTECTED)
// =======================================================
exports.getDoctorDashboard = async (req, res) => {
  try {
    const uid = await verifyRole(req, "doctor");
    const today = new Date().toISOString().split("T")[0];

    const snap = await db
      .collection("appointments")
      .where("doctorId", "==", uid)
      .get();

    const stats = {
      today: 0,
      upcoming: 0,
      completed: 0,
    };

    snap.docs.forEach(doc => {
      const a = doc.data();
      if (a.appointmentDate === today) stats.today++;
      if (a.status === "completed") stats.completed++;
      if (["requested", "approved"].includes(a.status)) stats.upcoming++;
    });

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};