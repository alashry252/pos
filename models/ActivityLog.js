const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // نحفظ اسم المستخدم هنا أيضاً كنوع من الأرشفة، 
    // حتى لو تم حذف المستخدم لاحقاً، يظل اسمه مسجلاً في السجل التاريخي
    userName: { 
        type: String, 
        required: true 
    },
    action: { 
        type: String, 
        required: true 
    },
    details: { 
        type: String 
    }
}, { timestamps: true }); // الـ timestamps سيقوم بتسجيل وقت العملية تلقائياً

module.exports = mongoose.model('ActivityLog', activityLogSchema);