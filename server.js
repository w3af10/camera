const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'data', 'log.json');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Garante que a pasta data existe
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Garante que o log.json existe
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

// =============================================
//  POST /api/log  —  Recebe dados de localização
// =============================================
app.post('/api/log', (req, res) => {
    try {
        const { latitude, longitude, accuracy, altitude, speed } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude e longitude são obrigatórios' });
        }

        const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));

        const entry = {
            id: logs.length + 1,
            latitude,
            longitude,
            accuracy: accuracy || null,
            altitude: altitude || null,
            speed: speed || null,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'],
            google_maps: `https://www.google.com/maps?q=${latitude},${longitude}`,
            timestamp: new Date().toISOString()
        };

        logs.push(entry);
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

        console.log(`[LOG] Nova localização: ${latitude}, ${longitude}`);
        res.json({ success: true, entry });
    } catch (err) {
        console.error('Erro ao salvar log:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// =============================================
//  GET /log.json  —  Retorna todos os logs
// =============================================
app.get('/log.json', (req, res) => {
    try {
        const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        res.json(logs);
    } catch (err) {
        res.json([]);
    }
});

// =============================================
//  GET /log  —  Painel visual dos logs
// =============================================
app.get('/log', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'log.html'));
});

// =============================================
//  DELETE /api/log  —  Limpa todos os logs
// =============================================
app.delete('/api/log', (req, res) => {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
    res.json({ success: true, message: 'Logs limpos' });
});

app.listen(PORT, () => {
    console.log(`
  ┌─────────────────────────────────────────┐
  │   GEO LOGGER rodando na porta ${PORT}        │
  │                                         │
  │   Página principal:  http://localhost:${PORT}  │
  │   Painel de logs:    http://localhost:${PORT}/log  │
  │   JSON dos logs:     http://localhost:${PORT}/log.json  │
  └─────────────────────────────────────────┘
    `);
});
