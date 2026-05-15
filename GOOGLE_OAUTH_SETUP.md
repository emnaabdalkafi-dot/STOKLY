# Google OAuth Setup Guide

## إعداد Google OAuth للمشروع

### الخطوة 1: إنشاء مشروع Google Cloud Console

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. فعل Google+ API و Google OAuth2 API

### الخطوة 2: إنشاء بيانات الاعتماد (Credentials)

1. في قائمة التنقل، اذهب إلى "APIs & Services" > "Credentials"
2. انقر على "Create Credentials" > "OAuth 2.0 Client IDs"
3. اختر "Web application" كنوع التطبيق
4. أضف اسم التطبيق (مثل: "STOKLY Admin")
5. في "Authorized redirect URIs"، أضف:
   - `http://localhost:8000/api/auth/google/callback` (للتطوير)
   - `https://yourdomain.com/api/auth/google/callback` (للإنتاج)

### الخطوة 3: تحديث ملف .env

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### الخطوة 4: إعداد الواجهة الأمامية

أضف زر "Connect with Google" في صفحة تسجيل الدخول:

```html
<a href="/api/auth/google" class="google-login-btn">
    <img src="https://developers.google.com/identity/images/btn_google_signin_dark_normal_web.png" alt="Sign in with Google">
</a>
```

### الخطوة 5: اختبار الوظيفة

1. تأكد من تشغيل الخادم: `php artisan serve`
2. اذهب إلى: `http://localhost:8000/api/auth/google`
3. سجل دخولك بحساب Google
4. ستتم إعادة توجيهك مع رمز الوصول

## API Endpoints

- `GET /api/auth/google` - إعادة توجيه إلى Google OAuth
- `GET /api/auth/google/callback` - معالجة رد Google OAuth

## ملاحظات مهمة

- يتم إنشاء حساب جديد تلقائياً للمستخدمين الجدد مع دور "admin"
- يتم حفظ صورة الملف الشخصي من Google كـ avatar
- جميع المستخدمين الذين يسجلون دخولهم عبر Google يحصلون على دور "admin" تلقائياً
- تأكد من أن حسابات Google المستخدمة للاختبار لها صلاحية الوصول للتطبيق