const express = require("express");
const mysql = require("mysql2");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.static("public"));

/* =========================
   MYSQL CONNECTION (ONLINE & LOCAL CONFIG)
========================= */
const db = mysql.createConnection({
  host: process.env.MYSQL_ADDON_HOST || "localhost",
  user: process.env.MYSQL_ADDON_USER || "root",
  password: process.env.MYSQL_ADDON_PASSWORD || "",
  database: process.env.MYSQL_ADDON_DB || "library2",
  port: process.env.MYSQL_ADDON_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Error:", err.message);
    return;
  }
  console.log("✅ Συνδέθηκε στη MySQL (Clever Cloud/Local)!");
});

/* =========================
   GET ALL BOOKS
========================= */
app.get("/books", (req, res) => {
  db.query("SELECT * FROM books", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    res.json(results);
  });
});

/* =========================
   GET BOOK BY ID
========================= */
app.get("/books/:id", (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM books WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Δεν βρέθηκε βιβλίο" });
    }

    res.json(results[0]);
  });
});

/* =========================
   ADD BOOK
========================= */
app.post("/books", (req, res) => {
  const { title, author, year } = req.body;

  console.log("BODY:", req.body);

  if (!title || !author) {
    return res.status(400).json({ message: "title & author required" });
  }

  db.query(
    "INSERT INTO books (title, author, year) VALUES (?, ?, ?)",
    [title, author, year],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      }

      res.json({
        message: "Το βιβλίο προστέθηκε!",
        book: {
          id: result.insertId,
          title,
          author,
          year
        }
      });
    }
  );
});

/* =========================
   UPDATE BOOK
========================= */
app.put("/books/:id", (req, res) => {
  const id = req.params.id;
  const { title, author, year } = req.body;

  db.query(
    "UPDATE books SET title=?, author=?, year=? WHERE id=?",
    [title, author, year, id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Δεν βρέθηκε βιβλίο" });
      }

      res.json({ message: "Updated successfully" });
    }
  );
});

/* =========================
   DELETE BOOK
========================= */
app.delete("/books/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM books WHERE id=?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    res.json({ message: "Deleted successfully" });
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server τρέχει στη θύρα ${PORT}`);
});