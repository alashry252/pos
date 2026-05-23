document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. إظهار وإخفاء كلمة المرور
    // ==========================================
    const passwordInput = document.getElementById('password');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');

    if (togglePasswordIcon && passwordInput) {
        togglePasswordIcon.addEventListener('click', function () {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
            this.style.color = isPassword ? '#818cf8' : '#64748b';
        });
    }

    // ==========================================
    // 2. حماية الفورم (Loading State)
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            if(loginForm.checkValidity()) {
                submitBtn.classList.add('btn-loading');
                submitBtn.style.pointerEvents = 'none';
            }
        });
    }

    // ==========================================
    // 3. منع خيارات المطور (Anti-DevTools UX)
    // ==========================================
    // منع الكليك يمين
    document.addEventListener('contextmenu', event => event.preventDefault());

    // منع اختصارات لوحة المفاتيح الخاصة بالمطورين
    document.addEventListener('keydown', event => {
        // منع F12
        if (event.keyCode === 123) {
            event.preventDefault();
        }
        // منع Ctrl+Shift+I (Windows/Linux) أو Cmd+Opt+I (Mac)
        if ((event.ctrlKey && event.shiftKey && event.keyCode === 73) || (event.metaKey && event.altKey && event.keyCode === 73)) {
            event.preventDefault();
        }
        // منع Ctrl+Shift+J (فتح الكونسول)
        if ((event.ctrlKey && event.shiftKey && event.keyCode === 74) || (event.metaKey && event.altKey && event.keyCode === 74)) {
            event.preventDefault();
        }
        // منع Ctrl+U (عرض مصدر الصفحة)
        if ((event.ctrlKey && event.keyCode === 85) || (event.metaKey && event.keyCode === 85)) {
            event.preventDefault();
        }
    });
});