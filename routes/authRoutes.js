const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware'); // استيراد وسيط التحقق

// مسار عرض صفحة تسجيل الدخول (GET)
router.get('/login', authController.getLoginPage);

// مسار إرسال بيانات الدخول (POST)
router.post('/login', authController.login);

// مسار تسجيل الخروج (GET) - محمي لتسجيل الحركة بدقة
router.get('/logout', requireAuth, authController.logout);

module.exports = router;