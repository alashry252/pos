const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // نحتاجه لفحص الـ ID

// ==========================================
//  استدعاء المتحكمات (Controllers)
// ==========================================
const adminController = require('../controllers/adminController');
const inventoryController = require('../controllers/inventoryController'); // إضافة متحكم المخزون
const { requireAuth, authorizeAdmin } = require('../middlewares/authMiddleware');

// ==========================================
//  درع الحماية الذكي (Smart ID Validator)
// يمنع انهيار السيرفر (Crash) إذا تلاعب شخص بالرابط وأرسل ID وهمي
// ==========================================
const validateObjectId = (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
            success: false, 
            message: 'إجراء أمني: المعرف (ID) المرسل غير صالح أو تم التلاعب به.' 
        });
    }
    next();
};

// ==========================================
//  حماية شاملة لجميع مسارات لوحة التحكم
// أي مسار تحت هذا السطر يتطلب تسجيل دخول + صلاحية أدمن
// ==========================================
// ==========================================
//  حماية شاملة لجميع مسارات لوحة التحكم
// أي مسار تحت هذا السطر يتطلب تسجيل دخول
// ==========================================
router.use(requireAuth);

// -------------------------------------------------------------
// 1. مسارات مشتركة (متاحة للأدمن وموظف الكاشير Agent)
// -------------------------------------------------------------
router.get('/pos', inventoryController.getPOSPage); // عرض صفحة الكاشير
router.post('/pos/process', inventoryController.processOrder); // إتمام الطلب
router.post('/pos/refund/:id', validateObjectId, inventoryController.refundOrder); // تسجيل المرتجع (مسموح للكاشير تسجيلها)
router.get('/inventory', inventoryController.getInventoryPage); // عرض صفحة المخزون للمراقبة
router.get('/settings', adminController.getSettingsPage); // عرض صفحة الإعدادات الشخصية والملف
router.post('/settings/update', adminController.updateSettings); // معالجة تحديث البيانات الشخصية

// -------------------------------------------------------------
// 2. مسارات محمية بالأدمن فقط (Admins Only)
// أي مسار تحت هذا السطر يتطلب صلاحيات أدمن كاملة
// -------------------------------------------------------------
router.use(authorizeAdmin);

// لوحة القيادة
router.get('/dashboard', adminController.getDashboard);

// التقارير المالية والرقابة الشاملة للمدير
router.get('/reports', adminController.getReportsPage);

// إدارة الموظفين والتعيين (Employees)
router.get('/employees', adminController.getUsersPage);
router.get('/employees/new', adminController.getCreateEmployeePage); // صفحة تعيين موظف جديد منفصلة
router.get('/employees/edit/:id', validateObjectId, adminController.getEditEmployeePage); // صفحة تعديل تعيين موظف منفصلة
router.post('/employees/create', adminController.createUser);
router.post('/employees/update/:id', validateObjectId, adminController.updateUser);
router.get('/employees/delete/:id', validateObjectId, adminController.deleteUser);

// إدارة وتعديل المخزون (إضافة، تعديل، حذف المنتجات)
router.post('/inventory/create', inventoryController.createProduct);
router.post('/inventory/update/:id', validateObjectId, inventoryController.updateProduct);
router.get('/inventory/delete/:id', validateObjectId, inventoryController.deleteProduct);

module.exports = router;