const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ==========================================
// 🧠 محرك الفلترة الذكي (Smart Name Normalization)
// ==========================================
// وظيفة هذه الدالة توحيد الحروف وإزالة التشكيل والمسافات الزائدة
// بحيث لا يمكن لشخص تسجيل اسم "أحمد على" إذا كان "احمد علي" موجوداً بالفعل
function normalizeName(name) {
    if (!name) return '';
    return name
        .replace(/[أإآ]/g, 'ا')         // توحيد الألف (أ، إ، آ -> ا)
        .replace(/ة/g, 'ه')             // توحيد التاء المربوطة مع الهاء
        .replace(/[ىي]/g, 'ي')          // توحيد الألف اللينة مع الياء
        .replace(/[\u064B-\u065F]/g, '') // إزالة التشكيل بالكامل (الفتحة، الضمة، الخ)
        .replace(/\s+/g, ' ')           // دمج المسافات المتعددة لمسافة واحدة
        .toLowerCase()                  // توحيد الحروف الإنجليزية لحروف صغيرة
        .trim();                        // إزالة مسافات البداية والنهاية
}

// ==========================================
// 🏗️ هيكل قاعدة البيانات (Database Schema)
// ==========================================
const userSchema = new mongoose.Schema({
    // 🆔 المعرف الفريد للموظف (يتولد تلقائياً من 10 أرقام)
    accountId: {
        type: String,
        unique: true
    },
    name: { 
        type: String, 
        required: [true, 'الاسم بالكامل مطلوب'], 
        trim: true,
        minlength: [3, 'الاسم يجب أن يكون 3 أحرف على الأقل'],
        maxlength: [50, 'الاسم طويل جداً، الحد الأقصى 50 حرف']
    },
    // 🛡️ حقل مخفي في الخلفية يستخدم فقط لضمان عدم تكرار الاسم الحقيقي
    normalizedName: {
        type: String,
        unique: true 
    },
    username: { 
        type: String, 
        required: [true, 'اسم المستخدم مطلوب'], 
        unique: true, 
        trim: true,
        lowercase: true, // يمنع تكرار Admin و admin
        match: [/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط (بدون مسافات)'], 
        minlength: [4, 'اسم المستخدم يجب أن يكون 4 أحرف على الأقل'],
        maxlength: [30, 'اسم المستخدم يجب ألا يتجاوز 30 حرفاً']
    },
    password: { 
        type: String, 
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'] 
    },
    role: { 
        type: String, 
        enum: {
            values: ['admin', 'agent'],
            message: 'الصلاحية المحددة غير صالحة ولا يمتلكها النظام' 
        }, 
        default: 'agent' 
    },
    isActive: { 
        // يسمح بإيقاف الحساب دون حذف سجلاته المرتبطة في النظام
        type: Boolean,
        default: true
    }
}, { timestamps: true }); 

// ==========================================
//  العمليات التلقائية قبل الإنشاء (Pre-save Hooks)
// ==========================================
userSchema.pre('save', async function() {
    
    // 1. توليد رقم تعريفي (ID) فريد من 10 أرقام إذا لم يكن موجوداً
    if (!this.accountId) {
        let isUnique = false;
        while (!isUnique) {
            // توليد رقم عشوائي رياضي بين مليار و 9.9 مليار
            const randomId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            // البحث للتأكد من عدم توليد رقم موجود صدفة
            const existing = await this.constructor.findOne({ accountId: randomId });
            if (!existing) {
                this.accountId = randomId;
                isUnique = true;
            }
        }
    }

    // 2. تحديث الاسم المفلتر (للمقارنة الذكية) إذا تم إدخال أو تعديل الاسم
    if (this.isModified('name')) {
        this.normalizedName = normalizeName(this.name);
    }

    // 3. تشفير كلمة المرور (فقط إذا تم تعديلها أو إنشاؤها للتو)
    if (this.isModified('password')) {
        // رفع قوة التشفير لـ 12 لزيادة مقاومة الكسر العكسي للهاكرز
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
    
    // تم حذف next() من هنا لتجنب خطأ الـ TypeError
});

// ==========================================
//  معالجة الثغرات عند التعديل (Update Hooks)
// ==========================================
userSchema.pre(['findOneAndUpdate', 'updateOne', 'update'], function() {
    const update = this.getUpdate();
    
    // التحقق مما إذا كان حقل الاسم ضمن التعديلات المرسلة
    if (update && update.name) {
        update.normalizedName = normalizeName(update.name);
    } else if (update && update.$set && update.$set.name) {
        update.$set.normalizedName = normalizeName(update.$set.name);
    }
});

// ==========================================
//  دالة مصادقة الدخول
// ==========================================
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);