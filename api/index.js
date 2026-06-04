const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// WICHTIG: Erlaubt Express, JSON-Daten aus dem Frontend zu lesen
app.use(express.json());
app.use(express.static(__dirname));

// --- DATENBANK EINRICHTEN ---
// '/tmp/' ist der einzige Ort, an dem Vercel Schreibrechte erlaubt
const db = new sqlite3.Database('/tmp/lebenslaeufe.db', (err) => {
    if (err) console.error(err.message);
    console.log('Verbunden mit der SQLite-Datenbank.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        beruf TEXT,
        skills TEXT
    )`);

    db.get("SELECT COUNT(*) as count FROM profile", [], (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO profile (name, beruf, skills) VALUES ('Max Mustermann', 'Softwareentwickler', 'JavaScript, HTML, CSS')");
        }
    });
});

// --- API ROUTEN ---

// 1. NEU: Lebenslauf SPEICHERN (POST)
app.post('/api/lebenslaeufe', (req, res) => {
    const { name, beruf, skills } = req.body;
    
    // Validierung: Schauen, ob alle Felder ausgefüllt sind
    if (!name || !beruf || !skills) {
        return res.status(400).json({ error: "Bitte alle Felder ausfüllen!" });
    }

    const sql = "INSERT INTO profile (name, beruf, skills) VALUES (?, ?, ?)";
    db.run(sql, [name, beruf, skills], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // Erfolg zurückmelden (inklusive der neuen ID aus der Datenbank)
        res.json({ message: "Erfolgreich gespeichert!", id: this.lastID });
    });
});

// 2. Lebensläufe ABRUFEN (GET)
app.get('/api/lebenslaeufe', (req, res) => {
    db.all("SELECT * FROM profile", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Server starten
// Nur lokal starten, Vercel übernimmt das online selbst
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server läuft lokal unter http://localhost:${PORT}`);
    });
}

// WICHTIG FÜR VERCEL: Express-App exportieren
module.exports = app;