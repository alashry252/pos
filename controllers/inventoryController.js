const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');
const Order = require('../models/Order');

// دالة مساعدة لمعالجة الأخطاء (DRY)
const handleDatabaseErrors = (error, req) => {
    if (error.code === 11000) {
        if (error.keyPattern && error.keyPattern.sku) return 'كود الصنف (SKU) موجود مسبقاً.';
        return 'هذا المنتج مسجل مسبقاً في قاعدة البيانات.';
    }
    if (error.name === 'ValidationError') {
        return Object.values(error.errors).map(val => val.message).join(' \n ');
    }
    console.error(' DB Error:', error);
    return 'حدث خطأ غير متوقع أثناء معالجة البيانات.';
};

// 1. عرض صفحة المخزون
exports.getInventoryPage = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        
        // حساب إحصائيات سريعة للوحة العلوية
        const stats = {
            total: products.length,
            outOfStock: products.filter(p => p.quantity === 0).length,
            lowStock: products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length,
            totalValue: products.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
        };

        res.render('admin/inventory', {
            title: 'إدارة المخزون | Nexus Campaign',
            user: req.user,
            products,
            stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ أثناء تحميل المخزون.');
    }
};

// 2. إضافة منتج جديد (AJAX)
exports.createProduct = async (req, res) => {
    try {
        const { name, category, quantity, price, lowStockThreshold } = req.body;
        const newProduct = new Product({ name, category, quantity, price, lowStockThreshold });
        
        await newProduct.save();

        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'إضافة للمخزون',
            details: `تم إدخال صنف جديد: ${name} (الكمية: ${quantity})`
        });

        res.status(200).json({ success: true, message: 'تم إضافة المنتج للمخزون بنجاح!' });
    } catch (error) {
        res.status(400).json({ success: false, message: handleDatabaseErrors(error, req) });
    }
};

// 3. تعديل منتج (AJAX)
exports.updateProduct = async (req, res) => {
    try {
        const { name, category, quantity, price, lowStockThreshold } = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { name, category, quantity, price, lowStockThreshold },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) return res.status(404).json({ success: false, message: 'المنتج غير موجود.' });

        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'تحديث المخزون',
            details: `تم تعديل بيانات/كمية: ${updatedProduct.name}`
        });

        res.status(200).json({ success: true, message: 'تم تحديث بيانات المنتج بنجاح!' });
    } catch (error) {
        res.status(400).json({ success: false, message: handleDatabaseErrors(error, req) });
    }
};

// 4. حذف منتج (AJAX)
exports.deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) return res.status(404).json({ success: false, message: 'المنتج غير موجود أصلاً.' });

        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'حذف من المخزون',
            details: `تم مسح الصنف: ${deletedProduct.name} نهائياً`
        });

        res.status(200).json({ success: true, message: 'تم مسح المنتج من المخزون نهائياً.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'فشل في عملية الحذف.' });
    }
};

// ==========================================
// 1. عرض صفحة نقطة البيع (POS)
// ==========================================
exports.getPOSPage = async (req, res) => {
    try {
        const products = await Product.find({ quantity: { $gt: 0 } }).sort({ name: 1 });
        
        // 🛡️ فلترة ذكية لـ "الفواتير السابقة" بناءً على دور المستخدم
        let query = {};
        if (req.user.role !== 'admin') {
            // الكاشير (Agent) يرى فقط فواتيره هو الشخصية التي تمت اليوم
            const today = new Date();
            today.setHours(0, 0, 0, 0); // بداية اليوم الحالي
            query = {
                cashierId: req.user.id,
                createdAt: { $gte: today }
            };
        }
        
        // جلب أحدث 50 فاتورة تطابق الفلترة الأمنية
        const orders = await Order.find(query).sort({ createdAt: -1 }).limit(50);
        
        res.render('admin/pos', {
            title: 'نقطة البيع الذكية | Nexus POS',
            user: req.user,
            products,
            orders // 👈 تمرير الفواتير المفلترة للواجهة
        });
    } catch (error) {
        console.error('getPOSPage error:', error);
        res.status(500).send('عذراً، حدث خطأ أثناء تشغيل شاشة الكاشير.');
    }
};

// ==========================================
// 2. معالجة عملية البيع (الذكاء والربط)
// ==========================================
// ==========================================
// 2. معالجة عملية البيع (الذكاء والربط)
// ==========================================
exports.processOrder = async (req, res) => {
    try {
        // استقبال الحقول المالية الجديدة وطريقة ونوع الطلب من الكاشير
        const { 
            cart, 
            paymentMethod, 
            orderType,
            discount, 
            serviceCharge, 
            vat, 
            deliveryFee, 
            customerPaid, 
            customerChange, 
            subTotal, 
            totalAmount 
        } = req.body;

        if (!cart || cart.length === 0) {
            return res.status(400).json({ success: false, message: 'السلة فارغة، لا يمكن إتمام البيع.' });
        }

        // التحقق من توفر الكميات في المخزون
        for (const item of cart) {
            const product = await Product.findById(item.id);
            if (!product || product.quantity < item.qty) {
                return res.status(400).json({ 
                    success: false, 
                    message: `عذراً، الكمية المطلوبة من "${item.name}" غير متوفرة حالياً.` 
                });
            }
        }

        // التنفيذ: خصم المخزون
        const orderItems = [];
        for (const item of cart) {
            await Product.findByIdAndUpdate(item.id, { $inc: { quantity: -item.qty } });
            
            orderItems.push({
                productId: item.id,
                name: item.name,
                quantity: item.qty,
                price: item.price
            });
        }

        // حفظ الفاتورة بالبيانات الجديدة
        const newOrder = new Order({
            items: orderItems,
            subTotal,
            discount,
            serviceCharge,
            vat,
            deliveryFee,
            customerPaid,
            customerChange,
            orderType,
            paymentMethod,
            totalAmount,
            cashierId: req.user.id,
            cashierName: req.user.name
        });
        await newOrder.save();

        // تسجيل العملية في سجل النشاطات
        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'عملية بيع جديدة',
            details: `تم إصدار فاتورة (${paymentMethod} - ${orderType}) بقيمة ${totalAmount} ج.م`
        });

        res.status(200).json({ 
            success: true, 
            message: 'تمت عملية البيع بنجاح وتحديث المخزون!',
            orderId: newOrder._id,
            order: newOrder
        });

    } catch (error) {
        console.error('POS Error:', error);
        res.status(500).json({ success: false, message: 'فشل في معالجة الطلب، يرجى المحاولة لاحقاً.' });
    }
};

// ==========================================
// 3. تسجيل وإرجاع الفاتورة (المرتجع)
// ==========================================
exports.refundOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // 1. جلب الفاتورة من قاعدة البيانات
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'عذراً، الفاتورة غير موجودة.' });
        }

        // 🛡️ حماية أمنية إضافية: الكاشير لا يمكنه إرجاع فاتورة ليست له أو ليست من مبيعات اليوم
        if (req.user.role !== 'admin') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isOwnOrder = order.cashierId && order.cashierId.toString() === req.user.id.toString();
            const isToday = order.createdAt >= today;
            if (!isOwnOrder || !isToday) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'إجراء غير مصرح: لا يمكنك إرجاع فواتير موظفين آخرين أو فواتير من أيام سابقة.' 
                });
            }
        }

        // 2. التحقق من عدم تكرار عملية المرتجع
        if (order.status === 'refunded') {
            return res.status(400).json({ success: false, message: 'هذه الفاتورة تم إرجاعها مسبقاً.' });
        }

        // 3. إرجاع الكميات للمخزن مع التحقق الفردي لكل منتج
        for (const item of order.items) {
            if (item.productId) {
                const productExists = await Product.findById(item.productId);
                if (productExists) {
                    await Product.findByIdAndUpdate(item.productId, { 
                        $inc: { quantity: item.quantity } 
                    });
                }
            }
        }

        // 4. تحديث حالة الفاتورة وتوثيق بيانات الكاشير الذي قام بالإرجاع وتاريخه
        order.status = 'refunded';
        order.refundedAt = new Date();
        order.refundedBy = req.user.id;
        order.refundedByName = req.user.name;
        
        await order.save();

        // 5. تسجيل العملية في سجل النشاطات العام
        await ActivityLog.create({
            userId: req.user.id,
            userName: req.user.name,
            action: 'تسجيل مرتجع',
            details: `تم تسجيل مرتجع للفاتورة رقم (${order.orderNumber}) بقيمة ${order.totalAmount} ج.م بواسطة ${req.user.name}`
        });

        res.status(200).json({
            success: true,
            message: 'تم تسجيل المرتجع بنجاح واسترداد الكميات للمخزن!',
            order
        });

    } catch (error) {
        console.error('Refund Error:', error);
        res.status(500).json({ success: false, message: 'فشل في عملية إرجاع الفاتورة، يرجى المحاولة لاحقاً.' });
    }
};