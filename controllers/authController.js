const User = require('../models/User');
const jwt = require('jsonwebtoken');

// عرض صفحة تسجيل الدخول
exports.getLoginPage = (req, res) => {
    // إذا كان المستخدم مسجل دخوله بالفعل، نوجهه للصفحة المناسبة لدوره فوراً
    if (req.cookies.token) {
        try {
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            if (decoded.role === 'admin') {
                return res.redirect('/dashboard');
            } else {
                return res.redirect('/admin/pos');
            }
        } catch (e) {
            res.clearCookie('token');
        }
    }
    res.render('login', { title: 'تسجيل الدخول | YM-CampaignHub', error: null });
};

// معالجة بيانات الدخول (The Core Logic)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. البحث عن المستخدم في قاعدة البيانات
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('login', { title: 'تسجيل الدخول', error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }

        // 2. التحقق من تطابق كلمة المرور (باستخدام الدالة التي صنعناها في Model)
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('login', { title: 'تسجيل الدخول', error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }

        // 3. توليد مفتاح الدخول (JWT Token)
        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name }, // البيانات المخزنة داخل التوكن (Payload)
            process.env.JWT_SECRET, // مفتاح التشفير من ملف .env
            { expiresIn: '1d' } // صلاحية التوكن (يوم واحد)
        );

        // 4. إرسال التوكن للمتصفح كـ HTTP-Only Cookie
        res.cookie('token', token, {
            httpOnly: true, // يمنع قراءته عبر الجافاسكريبت (حماية من XSS)
            secure: process.env.NODE_ENV === 'production', // يعمل مع HTTPS فقط في الإنتاج
            maxAge: 24 * 60 * 60 * 1000 // مدة بقاء الكوكي (يوم واحد بالمللي ثانية)
        });

        // 🛡️ توثيق عملية تسجيل الدخول بسجل النشاطات التاريخي
        const ActivityLog = require('../models/ActivityLog');
        await ActivityLog.create({
            userId: user._id,
            userName: user.name,
            action: 'تسجيل دخول',
            details: `تم تسجيل دخول الموظف بنجاح إلى شاشة ${user.role === 'admin' ? 'لوحة القيادة' : 'نقاط البيع'}`
        });

        // 5. توجيه المستخدم بنجاح إلى لوحة القيادة أو شاشة نقاط البيع
        if (user.role === 'admin') {
            res.redirect('/dashboard');
        } else {
            res.redirect('/admin/pos');
        }

    } catch (error) {
        console.error('Login Error:', error);
        res.render('login', { title: 'تسجيل الدخول', error: 'حدث خطأ داخلي في الخادم. يرجى المحاولة لاحقاً.' });
    }
};

// دالة تسجيل الخروج (مؤمنة وتوثق العملية في سجل النشاطات)
exports.logout = async (req, res) => {
    try {
        const ActivityLog = require('../models/ActivityLog');
        if (req.user) {
            await ActivityLog.create({
                userId: req.user.id,
                userName: req.user.name,
                action: 'تسجيل خروج',
                details: `تم تسجيل خروج الموظف من النظام بأمان`
            });
        }
    } catch (error) {
        console.error('Logout logging error:', error);
    }
    res.clearCookie('token'); // مسح الكوكي
    res.redirect('/auth/login');
};