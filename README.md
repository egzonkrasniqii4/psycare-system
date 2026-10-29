# PsyCare

Bazë për një SaaS menaxhimi klinikash psikologjike: Django REST Framework, PostgreSQL dhe React.

## Si niset

Nga rrënja e projektit:

```powershell
docker compose up -d
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Vendose çelësin te `FIELD_ENCRYPTION_KEY` në `backend/.env`, pastaj:

```powershell
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Në një terminal tjetër:

```powershell
cd frontend
npm install
npm run dev
```

Hape [http://localhost:5173](http://localhost:5173).

Pa Docker, vendos `DB_ENGINE=sqlite` në `.env`. PostgreSQL mbetet databaza e synuar.

## Llogari demo

| Roli | Email | Fjalëkalimi |
| --- | --- | --- |
| Administrator | admin@psycare.local | Admin12345! |
| Psikolog | arta.dema@psycare.local | Therapist12345! |
| Pacient | telefon +355690000001 | kod SMS (në zhvillim shfaqet në ekran dhe në terminalin e Django-s) |

## API

Të gjitha rrugët poshtë `/api/auth/token/` kërkojnë `Authorization: Bearer <access>`.

| Metoda | Rruga | Kush |
| --- | --- | --- |
| POST | `/api/auth/token/` | hyrje me email dhe fjalëkalim |
| POST | `/api/auth/token/refresh/` | rifreskim i access token |
| POST | `/api/auth/phone/request/` | dërgon kod SMS (`purpose`: `register` me emër, mbiemër, email opsional; ose `login`) |
| POST | `/api/auth/phone/verify/` | verifikon kodin dhe kthen JWT; në regjistrim merr kartelën e krijuar nga stafi nëse përputhen emri dhe mbiemri |
| GET | `/api/auth/me/` | përdoruesi aktual |
| GET | `/api/dashboard/` | numrat e panelit |
| GET | `/api/therapists/` | admin, psikolog (vetëm aktivët; admini me `?all=1` sheh edhe joaktivët) |
| POST, PATCH, DELETE | `/api/therapists/` | vetëm admin; DELETE e çaktivizon llogarinë |
| CRUD | `/api/patients/` | të filtruar sipas rolit |
| CRUD | `/api/appointments/` | `from`, `to`, `patient`, `status` |
| CRUD | `/api/session-notes/` | vetëm admin dhe psikolog |
| CRUD | `/api/billing/` | shkrimi: admin dhe psikolog |

Testet: `python manage.py test` nga `backend`.
