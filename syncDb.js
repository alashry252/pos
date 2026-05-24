const mongoose = require('mongoose');
require('dotenv').config();

const REMOTE_URI = process.env.MONGO_URI_PRODUCTION;
const LOCAL_URI = process.env.MONGO_URI_DEVELOPMENT || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus_pos';

async function syncDatabases() {
  if (!REMOTE_URI || !LOCAL_URI) {
    console.error('❌ خطأ: يرجى التأكد من تعريف MONGO_URI_PRODUCTION و MONGO_URI_DEVELOPMENT في ملف .env');
    process.exit(1);
  }

  console.log('🔄 جاري الاتصال بقواعد البيانات السحابية...');
  const maskedRemoteUri = REMOTE_URI.replace(/:([^@]+)@/, ':****@');
  const maskedLocalUri = LOCAL_URI.replace(/:([^@]+)@/, ':****@');
  console.log(`📡 قاعدة البيانات السحابية (الإنتاجية - المصدر): ${maskedRemoteUri}`);
  console.log(`💻 قاعدة البيانات السحابية (التطويرية - الوجهة): ${maskedLocalUri}`);

  let remoteConn, localConn;

  try {
    remoteConn = await mongoose.createConnection(REMOTE_URI).asPromise();
    console.log('✅ تم الاتصال بنجاح بقاعدة البيانات الإنتاجية (Production DB).');
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات الإنتاجية:', err.message);
    process.exit(1);
  }

  try {
    localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ تم الاتصال بنجاح بقاعدة البيانات التطويرية (Development DB).');
  } catch (err) {
    console.error('❌ فشل الاتصال بقاعدة البيانات التطويرية:', err.message);
    await remoteConn.close();
    process.exit(1);
  }

  try {
    // جلب جميع المجموعات من قاعدة البيانات الإنتاجية
    const collections = await remoteConn.db.listCollections().toArray();
    console.log(`📦 تم العثور على عدد (${collections.length}) مجموعات في قاعدة البيانات الإنتاجية.`);

    for (const col of collections) {
      const colName = col.name;
      
      // تخطي مجموعات النظام الخاصة بـ MongoDB
      if (colName.startsWith('system.')) continue;

      console.log(`\n⏳ معالجة المجموعة: [${colName}]`);

      // 1. جلب البيانات من قاعدة البيانات الإنتاجية
      const docs = await remoteConn.db.collection(colName).find({}).toArray();
      console.log(`   📥 تم سحب (${docs.length}) مستندات.`);

      // 2. تفريغ المجموعة التطويرية لضمان عدم التكرار وتطابق البيانات تماماً
      await localConn.db.collection(colName).deleteMany({});
      console.log(`   🧹 تم مسح البيانات القديمة في قاعدة التطوير للمجموعة [${colName}].`);

      // 3. حقن البيانات الجديدة في قاعدة التطوير
      if (docs.length > 0) {
        await localConn.db.collection(colName).insertMany(docs);
        console.log(`   📤 تم حقن (${docs.length}) مستندات بنجاح في قاعدة التطوير.`);
      } else {
        console.log(`   ℹ️ المجموعة فارغة، لم يتم حقن أي بيانات.`);
      }
    }

    console.log('\n🎉 تم المزامنة واستنساخ البيانات بنجاح تام إلى قاعدة التطوير الآمنة! 🚀');
  } catch (err) {
    console.error('❌ حدث خطأ غير متوقع أثناء عملية المزامنة:', err);
  } finally {
    // إغلاق الاتصالات بأمان
    if (remoteConn) await remoteConn.close();
    if (localConn) await localConn.close();
    console.log('🔌 تم إغلاق الاتصالات بأمان.');
  }
}

syncDatabases();
