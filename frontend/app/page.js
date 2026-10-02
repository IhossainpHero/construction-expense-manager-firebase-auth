"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

import "./style.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const today = () => new Date().toISOString().slice(0, 10);

const money = (n) => `৳${Number(n || 0).toLocaleString("en-BD")}`;

function AppHome({ user, appUser, onSignOut }) {
  const [tab, setTab] = useState("dashboard");
  const [adminUsers, setAdminUsers] = useState([]);

  const [dash, setDash] = useState({});
  const [parties, setParties] = useState([]);
  const [entries, setEntries] = useState([]);
  const [billTypes, setBillTypes] = useState([]);

  // =========================
  // Bill form
  // =========================

  const [form, setForm] = useState({
    partyId: "",
    type: "",
    date: today(),
    amount: "",
    productName: "",
    quantity: "",
    note: "",
  });

  // =========================
  // Payment form
  // =========================

  const [payment, setPayment] = useState({
    partyId: "",
    type: "",
    date: today(),
    amount: "",
    note: "",
    method: "Cash",
  });

  // =========================
  // New Party form
  // =========================

  const [newParty, setNewParty] = useState({
    name: "",
    type: "",
    phone: "",
  });

  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================
  // Load all data
  // =========================

  const authHeaders = async () => {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    setLoading(true);

    try {
      const headers = await authHeaders();
      const [d, p, e, types] = await Promise.all([
        fetch(API + "/dashboard", { headers }).then((r) => r.json()),
        fetch(API + "/parties", { headers }).then((r) => r.json()),
        fetch(API + "/entries", { headers }).then((r) => r.json()),
        fetch(API + "/bill-types", { headers }).then((r) => r.json()),
      ]);

      setDash(d);
      setParties(Array.isArray(p) ? p : []);
      setEntries(Array.isArray(e) ? e : []);
      setBillTypes(Array.isArray(types) ? types : []);
    } catch (e) {
      console.error(e);
      alert("Backend চালু আছে কি না দেখুন।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  // =========================
  // Search parties
  // =========================

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) {
      return parties;
    }

    return parties.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const type = (p.type || "").toLowerCase();

      return name.includes(q) || type.includes(q);
    });
  }, [parties, search]);

  // =========================
  // Common POST function
  // =========================

  async function post(url, body) {
    const r = await fetch(API + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify(body),
    });

    const j = await r.json();

    if (!r.ok) {
      throw new Error(j.message || "Save failed");
    }

    return j;
  }

  // =========================
  // Save Bill
  // =========================

  async function saveEntry(e) {
    e.preventDefault();

    try {
      if (!form.partyId) {
        alert("Shopkeeper নির্বাচন করুন");
        return;
      }

      if (!form.type.trim()) {
        alert("Bill-এর ধরন দিন");
        return;
      }

      await post("/entries", form);

      alert("Bill save হয়েছে");

      setForm({
        ...form,
        partyId: "",
        type: "",
        amount: "",
        productName: "",
        quantity: "",
        note: "",
      });

      await load();
    } catch (x) {
      console.error(x);
      alert(x.message);
    }
  }

  // =========================
  // Save Payment
  // =========================

  async function savePayment(e) {
    e.preventDefault();

    try {
      if (!payment.partyId) {
        alert("যাকে Payment করবেন তাকে নির্বাচন করুন");
        return;
      }

      const selectedParty = parties.find(
        (party) => party._id === payment.partyId,
      );

      const isShopkeeper = selectedParty?.type?.toLowerCase() === "shopkeeper";

      if (isShopkeeper && !payment.type) {
        alert("Bill-এর ধরন নির্বাচন করুন");
        return;
      }

      await post("/payments", payment);

      alert("Payment save হয়েছে");

      setPayment({
        ...payment,
        partyId: "",
        type: "",
        amount: "",
        note: "",
      });

      await load();
    } catch (x) {
      console.error(x);
      alert(x.message);
    }
  }

  // =========================
  // Create New Party
  // =========================

  async function saveParty(e) {
    e.preventDefault();

    try {
      if (!newParty.name.trim()) {
        alert("ব্যক্তির নাম দিন");
        return;
      }

      if (!newParty.type) {
        alert("ব্যক্তির ধরন নির্বাচন করুন");
        return;
      }

      await post("/parties", newParty);

      alert("নতুন ব্যক্তি তৈরি হয়েছে");

      setNewParty({
        name: "",
        type: "",
        phone: "",
      });

      await load();
    } catch (x) {
      console.error(x);
      alert(x.message);
    }
  }

  // =========================
  // Open party details
  // =========================

  async function openParty(id) {
    try {
      const r = await fetch(API + "/parties/" + id, { headers: await authHeaders() });

      if (!r.ok) {
        throw new Error("Party details load failed");
      }

      const data = await r.json();

      setDetail(data);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  // =========================
  // Delete entry
  // =========================

  async function del(id) {
    if (!confirm("এই হিসাবটি মুছে ফেলবেন?")) {
      return;
    }

    try {
      const r = await fetch(API + "/entries/" + id, {
        method: "DELETE",
        headers: await authHeaders(),
      });

      if (!r.ok) {
        throw new Error("Delete failed");
      }

      await load();

      if (detail) {
        openParty(detail._id);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function loadAdminUsers() {
    try {
      const r = await fetch(API + "/admin/users", { headers: await authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Admin users load failed");
      setAdminUsers(Array.isArray(data) ? data : []);
    } catch (e) { alert(e.message); }
  }

  async function approveUser(id) {
    try {
      const r = await fetch(API + `/admin/users/${id}/approve`, { method: "PATCH", headers: await authHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Approve failed");
      await loadAdminUsers();
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="app">
      {/* =========================
          Header
      ========================= */}

      <header>
        <div>
          <h1>🏠 বাড়ি নির্মাণের হিসাব</h1>
          <p>Construction Expense Manager</p>
        </div>

        <nav>
          {[
            ["dashboard", "Dashboard"],
            ["entries", "নতুন Bill"],
            ["payments", "Payment যোগ"],
            ["createParty", "নতুন ব্যক্তি"],
            ["parties", "সব হিসাব"],
            ...(appUser?.role === "admin" ? [["admin", "👑 Admin"]] : []),
          ].map((x) => (
            <button
              className={tab === x[0] ? "active" : ""}
              onClick={() => setTab(x[0])}
              key={x[0]}
            >
              {x[1]}
            </button>
          ))}
        </nav>
        <div className="auth-user">
          {appUser?.photoURL && <img src={appUser.photoURL} alt="" />}
          <span>{appUser?.name || appUser?.email}</span>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {/* =========================
          Main
      ========================= */}

      <main>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <>
            {/* Dashboard */}

            {tab === "dashboard" && (
              <Dashboard
                d={dash}
                entries={entries}
                onOpen={() => setTab("parties")}
              />
            )}

            {/* New Bill */}

            {tab === "entries" && (
              <BillForm
                f={form}
                setF={setForm}
                onSubmit={saveEntry}
                parties={parties}
              />
            )}

            {/* Payment */}

            {tab === "payments" && (
              <PaymentForm
                f={payment}
                setF={setPayment}
                onSubmit={savePayment}
                parties={parties}
                billTypes={billTypes}
              />
            )}

            {/* Create New Party */}

            {tab === "createParty" && (
              <CreateParty
                f={newParty}
                setF={setNewParty}
                onSubmit={saveParty}
              />
            )}

            {/* All Parties */}

            {tab === "parties" && (
              <PartyList
                parties={filtered}
                search={search}
                setSearch={setSearch}
                open={openParty}
              />
            )}

            {tab === "admin" && appUser?.role === "admin" && (
              <AdminPanel users={adminUsers} onLoad={loadAdminUsers} onApprove={approveUser} />
            )}
          </>
        )}
      </main>

      {/* =========================
          Ledger Modal
      ========================= */}

      {detail && <Modal p={detail} close={() => setDetail(null)} del={del} />}
    </div>
  );
}

// ======================================================
// Dashboard
// ======================================================

function Dashboard({ d, entries, onOpen }) {
  return (
    <section>
      <h2>Dashboard</h2>

      <div className="cards">
        <Card t="মোট Bill" v={money(d.totalBill)} />

        <Card t="মোট Paid" v={money(d.totalPaid)} />

        <Card t="বর্তমান Due" v={money(d.totalDue)} danger />

        {(d.typePaid || []).map((item) => (
          <Card
            key={item.type}
            t={`${item.type}কে Paid`}
            v={money(item.amount)}
          />
        ))}
      </div>

      <div className="panel">
        <div className="panelHead">
          <h3>সাম্প্রতিক হিসাব</h3>

          <button onClick={onOpen}>সব হিসাব</button>
        </div>

        {entries.slice(0, 8).map((e) => (
          <div className="row" key={e._id}>
            <div>
              <b>{e.partyId?.name || "অজানা"}</b>

              <small>
                {new Date(e.date).toLocaleDateString("en-GB")}

                {" · "}

                {e.kind === "bill" ? "Bill" : "Payment"}

                {e.type ? ` · ${e.type}` : ""}

                {e.note ? ` · ${e.note}` : ""}
              </small>
            </div>

            <strong>{money(e.amount)}</strong>
          </div>
        ))}

        {!entries.length && <div className="empty">এখনও কোনো হিসাব নেই</div>}
      </div>
    </section>
  );
}

// ======================================================
// Card
// ======================================================

function Card({ t, v, danger }) {
  return (
    <div className={"card " + (danger ? "danger" : "")}>
      <span>{t}</span>

      <b>{v}</b>
    </div>
  );
}

// ======================================================
// Create Party
// ======================================================

function CreateParty({ f, setF, onSubmit }) {
  const set = (key, value) => {
    setF({
      ...f,
      [key]: value,
    });
  };

  return (
    <section className="panel form">
      <h2>নতুন ব্যক্তি তৈরি করুন</h2>

      <p className="muted">
        এখানে Shopkeeper, Mistri বা Kamla তৈরি করতে পারবেন।
      </p>

      <form onSubmit={onSubmit}>
        <div className="grid">
          {/* Name */}

          <Field l="ব্যক্তির নাম *">
            <input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="যেমন: Haji Khaleq"
              required
            />
          </Field>

          {/* Type */}

          <Field l="ব্যক্তির ধরন *">
            <select
              value={f.type}
              onChange={(e) => set("type", e.target.value)}
              required
            >
              <option value="">ধরন নির্বাচন করুন</option>

              <option value="shopkeeper">Shopkeeper</option>

              <option value="mistri">Mistri</option>

              <option value="kamla">Kamla</option>
            </select>
          </Field>

          {/* Phone */}

          <Field l="Phone (Optional)">
            <input
              type="tel"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </Field>
        </div>

        <button type="submit" className="primary">
          ব্যক্তি তৈরি করুন
        </button>
      </form>
    </section>
  );
}

// ======================================================
// Bill Form
// ======================================================

function BillForm({ f, setF, onSubmit, parties }) {
  const set = (key, value) => {
    setF({
      ...f,
      [key]: value,
    });
  };

  const shopkeepers = parties.filter(
    (party) => party.type?.toLowerCase() === "shopkeeper",
  );

  return (
    <section className="panel form">
      <h2>নতুন Bill / দেনা যোগ করুন</h2>

      <p className="muted">এখানে শুধু Shopkeeper-এর Bill তৈরি করা যাবে।</p>

      {!shopkeepers.length && (
        <div className="empty">আগে একজন Shopkeeper যোগ করুন।</div>
      )}

      <form onSubmit={onSubmit}>
        <div className="grid">
          {/* Shopkeeper */}

          <Field l="Shopkeeper *">
            <select
              value={f.partyId}
              onChange={(e) => set("partyId", e.target.value)}
              required
            >
              <option value="">Shopkeeper নির্বাচন করুন</option>

              {shopkeepers.map((party) => (
                <option key={party._id} value={party._id}>
                  {party.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Bill Type */}

          <Field l="Bill-এর ধরন *">
            <input
              value={f.type}
              onChange={(e) => set("type", e.target.value)}
              placeholder="রড / সিমেন্ট / ইট..."
              required
            />
          </Field>

          {/* Date */}

          <Field l="তারিখ *">
            <input
              type="date"
              value={f.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </Field>

          {/* Amount */}

          <Field l="টাকার পরিমাণ *">
            <input
              type="number"
              min="1"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              required
            />
          </Field>
        </div>

        {/* Product */}

        <div className="grid">
          <Field l="পণ্যের নাম (Optional)">
            <input
              value={f.productName}
              onChange={(e) => set("productName", e.target.value)}
              placeholder="রড, সিমেন্ট, ইট..."
            />
          </Field>

          <Field l="Quantity (Optional)">
            <input
              value={f.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="10 বস্তা / 2 বান্ডিল"
            />
          </Field>
        </div>

        {/* Note */}

        <Field l="Note (Optional)">
          <textarea
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="যেমন: Foundation-এর মাল"
          />
        </Field>

        <button type="submit" className="primary">
          Save Bill
        </button>
      </form>
    </section>
  );
}

// ======================================================
// Payment Form
// ======================================================

function PaymentForm({ f, setF, onSubmit, parties, billTypes }) {
  const set = (key, value) => {
    setF({
      ...f,
      [key]: value,
    });
  };

  const selectedParty = parties.find((party) => party._id === f.partyId);

  const isShopkeeper = selectedParty?.type?.toLowerCase() === "shopkeeper";

  return (
    <section className="panel form">
      <h2>Payment যোগ করুন</h2>

      <p className="muted">
        Shopkeeper, Mistri বা Kamla — যেকোনো ব্যক্তিকে Payment দিতে পারবেন।
      </p>

      <form onSubmit={onSubmit}>
        <div className="grid">
          {/* Person */}

          <Field l="যাকে Payment করবেন *">
            <select
              value={f.partyId}
              onChange={(e) => {
                setF({
                  ...f,
                  partyId: e.target.value,
                  type: "",
                });
              }}
              required
            >
              <option value="">ব্যক্তি নির্বাচন করুন</option>

              {parties.map((party) => (
                <option key={party._id} value={party._id}>
                  {party.name} — {party.type}
                </option>
              ))}
            </select>
          </Field>

          {/* Bill Type
              শুধু Shopkeeper-এর জন্য */}

          {isShopkeeper && (
            <Field l="Bill-এর ধরন *">
              <select
                value={f.type}
                onChange={(e) => set("type", e.target.value)}
                required
              >
                <option value="">ধরন নির্বাচন করুন</option>

                {billTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Date */}

          <Field l="তারিখ *">
            <input
              type="date"
              value={f.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </Field>

          {/* Amount */}

          <Field l="Payment Amount *">
            <input
              type="number"
              min="1"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
              required
            />
          </Field>

          {/* Method */}

          <Field l="Payment Method">
            <select
              value={f.method}
              onChange={(e) => set("method", e.target.value)}
            >
              <option value="Cash">Cash</option>

              <option value="Bank">Bank</option>

              <option value="bKash">bKash</option>

              <option value="Nagad">Nagad</option>

              <option value="Other">Other</option>
            </select>
          </Field>
        </div>

        {/* Note */}

        <Field l="Note (Optional)">
          <textarea
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="যেমন: ৫ দিনের মজুরি"
          />
        </Field>

        <button type="submit" className="primary">
          Payment Save করুন
        </button>
      </form>
    </section>
  );
}

// ======================================================
// Field
// ======================================================

function Field({ l, children }) {
  return (
    <label>
      <span>{l}</span>
      {children}
    </label>
  );
}

// ======================================================
// Party List
// ======================================================

function PartyList({ parties, search, setSearch, open }) {
  return (
    <section>
      <div className="toolbar">
        <div>
          <h2>সব হিসাব</h2>

          <p className="muted">প্রত্যেক ব্যক্তি/দোকানির সম্পূর্ণ Ledger</p>
        </div>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম / ধরন Search..."
        />
      </div>

      <div className="partygrid">
        {parties.map((p) => {
          const isShopkeeper = p.type?.toLowerCase() === "shopkeeper";

          return (
            <button className="party" key={p._id} onClick={() => open(p._id)}>
              {/* Name + Type */}

              <div className="partyTop">
                <div>
                  <b>{p.name}</b>

                  <small>{p.type}</small>
                </div>
              </div>

              {/* Shopkeeper */}

              {isShopkeeper ? (
                <>
                  <div className="stats">
                    <span>
                      Bill
                      <b>{money(p.totalBill)}</b>
                    </span>

                    <span>
                      Paid
                      <b>{money(p.totalPaid)}</b>
                    </span>
                  </div>

                  <div className="due">Due {money(p.due)}</div>
                </>
              ) : (
                /* Mistri / Kamla */

                <div className="stats">
                  <span>
                    Paid
                    <b>{money(p.totalPaid)}</b>
                  </span>
                </div>
              )}

              <div className="muted">বিস্তারিত Ledger দেখতে Click করুন →</div>
            </button>
          );
        })}

        {!parties.length && <div className="empty">কোনো হিসাব পাওয়া যায়নি</div>}
      </div>
    </section>
  );
}

// ======================================================
// Modal / Full Ledger
// ======================================================

function Modal({ p, close, del }) {
  const isShopkeeper = p.type?.toLowerCase() === "shopkeeper";

  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}

        <div className="panelHead">
          <div>
            <h2>{p.name}</h2>

            <p className="muted">{p.type}</p>

            {p.phone && <small>📞 {p.phone}</small>}
          </div>

          <button onClick={close}>✕</button>
        </div>

        {/* Summary */}

        <div className="summary">
          {isShopkeeper && (
            <div>
              <span>Bill</span>

              <b>{money(p.totalBill)}</b>
            </div>
          )}

          <div>
            <span>Paid</span>

            <b>{money(p.totalPaid)}</b>
          </div>

          {isShopkeeper && (
            <div>
              <span>Due</span>

              <b>{money(p.due)}</b>
            </div>
          )}
        </div>

        {/* Ledger */}

        <h3>সম্পূর্ণ Ledger</h3>

        <div className="ledger">
          {p.entries.map((e) => (
            <div className="ledgerRow" key={e._id}>
              <div>
                <b>
                  {new Date(e.date).toLocaleDateString("en-GB")}

                  {" · "}

                  {e.kind === "bill" ? "Bill" : "Payment"}
                </b>

                <small>
                  {e.type ? `ধরন: ${e.type}` : ""}

                  {e.productName ? ` · পণ্য: ${e.productName}` : ""}

                  {e.quantity ? ` · Qty: ${e.quantity}` : ""}

                  {e.method ? ` · ${e.method}` : ""}

                  {e.note ? ` · ${e.note}` : ""}
                </small>
              </div>

              <strong>{money(e.amount)}</strong>

              <button onClick={() => del(e._id)}>Delete</button>
            </div>
          ))}

          {!p.entries.length && (
            <div className="empty">এই ব্যক্তির কোনো Ledger নেই</div>
          )}
        </div>
      </div>
    </div>
  );
}


function AdminPanel({ users, onLoad, onApprove }) {
  useEffect(() => { onLoad(); }, []);
  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <h2>👑 Admin Panel</h2>
          <p className="muted">Google দিয়ে sign in করা সব user-এর approval এখান থেকে নিয়ন্ত্রণ করুন।</p>
        </div>
        <button onClick={onLoad}>Refresh</button>
      </div>
      <div className="admin-list">
        {users.map((u) => (
          <div className="admin-user-row" key={u._id}>
            <div className="admin-user-main">
              {u.photoURL ? <img src={u.photoURL} alt="" /> : <div className="avatar-fallback">{(u.name || u.email || "?")[0]}</div>}
              <div><b>{u.name || "No name"}</b><small>{u.email}</small></div>
            </div>
            <div className="admin-status">
              <span className={u.approved ? "status approved" : "status pending"}>{u.approved ? "Approved" : "Pending"}</span>
              {u.role === "admin" && <span className="status role">Admin</span>}
              {!u.approved && <button className="primary small" onClick={() => onApprove(u._id)}>Approve & Give Admin Access</button>}
            </div>
          </div>
        ))}
        {!users.length && <div className="empty">কোনো user পাওয়া যায়নি।</div>}
      </div>
    </section>
  );
}

function AuthGate() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    setError("");
    if (!firebaseUser) { setUser(null); setAppUser(null); setPending(false); setLoading(false); return; }
    setUser(firebaseUser);
    try {
      const token = await firebaseUser.getIdToken(true);
      const r = await fetch(API + "/auth/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Sign-in sync failed");
      setAppUser(data.user);
      setPending(!data.user.approved);
    } catch (e) { setError(e.message); setAppUser(null); setPending(true); }
    finally { setLoading(false); }
  }), []);

  async function googleSignIn() {
    try { setError(""); await signInWithPopup(auth, googleProvider); }
    catch (e) { setError(e.message || "Google sign-in failed"); }
  }

  async function logout() { await signOut(auth); }

  if (loading) return <div className="auth-screen"><div className="auth-card"><h1>🏠 বাড়ি নির্মাণের হিসাব</h1><p>Account যাচাই করা হচ্ছে...</p></div></div>;
  if (!user) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon">🏠</div><h1>বাড়ি নির্মাণের হিসাব</h1><p>Google Account দিয়ে sign in করুন।</p>{error && <div className="auth-error">{error}</div>}<button className="google-btn" onClick={googleSignIn}>G&nbsp; Continue with Google</button></div></div>;
  if (pending || !appUser?.approved) return <div className="auth-screen"><div className="auth-card"><div className="auth-icon">⏳</div><h1>Approval Pending</h1><p><b>{user.email}</b></p><p>আপনার account sign in হয়েছে। Admin approval না পাওয়া পর্যন্ত project-এর কোনো data বা feature দেখা যাবে না।</p>{error && <div className="auth-error">{error}</div>}<button className="secondary-btn" onClick={logout}>Sign out</button></div></div>;
  return <AppHome user={user} appUser={appUser} onSignOut={logout} />;
}

export default AuthGate;
