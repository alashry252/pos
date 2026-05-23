const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');

// 🛡️ استدعاء مكتبات الحماية المتقدمة
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// تحميل المتغيرات البيئية من ملف .env
dotenv.config();

const app = express();

// إعداد محرك قوالب الواجهة EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 1. قراءة البيانات الأساسية (يجب أن تكون أولاً)
// ==========================================
// قراءة البيانات المرسلة بصيغة JSON بأمان مع تحديد حجم أقصى لمنع هجمات الإغراق
app.use(express.json({ limit: '10kb' })); 
// قراءة البيانات المرسلة من النماذج (Forms)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// قراءة ملفات الكوكيز للتعامل مع الـ Tokens
app.use(cookieParser());

// ==========================================
// 2. بوابات الحماية (Security Middlewares)
// ==========================================
// حماية الـ HTTP Headers (تم إيقاف CSP مؤقتاً لتجنب تعارضات ملفات التصميم)
app.use(helmet({ contentSecurityPolicy: false }));

// منع هجمات الـ NoSQL Injection بتنظيف المدخلات (يجب أن توضع بعد قراءة البيانات)
// app.use(mongoSanitize());

// تحديد عدد الطلبات لمنع هجمات التخمين العشوائي (DDoS & Brute-force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 50, // أقصى عدد طلبات من نفس الـ IP
    message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً.'
});
app.use('/auth', loginLimiter);

// ==========================================
// 3. تحديد مجلدات الملفات الثابتة (Static Files)
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/vendor/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));

// ==========================================
// 4. الاتصال بقاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Enterprise Database...'))
    .catch(err => {
        console.error('❌ Failed to connect to MongoDB:', err.message);
        console.log('💡 تأكد من تشغيل خدمة MongoDB على جهازك (Localhost).');
        process.exit(1); // إغلاق الخادم فوراً في حال فشل الاتصال لحماية النظام
    });

// ==========================================
// 5. استدعاء المسارات (Routes)
// ==========================================
const { requireAuth } = require('./middlewares/authMiddleware');
const adminController = require('./controllers/adminController');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

// ربط المسارات بالخادم
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

// مسار لوحة القيادة الرئيسي (Dashboard)
app.get('/dashboard', requireAuth, adminController.getDashboard);
// إعادة توجيه المسار الرئيسي (/) تلقائيا إلى صفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

// ==========================================
// 6. صائد الأخطاء العام (Global Error Handler)
// ==========================================
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(500).send('حدث خطأ داخلي في الخادم. نحن نعمل على حله.');
});

// ==========================================
// تشغيل الخادم
// ==========================================
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Nexus Campaign Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;