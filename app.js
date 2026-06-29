const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

const db = mysql.createConnection({
    host: 'bjntcif47a8lijewmwxx-mysql.services.clever-cloud.com',
    user: 'uwnoosni3svl2uw5',
    password: 'fwqBvO9UjW7e3UrrKjIk',
    database: 'bjntcif47a8lijewmwxx'
});

app.get("/books", (req, res) => {
    const user = req.session.username;
    if (!user) return res.json([]);
    
    if (user === 'guest') {
        res.json([{id: 1, title: "Guest Book", author: "Admin", year: 2024}]);
    } else {
        // 🔥 ΕΔΩ ΕΙΝΑΙ Η ΑΛΛΑΓΗ: Πάντα φιλτράρουμε με το username!
        db.query("SELECT * FROM books WHERE username = ?", [user], (err, results) => {
            res.json(results || []);
        });
    }
});

app.post("/books", (req, res) => {
    if (!req.session.username) return res.status(401).send();
    const book = { ...req.body, username: req.session.username }; // 🔥 ΑΠΟΘΗΚΕΥΣΗ ΜΕ USERNAME
    db.query("INSERT INTO books SET ?", book, () => res.send());
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send();
});

app.listen(3000);