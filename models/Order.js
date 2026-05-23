const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true }, 
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        quantity: Number,
        price: Number 
    }],
    subTotal: Number,
    // تم استبدال الضريبة بالخصم بناءً على التحديث الأخير
    discount: { type: Number, default: 0 }, 
    totalAmount: Number,
    // إضافة طريقة الدفع
    paymentMethod: { type: String, enum: ['cash', 'card'], default: 'cash' },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashierName: String
}, { timestamps: true });

orderSchema.pre('save', async function() {
    if (!this.orderNumber) {
        const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        this.orderNumber = `INV-${date}-${random}`;
    }
});

module.exports = mongoose.model('Order', orderSchema);