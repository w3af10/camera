# 📍 Geo Logger

Sistema que captura a geolocalização de quem acessa o link e salva num log JSON.

---

## 📂 Estrutura

```
geo-logger/
├── server.js          ← Servidor Express
├── package.json
├── public/
│   ├── index.html     ← Página que captura a localização
│   └── log.html       ← Painel visual dos logs
└── data/
    └── log.json       ← Logs salvos (criado automaticamente)
```

## 🔗 Rotas

| Rota           | Descrição                              |
|----------------|----------------------------------------|
| `/`            | Página principal (captura localização) |
| `/log`         | Painel visual com todos os logs        |
| `/log.json`    | Dados brutos em JSON                   |
| `/api/log`     | POST: salva / DELETE: limpa logs       |

---

## 🚀 Como rodar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Rode o servidor
npm start

# 3. Acesse no navegador
#    Página principal:  http://localhost:3000
#    Painel de logs:    http://localhost:3000/log
#    JSON bruto:        http://localhost:3000/log.json
```

---

## ☁️ Como hospedar GRÁTIS

### Opção 1: Render (recomendado)

1. Crie uma conta em [render.com](https://render.com)
2. Suba o projeto para o GitHub
3. No Render, clique **New → Web Service**
4. Conecte seu repositório
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Clique **Deploy** — pronto! Você recebe um link HTTPS

### Opção 2: Railway

1. Acesse [railway.app](https://railway.app)
2. Clique **New Project → Deploy from GitHub**
3. Selecione o repositório
4. Ele detecta automaticamente e faz deploy

### Opção 3: Fly.io

```bash
# Instale o CLI do Fly
curl -L https://fly.io/install.sh | sh

# Login e deploy
fly auth login
fly launch
fly deploy
```

---

## 📋 Exemplo de log.json

```json
[
  {
    "id": 1,
    "latitude": -23.550520,
    "longitude": -46.633308,
    "accuracy": 20,
    "altitude": null,
    "speed": null,
    "ip": "189.100.xx.xx",
    "user_agent": "Mozilla/5.0 ...",
    "google_maps": "https://www.google.com/maps?q=-23.550520,-46.633308",
    "timestamp": "2026-02-27T15:30:00.000Z"
  }
]
```

---

## ⚠️ Observações

- A geolocalização **só funciona em HTTPS** (todos os hosts acima fornecem HTTPS)
- O usuário precisa **permitir** o acesso à localização no navegador
- Os logs ficam salvos no servidor enquanto ele estiver rodando
- No Render gratuito, os dados podem ser perdidos ao reiniciar (use um banco de dados para persistência permanente)
