/**
 * PWA Installation Handler
 * @module PWAInstall
 */

// Global variables
let deferredPrompt = null;
const installButton = document.getElementById('install-button');

/**
 * Initialize PWA installation functionality
 */
function initPWAInstall() {
    if (!installButton) {
        console.warn('Install button not found');
        return;
    }
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Listen for app installed event
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Add click event to install button
    installButton.addEventListener('click', installPWA);
    
    // Check if the app is already installed
    checkIfAppIsInstalled();
}

/**
 * Handle beforeinstallprompt event
 * @param {Event} event - The beforeinstallprompt event
 */
function handleBeforeInstallPrompt(event) {
    console.log('beforeinstallprompt event fired');
    
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    
    // Stash the event so it can be triggered later
    deferredPrompt = event;
    
    // Show the install button
    installButton.style.display = 'flex';
    
    // Optionally, send analytics event that PWA install is available
    logAnalyticsEvent('pwa_install_available');
}

/**
 * Handle app installed event
 */
function handleAppInstalled() {
    console.log('PWA was installed');
    
    // Hide the install button
    installButton.style.display = 'none';
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    
    // Optionally, send analytics event to track successful installation
    logAnalyticsEvent('pwa_installed');
}

/**
 * Install the PWA
 */
function installPWA() {
    if (!deferredPrompt) {
        console.warn('No deferred prompt available');
        return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
            logAnalyticsEvent('pwa_install_accepted');
        } else {
            console.log('User dismissed the install prompt');
            logAnalyticsEvent('pwa_install_dismissed');
        }
        
        // Clear the deferredPrompt variable
        deferredPrompt = null;
        
        // Hide the install button
        installButton.style.display = 'none';
    });
}

/**
 * Check if the app is already installed
 */
function checkIfAppIsInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('App is running in standalone mode');
        installButton.style.display = 'none';
        return true;
    }
    
    // Check using the navigator.getInstalledRelatedApps() method if available
    if ('getInstalledRelatedApps' in navigator) {
        navigator.getInstalledRelatedApps().then((apps) => {
            if (apps.length > 0) {
                console.log('App is already installed');
                installButton.style.display = 'none';
            }
        }).catch((error) => {
            console.warn('Error checking installed apps:', error);
        });
    }
    
    return false;
}

/**
 * Log analytics events (stub for actual analytics implementation)
 * @param {string} eventName - The name of the event
 * @param {Object} eventData - Additional event data
 */
function logAnalyticsEvent(eventName, eventData = {}) {
    // This is a stub for actual analytics implementation
    console.log(`Analytics event: ${eventName}`, eventData);
    
    // In a real application, you would send this to your analytics service
    // Example: 
    // gtag('event', eventName, eventData);
    // or
    // amplitude.getInstance().logEvent(eventName, eventData);
}

// Initialize PWA install functionality when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWAInstall);
} else {
    initPWAInstall();
}