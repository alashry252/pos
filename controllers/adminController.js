const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog'); //  استدعاء سجل النشاطات الذكي
const Product = require('../models/Product'); 
const Order = require('../models/Order');     
// ==========================================
//  دالة مساعدة (Helper): تحويل التواريخ لوقت مقروء بشرياً
// ==========================================
const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval === 1 ? 'منذ سنة' : `منذ ${interval} سنوات`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval === 1 ? 'منذ شهر' : `منذ ${interval} أشهر`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval === 1 ? 'منذ يوم' : `منذ ${interval} أيام`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval === 1 ? 'منذ ساعة' : `منذ ${interval} ساعات`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval === 1 ? 'منذ دقيقة' : `منذ ${interval} دقائق`;
    return 'الآن';
};

// ==========================================
// 🛠️ دالة مساعدة (Helper): معالجة أخطاء قاعدة البيانات بذكاء (DRY)
// ==========================================
const handleDatabaseErrors = (error, req) => {
    // 1. التقاط التكرار الذكي (Duplicate Key)
    if (error.code === 11000) {
        if (error.keyPattern && error.keyPattern.normalizedName) {
            return `عذراً، هذا الاسم "${req.body.name}" مسجل مسبقاً لموظف آخر (حتى لو اختلفت الحروف أو المسافات).`;
        } 
        if (error.keyPattern && error.keyPattern.username) {
            return `عذراً، اسم المستخدم (للدخول) "${req.body.username}" محجوز مسبقاً.`;
        }
        return 'عذراً، هناك بيانات مكررة ومسجلة مسبقاً.';
    }
    
    // 2. التقاط أخطاء التحقق (Validation Errors)
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return messages.join(' \n '); 
    }

    console.error(' DB Error:', error);
    return 'حدث خطأ غير متوقع أثناء معالجة البيانات، يرجى المحاولة لاحقاً.';
};

// ==========================================
// 1. عرض صفحة إدارة المستخدمين (مع جلب السجل الحقيقي)
// ==========================================
exports.getUsersPage = async (req, res) => {
    try {
        // جلب المستخدمين (بدون الباسورد)
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        
        //  جلب أحدث 10 نشاطات من قاعدة البيانات
        const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(10);
        
        // تجهيز البيانات للواجهة الأمامية
        const recentActivities = logs.map(log => ({
            action: log.action,
            user: log.userName,
            time: timeAgo(log.createdAt),
            details: log.details
        }));

        res.render('admin/users', { 
            title: 'إدارة الصلاحيات | Nexus Campaign',
            user: req.user,
            users,
            recentActivities, // تمرير السجل الحقيقي الآن
            error: null
        });
    } catch (error) {
        console.error('System Error:', error);
        res.render('admin/users', { 
            title: 'إدارة الصلاحيات | Nexus',
            user: req.user,
            users: [],
            recentActivities: [],
            error: 'حدث خطأ في الخادم أثناء جلب البيانات.'
        });
    }
};

// ==========================================
// 2. إنشاء مستخدم جديد (تسجيل العملية بذكاء)
// ==========================================
exports.createUser = async (req, res) => {
    try {
        const { name, username, password, role } = req.body;
        const newUser = new User({ name, username, password, role });
        
        await newUser.save();
        
        // 🛡️ توثيق العملية في السجل
        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'إضافة حساب جديد',
            details: `تم إضافة الموظف: ${name}`
        });
        
        res.status(200).json({ success: true, message: 'تم إنشاء الحساب وتوليد المعرف (ID) بنجاح!' });
        
    } catch (error) {
        const errorMessage = handleDatabaseErrors(error, req);
        res.status(400).json({ success: false, message: errorMessage });
    }
};

// ==========================================
// 3. تعديل بيانات مستخدم (تسجيل العملية بذكاء)
// ==========================================
exports.updateUser = async (req, res) => {
    try {
        const { name, role } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { name, role },
            { new: true, runValidators: true } 
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود أو تم حذفه مسبقاً.' });
        }

        // 🛡️ توثيق العملية في السجل
        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'تعديل صلاحيات',
            details: `تم تعديل بيانات: ${updatedUser.name}`
        });

        res.status(200).json({ success: true, message: 'تم تحديث بيانات الصلاحيات بنجاح!' });
        
    } catch (error) {
        const errorMessage = handleDatabaseErrors(error, req);
        res.status(400).json({ success: false, message: errorMessage });
    }
};

// ==========================================
// 4. حذف مستخدم (تسجيل العملية بذكاء)
// ==========================================
exports.deleteUser = async (req, res) => {
    try {
        // حماية من الانتحار الرقمي
        if (req.params.id === req.user.id) {
            return res.status(403).json({ success: false, message: 'إجراء أمني: لا يمكنك حذف حسابك الشخصي الجاري العمل به.' });
        }

        const deletedUser = await User.findByIdAndDelete(req.params.id);
        
        if (!deletedUser) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود أصلاً.' });
        }

        //  توثيق العملية في السجل
        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'إزالة مستخدم',
            details: `تم مسح سجلات الموظف: ${deletedUser.name}`
        });

        res.status(200).json({ success: true, message: 'تم مسح سجلات المستخدم نهائياً.' });
        
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ success: false, message: 'المعرف المرسل غير صالح.' });
        }
        res.status(500).json({ success: false, message: 'فشل في عملية الحذف بسبب عطل داخلي.' });
    }
};

// ==========================================
// 📊 عرض لوحة القيادة (Dashboard) بالبيانات الحقيقية
// ==========================================
exports.getDashboard = async (req, res) => {
    try {
        // 1. حساب مبيعات اليوم
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ضبط الوقت لبداية اليوم
        
        const todaysOrders = await Order.find({ createdAt: { $gte: today } });
        const todaysSales = todaysOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        // 2. إحصائيات المخزون والمستخدمين
        const productsCount = await Product.countDocuments();
        const lowStockCount = await Product.countDocuments({ quantity: { $lte: 5 } });
        const usersCount = await User.countDocuments();

        // 3. جلب أحدث 5 عمليات بيع
        const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);

        // 4.  الذكاء الحقيقي: حساب مبيعات آخر 7 أيام للرسم البياني 
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setHours(0, 0, 0, 0);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // نرجع 6 أيام للخلف + اليوم = 7 أيام

        const weeklyOrders = await Order.find({ createdAt: { $gte: sevenDaysAgo } });
        
        // مصفوفة مبدئية من 7 أصفار (تمثل الأيام من الأقدم لليوم)
        const weeklySalesData = [0, 0, 0, 0, 0, 0, 0];

        weeklyOrders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            
            // حساب الفرق بالأيام بين تاريخ الفاتورة وتاريخ "منذ 7 أيام"
            const diffTime = orderDate.getTime() - sevenDaysAgo.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // وضع قيمة الفاتورة في خانة اليوم الصحيح
            if (diffDays >= 0 && diffDays <= 6) {
                weeklySalesData[diffDays] += order.totalAmount;
            }
        });

        // 5. إرسال البيانات للواجهة
        res.render('dashboard', { // أو 'admin/dashboard' حسب مسارك
            title: 'لوحة القيادة | Nexus ERP',
            user: req.user,
            stats: {
                todaysSales,
                todaysOrdersCount: todaysOrders.length,
                productsCount,
                lowStockCount,
                usersCount
            },
            recentOrders,
            weeklySalesData //  تمرير المصفوفة الحقيقية للرسم البياني
        });
    } catch (error) {
        console.error('🔥 Dashboard Error:', error);
        res.status(500).send('حدث خطأ داخلي أثناء تحميل لوحة التحكم.');
    }
};