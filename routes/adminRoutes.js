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
router.use(requireAuth);
router.use(authorizeAdmin);

// ==========================================
//  مسارات إدارة المستخدمين والصلاحيات (Users)
// ==========================================
router.get('/users', adminController.getUsersPage);
router.post('/users/create', adminController.createUser);

// نضع validateObjectId هنا لأن الرابط يحتوي على Params (:id)
router.post('/users/update/:id', validateObjectId, adminController.updateUser);
router.get('/users/delete/:id', validateObjectId, adminController.deleteUser);
// مسار لوحة القيادة الرئيسية
router.get('/dashboard', adminController.getDashboard);
// ==========================================
//  مسارات إدارة المخزون والمنتجات (Inventory)
// ==========================================
router.get('/inventory', inventoryController.getInventoryPage);
router.post('/inventory/create', inventoryController.createProduct);

// نضع validateObjectId هنا أيضاً لحماية عمليات المخزون
router.post('/inventory/update/:id', validateObjectId, inventoryController.updateProduct);
router.get('/inventory/delete/:id', validateObjectId, inventoryController.deleteProduct);

router.get('/pos', inventoryController.getPOSPage); // عرض صفحة الكاشير
router.post('/pos/process', inventoryController.processOrder);

module.exports = router;