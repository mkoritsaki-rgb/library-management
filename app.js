const express = require("express");
const mysql = require("mysql2");
const bcrypt = require('bcryptjs'); // Χρήση bcryptjs για μέγιστη συμβατότητα στο Render
const session = require('express-session');
const app = express();

/* ==========================================================================
   🌟 MIDDLEWARES (Η ΣΩΣΤΗ ΣΕΙΡΑ ΓΙΑ ΝΑ ΔΟΥΛΕΥΟΥΝ ΤΑ FETCH & SESSIONS)
   ========================================================================== */

// 1. ΠΡΩΤΑ ΕΝΕΡΓΟΠΟΙΟΥΜΕ ΤΟ JSON: Για να μπορεί ο server να διαβάζει τα δεδομένα που στέλνει το frontend
app.use(express.json());

// 2. ΜΕΤΑ ΤΟ SESSION: Για να θυμάται ο server ποιος χρήστης είναι συνδεδεμένος
app.use(session({
    secret: 'mary_secret_key_123', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 ώρες διάρκεια
}));

// 3. ΤΕΛΕΥΤΑΙΟ ΤΟ STATIC: Σερβίρει τα αρχεία του frontend (HTML, CSS, JS) από τον φάκελο public
app.use(express.static("public"));

/* ==========================================================================
   🗄️ MYSQL CONNECTION (CLEVER CLOUD / LOCALHOST)
   ========================================================================== */
const db = mysql.createConnection({
  host: process.env.MYSQL_ADDON_HOST || "localhost",
  user: process.env.MYSQL_ADDON_USER || "root",
  password: process.env.MYSQL_ADDON_PASSWORD || "",
  database: process.env.MYSQL_ADDON_DB || "library2",
  port: process.env.MYSQL_ADDON_PORT || 3306
});

// 🔥 ΑΣΦΑΛΗΣ ΣΥΝΔΕΣΗ: Καταγράφει το λάθος χωρίς να ρίχνει τον server!
db.connect((err) => {
  if (err) {
    console.error("❌ DB Error αλλά ο server συνεχίζει κανονικά:", err.message);
    return;
  }
  console.log("✅ Συνδέθηκε στη MySQL (Clever Cloud/Local)!");
});

/* ==========================================================================
   🔒 AUTHENTICATION ENDPOINTS (REGISTER & LOGIN)
   ========================================================================== */

// 1. ΕΓΓΡΑΦΗ ΝΕΟΥ ΧΡΗΣΤΗ
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username και password είναι υποχρεωτικά" });
    }

    try {
        // Κρυπτογραφούμε τον κωδικό πριν τον αποθηκεύσουμε
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: "Το όνομα χρήστη χρησιμοποιείται ήδη" });
                }
                return res.status(500).json({ error: err });
            }
            res.json({ message: "Η εγγραφή έγινε με επιτυχία!" });
        });
    } catch (error) {
        res.status(500).json({ message: "Σφάλμα κατά την εγγραφή" });
    }
});

// 2. ΣΥΝΔΕΣΗ ΧΡΗΣΤΗ (LOGIN) - ΔΙΟΡΘΩΜΕΝΟ ΓΙΑ ΤΟ RENDER 🚀
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // 🔥 ΠΑΡΑΚΑΜΨΗ ΓΙΑ ΤΟ PORTFOLIO: 
    // Αν ζητηθεί login ως guest, περνάει κατευθείαν χωρίς να ρωτήσουμε τη βάση δεδομένων!
    if (username === "guest") {
        if (password === "guest123") {
            req.session.userId = 9999; // Εικονικό ID για να δουλεύουν τα sessions του guest
            req.session.username = "guest";
            return res.json({ message: "Συνδέθηκες ως Guest!", username: "guest" });
        } else {
            return res.status(400).json({ message: "Λάθος κωδικός Guest" });
        }
    }

    // Για όλους τους άλλους κανονικούς χρήστες, η MySQL και το Bcrypt δουλεύουν κανονικά
    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err });
        if (results.length === 0) return res.status(400).json({ message: "Λάθος username ή password" });

        const user = results[0];

        // Έλεγχος κρυπτογραφημένου κωδικού
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Λάθος username ή password" });

        // ΑΠΟΘΗΚΕΥΟΥΜΕ ΤΟΝ ΧΡΗΣΤΗ ΣΤΟ SESSION
        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({ message: "Συνδέθηκες επιτυχώς!", username: user.username });
    });
});

// 3. ΑΠΟΣΥΝΔΕΣΗ (LOGOUT)
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Αποσυνδέθηκες!" });
    });
});

// 4. ΕΛΕΓΧΟΣ ΑΝ ΕΙΝΑΙ ΣΥΝΔΕΔΕΜΕΝΟΣ Ο ΧΡΗΣΤΗΣ
app.get("/check-auth", (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});


/* ==========================================================================
   📚 BOOKS ENDPOINTS (ΠΡΟΣΤΑΤΕΥΜΕΝΑ ΜΕ USER_ID)
   ========================================================================== */

// Λίστα βιβλίων: Φέρνει ΜΟΝΟ τα βιβλία του συνδεδεμένου χρήστη
app.get("/books", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });

  db.query("SELECT * FROM books WHERE user_id = ?", [req.session.userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Προβολή ενός βιβλίου (αν ανήκει στον χρήστη)
app.get("/books/:id", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const id = req.params.id;

  db.query("SELECT * FROM books WHERE id = ? AND user_id = ?", [id, req.session.userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Δεν βρέθηκε βιβλίο" });
    res.json(results[0]);
  });
});

// Προσθήκη βιβλίου: Αποθηκεύεται ΜΑΖΙ με το user_id του χρήστη
app.post("/books", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const { title, author, year } = req.body;

  if (!title || !author) return res.status(400).json({ message: "title & author required" });

  db.query(
    "INSERT INTO books (title, author, year, user_id) VALUES (?, ?, ?, ?)",
    [title, author, year, req.session.userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        message: "Το βιβλίο προστέθηκε!",
        book: { id: result.insertId, title, author, year }
      });
    }
  );
});

// Ενημέρωση βιβλίου
app.put("/books/:id", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const id = req.params.id;
  const { title, author, year } = req.body;

  db.query(
    "UPDATE books SET title=?, author=?, year=? WHERE id=? AND user_id=?",
    [title, author, year, id, req.session.userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Δεν βρέθηκε βιβλίο" });
      res.json({ message: "Updated successfully" });
    }
  );
});

// Διαγραφή βιβλίου
app.delete("/books/:id", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const id = req.params.id;

  db.query("DELETE FROM books WHERE id=? AND user_id=?", [id, req.session.userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Deleted successfully" });
  });
});

/* ==========================================================================
   🚀 START SERVER
   ========================================================================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server τρέχει στη θύρα ${PORT}`);
});