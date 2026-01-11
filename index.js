if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

/// ---------------- ENV ----------------
require("dotenv").config();

// ---------------- FIREBASE ----------------
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "samagra-nutricare-backend",
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "samagra-nutricare-backend",
  });
}

// ---------------- IMPORT MODULES ----------------
const patient = require("./patient");
const doctor = require("./doctor");
const appointments = require("./appointments");
const chat = require("./chat");
const report = require("./report");



// ===============================
// PATIENT FUNCTIONS
// ===============================
exports.sendEmailOTP = onRequest(patient.sendEmailOTP);
exports.verifyEmailOTP = onRequest(patient.verifyEmailOTP);
exports.registerPatient = onRequest(patient.registerPatient);
exports.loginPatient = onRequest(patient.loginPatient);
exports.updatePatientProfile = onRequest(patient.updatePatientProfile);

// ===============================
// DOCTOR FUNCTIONS
// ===============================
exports.sendDoctorEmailOTP = onRequest(doctor.sendDoctorEmailOTP);
exports.verifyDoctorEmailOTP = onRequest(doctor.verifyDoctorEmailOTP);
exports.registerDoctor = onRequest(doctor.registerDoctor);
exports.loginDoctor = onRequest(doctor.loginDoctor);
exports.updateDoctorProfile = onRequest(doctor.updateDoctorProfile);
exports.getDoctorProfile = onRequest(doctor.getDoctorProfile);

// ===============================
// APPOINTMENT FUNCTIONS
// ===============================
exports.createAppointment = onRequest(appointments.createAppointment);
exports.getDoctorAppointmentsByDate = onRequest(
  appointments.getDoctorAppointmentsByDate
);
exports.updateAppointmentStatus = onRequest(
  appointments.updateAppointmentStatus
);
exports.addAppointmentReport = onRequest(
  appointments.addAppointmentReport
);
exports.rescheduleAppointment = onRequest(
  appointments.rescheduleAppointment
);
exports.generateWeeklyAppointment = onRequest(
  appointments.generateWeeklyAppointment
);
exports.getMyAppointments = onRequest(
  appointments.getMyAppointments
);

exports.getAppointmentHistory = onRequest(
  appointments.getAppointmentHistory
);

// ---------------- CHAT FUNCTIONS ----------------
exports.createOrGetChat = onRequest(chat.createOrGetChat);
exports.sendMessage = onRequest(chat.sendMessage);
exports.getMessages = onRequest(chat.getMessages);
exports.getDoctorChats = onRequest(chat.getDoctorChats);
exports.getPatientChats = onRequest(chat.getPatientChats);



// ---------------- REPORT FUNCTIONS ----------------
exports.createReport = report.createReport;
exports.getReports = report.getReports;
exports.updateReport = report.updateReport;

