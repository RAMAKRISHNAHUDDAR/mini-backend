const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

// ================= DEV AUTH (NO TOKENS) =================
function verifyDevAuth(req) {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];

  if (!uid || !role) {
    throw new Error("Unauthorized: Missing dev auth headers");
  }

  return { uid, role };
}

// ================= TOKEN AUTH =================
async function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  // Emulator mode
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    return payload;
  }

  // Production
  return await admin.auth().verifyIdToken(token);
}

// ================= ROLE CHECK =================
exports.verifyRole = async (req, requiredRole) => {
  let decoded;

  // 🔁 DEV MODE (Postman testing)
  if (req.headers["x-user-id"]) {
    decoded = verifyDevAuth(req);
  } 
  // 🔐 TOKEN MODE (future / frontend)
  else {
    decoded = await verifyToken(req);
  }

  if (decoded.role !== requiredRole) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return decoded.uid;
};

// ================= MULTI-ROLE CHECK =================
exports.verifyAnyRole = async (req, allowedRoles) => {
  let decoded;

  if (req.headers["x-user-id"]) {
    decoded = verifyDevAuth(req);
  } else {
    decoded = await verifyToken(req);
  }

  if (!allowedRoles.includes(decoded.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return decoded;
};
