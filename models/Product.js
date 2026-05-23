const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    // كود الصنف (Stock Keeping Unit) - يتولد تلقائياً
    sku: {
        type: String,
        unique: true
    },
    name: {
        type: String,
        required: [true, 'اسم المنتج مطلوب'],
        trim: true,
        minlength: [2, 'اسم المنتج يجب أن يكون حرفين على الأقل'],
        maxlength: [100, 'اسم المنتج طويل جداً']
    },
    category: {
        type: String,
        required: [true, 'تصنيف المنتج مطلوب'],
        trim: true
    },
    quantity: {
        type: Number,
        required: [true, 'الكمية مطلوبة'],
        min: [0, 'لا يمكن أن تكون الكمية بالسالب'],
        default: 0
    },
    price: {
        type: Number,
        required: [true, 'السعر مطلوب'],
        min: [0, 'السعر لا يمكن أن يكون بالسالب']
    },
    // حد النواقص (عند وصول الكمية لهذا الرقم يعتبر المخزون منخفضاً)
    lowStockThreshold: {
        type: Number,
        default: 5
    }
}, { timestamps: true });

// ==========================================
// ⚙️ توليد كود الـ SKU تلقائياً قبل الحفظ
// ==========================================
productSchema.pre('save', async function() {
    if (!this.sku) {
        let isUnique = false;
        while (!isUnique) {
            // توليد كود يبدأ بـ PRD ثم 6 أرقام عشوائية (مثال: PRD-482910)
            const randomCode = 'PRD-' + Math.floor(100000 + Math.random() * 900000).toString();
            const existing = await this.constructor.findOne({ sku: randomCode });
            if (!existing) {
                this.sku = randomCode;
                isUnique = true;
            }
        }
    }
});

module.exports = mongoose.model('Product', productSchema);