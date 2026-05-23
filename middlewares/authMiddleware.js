const jwt = require('jsonwebtoken');
// 🛡️ استدعاء موديل المستخدم للتحقق اللحظي من قاعدة البيانات
const User = require('../models/User');

// ==========================================
// 🔐 1. وسيط المصادقة المتقدم (Advanced Auth)
// ==========================================
exports.requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        // 1. التحقق من وجود التوكن أصلاً
        if (!token) {
            return res.redirect('/auth/login');
        }

        // 2. فك تشفير التوكن والتحقق من صحة التوقيع
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. 🔥 الحماية الصارمة (Real-time DB Check) 🔥
        // التأكد أن المستخدم ما زال موجوداً في الداتابيز وحسابه نشط
        const currentUser = await User.findById(decoded.id);
        if (!currentUser || currentUser.isActive === false) {
            res.clearCookie('token');
            return res.redirect('/auth/login?error=account_disabled');
        }

        // 4. حقن بيانات المستخدم الطازجة في الطلب
        req.user = currentUser;

        // 5. 🛡️ حماية ضد ثغرة زر الرجوع (Back-Button Cache Prevention)
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        next();
    } catch (error) {
        // التقاط أي تلاعب في التوكن أو انتهاء صلاحيته
        console.error('🔒 Security/Auth Alert:', error.message);
        res.clearCookie('token');
        return res.redirect('/auth/login');
    }
};

// ==========================================
// 🚧 2. بوابة حماية الأدوار الذكية (Smart RBAC)
// ==========================================
exports.authorizeAdmin = (req, res, next) => {
    // حماية إضافية لمنع خطأ (Cannot read property 'role' of undefined)
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    if (req.user.role !== 'admin') {
        
        // 🔥 الذكاء هنا: معالجة نوع الطلب (AJAX vs Browser) 🔥
        // إذا كان الطلب قادم من Fetch/AJAX (مثل محاولة حذف منتج من الـ POS)
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(403).json({ 
                success: false, 
                message: 'وصول مرفوض: ليس لديك الصلاحيات الكافية لتنفيذ هذا الإجراء.' 
            });
        }

        // إذا كان الطلب تصفح عادي (محاولة فتح صفحة المستخدمين مثلاً)
        return res.status(403).render('error', { 
            title: 'وصول مرفوض | 403',
            message: 'عفواً، ليس لديك الصلاحيات الكافية لدخول هذه الصفحة. تواصل مع مدير النظام.',
            user: req.user 
        });
    }
    
    next();
};