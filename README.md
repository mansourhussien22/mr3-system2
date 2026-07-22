# MR3 System VS Project

نسخة منظمة من مشروع MR3 تقدر تفتحها في VS Code بسهولة، ومقسمة إلى:

- `frontend/`: ملفات الواجهة الحالية HTML/CSS/JS/images/pages.
- `backend/`: سيرفر Node.js بسيط بدون dependencies يخدم الواجهة ويوفر API لملف الداتا.
- `database/`: ملف الداتا `db.json` وملف schema يوضح الجداول.
- `docs/`: شرح الرفع على GitHub وخطوات التطوير.

## التشغيل

افتح Terminal داخل فولدر `MR3-VS-Project` وشغل:

```powershell
npm start
```

وبعدين افتح:

```text
http://127.0.0.1:3000/login.html
```

## فتحه في VS Code

افتح الملف ده مباشرة:

```text
MR3-System.code-workspace
```

أو من Terminal:

```powershell
code MR3-System.code-workspace
```

بيانات الدخول الافتراضية:

```text
admin@example.com
Admin@123456
```

## ملاحظات مهمة

- الواجهة الحالية ما زالت تستخدم `localStorage` في المتصفح زي النسخة الأصلية.
- `backend` و`database/db.json` جاهزين كبداية منظمة لو حبيت تنقل التخزين من LocalStorage إلى Backend API.
- API متاح تحت `/api`.

## API سريع

```text
GET    /api/health
GET    /api/db
PUT    /api/db
GET    /api/products
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

ينفع تبدل `products` بأي collection موجودة في `database/db.json`.

## الرفع على GitHub

شوف الملف:

```text
docs/GITHUB_SETUP.md
```
