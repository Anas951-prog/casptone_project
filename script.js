document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const eyeIcon = togglePassword.querySelector('i');
    
    // Toggle password visibility
    togglePassword.addEventListener('click', function() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
        
        // Force a reflow to prevent layout shift
        passwordInput.style.fontFamily = 'inherit';
    });
    
    // Enhanced offline functionality
    function saveOfflineData(key, data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data);
        }
        localStorage.setItem(key, data);
    }

    function getOfflineData(key) {
        const data = localStorage.getItem(key);
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }

    // Enhanced login form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        if (email && password.length >= 6) {
            if (navigator.onLine) {
                // Simulate API call
                simulateLoginAPI(email, password, rememberMe)
                    .then(response => {
                        if (response.success) {
                            // Save credentials for offline use if "Remember me" is checked
                            if (rememberMe) {
                                saveOfflineData('userCredentials', { email, password });
                            }
                            alert('Login successful! Redirecting to your farm dashboard...');
                            window.location.href = 'dashboard.html';
                        } else {
                            showError('Invalid email or password');
                        }
                    })
                    .catch(error => {
                        showError('Login failed. Please try again.');
                    });
            } else {
                // Offline mode
                const storedCredentials = getOfflineData('userCredentials');
                if (storedCredentials && email === storedCredentials.email && password === storedCredentials.password) {
                    alert('Offline login successful! Some features may be limited.');
                    window.location.href = 'dashboard.html';
                } else {
                    showError('Cannot login offline. Please connect to the internet or use remembered credentials.');
                }
            }
        } else {
            showError('Invalid email or password. Please try again.');
        }
    });

    function simulateLoginAPI(email, password, rememberMe) {
        return new Promise((resolve, reject) => {
            // Simulate API call delay
            setTimeout(() => {
                // Demo credentials
                if (email === 'demo@poultryfarm.com' && password === 'demo123') {
                    resolve({ success: true, user: { name: 'Admin User', email: email } });
                } else {
                    resolve({ success: false, error: 'Invalid credentials' });
                }
            }, 1000);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 3000);
    }
    
    // Clear error when user starts typing
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            errorMessage.style.display = 'none';
        });
    });
    
    // Demo credentials for offline use
    localStorage.setItem('poultryFarmEmail', 'demo@poultryfarm.com');
    localStorage.setItem('poultryFarmPassword', 'demo123');
});