const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();

const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || 'bjntcif47a8lijewmwxx-mysql.services.clever-cloud.com',
    user: process.env.DB_USER || 'uwnoosni3svl2uw5',
    password: process.env.DB_PASSWORD || 'fwqBvO9UjW7e3UrrKjIk',
    database: process.env.DB_NAME || 'bjntcif47a8lijewmwxx',
    waitForConnections: true,
    queueLimit: 0
});


db.on('error', (err) => console.log('Database error:', err));

app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: 'secret-key-123', resave: false, saveUninitialized: true }));

app.get("/check-auth", (req, res) => {
    res.json({ authenticated: !!req.session.username, username: req.session.username });
});

app.post("/login", (req, res) => {
    req.session.username = req.body.username;
    res.send({ success: true });
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send({ success: true });
});

app.get("/books", (req, res) => {
    if (!req.session.username) return res.json([]);
    const sql = "SELECT * FROM books WHERE username = ?";
    db.query(sql, [req.session.username], (err, results) => {
        res.json(results || []);
    });
});

app.post("/books", (req, res) => {
    if (!req.session.username) return res.status(401).send();
    const book = { ...req.body, username: req.session.username };
    db.query("INSERT INTO books SET ?", book, (err) => {
        res.send({ success: !err });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));
