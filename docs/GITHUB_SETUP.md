# GitHub Setup

افتح Terminal داخل فولدر `MR3-VS-Project` ثم شغل:

```powershell
git init
git add .
git commit -m "Initial MR3 organized project"
```

بعد ما تعمل Repository جديدة على GitHub، شغل:

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## تشغيل المشروع قبل الرفع

```powershell
npm start
```

الرابط المحلي:

```text
http://127.0.0.1:3000/login.html
```

## هيكل المشروع

```text
MR3-VS-Project/
  frontend/
  backend/
  database/
  docs/
```
