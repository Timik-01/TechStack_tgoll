// Lädt die lokalen Umgebungsvariablen aus der .env Datei
require('dotenv').config();

const express = require('express');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
const PORT = 3000;

// WICHTIG: Erlaubt Express, JSON-Daten aus dem Frontend zu lesen
app.use(express.json());

// Bringt Express bei, die index.html einen Ordner weiter oben zu finden
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

console.log("DEBUG URL:", process.env.TURSO_DATABASE_URL);
console.log("DEBUG TOKEN VORHANDEN?:", process.env.TURSO_AUTH_TOKEN ? "JA" : "NEIN");
// --- TURSO CLOUD-DATENBANK EINRICHTEN ---
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Tabelle und Start-Eintrag asynchron beim Serverstart anlegen
async function initDatabase() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                beruf TEXT,
                skills TEXT
            )
        `);

        const result = await db.execute("SELECT COUNT(*) as count FROM profile");
        // Bei Turso greift man über .rows auf die Daten zu
        const count = result.rows[0]?.count || 0;

        if (count === 0) {
            await db.execute({
                sql: "INSERT INTO profile (name, beruf, skills) VALUES (?, ?, ?)",
                args: ['Max Mustermann', 'Softwareentwickler', 'JavaScript, HTML, CSS']
            });
            console.log("Standard-Eintrag Max Mustermann wurde in der Cloud angelegt.");
        }
        console.log("Turso Cloud-Datenbank ist bereit!");
    } catch (err) {
        console.error("Fehler bei der Datenbank-Initialisierung:", err.message);
    }
}
initDatabase();


// --- API ROUTEN ---

// 1. Lebenslauf SPEICHERN (POST)
app.post('/api/lebenslaeufe', async (req, res) => {
    const { name, beruf, skills } = req.body;
    
    if (!name || !beruf || !skills) {
        return res.status(400).json({ error: "Bitte alle Felder ausfüllen!" });
    }

    try {
        const result = await db.execute({
            sql: "INSERT INTO profile (name, beruf, skills) VALUES (?, ?, ?)",
            args: [name, beruf, skills]
        });
        
        // Erfolg zurückmelden (Turso liefert die neue ID in lastInsertRowid)
        res.json({ 
            message: "Erfolgreich gespeichert!", 
            id: Number(result.lastInsertRowid) 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Lebensläufe ABRUFEN (GET)
app.get('/api/lebenslaeufe', async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM profile");
        
        // Turso gibt ein Objekt zurück, das Frontend erwartet aber ein reines Array.
        // Deshalb mappen wir die Zeilen sauber in das gewohnte Format um:
        const profiles = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            beruf: row.beruf,
            skills: row.skills
        }));

        res.json(profiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Lebenslauf LÖSCHEN (DELETE)
app.delete('/api/lebenslaeufe/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.execute({
            sql: "DELETE FROM profile WHERE id = ?",
            args: [id]
        });

        // rowsAffected zeigt uns, ob wirklich etwas gelöscht wurde
        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: "Lebenslauf mit dieser ID nicht gefunden." });
        }

        res.json({ message: "Lebenslauf erfolgreich gelöscht!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server starten (Nur lokal)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server läuft lokal unter http://localhost:${PORT}`);
    });
}

// WICHTIG FÜR VERCEL: Express-App exportieren
module.exports = app;