const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// مسار عرض صفحة تسجيل الدخول (GET)
router.get('/login', authController.getLoginPage);

// مسار إرسال بيانات الدخول (POST)
router.post('/login', authController.login);

// مسار تسجيل الخروج (GET)
router.get('/logout', authController.logout);

module.exports = router;