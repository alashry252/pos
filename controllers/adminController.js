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

        res.render('admin/employees', { 
            title: 'إدارة وتعيين الموظفين | Nexus Campaign',
            user: req.user,
            users,
            recentActivities, // تمرير السجل الحقيقي الآن
            error: null
        });
    } catch (error) {
        console.error('System Error:', error);
        res.render('admin/employees', { 
            title: 'إدارة وتعيين الموظفين | Nexus',
            user: req.user,
            users: [],
            recentActivities: [],
            error: 'حدث خطأ في الخادم أثناء جلب البيانات.'
        });
    }
};

// ==========================================
// 1.1 عرض صفحة إضافة وتعيين موظف جديد (منفصلة)
// ==========================================
exports.getCreateEmployeePage = (req, res) => {
    res.render('admin/employees-create', {
        title: 'تعيين موظف جديد | Nexus Campaign',
        user: req.user
    });
};

// ==========================================
// 1.2 عرض صفحة تعديل صلاحيات وتعيين موظف (منفصلة)
// ==========================================
exports.getEditEmployeePage = async (req, res) => {
    try {
        const employee = await User.findById(req.params.id);
        if (!employee) {
            return res.status(404).render('error', {
                title: 'خطأ 404',
                message: 'عذراً، الموظف المطلوب غير موجود أو تم حذفه مسبقاً.',
                user: req.user
            });
        }
        res.render('admin/employees-edit', {
            title: 'تعديل صلاحيات الموظف | Nexus Campaign',
            user: req.user,
            employee
        });
    } catch (error) {
        console.error('Error fetching employee for edit:', error);
        res.status(500).send('حدث خطأ داخلي أثناء جلب البيانات.');
    }
};

// ==========================================
// 📈 1.3 عرض صفحة التقارير المالية ورقابة الخزنة والورديات (منفصلة للمدير)
// ==========================================
exports.getReportsPage = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // بداية اليوم
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999); // نهاية اليوم

        // ١. حساب إحصائيات لوحة التقارير العلوية العامة
        const totalEmployees = await User.countDocuments();
        
        // الدخل اليومي (صافي اليوم باستثناء المرتجعات)
        const todayOrders = await Order.find({ 
            createdAt: { $gte: today, $lte: endOfDay }, 
            status: { $ne: 'refunded' } 
        });
        const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        // إجمالي دخل المطعم التراكمي منذ أول طلب وحتى الآن
        const lifetimeOrders = await Order.find({ status: { $ne: 'refunded' } });
        const lifetimeIncome = lifetimeOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        // ٢. جلب الموظفين لعمل تقارير فردية وتحليل نشاطهم وحضورهم
        const employees = await User.find().sort({ createdAt: -1 });

        let presentCount = 0;
        let absentCount = 0;

        const employeeReports = [];

        for (const emp of employees) {
            // أ. جلب السجلات اليومية للموظف من سجل النشاطات
            const empLogs = await ActivityLog.find({
                userId: emp._id,
                createdAt: { $gte: today, $lte: endOfDay }
            }).sort({ createdAt: 1 });

            // ب. تحديد حضور وانصراف الموظف بدقة
            const loginLog = empLogs.find(l => l.action === 'تسجيل دخول');
            const logoutLog = [...empLogs].reverse().find(l => l.action === 'تسجيل خروج');

            const loginTime = loginLog 
                ? new Date(loginLog.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
                : null;
            const logoutTime = logoutLog 
                ? new Date(logoutLog.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
                : null;

            // ج. جلب مبيعات الموظف اليوم (النشطة والملغاة/المرتجعة)
            const empOrders = await Order.find({
                cashierId: emp._id,
                createdAt: { $gte: today, $lte: endOfDay }
            }).sort({ createdAt: -1 });

            const completedOrders = empOrders.filter(o => o.status !== 'refunded');
            const salesCount = completedOrders.length;
            const totalSalesVal = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

            // د. حركة الخزنة الفردية (كاش ضد فيزا)
            const cashSalesVal = completedOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.totalAmount, 0);
            const cardSalesVal = completedOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.totalAmount, 0);

            // هـ. مرتجعات الموظف اليوم (التي سجلها بنفسه)
            const empRefunds = await Order.find({
                refundedBy: emp._id,
                refundedAt: { $gte: today, $lte: endOfDay },
                status: 'refunded'
            }).sort({ refundedAt: -1 });

            const refundsCount = empRefunds.length;
            const totalRefundsVal = empRefunds.reduce((sum, o) => sum + o.totalAmount, 0);
            
            // المبالغ المستردة نقداً من الخزنة
            const cashRefundsVal = empRefunds.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.totalAmount, 0);

            // و. قفل اليوم للدرج/الخزنة الخاصة بالموظف (المدخول الكاش - المرتجع الكاش)
            const safeClosing = cashSalesVal - cashRefundsVal;

            // ز. حالة الحضور والغياب (حاضر إذا سجل دخول أو أصدر أي فواتير أو مرتجعات اليوم)
            const isPresent = loginLog || empOrders.length > 0 || empRefunds.length > 0;
            if (isPresent) {
                presentCount++;
            } else {
                absentCount++;
            }

            // ح. دمج جميع العمليات المنفذة اليوم لكي تظهر في جدول حركة الخزنة التفصيلي
            const transactions = [];
            
            completedOrders.forEach(o => {
                transactions.push({
                    type: 'sale',
                    orderNumber: o.orderNumber,
                    amount: o.totalAmount,
                    paymentMethod: o.paymentMethod === 'cash' ? 'نقدي (كاش)' : 'بطاقة بنكية',
                    orderType: o.orderType === 'takeaway' ? 'تيك أواي' : o.orderType === 'dinein' ? 'صالة' : 'دليفري',
                    time: new Date(o.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    statusText: 'مكتملة',
                    badgeClass: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                });
            });

            empRefunds.forEach(o => {
                transactions.push({
                    type: 'refund',
                    orderNumber: o.orderNumber,
                    amount: o.totalAmount,
                    paymentMethod: o.paymentMethod === 'cash' ? 'نقدي (كاش)' : 'بطاقة بنكية',
                    orderType: o.orderType === 'takeaway' ? 'تيك أواي' : o.orderType === 'dinein' ? 'صالة' : 'دليفري',
                    time: new Date(o.refundedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    statusText: 'مرتجع',
                    badgeClass: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                });
            });

            // ترتيب العمليات من الأحدث للأقدم
            transactions.sort((a, b) => b.time.localeCompare(a.time));

            employeeReports.push({
                user: emp,
                isPresent,
                loginTime,
                logoutTime,
                salesCount,
                totalSalesVal,
                cashSalesVal,
                cardSalesVal,
                refundsCount,
                totalRefundsVal,
                cashRefundsVal,
                safeClosing,
                transactions
            });
        }

        res.render('admin/reports', {
            title: 'التقارير المالية والرقابة | Nexus Campaign',
            user: req.user,
            stats: {
                totalEmployees,
                todaySales,
                lifetimeIncome,
                presentCount,
                absentCount
            },
            employeeReports
        });

    } catch (error) {
        console.error('getReportsPage Error:', error);
        res.status(500).send('حدث خطأ داخلي في الخادم أثناء تحميل صفحة التقارير.');
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
        // 1. حساب مبيعات اليوم (باستثناء الفواتير المرتجعة)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ضبط الوقت لبداية اليوم
        
        const todaysOrders = await Order.find({ createdAt: { $gte: today }, status: { $ne: 'refunded' } });
        const todaysSales = todaysOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        // 2. إحصائيات المخزون والمستخدمين
        const productsCount = await Product.countDocuments();
        const lowStockCount = await Product.countDocuments({ quantity: { $lte: 5 } });
        const usersCount = await User.countDocuments();

        // 3. جلب أحدث 5 عمليات بيع
        const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);

        // 4.  الذكاء الحقيقي: حساب مبيعات آخر 7 أيام للرسم البياني (باستثناء المرتجعات)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setHours(0, 0, 0, 0);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // نرجع 6 أيام للخلف + اليوم = 7 أيام

        const weeklyOrders = await Order.find({ createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'refunded' } });
        
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

// ==========================================
// ⚙️ 1.4 عرض صفحة الإعدادات الشخصية والملف (مشتركة لكافة الأدوار)
// ==========================================
exports.getSettingsPage = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        res.render('admin/settings', {
            title: 'الإعدادات الشخصية | Nexus Campaign',
            user: req.user,
            currentUser
        });
    } catch (error) {
        console.error('Error loading settings page:', error);
        res.status(500).send('حدث خطأ داخلي أثناء تحميل صفحة الإعدادات.');
    }
};

// ==========================================
// ⚙️ 1.5 حفظ وتحديث بيانات الدخول الشخصية بأمان (AJAX)
// ==========================================
exports.updateSettings = async (req, res) => {
    try {
        const { name, username, currentPassword, newPassword } = req.body;
        
        // 1. جلب الموظف الحالي من قاعدة البيانات بشكل كامل (بما فيه الـ password للمقارنة)
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود.' });
        }

        // 2. التحقق الإلزامي من كلمة المرور الحالية (حماية أمنية من الاختراق)
        if (!currentPassword) {
            return res.status(400).json({ success: false, message: 'يجب إدخال كلمة المرور الحالية لتأكيد الهوية.' });
        }
        
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة، تم حظر التحديث لأسباب أمنية.' });
        }

        // 3. تحديث الاسم الحقيقي واسم المستخدم (الاسم الكامل يُعدل فقط بواسطة المدير)
        if (name && name.trim() && user.role === 'admin') {
            user.name = name.trim();
        }

        if (username && username.trim()) {
            const newUsername = username.trim().toLowerCase();
            if (newUsername !== user.username) {
                // فحص فرادة اسم المستخدم لمنع التعارض والتكرار
                const usernameExists = await User.findOne({ username: newUsername });
                if (usernameExists) {
                    return res.status(400).json({ success: false, message: `عذراً، اسم المستخدم "${username}" محجوز لموظف آخر.` });
                }
                user.username = newUsername;
            }
        }

        // 4. تحديث كلمة المرور الجديدة (إذا تم إدخالها)
        if (newPassword && newPassword.trim()) {
            if (newPassword.trim().length < 8) {
                return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' });
            }
            user.password = newPassword.trim();
        }

        // 5. حفظ البيانات في الموديل
        await user.save();

        // 🛡️ توثيق العملية الحساسة في سجل النشاطات التاريخي
        await ActivityLog.create({
            userId: user._id,
            userName: user.name,
            action: 'تحديث بيانات الحساب',
            details: `قام الموظف بتعديل بيانات الدخول الخاصة به بنجاح`
        });

        // 6. 🔥 إعادة توليد الـ Token وتحديث الـ Cookie بالخلفية 🔥
        // لكي تظل جلسة الموظف مستقرة ومفتوحة بالمعطيات الجديدة دون انقطاع
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: user._id, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.status(200).json({ 
            success: true, 
            message: 'تم تحديث بيانات ملفك الشخصي وبيانات الدخول بنجاح!' 
        });

    } catch (error) {
        console.error('updateSettings Error:', error);
        
        // التقاط التكرارات الذكية للاسم الحقيقي
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'عذراً، هذا الاسم مسجل مسبقاً لموظف آخر في قاعدة البيانات.' 
            });
        }
        
        res.status(500).json({ success: false, message: 'حدث خطأ داخلي أثناء تحديث البيانات، يرجى المحاولة لاحقاً.' });
    }
};