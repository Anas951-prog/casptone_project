// Service Worker Registration with enhanced cachings tge
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// WebSocket connection for real-time data
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function initWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    
    try {
        // Use wss:// for secure connection if available, otherwise fallback to ws://
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket connection established');
            reconnectAttempts = 0;
            showNotification('Real-time connection established', 'success', 2000);
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleRealTimeData(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket connection closed');
            attemptReconnect();
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
    }
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached');
        return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    
    console.log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts})`);
    
    setTimeout(() => {
        initWebSocket();
    }, delay);
}

function handleRealTimeData(data) {
    // Update dashboard with real-time data
    if (data.type === 'sensor_data') {
        updateSensorData(data);
    } else if (data.type === 'alert') {
        handleRealTimeAlert(data);
    } else if (data.type === 'system_status') {
        updateSystemStatus(data);
    }
}

function updateSensorData(data) {
    // Update temperature value and trend
    const tempValue = document.getElementById('tempValue');
    if (tempValue && data.temperature !== undefined) {
        const currentTemp = parseFloat(tempValue.textContent);
        tempValue.textContent = `${data.temperature.toFixed(1)}°C`;
        
        // Update trend indicator
        const trend = document.querySelector('.card.temp .card-trend');
        if (trend) {
            const change = (data.temperature - currentTemp).toFixed(1);
            updateTrendIndicator(trend, change, '°C');
        }
    }
    
    // Update humidity value and trend
    const humidityValue = document.getElementById('humidityValue');
    if (humidityValue && data.humidity !== undefined) {
        const currentHumidity = parseInt(humidityValue.textContent);
        humidityValue.textContent = `${Math.round(data.humidity)}%`;
        
        // Update trend indicator
        const trend = document.querySelector('.card.humidity .card-trend');
        if (trend) {
            const change = data.humidity - currentHumidity;
            updateTrendIndicator(trend, change, '%');
        }
    }
    
    // Update ammonia value and trend
    const ammoniaValue = document.querySelector('.card.ammonia .card-value');
    if (ammoniaValue && data.ammonia !== undefined) {
        const currentAmmonia = parseInt(ammoniaValue.textContent);
        ammoniaValue.textContent = `${Math.round(data.ammonia)} ppm`;
        
        // Update trend indicator
        const trend = document.querySelector('.card.ammonia .card-trend');
        if (trend) {
            const change = data.ammonia - currentAmmonia;
            updateTrendIndicator(trend, change, 'ppm');
        }
    }
    
    // Update charts with new data
    if (window.tempHumidityChart && data.temperature !== undefined && data.humidity !== undefined) {
        addDataToChart(window.tempHumidityChart, data.timestamp, [data.temperature, data.humidity]);
    }
    
    if (window.ammoniaChart && data.ammonia !== undefined) {
        addDataToChart(window.ammoniaChart, data.timestamp, [data.ammonia]);
    }
}

function updateTrendIndicator(element, change, unit) {
    if (change > 0) {
        element.innerHTML = `<i class="fas fa-arrow-up" aria-hidden="true"></i> ${Math.abs(change).toFixed(1)}${unit} from last reading`;
        element.className = 'card-trend trend-up';
    } else if (change < 0) {
        element.innerHTML = `<i class="fas fa-arrow-down" aria-hidden="true"></i> ${Math.abs(change).toFixed(1)}${unit} from last reading`;
        element.className = 'card-trend trend-down';
    } else {
        element.innerHTML = `<i class="fas fa-minus" aria-hidden="true"></i> No change from last reading`;
        element.className = 'card-trend trend-neutral';
    }
}

function addDataToChart(chart, timestamp, values) {
    // Limit data points to prevent chart from getting too crowded
    const maxDataPoints = 20;
    
    // Format time for display
    const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Add new data
    chart.data.labels.push(time);
    
    // Add values to each dataset
    chart.data.datasets.forEach((dataset, index) => {
        dataset.data.push(values[index]);
    });
    
    // Remove oldest data if we exceed max data points
    if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }
    
    // Update chart
    chart.update('quiet');
}

function handleRealTimeAlert(data) {
    // Create new alert
    const alert = {
        id: Date.now(),
        title: data.title || 'New Alert',
        message: data.message || 'An issue has been detected',
        type: data.severity || 'warning',
        timestamp: Date.now(),
        unread: true
    };
    
    // Add to notifications
    addNotification(alert);
    
    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
        showBrowserNotification(alert);
    }
    
    // Play notification sound
    playNotificationSound();
    
    // Show in-app notification
    showNotification(alert.message, alert.type);
}

function updateSystemStatus(data) {
    // Update system status indicators
    const statusIndicator = document.getElementById('systemStatus');
    if (statusIndicator) {
        if (data.status === 'online') {
            statusIndicator.className = 'status-indicator online';
            statusIndicator.title = 'System online';
        } else if (data.status === 'offline') {
            statusIndicator.className = 'status-indicator offline';
            statusIndicator.title = 'System offline';
        } else if (data.status === 'degraded') {
            statusIndicator.className = 'status-indicator degraded';
            statusIndicator.title = 'System degraded';
        }
    }
}

// Update notification
function showUpdateNotification() {
    if (document.getElementById('update-notification')) return;
    
    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1a73e8;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    notification.innerHTML = `
        <span>New update available!</span>
        <button onclick="window.location.reload()" style="
            background: white;
            color: #1a73e8;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        ">Update</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 10000);
}

// DOM Ready Function
document.addEventListener('DOMContentLoaded', function() {
    // Check network status
    checkNetworkStatus();
    
    // Initialize based on current page
    if (document.querySelector('.login-body')) {
        initLoginPage();
    } else if (document.querySelector('.dashboard')) {
        initDashboard();
    }
    
    // Initialize PWA install prompt
    initPWAInstall();
    
    // Add offline/online event listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Initialize background sync if available
    initBackgroundSync();
    
    // Request notification permission
    requestNotificationPermission();
    
    // Initialize notification sound
    initNotificationSound();
    
    // Initialize WebSocket connection for real-time data
    if (isAuthenticated()) {
        initWebSocket();
    }
    
    // Initialize language preferences
    initLanguagePreferences();
});

// Network status functions
function checkNetworkStatus() {
    if (!navigator.onLine) {
        handleOfflineStatus();
    }
}

function handleOnlineStatus() {
    const offlineBanner = document.getElementById('offline-banner');
    if (offlineBanner) {
        offlineBanner.remove();
    }
    
    // Show online notification
    showNotification('Connection restored', 'success');
    
    // Sync any pending data
    syncPendingData();
    
    // Reconnect WebSocket
    if (isAuthenticated()) {
        initWebSocket();
    }
}

function handleOfflineStatus() {
    if (document.getElementById('offline-banner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ea4335;
        color: white;
        padding: 10px 20px;
        text-align: center;
        z-index: 10000;
        font-size: 14px;
    `;
    banner.textContent = 'You are currently offline. Some features may be limited.';
    
    document.body.appendChild(banner);
    
    // Close WebSocket connection
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: ${type === 'success' ? '#34a853' : type === 'error' ? '#ea4335' : '#1a73e8'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 250px;
    `;
    
    // Add icon based on notification type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}" aria-hidden="true"></i>
        <span>${message}</span>
        <button class="notification-close" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            margin-left: auto;
            padding: 0;
        ">
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        removeNotification(notification);
    });
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                removeNotification(notification);
            }
        }, duration);
    }
    
    return notification;
}

function removeNotification(notification) {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function syncPendingData() {
    // Check if there's any pending data to sync
    const pendingData = JSON.parse(localStorage.getItem('pendingData') || '[]');
    
    if (pendingData.length > 0) {
        showNotification('Syncing pending data...', 'info');
        
        // Simulate API calls for each pending item
        pendingData.forEach((data, index) => {
            setTimeout(() => {
                // In a real app, this would be an actual API call
                console.log('Syncing data:', data);
                
                // Remove from pending after successful sync
                const updatedPendingData = pendingData.filter(item => item !== data);
                localStorage.setItem('pendingData', JSON.stringify(updatedPendingData));
                
                if (index === pendingData.length - 1) {
                    showNotification('Data sync completed', 'success');
                }
            }, index * 1000);
        });
    }
}

// Background Sync initialization
function initBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            // Register for background sync
            registration.sync.register('pending-data-sync')
                .then(() => {
                    console.log('Background sync registered');
                })
                .catch(err => {
                    console.log('Background sync registration failed:', err);
                });
        });
    }
}

// Login Page Functionality
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    
    // Check for saved credentials
    const savedCredentials = getSavedCredentials();
    if (savedCredentials) {
        document.getElementById('email').value = savedCredentials.email;
        document.getElementById('password').value = savedCredentials.password;
        document.getElementById('rememberMe').checked = true;
    }
    
    // Toggle password visibility
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle eye icon
            const eyeIcon = this.querySelector('i');
            if (type === 'text') {
                eyeIcon.classList.remove('fa-eye');
                eyeIcon.classList.add('fa-eye-slash');
            } else {
                eyeIcon.classList.remove('fa-eye-slash');
                eyeIcon.classList.add('fa-eye');
            }
        });
    }
    
    // Form submission
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            // Enhanced validation
            if (!validateEmail(email)) {
                showError('Please enter a valid email address');
                return;
            }
            
            if (password.length < 6) {
                showError('Password must be at least 6 characters');
                return;
            }
            
            // Save credentials if remember me is checked
            if (rememberMe) {
                saveCredentials(email, password);
            } else {
                clearSavedCredentials();
            }
            
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;
            
            // Simulate login (replace with actual API call)
            simulateLogin(email, password)
                .then(success => {
                    if (success) {
                        // Set authentication flag and user data
                        localStorage.setItem('isAuthenticated', 'true');
                        localStorage.setItem('userEmail', email);
                        
                        // Track login event
                        trackEvent('login', {method: 'form', success: true});
                        
                        showNotification('Login successful!', 'success');
                        setTimeout(() => {
                            window.location.href = 'dashboard.html';
                        }, 1000);
                    } else {
                        showError('Invalid credentials');
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        
                        // Track failed login
                        trackEvent('login', {method: 'form', success: false});
                    }
                })
                .catch(error => {
                    showError('Login failed. Please try again.');
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    
                    // Track login error
                    trackEvent('login_error', {error: error.message});
                });
        });
    }
    
    // Add demo login button for testing
    addDemoLoginButton();
}

function addDemoLoginButton() {
    const demoBtn = document.createElement('button');
    demoBtn.type = 'button';
    demoBtn.className = 'demo-button';
    demoBtn.textContent = 'Use Demo Account';
    demoBtn.style.cssText = `
        background: #f1f3f4;
        color: #5f6368;
        border: 1px solid #dadce0;
        padding: 12px;
        border-radius: 4px;
        width: 100%;
        margin-top: 15px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    demoBtn.addEventListener('click', function() {
        document.getElementById('email').value = 'demo@poultryfarm.com';
        document.getElementById('password').value = 'demo123';
        document.getElementById('rememberMe').checked = true;
        
        // Show info message
        showNotification('Demo credentials filled', 'info', 2000);
    });
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.appendChild(demoBtn);
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function simulateLogin(email, password) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Demo credentials - in a real app, this would be an API call
            resolve(email === 'demo@poultryfarm.com' && password === 'demo123');
        }, 1500);
    });
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

function saveCredentials(email, password) {
    // Use more secure storage in a real app (e.g., encrypted)
    localStorage.setItem('savedEmail', email);
    localStorage.setItem('savedPassword', password);
}

function getSavedCredentials() {
    const email = localStorage.getItem('savedEmail');
    const password = localStorage.getItem('savedPassword');
    return email && password ? { email, password } : null;
}

function clearSavedCredentials() {
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('savedPassword');
}

// Dashboard Functionality
function initDashboard() {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize user preferences
    initUserPreferences();
    
    // Toggle sidebar on mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(event) {
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(event.target) && event.target !== menuToggle) {
                sidebar.classList.remove('active');
            }
        }
    });
    
    // Initialize charts
    initCharts();
    
    // Initialize real-time data updates
    initRealTimeData();
    
    // Initialize date range filter
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', function() {
            updateCharts(this.value);
        });
    }
    
    // Initialize chart period buttons
    const chartButtons = document.querySelectorAll('.chart-actions button');
    chartButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons in the same container
            const parent = this.closest('.chart-actions');
            parent.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update chart based on period
            const period = this.getAttribute('data-period');
            const chartContainer = this.closest('.chart-container');
            const chartId = chartContainer.querySelector('canvas').id;
            
            updateChartPeriod(chartId, period);
        });
    });
    
    // Initialize alert actions
    initAlertActions();
    
    // Add logout functionality
    initLogout();
    
    // Initialize data export functionality
    initDataExport();
    
    // Initialize notification panel
    initNotificationPanel();
    
    // Initialize notification settings
    initNotificationSettings();
    
    // Initialize house selection
    initHouseSelection();
    
    // Initialize predictive analytics
    initPredictiveAnalytics();
    
    // Initialize equipment status
    initEquipmentStatus();
}

function isAuthenticated() {
    // Check if user is authenticated
    return localStorage.getItem('isAuthenticated') === 'true';
}

function initUserPreferences() {
    // Load user preferences
    const preferences = JSON.parse(localStorage.getItem('userPreferences')) || {};
    
    // Apply theme if set
    if (preferences.theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    // Apply language if set
    if (preferences.language) {
        setLanguage(preferences.language);
    }
}

function initHouseSelection() {
    const houseSelector = document.getElementById('houseSelector');
    if (houseSelector) {
        houseSelector.addEventListener('change', function() {
            const selectedHouse = this.value;
            updateHouseData(selectedHouse);
            
            // Track house selection
            trackEvent('house_selection', {house: selectedHouse});
        });
    }
}

function updateHouseData(houseId) {
    // Show loading state
    showNotification(`Loading data for ${houseId}...`, 'info', 2000);
    
    // Simulate API call to get house-specific data
    setTimeout(() => {
        // Update dashboard with house-specific data
        const houseData = getHouseData(houseId);
        
        if (houseData) {
            // Update status cards
            if (houseData.temperature !== undefined) {
                document.getElementById('tempValue').textContent = `${houseData.temperature}°C`;
            }
            
            if (houseData.humidity !== undefined) {
                document.getElementById('humidityValue').textContent = `${houseData.humidity}%`;
            }
            
            if (houseData.ammonia !== undefined) {
                document.querySelector('.card.ammonia .card-value').textContent = `${houseData.ammonia} ppm`;
            }
            
            if (houseData.birds !== undefined) {
                document.querySelector('.card.birds .card-value').textContent = houseData.birds.toLocaleString();
            }
            
            // Update charts
            if (window.tempHumidityChart && houseData.temperature !== undefined && houseData.humidity !== undefined) {
                // This would be replaced with actual historical data for the selected house
                window.tempHumidityChart.data.datasets[0].data = generateRandomData(20, 25, 30);
                window.tempHumidityChart.data.datasets[1].data = generateRandomData(50, 60, 70);
                window.tempHumidityChart.update();
            }
            
            if (window.ammoniaChart && houseData.ammonia !== undefined) {
                // This would be replaced with actual historical data for the selected house
                window.ammoniaChart.data.datasets[0].data = generateRandomData(5, 10, 15);
                window.ammoniaChart.update();
            }
        }
    }, 1000);
}

function getHouseData(houseId) {
    // Mock data for different houses
    const houseData = {
        'house-1': {
            temperature: 27.5,
            humidity: 65,
            ammonia: 12,
            birds: 2450
        },
        'house-2': {
            temperature: 26.8,
            humidity: 68,
            ammonia: 9,
            birds: 2100
        },
        'house-3': {
            temperature: 28.2,
            humidity: 62,
            ammonia: 14,
            birds: 2750
        }
    };
    
    return houseData[houseId] || houseData['house-1'];
}

function generateRandomData(min, avg, max) {
    const data = [];
    for (let i = 0; i < 7; i++) {
        // Generate random value around the average
        const value = avg + (Math.random() * (max - min) - (avg - min));
        data.push(Number(value.toFixed(1)));
    }
    return data;
}

function initPredictiveAnalytics() {
    // Initialize predictive analytics chart if it exists
    const predictiveChart = document.getElementById('predictiveChart');
    if (predictiveChart && !window.predictiveChart) {
        initPredictiveChart();
    }
}

// New initEquipmentStatus function
function initEquipmentStatus() {
  // Initialize equipment status
  const equipmentStatus = document.getElementById('equipmentStatus');
  if (equipmentStatus) {
    // Initialize fan control buttons
    const fanAutoBtn = document.getElementById('fanAutoBtn');
    const fanManualBtn = document.getElementById('fanManualBtn');
    const fanOnBtn = document.getElementById('fanOnBtn');
    const fanOffBtn = document.getElementById('fanOffBtn');
    const fanPowerControl = document.getElementById('fanPowerControl');
    
    // Initialize ventilation control buttons
    const ventilationAutoBtn = document.getElementById('ventilationAutoBtn');
    const ventilationManualBtn = document.getElementById('ventilationManualBtn');
    const ventilationOnBtn = document.getElementById('ventilationOnBtn');
    const ventilationOffBtn = document.getElementById('ventilationOffBtn');
    const ventilationPowerControl = document.getElementById('ventilationPowerControl');
    
    // Fan control logic
    if (fanAutoBtn && fanManualBtn) {
      fanAutoBtn.addEventListener('click', function() {
        this.classList.add('active');
        fanManualBtn.classList.remove('active');
        fanPowerControl.style.display = 'none';
        document.getElementById('fanMode').textContent = 'Automatic';
        showNotification('Fan set to automatic mode', 'info');
        // In a real app, this would send a command to the system
      });
      
      fanManualBtn.addEventListener('click', function() {
        this.classList.add('active');
        fanAutoBtn.classList.remove('active');
        fanPowerControl.style.display = 'flex';
        document.getElementById('fanMode').textContent = 'Manual';
        showNotification('Fan set to manual mode', 'info');
        // In a real app, this would send a command to the system
      });
    }
    
    if (fanOnBtn && fanOffBtn) {
      fanOnBtn.addEventListener('click', function() {
        this.classList.add('active');
        fanOffBtn.classList.remove('active');
        document.getElementById('fanStatus').textContent = 'RUNNING';
        document.getElementById('fanStatus').className = 'state-value online';
        showNotification('Fan turned on', 'info');
        // In a real app, this would send a command to the system
      });
      
      fanOffBtn.addEventListener('click', function() {
        this.classList.add('active');
        fanOnBtn.classList.remove('active');
        document.getElementById('fanStatus').textContent = 'OFF';
        document.getElementById('fanStatus').className = 'state-value offline';
        showNotification('Fan turned off', 'info');
        // In a real app, this would send a command to the system
      });
    }
    
    // Ventilation control logic
    if (ventilationAutoBtn && ventilationManualBtn) {
      ventilationAutoBtn.addEventListener('click', function() {
        this.classList.add('active');
        ventilationManualBtn.classList.remove('active');
        ventilationPowerControl.style.display = 'none';
        document.getElementById('ventilationMode').textContent = 'Automatic';
        showNotification('Ventilation set to automatic mode', 'info');
        // In a real app, this would send a command to the system
      });
      
      ventilationManualBtn.addEventListener('click', function() {
        this.classList.add('active');
        ventilationAutoBtn.classList.remove('active');
        ventilationPowerControl.style.display = 'flex';
        document.getElementById('ventilationMode').textContent = 'Manual';
        showNotification('Ventilation set to manual mode', 'info');
        // In a real app, this would send a command to the system
      });
    }
    
    if (ventilationOnBtn && ventilationOffBtn) {
      ventilationOnBtn.addEventListener('click', function() {
        this.classList.add('active');
        ventilationOffBtn.classList.remove('active');
        document.getElementById('ventilationStatus').textContent = 'RUNNING';
        document.getElementById('ventilationStatus').className = 'state-value online';
        showNotification('Ventilation turned on', 'info');
        // In a real app, this would send a command to the system
      });
      
      ventilationOffBtn.addEventListener('click', function() {
        this.classList.add('active');
        ventilationOnBtn.classList.remove('active');
        document.getElementById('ventilationStatus').textContent = 'OFF';
        document.getElementById('ventilationStatus').className = 'state-value offline';
        showNotification('Ventilation turned off', 'info');
        // In a real app, this would send a command to the system
      });
    }
    
    // Simulate real-time updates to equipment status
    setInterval(() => {
      updateEquipmentStatus();
    }, 30000);
  }
}

// New updateEquipmentStatus function
function updateEquipmentStatus() {
  const fanStatus = document.getElementById('fanStatus');
  const ventilationStatus = document.getElementById('ventilationStatus');
  const lastUpdated = document.querySelector('.last-updated');
  
  if (fanStatus && ventilationStatus && lastUpdated) {
    // Simulate status changes (in a real app, this would come from the server)
    const fanIsOnline = Math.random() > 0.1; // 90% chance of being online
    const fanIsRunning = fanIsOnline && Math.random() > 0.3; // 70% chance of running if online
    
    const ventilationIsOnline = Math.random() > 0.1; // 90% chance of being online
    const ventilationIsRunning = ventilationIsOnline && Math.random() > 0.3; // 70% chance of running if online
    
    // Update fan status
    if (document.getElementById('fanMode').textContent === 'Automatic') {
      if (fanIsOnline) {
        fanStatus.textContent = fanIsRunning ? 'RUNNING' : 'IDLE';
        fanStatus.className = 'state-value ' + (fanIsRunning ? 'online' : 'offline');
      } else {
        fanStatus.textContent = 'OFFLINE';
        fanStatus.className = 'state-value offline';
      }
    }
    
    // Update ventilation status
    if (document.getElementById('ventilationMode').textContent === 'Automatic') {
      if (ventilationIsOnline) {
        ventilationStatus.textContent = ventilationIsRunning ? 'RUNNING' : 'IDLE';
        ventilationStatus.className = 'state-value ' + (ventilationIsRunning ? 'online' : 'offline');
      } else {
        ventilationStatus.textContent = 'OFFLINE';
        ventilationStatus.className = 'state-value offline';
      }
    }
    
    lastUpdated.textContent = 'Last updated: Just now';
    
    // Add a visual pulse to indicate update
    [fanStatus, ventilationStatus].forEach(element => {
      element.classList.add('pulse');
      setTimeout(() => {
        element.classList.remove('pulse');
      }, 1000);
    });
  }
}

function checkEquipmentStatus(equipment) {
    showNotification(`Checking ${equipment} status...`, 'info');
    
    // Simulate equipment check
    setTimeout(() => {
        showNotification(`${equipment} status updated`, 'success');
        
        // Update equipment status (in a real app, this would be based on actual check)
        const randomStatus = ['online', 'degraded', 'offline'][Math.floor(Math.random() * 3)];
        updateEquipmentStatus(equipment, randomStatus);
    }, 2000);
}

function initAlertActions() {
    const alertButtons = document.querySelectorAll('.alert-actions button');
    alertButtons.forEach(button => {
        button.addEventListener('click', function() {
            const alertCard = this.closest('.alert-card');
            const alertId = alertCard.dataset.alertId || Date.now();
            
            // Store dismissed alert to prevent reappearing
            const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts') || '[]');
            dismissedAlerts.push(alertId);
            localStorage.setItem('dismissedAlerts', JSON.stringify(dismissedAlerts));
            
            alertCard.style.opacity = '0';
            setTimeout(() => {
                alertCard.remove();
                checkEmptyAlerts();
            }, 300);
        });
    });
}

function checkEmptyAlerts() {
    const alertsContainer = document.querySelector('.alerts-container');
    if (alertsContainer && alertsContainer.children.length === 0) {
        alertsContainer.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <p>No active alerts</p>
            </div>
        `;
    }
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Track logout event
            trackEvent('logout');
            
            // Clear authentication data
            localStorage.removeItem('isAuthenticated');
            sessionStorage.removeItem('isAuthenticated');
            
            // Close WebSocket connection
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            
            // Redirect to login page
            window.location.href = 'login.html';
        });
    }
}

// Data export functionality
function initDataExport() {
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            // Show export options
            showExportOptions();
        });
    }
}

function showExportOptions() {
    const exportOptions = document.getElementById('exportOptions');
    if (exportOptions) {
        exportOptions.classList.toggle('show');
    } else {
        createExportOptionsModal();
    }
}

function createExportOptionsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal export-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Export Data</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="export-option" data-format="csv">
                    <i class="fas fa-file-csv"></i>
                    <span>CSV Format</span>
                </div>
                <div class="export-option" data-format="json">
                    <i class="fas fa-file-code"></i>
                    <span>JSON Format</span>
                </div>
                <div class="export-option" data-format="pdf">
                    <i class="fas fa-file-pdf"></i>
                    <span>PDF Report</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="cancelExport">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#cancelExport').addEventListener('click', () => {
        modal.remove();
    });
    
    const exportOptions = modal.querySelectorAll('.export-option');
    exportOptions.forEach(option => {
        option.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            exportChartData(format);
            modal.remove();
        });
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function exportChartData(format = 'csv') {
    if ((!window.tempHumidityChart || !window.ammoniaChart) && format !== 'pdf') return;
    
    let data, filename, mimeType;
    
    if (format === 'csv') {
        const tempData = window.tempHumidityChart.data.datasets[0].data;
        const humidityData = window.tempHumidityChart.data.datasets[1].data;
        const ammoniaData = window.ammoniaChart.data.datasets[0].data;
        const labels = window.tempHumidityChart.data.labels;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Time,Temperature (°C),Humidity (%),Ammonia (ppm)\n";
        
        for (let i = 0; i < labels.length; i++) {
            const row = [
                labels[i],
                tempData[i] || '',
                humidityData[i] || '',
                ammoniaData[i] || ''
            ].join(',');
            csvContent += row + "\n";
        }
        
        data = encodeURI(csvContent);
        filename = "poultry_farm_data.csv";
        mimeType = "text/csv";
    } else if (format === 'json') {
        const chartData = {
            temperature: window.tempHumidityChart.data.datasets[0].data,
            humidity: window.tempHumidityChart.data.datasets[1].data,
            ammonia: window.ammoniaChart.data.datasets[0].data,
            labels: window.tempHumidityChart.data.labels,
            exportedAt: new Date().toISOString()
        };
        
        data = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chartData, null, 2));
        filename = "poultry_farm_data.json";
        mimeType = "application/json";
    } else if (format === 'pdf') {
        // In a real app, this would use a PDF generation library
        showNotification('PDF export would be generated here', 'info');
        return;
    }
    
    const link = document.createElement("a");
    link.setAttribute("href", data);
    link.setAttribute("download", filename);
    link.setAttribute("type", mimeType);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Data exported as ${format.toUpperCase()}`, 'success');
    
    // Track export event
    trackEvent('data_export', {format: format});
}

// Initialize Charts
function initCharts() {
    // Temperature & Humidity Chart
    const tempHumidityCtx = document.getElementById('tempHumidityChart');
    if (tempHumidityCtx) {
        window.tempHumidityChart = new Chart(tempHumidityCtx, {
            type: 'line',
            data: {
                labels: ['6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: [26.5, 27.2, 28.5, 29.8, 29.2, 28.0, 27.0],
                        borderColor: '#ea4335',
                        backgroundColor: 'rgba(234, 67, 53, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Humidity (%)',
                        data: [70, 65, 60, 55, 58, 63, 68],
                        borderColor: '#4285f4',
                        backgroundColor: 'rgba(66, 133, 244, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Ammonia Chart
    const ammoniaCtx = document.getElementById('ammoniaChart');
    if (ammoniaCtx) {
        window.ammoniaChart = new Chart(ammoniaCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Ammonia (ppm)',
                    data: [8, 10, 12, 9, 11, 13, 12],
                    backgroundColor: 'rgba(52, 168, 83, 0.7)',
                    borderColor: 'rgba(52, 168, 83, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // Predictive Analytics Chart
    initPredictiveChart();
}

function initPredictiveChart() {
    const predictiveCtx = document.getElementById('predictiveChart');
    if (predictiveCtx) {
        // Generate sample predictive data
        const historicalData = [26.5, 27.2, 28.5, 29.8, 29.2, 28.0, 27.0];
        const predictiveData = [27.5, 28.2, 29.0, 29.5, 29.0, 28.2, 27.5];
        
        window.predictiveChart = new Chart(predictiveCtx, {
            type: 'line',
            data: {
                labels: ['Now', '+1h', '+2h', '+3h', '+4h', '+5h', '+6h'],
                datasets: [
                    {
                        label: 'Historical',
                        data: historicalData,
                        borderColor: '#4285f4',
                        backgroundColor: 'rgba(66, 133, 244, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: false
                    },
                    {
                        label: 'Predicted',
                        data: predictiveData,
                        borderColor: '#fbbc04',
                        backgroundColor: 'rgba(251, 188, 4, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

// Update Charts Based on Date Filter
function updateCharts(period) {
    console.log('Updating charts for period:', period);
    
    // Show loading state
    const charts = document.querySelectorAll('canvas');
    charts.forEach(chart => {
        chart.style.opacity = '0.5';
    });
    
    // Simulate API call delay
    setTimeout(() => {
        if (window.tempHumidityChart) {
            const newTempData = period === 'today' ? 
                [26.5, 27.2, 28.5, 29.8, 29.2, 28.0, 27.0] :
                period === 'last7' ? 
                [25.8, 26.5, 27.2, 28.0, 27.5, 26.8, 26.2] :
                [26.0, 26.8, 27.5, 28.2, 27.8, 27.2, 26.5];
                
            const newHumidityData = period === 'today' ? 
                [70, 65, 60, 55, 58, 63, 68] :
                period === 'last7' ? 
                [72, 68, 63, 59, 62, 66, 70] :
                [71, 67, 62, 58, 61, 65, 69];
                
            window.tempHumidityChart.data.datasets[0].data = newTempData;
            window.tempHumidityChart.data.datasets[1].data = newHumidityData;
            window.tempHumidityChart.update();
        }
        
        if (window.ammoniaChart) {
            const newAmmoniaData = period === 'today' ? 
                [8, 10, 12, 9, 11, 13, 12] :
                period === 'last7' ? 
                [7, 9, 11, 8, 10, 12, 11] :
                [8, 10, 12, 9, 11, 13, 12];
                
            window.ammoniaChart.data.datasets[0].data = newAmmoniaData;
            window.ammoniaChart.update();
        }
        
        // Update predictive chart if it exists
        if (window.predictiveChart) {
            // In a real app, this would fetch new predictive data
            window.predictiveChart.update();
        }
        
        // Remove loading state
        charts.forEach(chart => {
            chart.style.opacity = '1';
        });
    }, 500);
}

// Update Chart Based on Period (Day/Week/Month)
function updateChartPeriod(chartId, period) {
    console.log(`Updating ${chartId} for period: ${period}`);
    
    // Show loading state
    const chart = document.getElementById(chartId);
    if (chart) chart.style.opacity = '0.5';
    
    // Simulate API call delay
    setTimeout(() => {
        if (chartId === 'tempHumidityChart' && window.tempHumidityChart) {
            let newLabels, newTempData, newHumidityData;
            
            if (period === 'day') {
                newLabels = ['6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
                newTempData = [26.5, 27.2, 28.5, 29.8, 29.2, 28.0, 27.0];
                newHumidityData = [70, 65, 60, 55, 58, 63, 68];
            } else if (period === 'week') {
                newLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                newTempData = [25.8, 26.5, 27.2, 28.0, 27.5, 26.8, 26.2];
                newHumidityData = [72, 68, 63, 59, 62, 66, 70];
            } else if (period === 'month') {
                newLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                newTempData = [26.2, 27.5, 28.2, 27.8];
                newHumidityData = [68, 62, 58, 61];
            }
            
            window.tempHumidityChart.data.labels = newLabels;
            window.tempHumidityChart.data.datasets[0].data = newTempData;
            window.tempHumidityChart.data.datasets[1].data = newHumidityData;
            window.tempHumidityChart.update();
        }
        
        if (chartId === 'ammoniaChart' && window.ammoniaChart) {
            let newLabels, newAmmoniaData;
            
            if (period === 'day') {
                newLabels = ['6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
                newAmmoniaData = [8, 10, 12, 9, 11, 13, 12];
            } else if (period === 'week') {
                newLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                newAmmoniaData = [7, 9, 11, 8, 10, 12, 11];
            }
            
            window.ammoniaChart.data.labels = newLabels;
            window.ammoniaChart.data.datasets[0].data = newAmmoniaData;
            window.ammoniaChart.update();
        }
        
        if (chartId === 'predictiveChart' && window.predictiveChart) {
            // Update predictive chart based on period
            window.predictiveChart.update();
        }
        
        // Remove loading state
        if (chart) chart.style.opacity = '1';
    }, 500);
}

// Initialize Real-time Data Updates
function initRealTimeData() {
    // Only run on dashboard
    if (!document.querySelector('.dashboard')) return;
    
    // Simulate real-time data updates (in a real app, this would come from WebSocket)
    setInterval(() => {
        // Generate random sensor data
        const newData = {
            temperature: 27 + (Math.random() * 2 - 1), // 26-28°C
            humidity: 60 + (Math.random() * 10 - 5),   // 55-65%
            ammonia: 10 + (Math.random() * 4 - 2),     // 8-12 ppm
            timestamp: new Date().toISOString()
        };
        
        // Update dashboard with new data
        updateSensorData(newData);
    }, 5000); // Update every 5 seconds
}

// PWA Install Prompt
function initPWAInstall() {
    let deferredPrompt;
    const installButton = document.getElementById('install-button');
    
    if (!installButton) return;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show the install button
        installButton.style.display = 'flex';
        installButton.addEventListener('click', installApp);
    });
    
    function installApp() {
        if (!deferredPrompt) return;
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                showNotification('App installed successfully!', 'success');
                
                // Track installation
                trackEvent('pwa_install', {outcome: 'accepted'});
            } else {
                console.log('User dismissed the install prompt');
                
                // Track dismissal
                trackEvent('pwa_install', {outcome: 'dismissed'});
            }
            // Clear the saved prompt since it can't be used again
            deferredPrompt = null;
            // Hide the install button
            installButton.style.display = 'none';
        });
    }
    
    // Hide the install button if the app is already installed
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        installButton.style.display = 'none';
        deferredPrompt = null;
    });
}

// Notification Panel Functionality
function initNotificationPanel() {
    const notificationsBtn = document.querySelector('.notifications');
    const notificationPanel = document.getElementById('notificationPanel');
    const markAllReadBtn = document.getElementById('markAllRead');
    const clearNotificationsBtn = document.getElementById('clearNotifications');
    
    if (notificationsBtn && notificationPanel) {
        // Toggle notification panel
        notificationsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationPanel.classList.toggle('active');
            
            // Mark notifications as read when panel is opened
            if (notificationPanel.classList.contains('active')) {
                markNotificationsAsRead();
            }
        });
        
        // Close panel when clicking outside
        document.addEventListener('click', function(e) {
            if (!notificationPanel.contains(e.target) && !notificationsBtn.contains(e.target)) {
                notificationPanel.classList.remove('active');
            }
        });
        
        // Mark all as read
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                markNotificationsAsRead();
                showNotification('All notifications marked as read', 'success');
            });
        }
        
        // Clear all notifications
        if (clearNotificationsBtn) {
            clearNotificationsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                clearAllNotifications();
                showNotification('All notifications cleared', 'info');
            });
        }
        
        // Load notifications
        loadNotifications();
        
        // Simulate new notifications for demo
        simulateNewNotifications();
    }
}

function loadNotifications() {
    const notificationList = document.querySelector('.notification-list');
    if (!notificationList) return;
    
    // Get notifications from localStorage or use demo data
    const notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
    
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.unread ? 'unread' : ''}" data-id="${notification.id}">
            <div class="notification-icon ${notification.type}">
                <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <div class="notification-meta">
                    <span class="notification-time">${formatTime(notification.timestamp)}</span>
                    <span class="notification-type ${notification.type}">${notification.type}</span>
                </div>
            </div>
            <button class="notification-action" data-id="${notification.id}" aria-label="Dismiss notification">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    // Add event listeners to dismiss buttons
    const dismissButtons = document.querySelectorAll('.notification-action');
    dismissButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const notificationId = this.getAttribute('data-id');
            dismissNotification(notificationId);
        });
    });
    
    // Update badge count
    updateNotificationBadge();
}

function getNotificationIcon(type) {
    const icons = {
        alert: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle',
        success: 'check-circle'
    };
    
    return icons[type] || 'bell';
}

function getDemoNotifications() {
    return [
        {
            id: 1,
            title: 'High Temperature Alert',
            message: 'Temperature exceeded 30°C in Broiler House 2. Please check ventilation system.',
            type: 'alert',
            timestamp: Date.now() - 600000, // 10 minutes ago
            unread: true
        },
        {
            id: 2,
            title: 'Ammonia Level Rising',
            message: 'Ammonia levels approaching threshold in Layer House 1. Consider increasing ventilation.',
            type: 'warning',
            timestamp: Date.now() - 1800000, // 30 minutes ago
            unread: true
        },
        {
            id: 3,
            title: 'Humidity Fluctuation',
            message: 'Humidity dropped below optimal range in Breeder House. Check humidifier settings.',
            type: 'info',
            timestamp: Date.now() - 7200000, // 2 hours ago
            unread: true
        },
        {
            id: 4,
            title: 'System Update',
            message: 'New dashboard features available. Check the settings page for details.',
            type: 'info',
            timestamp: Date.now() - 86400000, // 1 day ago
            unread: false
        }
    ];
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function markNotificationsAsRead() {
    const notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
    const updatedNotifications = notifications.map(notification => ({
        ...notification,
        unread: false
    }));
    
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    loadNotifications();
}

function dismissNotification(notificationId) {
    let notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
    notifications = notifications.filter(notification => notification.id != notificationId);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    loadNotifications();
    showNotification('Notification dismissed', 'info');
}

function clearAllNotifications() {
    localStorage.setItem('notifications', JSON.stringify([]));
    loadNotifications();
}

function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    const notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
    const unreadCount = notifications.filter(n => n.unread).length;
    
    if (badge) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        
        if (unreadCount > 0) {
            badge.classList.add('pulse');
            setTimeout(() => badge.classList.remove('pulse'), 500);
        }
    }
}

function addNotification(notification) {
    let notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
    notifications.unshift(notification);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    loadNotifications();
}

function simulateNewNotifications() {
    // Simulate receiving new notifications every 30 seconds for demo
    setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance of new notification
            const notifications = JSON.parse(localStorage.getItem('notifications')) || getDemoNotifications();
            
            // Notification types and messages
            const notificationTypes = [
                {
                    type: 'alert',
                    title: 'Temperature Alert',
                    messages: [
                        'Temperature exceeded safe limits in House 1',
                        'Rapid temperature increase detected in Broiler House',
                        'Cooling system may need adjustment in Layer House'
                    ]
                },
                {
                    type: 'warning',
                    title: 'Humidity Warning',
                    messages: [
                        'Humidity levels approaching threshold in Breeder House',
                        'Low humidity detected in Broiler House',
                        'Humidity fluctuation detected in House 2'
                    ]
                },
                {
                    type: 'info',
                    title: 'System Update',
                    messages: [
                        'New features available in dashboard',
                        'Scheduled maintenance tomorrow at 2 AM',
                        'Data export functionality improved'
                    ]
                }
            ];
            
            const randomType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
            const randomMessage = randomType.messages[Math.floor(Math.random() * randomType.messages.length)];
            
            const newNotification = {
                id: Date.now(),
                title: randomType.title,
                message: randomMessage,
                type: randomType.type,
                timestamp: Date.now(),
                unread: true
            };
            
            notifications.unshift(newNotification);
            localStorage.setItem('notifications', JSON.stringify(notifications));
            
            // Update UI
            loadNotifications();
            
            // Show browser notification if permitted
            if (Notification.permission === 'granted') {
                showBrowserNotification(newNotification);
            }
            
            // Play notification sound
            playNotificationSound();
            
            showNotification('New notification received', 'info');
        }
    }, 30000);
}

function showBrowserNotification(notification) {
    if (!('Notification' in window)) return;
    
    const options = {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'poultry-notification',
        vibrate: [200, 100, 200]
    };
    
    new Notification(notification.title, options);
}

// Notification Settings
function initNotificationSettings() {
    const notificationSettingsBtn = document.getElementById('notificationSettings');
    const notificationSettingsModal = document.getElementById('notificationSettingsModal');
    const closeModalBtn = document.querySelector('.modal-close');
    const saveSettingsBtn = document.getElementById('saveNotificationSettings');
    
    if (notificationSettingsBtn && notificationSettingsModal) {
        // Open modal
        notificationSettingsBtn.addEventListener('click', function() {
            notificationSettingsModal.classList.add('active');
            loadNotificationSettings();
        });
        
        // Close modal
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
                notificationSettingsModal.classList.remove('active');
            });
        }
        
        // Close modal when clicking outside
        notificationSettingsModal.addEventListener('click', function(e) {
            if (e.target === notificationSettingsModal) {
                notificationSettingsModal.classList.remove('active');
            }
        });
        
        // Save settings
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', function() {
                saveNotificationSettings();
                notificationSettingsModal.classList.remove('active');
                showNotification('Notification settings saved', 'success');
            });
        }
    }
}

function loadNotificationSettings() {
    const settings = JSON.parse(localStorage.getItem('notificationSettings')) || {
        temperatureAlerts: true,
        humidityAlerts: true,
        ammoniaAlerts: true,
        systemUpdates: true,
        browserNotifications: true,
        soundNotifications: true,
        emailNotifications: false,
        smsNotifications: false,
        // Threshold settings
        temperatureThreshold: 30,
        humidityThreshold: 70,
        ammoniaThreshold: 15
    };
    
    // Set checkbox values
    Object.keys(settings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = settings[key];
            } else {
                element.value = settings[key];
            }
        }
    });
}

function saveNotificationSettings() {
    const settings = {
        temperatureAlerts: document.getElementById('temperatureAlerts').checked,
        humidityAlerts: document.getElementById('humidityAlerts').checked,
        ammoniaAlerts: document.getElementById('ammoniaAlerts').checked,
        systemUpdates: document.getElementById('systemUpdates').checked,
        browserNotifications: document.getElementById('browserNotifications').checked,
        soundNotifications: document.getElementById('soundNotifications').checked,
        emailNotifications: document.getElementById('emailNotifications').checked,
        smsNotifications: document.getElementById('smsNotifications').checked,
        temperatureThreshold: parseFloat(document.getElementById('temperatureThreshold').value),
        humidityThreshold: parseFloat(document.getElementById('humidityThreshold').value),
        ammoniaThreshold: parseFloat(document.getElementById('ammoniaThreshold').value)
    };
    
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
}

// Request notification permission
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
        // Only ask once per session
        if (!sessionStorage.getItem('notificationPermissionAsked')) {
            setTimeout(() => {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        showNotification('Browser notifications enabled', 'success');
                    }
                });
                sessionStorage.setItem('notificationPermissionAsked', 'true');
            }, 3000);
        }
    }
}

// Notification sound
function initNotificationSound() {
    // Create audio context for notification sounds
    try {
        window.notificationAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
        console.log('Audio context not supported:', error);
    }
}

function playNotificationSound() {
    const settings = JSON.parse(localStorage.getItem('notificationSettings')) || {};
    if (settings.soundNotifications === false) return;
    
    try {
        // Check if AudioContext is available
        if (!window.notificationAudioContext) {
            initNotificationSound();
        }
        
        const oscillator = window.notificationAudioContext.createOscillator();
        const gainNode = window.notificationAudioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(window.notificationAudioContext.destination);
        
        oscillator.frequency.setValueAtTime(880, window.notificationAudioContext.currentTime);
        oscillator.frequency.setValueAtTime(440, window.notificationAudioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, window.notificationAudioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, window.notificationAudioContext.currentTime + 0.3);
        
        oscillator.start();
        oscillator.stop(window.notificationAudioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Could not play notification sound:', error);
    }
}

// Language preferences
function initLanguagePreferences() {
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        // Load saved language preference
        const preferences = JSON.parse(localStorage.getItem('userPreferences')) || {};
        if (preferences.language) {
            languageSelector.value = preferences.language;
        }
        
        languageSelector.addEventListener('change', function() {
            const language = this.value;
            setLanguage(language);
            
            // Save preference
            const preferences = JSON.parse(localStorage.getItem('userPreferences')) || {};
            preferences.language = language;
            localStorage.setItem('userPreferences', JSON.stringify(preferences));
            
            showNotification('Language changed', 'success');
        });
    }
}

function setLanguage(language) {
    // This would be replaced with actual i18n implementation
    console.log('Setting language to:', language);
    // For now, just update a data attribute on the body
    document.body.setAttribute('data-lang', language);
}

// Analytics and tracking
function trackEvent(eventName, eventData = {}) {
    // This would be replaced with actual analytics implementation
    console.log('Tracking event:', eventName, eventData);
    
    // Simulate sending to analytics service
    const analyticsData = {
        event: eventName,
        timestamp: new Date().toISOString(),
        user: localStorage.getItem('userEmail') || 'anonymous',
        ...eventData
    };
    
    // Store events for offline syncing
    if (navigator.onLine) {
        // Simulate sending to analytics server
        console.log('Sending analytics:', analyticsData);
    } else {
        // Store for later syncing
        const pendingEvents = JSON.parse(localStorage.getItem('pendingAnalytics') || '[]');
        pendingEvents.push(analyticsData);
        localStorage.setItem('pendingAnalytics', JSON.stringify(pendingEvents));
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notification-badge.pulse {
        animation: pulse 0.5s ease-in-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        align-items: center;
        justify-content: center;
    }
    
    .modal.active {
        display: flex;
    }
    
    .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    
    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
    }
    
    .setting-item:last-child {
        border-bottom: none;
    }
    
    .modal-footer {
        margin-top: 20px;
        text-align: right;
    }
    
    .btn-primary {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .btn-primary:hover {
        background: #1967d2;
    }
    
    .trend-neutral {
        color: #5f6368;
    }
    
    .status-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 8px;
    }
    
    .status-indicator.online {
        background: #34a853;
    }
    
    .status-indicator.offline {
        background: #ea4335;
    }
    
    .status-indicator.degraded {
        background: #fbbc04;
    }
    
    .equipment-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        background: #f8f9fa;
    }
    
    .equipment-item.online {
        border-left: 4px solid #34a853;
    }
    
    .equipment-item.offline {
        border-left: 4px solid #ea4335;
    }
    
    .equipment-item.degraded {
        border-left: 4px solid #fbbc04;
    }
    
    .equipment-info h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
    }
    
    .equipment-status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
        background: #e8f0fe;
        color: #1a73e8;
    }
    
    .equipment-item.online .equipment-status {
        background: #e6f4ea;
        color: #34a853;
    }
    
    .equipment-item.offline .equipment-status {
        background: #fce8e6;
        color: #ea4335;
    }
    
    .equipment-item.degraded .equipment-status {
        background: #fef7e0;
        color: #fbbc04;
    }
    
    .last-check {
        font-size: 12px;
        color: #5f6368;
    }
    
    .action-btn {
        background: #1a73e8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    }
    
    .export-modal .modal-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .export-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid #dadce0;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .export-option:hover {
        background: #f8f9fa;
        border-color: #1a73e8;
    }
    
    .export-option i {
        font-size: 24px;
        color: #5f6368;
    }
    
    .export-option[data-format="csv"] i {
        color: #34a853;
    }
    
    .export-option[data-format="json"] i {
        color: #fbbc04;
    }
    
    .export-option[data-format="pdf"] i {
        color: #ea4335;
    }
    
    .dark-mode {
        --text-primary: #e8eaed;
        --text-secondary: #9aa0a6;
        --bg-light: #202124;
        --bg-lighter: #303134;
        --border-color: #5f6368;
    }
    
    body.dark-mode {
        background: #202124;
        color: #e8eaed;
    }
    
    body.dark-mode .card,
    body.dark-mode .chart-container,
    body.dark-mode .alerts-section {
        background: #303134;
        color: #e8eaed;
    }
    
    body.dark-mode .card-header h3 {
        color: #9aa0a6;
    }
    
    body.dark-mode .input-group input {
        background: #303134;
        color: #e8eaed;
        border-color: #5f6368;
    }
`;
document.head.appendChild(style);