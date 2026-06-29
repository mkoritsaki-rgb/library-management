const express = require("express");
const mysql = require("mysql2");
const bcrypt = require('bcryptjs'); 
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(session({
    secret: 'mary_secret_key_123', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static("public"));

/* ==========================================================================
   🗄️ MYSQL CONNECTION & AUTO-TABLE CREATION
   ========================================================================== */
let isDbConnected = false;

const db = mysql.createConnection({
  host: process.env.MYSQL_ADDON_HOST || "localhost",
  user: process.env.MYSQL_ADDON_USER || "root",
  password: process.env.MYSQL_ADDON_PASSWORD || "",
  database: process.env.MYSQL_ADDON_DB || "library2",
  port: process.env.MYSQL_ADDON_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Error - Γύρισμα σε Guest Mode:", err.message);
    isDbConnected = false;
    return;
  }
  console.log("✅ Συνδέθηκε στη MySQL!");
  isDbConnected = true;

  // 🔥 Αυτόματη δημιουργία πινάκων για να μη χρησιμοποιείς το phpMyAdmin
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    );
  `;

  const createBooksTable = `
    CREATE TABLE IF NOT EXISTS books (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      year INT,
      user_id INT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  db.query(createUsersTable, (err) => {
    if (err) console.error("Σφάλμα στον πίνακα users:", err.message);
    else {
      db.query(createBooksTable, (err) => {
        if (err) console.error("Σφάλμα στον πίνακα books:", err.message);
        else console.log("📊 Οι πίνακες της βάσης (users & books) είναι έτοιμοι!");
      });
    }
  });
});

// Εικονική βάση δεδομένων για το Guest Mode
let guestBooks = [
    { id: 1, title: "Το Μυστικό", author: "Rhonda Byrne", year: 2006 },
    { id: 2, title: "Νεφέλη και η Μαγική Βροχή", author: "Μαίρη Κάντα", year: 2024 }
];

/* ==========================================================================
   🔒 AUTHENTICATION ENDPOINTS (ΔΙΟΡΘΩΜΕΝΑ)
   ========================================================================== */

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username και password υποχρεωτικά" });
    if (!isDbConnected) return res.status(400).json({ message: "Η βάση είναι offline. Δοκιμάστε να συνδεθείτε ως Guest γράφοντας guest." });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err, result) => {
            if (err) return res.status(500).json({ error: err });
            res.json({ message: "Η εγγραφή έγινε με επιτυχία!" });
        });
    } catch (error) {
        res.status(500).json({ message: "Σφάλμα κατά την εγγραφή" });
    }
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Ελεγχόμενη είσοδος Guest: Μπαίνει ΜΟΝΟ αν το πληκτρολογήσει ο χρήστης
    if (username === "guest") {
        req.session.userId = 9999; 
        req.session.username = "guest";
        return res.json({ message: "Συνδέθηκες ως Guest!", username: "guest" });
    }

    if (!isDbConnected) {
        return res.status(400).json({ message: "Η βάση είναι offline. Πληκτρολογήστε 'guest' στο username για να περιηγηθείτε." });
    }

    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err });
        if (results.length === 0) return res.status(400).json({ message: "Λάθος username ή password" });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Λάθος username ή password" });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ message: "Συνδέθηκες επιτυχώς!", username: user.username });
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => { 
        res.clearCookie('connect.sid'); // Καθαρίζει το cookie για σίγουρη αποσύνδεση
        res.json({ message: "Αποσυνδέθηκες!" }); 
    });
});

app.get("/check-auth", (req, res) => {
    // ΑΦΑΙΡΕΘΗΚΕ ΤΟ ΑΥΤΟΜΑΤΟ GUEST LOGIN ΓΙΑ ΝΑ ΜΗΝ ΚΟΛΛΑΕΙ Η ΑΠΟΣΥΝΔΕΣΗ
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

/* ==========================================================================
   📚 BOOKS ENDPOINTS
   ========================================================================== */

app.get("/books", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });

  if (req.session.username === "guest" || !isDbConnected) {
      return res.json(guestBooks);
  }

  db.query("SELECT * FROM books WHERE user_id = ?", [req.session.userId], (err, results) => {
    if (err) return res.json(guestBooks);
    res.json(results);
  });
});

app.post("/books", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const { title, author, year } = req.body;

  if (req.session.username === "guest" || !isDbConnected) {
      const newBook = { id: Date.now(), title, author, year: parseInt(year) || "" };
      guestBooks.push(newBook);
      return res.json({ message: "Το βιβλίο προστέθηκε!", book: newBook });
  }

  db.query(
    "INSERT INTO books (title, author, year, user_id) VALUES (?, ?, ?, ?)",
    [title, author, year, req.session.userId],
    (err, result) => {
      if (err) {
          const newBook = { id: Date.now(), title, author, year: parseInt(year) || "" };
          guestBooks.push(newBook);
          return res.json({ message: "Το βιβλίο προστέθηκε!", book: newBook });
      }
      res.json({ message: "Το βιβλίο προστέθηκε!", book: { id: result.insertId, title, author, year } });
    }
  );
});

app.delete("/books/:id", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Παρακαλώ συνδεθείτε" });
  const id = parseInt(req.params.id);

  if (req.session.username === "guest" || !isDbConnected) {
      guestBooks = guestBooks.filter(book => book.id !== id);
      return res.json({ message: "Deleted successfully" });
  }

  db.query("DELETE FROM books WHERE id=? AND user_id=?", [id, req.session.userId], (err, result) => {
    if (err) {
        guestBooks = guestBooks.filter(book => book.id !== id);
        return res.json({ message: "Deleted successfully" });
    }
    res.json({ message: "Deleted successfully" });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server τρέχει στη θύρα ${PORT}`);
});