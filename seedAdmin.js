// استدعاء المتغيرات البيئية (مهم لجلب رابط قاعدة البيانات)
require('dotenv').config(); 
const mongoose = require('mongoose');

// استدعاء نموذج المستخدم (تأكد من صحة المسار بناءً على مكان ملفك)
const User = require('./models/User'); 

const createAdmin = async () => {
    try {
        // 1. الاتصال بقاعدة البيانات
        // استبدل الرابط الاحتياطي برابط قاعدة بياناتك الفعلي إذا لم تكن تستخدم dotenv
        const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus_campaign';
        await mongoose.connect(dbURI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح.');

        // 2. التحقق مما إذا كان اسم المستخدم "admin" موجوداً مسبقاً
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('⚠️ حساب المسؤول (Admin) موجود مسبقاً في قاعدة البيانات!');
            process.exit(0); // إنهاء العملية بسلام
        }

        // 3. إنشاء حساب المسؤول
        const adminData = {
            name: 'مدير النظام',
            username: 'admin',
            // ملاحظة: نفترض أن نموذج User (User.js) يحتوي على دالة تشفير (bcrypt) 
            // تعمل تلقائياً قبل الحفظ (pre-save hook). إذا لم يكن كذلك، يجب تشفيرها هنا.
            password: 'AdminPassword123!', 
            role: 'admin' // تأكد من أن هذه القيمة تتوافق مع نظام الصلاحيات لديك
        };

        const newAdmin = new User(adminData);
        await newAdmin.save();

        console.log('🎉 تم حقن حساب المسؤول (Admin) بنجاح!');
        console.log(`👤 اسم المستخدم: ${adminData.username}`);
        console.log(`🔑 كلمة المرور: ${adminData.password}`);

        // 4. إغلاق الاتصال وإنهاء العملية
        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ حدث خطأ أثناء حقن بيانات المسؤول:', error);
        process.exit(1); // إنهاء العملية مع وجود خطأ
    }
};

// تشغيل الدالة
createAdmin();