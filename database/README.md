# Database Folder

`db.json` هو ملف الداتا الرئيسي للنسخة المنظمة.

السيرفر يقرأ ويكتب هذا الملف من خلال:

```text
backend/server.cjs
```

مهم: الواجهة الحالية ما زالت تستخدم LocalStorage، لكن هذا الملف جاهز لو هتنقل التخزين إلى Backend API.

أمثلة:

```powershell
curl http://127.0.0.1:3000/api/products
curl http://127.0.0.1:3000/api/db
```
