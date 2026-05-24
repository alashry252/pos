const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true }, 
    boneNumber: { type: Number },
    orderType: { type: String, enum: ['dinein', 'takeaway', 'delivery'], default: 'takeaway' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        quantity: Number,
        price: Number 
    }],
    subTotal: Number,
    discount: { type: Number, default: 0 }, 
    serviceCharge: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    customerPaid: { type: Number, default: 0 },
    customerChange: { type: Number, default: 0 },
    totalAmount: Number,
    paymentMethod: { type: String, enum: ['cash', 'card'], default: 'cash' },
    status: { type: String, enum: ['completed', 'refunded'], default: 'completed' }, // 👈 إضافة حالة الفاتورة (مكتملة / مرتجع)
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refundedByName: { type: String },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cashierName: String
}, { timestamps: true });

orderSchema.pre('save', async function() {
    if (!this.orderNumber) {
        const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        this.orderNumber = `INV-${date}-${random}`;
    }
    if (!this.boneNumber) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const count = await this.constructor.countDocuments({ createdAt: { $gte: startOfDay } });
        this.boneNumber = count + 1;
    }
});

module.exports = mongoose.model('Order', orderSchema);