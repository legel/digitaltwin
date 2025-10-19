/**
 * UserManager class handles basic user device detection for UI customization.
 */
class UserManager {
    constructor() {
        this.userDevice = this.detectUserDevice();
    }

    /**
     * Detects the user's device type based on navigator properties.
     * @returns {string} - The detected device type.
     */
    detectUserDevice() {
        const userAgent = navigator.userAgent;

        const isMobile = /Mobi|Android/i.test(userAgent);
        if (isMobile) {
            return "Smartphone with Touchscreen";
        }

        if (userAgent.includes("Mac OS X")) {
            return "Laptop with Trackpad";
        } else if (userAgent.includes("Linux")) {
            return "Desktop with Mouse";
        }

        // Default to Desktop with Mouse for other cases (e.g., Windows desktops)
        return "Desktop with Mouse";
    }
}

// Expose UserManager to the global scope
window.UserManager = UserManager;

// Initialize UserManager instance for device detection
window.user = new UserManager();