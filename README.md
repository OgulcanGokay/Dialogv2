# Dia-Log (Dialogv2)

Glucose prediction demo project with:
- **Frontend:** React + Vite + TypeScript
- **Backend:** FastAPI (`/predict` endpoint)

> Uygulama 2 ayrı process olarak çalışır:  
> **(1) Backend (FastAPI)** + **(2) Frontend (Vite)**

---

## Why FastAPI?
Bu projede FastAPI kullanmamızın sebebi:
- **Hızlı geliştirme:** Minimum boilerplate ile kısa sürede API ayağa kalkar.
- **Yüksek performans:** ASGI tabanlıdır, düşük gecikmeyle çalışır.
- **Otomatik dokümantasyon:** Swagger UI otomatik gelir: `http://127.0.0.1:8000/docs`
- **Pydantic ile tip güvenliği:** Request/response şemaları netleşir, hatalar erken yakalanır.
- **Frontend entegrasyonu kolay:** React tarafı için tek bir stabil endpoint (`/predict`) sunar; CORS/LAN kontrol edilebilir.

---

## Project Structure
- `api/` → FastAPI backend
- `components/`, `services/`, `context/`, `types.ts` → Frontend source

---

## Requirements
- **Node.js** (recommended: 18+)
- **Python** (recommended: 3.10+)

---

## Environment Variables

### Frontend: `.env.local`
Proje kök dizininde `.env.local` oluşturun (veya güncelleyin):

```env
# Backend base URL (local geliştirme için)
VITE_API_BASE=http://127.0.0.1:8000

# Opsiyonel: Eğer projede Gemini kullanıyorsan
GEMINI_API_KEY=YOUR_GEMINI_KEY
```

### ⚠️ Backend IP Adresi
Eğer frontend'i telefondan/başka PC'den açıyorsan `127.0.0.1` çalışmaz.  
`VITE_API_BASE` değerini backend'in LAN IP'siyle değiştir:

```env
VITE_API_BASE=http://192.168.x.x:8000
```

---

## Quick Start: One-liner PowerShell

Aşağıdaki komutlar aynen senin akışın: **2 ayrı PowerShell penceresi aç**.

### PowerShell #1 (Backend)
```powershell
cd "E:\Downloads\Dia_Log\Dia-Log\api"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### PowerShell #2 (Frontend)
```powershell
cd "E:\Downloads\Dia_Log\Dia-Log"
npm install
npm run dev
```

---

## API Documentation
Backend çalışmaya başladıktan sonra Swagger UI'ya bakabilirsin:
- **Swagger:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc