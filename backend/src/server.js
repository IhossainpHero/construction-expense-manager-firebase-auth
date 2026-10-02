import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

import firebaseAdmin from "./firebaseAdmin.js";
import Entry from "./models/Entry.js";
import Party from "./models/Party.js";
import User from "./models/User.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const ADMIN_EMAIL = "imran.hossainp952@gmail.com".toLowerCase();

// ======================================================
// Authentication
// ======================================================

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        message: "Sign in required",
      });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);

    const email = (decoded.email || "").toLowerCase();

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    // ==================================================
    // নতুন User
    // ==================================================

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email,
        name: decoded.name || "",
        photoURL: decoded.picture || "",

        // শুধু Admin automatically approved
        approved: email === ADMIN_EMAIL,

        role: email === ADMIN_EMAIL ? "admin" : "user",
      });
    }

    // ==================================================
    // Existing User
    // ==================================================
    else {
      user.email = email || user.email;
      user.name = decoded.name || user.name;
      user.photoURL = decoded.picture || user.photoURL;

      // Admin সবসময় approved থাকবে
      if (email === ADMIN_EMAIL) {
        user.approved = true;
        user.role = "admin";
      }

      // গুরুত্বপূর্ণ:
      // এখানে existing user's approved status
      // reset করা হচ্ছে না।
      //
      // তাই Admin panel থেকে approve করার পর
      // user আবার login করলেও approved থাকবে।

      await user.save();
    }

    req.firebaseUser = decoded;
    req.appUser = user;

    // ==================================================
    // Approval Check
    // ==================================================

    if (!user.approved) {
      return res.status(403).json({
        code: "PENDING_APPROVAL",
        message: "Admin approval required",
      });
    }

    next();
  } catch (e) {
    console.error("Auth error:", e.message);

    return res.status(401).json({
      message: "Invalid or expired sign-in",
    });
  }
}

// ======================================================
// Admin Middleware
// ======================================================

async function adminRequired(req, res, next) {
  if (req.appUser?.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

// ======================================================
// Helpers
// ======================================================

const money = (n) => Number(n || 0);

// ======================================================
// Health
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
  });
});

// ======================================================
// Firebase Auth Sync
// ======================================================

app.post("/api/auth/sync", async (req, res) => {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        message: "Sign in required",
      });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);

    const email = (decoded.email || "").toLowerCase();

    const isAdmin = email === ADMIN_EMAIL;

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    // ==================================================
    // New User
    // ==================================================

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email,
        name: decoded.name || "",
        photoURL: decoded.picture || "",

        approved: isAdmin,

        role: isAdmin ? "admin" : "user",
      });
    }

    // ==================================================
    // Existing User
    // ==================================================
    else {
      user.email = email || user.email;
      user.name = decoded.name || user.name;
      user.photoURL = decoded.picture || user.photoURL;

      // Admin automatically approved
      if (isAdmin) {
        user.approved = true;
        user.role = "admin";
      }

      // Existing user's approved status
      // এখানে পরিবর্তন করা হচ্ছে না।

      await user.save();
    }

    res.json({
      user,
    });
  } catch (e) {
    console.error("Auth sync error:", e);

    res.status(401).json({
      message: "Firebase sign-in verification failed",
    });
  }
});

// ======================================================
// Protected API
// ======================================================

app.use("/api", authRequired);

// ======================================================
// Current User
// ======================================================

app.get("/api/me", (req, res) => {
  res.json({
    uid: req.firebaseUser.uid,
    email: req.appUser.email,
    name: req.appUser.name,
    photoURL: req.appUser.photoURL,
    approved: req.appUser.approved,
    role: req.appUser.role || null,
  });
});

// ======================================================
// Admin - Get Users
// ======================================================

app.get("/api/admin/users", adminRequired, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();

    res.json(users);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Admin - Approve User
// ======================================================

app.patch("/api/admin/users/:id/approve", adminRequired, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          approved: true,
          role: "admin",
        },
      },
      {
        new: true,
      },
    ).lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Get All Parties
// ======================================================

app.get("/api/parties", async (req, res) => {
  try {
    const parties = await Party.find().sort({ name: 1 }).lean();

    const ids = parties.map((p) => p._id);

    const entries = await Entry.find({
      partyId: {
        $in: ids,
      },
    }).lean();

    const result = parties.map((party) => {
      const partyEntries = entries.filter(
        (entry) => String(entry.partyId) === String(party._id),
      );

      const totalBill = partyEntries
        .filter((entry) => entry.kind === "bill")
        .reduce((sum, entry) => sum + money(entry.amount), 0);

      const totalPaid = partyEntries
        .filter((entry) => entry.kind === "payment")
        .reduce((sum, entry) => sum + money(entry.amount), 0);

      const isShopkeeper = party.type?.toLowerCase() === "shopkeeper";

      return {
        ...party,

        totalBill: isShopkeeper ? totalBill : 0,

        totalPaid,

        due: isShopkeeper ? Math.max(0, totalBill - totalPaid) : 0,
      };
    });

    res.json(result);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Create Party
// ======================================================

app.post("/api/parties", async (req, res) => {
  try {
    const { name, type, phone } = req.body;

    if (!name?.trim() || !type?.trim()) {
      return res.status(400).json({
        message: "নাম ও ধরন দিন",
      });
    }

    const cleanName = name.trim();

    const cleanType = type.trim().toLowerCase();

    const cleanPhone = phone?.trim() || "";

    const existingParty = await Party.findOne({
      name: cleanName,
      type: cleanType,
    });

    if (existingParty) {
      return res.status(400).json({
        message: "এই ব্যক্তি আগে থেকেই আছে",
      });
    }

    const party = await Party.create({
      name: cleanName,
      type: cleanType,
      phone: cleanPhone,
    });

    res.status(201).json(party);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Get Single Party / Ledger
// ======================================================

app.get("/api/parties/:id", async (req, res) => {
  try {
    const party = await Party.findById(req.params.id).lean();

    if (!party) {
      return res.status(404).json({
        message: "Party পাওয়া যায়নি",
      });
    }

    const entries = await Entry.find({
      partyId: party._id,
    })
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    const totalBill = entries
      .filter((entry) => entry.kind === "bill")
      .reduce((sum, entry) => sum + money(entry.amount), 0);

    const totalPaid = entries
      .filter((entry) => entry.kind === "payment")
      .reduce((sum, entry) => sum + money(entry.amount), 0);

    const isShopkeeper = party.type?.toLowerCase() === "shopkeeper";

    res.json({
      ...party,

      entries,

      totalBill: isShopkeeper ? totalBill : 0,

      totalPaid,

      due: isShopkeeper ? Math.max(0, totalBill - totalPaid) : 0,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Get Bill Types
// ======================================================

app.get("/api/bill-types", async (req, res) => {
  try {
    const types = await Entry.distinct("type", {
      kind: "bill",
      type: {
        $exists: true,
        $ne: "",
      },
    });

    const cleanTypes = types
      .map((type) => type?.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "bn"));

    res.json(cleanTypes);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Create Bill / Entry
// ======================================================

app.post("/api/entries", async (req, res) => {
  try {
    const { partyId, type, date, amount, productName, quantity, note } =
      req.body;

    if (!partyId || !type?.trim() || !date || !(Number(amount) > 0)) {
      return res.status(400).json({
        message: "দোকানি, Bill-এর ধরন, তারিখ ও Amount দিন",
      });
    }

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({
        message: "দোকানি পাওয়া যায়নি",
      });
    }

    const isShopkeeper = party.type?.toLowerCase() === "shopkeeper";

    if (!isShopkeeper) {
      return res.status(400).json({
        message: "Mistri বা Kamla-এর জন্য Bill তৈরি করা যাবে না",
      });
    }

    const entry = await Entry.create({
      partyId: party._id,

      type: type.trim(),

      date,

      amount: Number(amount),

      productName: productName?.trim() || "",

      quantity: quantity?.trim() || "",

      note: note?.trim() || "",

      kind: "bill",
    });

    res.status(201).json(entry);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Create Payment
// ======================================================

app.post("/api/payments", async (req, res) => {
  try {
    const { partyId, type, date, amount, method, note } = req.body;

    if (!partyId || !date || !(Number(amount) > 0)) {
      return res.status(400).json({
        message: "ব্যক্তি, তারিখ ও Payment Amount দিন",
      });
    }

    const party = await Party.findById(partyId);

    if (!party) {
      return res.status(404).json({
        message: "ব্যক্তি পাওয়া যায়নি",
      });
    }

    const isShopkeeper = party.type?.toLowerCase() === "shopkeeper";

    // ==================================================
    // Shopkeeper Payment
    // ==================================================

    if (isShopkeeper) {
      if (!type?.trim()) {
        return res.status(400).json({
          message: "Bill-এর ধরন নির্বাচন করুন",
        });
      }

      const bills = await Entry.find({
        partyId: party._id,
        kind: "bill",
      }).lean();

      const totalBill = bills.reduce(
        (sum, entry) => sum + Number(entry.amount || 0),
        0,
      );

      const payments = await Entry.find({
        partyId: party._id,
        kind: "payment",
      }).lean();

      const totalPaid = payments.reduce(
        (sum, entry) => sum + Number(entry.amount || 0),
        0,
      );

      const due = Math.max(0, totalBill - totalPaid);

      if (Number(amount) > due) {
        return res.status(400).json({
          message: `বর্তমান বাকি ৳${due.toLocaleString(
            "en-BD",
          )} এর বেশি Payment দেওয়া যাবে না`,
        });
      }
    }

    // ==================================================
    // Create Payment
    // ==================================================

    const entry = await Entry.create({
      partyId: party._id,

      type: isShopkeeper ? type.trim() : "",

      date,

      amount: Number(amount),

      note: note?.trim() || "",

      method: method?.trim() || "",

      kind: "payment",
    });

    res.status(201).json(entry);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Delete Entry
// ======================================================

app.delete("/api/entries/:id", async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        message: "হিসাব পাওয়া যায়নি",
      });
    }

    await Entry.findByIdAndDelete(req.params.id);

    res.json({
      ok: true,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Dashboard
// ======================================================

app.get("/api/dashboard", async (req, res) => {
  try {
    const entries = await Entry.find().lean();

    const parties = await Party.find().lean();

    // ==================================================
    // Total Bill
    // ==================================================

    const totalBill = entries
      .filter((entry) => entry.kind === "bill")
      .reduce((sum, entry) => sum + money(entry.amount), 0);

    // ==================================================
    // Total Payment
    // ==================================================

    const totalPaid = entries
      .filter((entry) => entry.kind === "payment")
      .reduce((sum, entry) => sum + money(entry.amount), 0);

    // ==================================================
    // Shopkeeper IDs
    // ==================================================

    const shopkeeperIds = new Set(
      parties
        .filter((party) => party.type?.toLowerCase() === "shopkeeper")
        .map((party) => String(party._id)),
    );

    // ==================================================
    // Shopkeeper Paid
    // ==================================================

    const shopkeeperPaid = entries
      .filter(
        (entry) =>
          entry.kind === "payment" && shopkeeperIds.has(String(entry.partyId)),
      )
      .reduce((sum, entry) => sum + money(entry.amount), 0);

    // ==================================================
    // Current Due
    // ==================================================

    const totalDue = Math.max(0, totalBill - shopkeeperPaid);

    // ==================================================
    // Payment By Type
    // ==================================================

    const typePaidMap = {};

    entries
      .filter((entry) => entry.kind === "payment")
      .forEach((entry) => {
        const party = parties.find(
          (p) => String(p._id) === String(entry.partyId),
        );

        if (!party?.type) {
          return;
        }

        const partyType = party.type.trim();

        typePaidMap[partyType] =
          (typePaidMap[partyType] || 0) + money(entry.amount);
      });

    const typePaid = Object.entries(typePaidMap)
      .map(([type, amount]) => ({
        type,
        amount,
      }))
      .sort((a, b) => a.type.localeCompare(b.type, "bn"));

    // ==================================================
    // Dashboard Response
    // ==================================================

    res.json({
      totalBill,

      totalPaid,

      totalDue,

      shopkeeperPaid,

      typePaid,

      partyCount: parties.length,

      transactionCount: entries.length,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Get All Entries
// ======================================================

app.get("/api/entries", async (req, res) => {
  try {
    const entries = await Entry.find()
      .populate("partyId", "name type")
      .sort({
        date: -1,
        createdAt: -1,
      })
      .lean();

    res.json(entries);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: e.message,
    });
  }
});

// ======================================================
// Start Server
// ======================================================

const port = process.env.PORT || 5000;

mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/construction_expense_manager",
  )
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on ${port}`);
    });
  })
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);

    process.exit(1);
  });
