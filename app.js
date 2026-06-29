const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'bjntcif47a8lijewmwxx-mysql.services.clever-cloud.com', 
    user: process.env.DB_USER || 'uwnoosni3svl2uw5',
    password: process.env.DB_PASSWORD || 'fwqBvO9UjW7e3UrrKjIk',
    database: process.env.DB_NAME || 'bjntcif47a8lijewmwxx'
});

app.use(express.json());
app.use(express.static('public'));

app.use(session({ 
    secret: 'secret-key-123', 
    resave: false, 
    saveUninitialized: true 
}));


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
    
    // Εδώ βεβαιώσου ότι τα ονόματα των στηλών είναι ακριβώς: title, author, year
    db.query("SELECT id, title, author, year FROM books WHERE username = ?", [req.session.username], (err, results) => {
        if (err) {
            console.error("SQL Error in GET:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results || []);
    });
});

// Προσθήκη Βιβλίου
app.post("/books", (req, res) => {
    if (!req.session.username) return res.status(401).send();
    
    const book = { 
        title: req.body.title, 
        author: req.body.author, 
        year: req.body.year, // Το πεδίο year που έχεις στη βάση
        username: req.session.username 
    };

    db.query("INSERT INTO books SET ?", book, (err) => {
        if (err) {
            console.error("SQL Error in POST:", err);
            return res.status(500).send("Error saving to database");
        }
        res.send({ success: true });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));