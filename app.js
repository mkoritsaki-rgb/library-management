const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use(session({ 
    secret: 'secret-key-123', 
    resave: false, 
    saveUninitialized: true 
}));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Έλεγχος ταυτότητας
app.get("/check-auth", (req, res) => {
    if (req.session.username) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// Login
app.post("/login", (req, res) => {
    req.session.username = req.body.username;
    req.session.save(); // Σημαντικό για να αποθηκευτεί το session
    res.send({ success: true });
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send({ success: true });
});

// Ανάκτηση Βιβλίων
app.get("/books", (req, res) => {
    if (!req.session.username) return res.json([]);
    db.query("SELECT * FROM books WHERE username = ?", [req.session.username], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results || []);
    });
});

// Προσθήκη Βιβλίου
app.post("/books", (req, res) => {
    if (!req.session.username) return res.status(401).send();
    const book = { ...req.body, username: req.session.username };
    db.query("INSERT INTO books SET ?", book, (err) => {
        if (err) return res.status(500).send(err);
        res.send({ success: true });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));