const { app, BrowserWindow } = require('electron');
const path = require('path');

// تحميل المتغيرات البيئية من ملف .env المدمج بأمان
require('dotenv').config({ path: path.join(__dirname, '.env') });

// تعيين بيئة التشغيل كـ production لتجنب تعارض nodemon أو بدء خادم مزدوج
process.env.NODE_ENV = 'production'; 

// استيراد تطبيق Express الأساسي لقاعدة البيانات والواجهات
const serverApp = require('./app');
const PORT = process.env.PORT || 3000;

let mainWindow;
let serverInstance;

// تشغيل خادم Express محلياً بأمان
function startExpressServer() {
    return new Promise((resolve) => {
        serverInstance = serverApp.listen(PORT, '127.0.0.1', () => {
            console.log(`🚀 Express server running locally inside Electron on http://127.0.0.1:${PORT}`);
            resolve();
        });
    });
}

// إنشاء نافذة سطح المكتب ويندوز الفخمة والمحسنة
function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: 'Nexus POS - نظام نقاط البيع والمخزون الذكي',
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false // إخفاء النافذة في البداية لمنع الوميض الأبيض المزعج
    });

    // تكبير النافذة تلقائياً لتملأ الشاشة كشاشة كاشير احترافية
    mainWindow.maximize();

    // تحميل خادم Express المحلي المربوط بقاعدة البيانات
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

    // إظهار النافذة بمجرد اكتمال رندرة وعرض المحتويات
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // تسجيل اختصارات لوحة المفاتيح الهامة للكاشير (F11 للكاملة، Ctrl+R للتحديث)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'r') {
            mainWindow.reload();
            event.preventDefault();
        }
        if (input.key === 'F11') {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
            event.preventDefault();
        }
    });
}

// بدء التطبيق
app.whenReady().then(async () => {
    // 1. بدء السيرفر محلياً
    await startExpressServer();
    
    // 2. فتح الشاشة الرسومية
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

// إغلاق خادم Express بالخلفية عند إغلاق التطبيق لتجنب تعليق البورتات والذاكرة
app.on('window-all-closed', () => {
    if (serverInstance) {
        serverInstance.close(() => {
            console.log('✅ Express server stopped safely.');
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    } else {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }
});

// ==========================================
// 🖨️ قنوات الاتصال بالطباعة الصامتة المتعددة (Multi-Printer Silent Printing IPC)
// ==========================================
const { ipcMain } = require('electron');

// 1. جلب قائمة الطابعات المتصلة بالجهاز
ipcMain.handle('get-printers', async () => {
    if (mainWindow) {
        return await mainWindow.webContents.getPrintersAsync();
    }
    return [];
});

// 2. طباعة صامتة لمحتوى HTML على طابعة محددة
ipcMain.handle('print-silent', async (event, html, printerName) => {
    return new Promise((resolve) => {
        let printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // تحميل كود الـ HTML داخل النافذة المخفية
        printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

        printWindow.webContents.on('did-finish-load', () => {
            const printOptions = {
                silent: true,
                deviceName: printerName || '', // إذا كانت فارغة سيطبع على الطابعة الافتراضية
                printBackground: true
            };

            printWindow.webContents.print(printOptions, (success, failureReason) => {
                printWindow.destroy();
                if (success) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: failureReason });
                }
            });
        });
    });
});
