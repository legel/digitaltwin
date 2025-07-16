/**
 * UserManager class handles user session details, including device information,
 * session duration, and geolocation data based on IP address.
 */
class UserManager {
    constructor(map3D) {
        this.userDevice = this.detectUserDevice();
        this.deviceScreenWidth = window.innerWidth;
        this.deviceScreenHeight = window.innerHeight;
        this.durationOfSession = "0 minutes 0 seconds";
        this.startTimeOfSession = this.formatDate(new Date());
        this.endTimeOfSession = this.formatDate(new Date());
        this.browserDetails = navigator.userAgent;
        this.iPAddress = null;
        this.geoData = {};
        this.map3D = map3D; // Store the reference to the CesiumManager

        this.updateSessionDuration();
        this.fetchGeoData(); // Fetch geolocation data directly
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




    /**
     * Formats the given date to a human-readable string.
     * @param {Date} date - The date to format.
     * @returns {string} - The formatted date string.
     */
    formatDate(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
            timeZoneName: 'short',
        });
    }

    /**
     * Updates the session duration and end time every 5 seconds.
     */
    updateSessionDuration() {
        const startTime = new Date();
        setInterval(() => {
            const now = new Date();
            const durationSeconds = Math.floor((now - startTime) / 1000);
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;
            this.durationOfSession = `${minutes} minutes ${seconds} seconds`;
            this.endTimeOfSession = this.formatDate(now);
        }, 5000);
    }

    /**
     * Fetches geolocation data based on the user's IP address.
     */
    async fetchGeoData() {
        try {
            const apiKey = "57846733f1a941618109ca3223ea0b21";
            const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}`);
            const data = await response.json();
            this.iPAddress = data.ip;
            this.geoData = data;
            console.log("GeoData:", data); // For debugging
        } catch (error) {
            console.error("Failed to fetch geolocation data:", error);
        }
    }

    /**
     * Waits for the geolocation data to be available.
     * @returns {Promise<void>}
     */
    waitForGeoData() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.geoData.latitude && this.geoData.longitude) {
                    clearInterval(interval);
                    resolve();
                }
            }, 500);
        });
    }

    /**
     * Flies to the user's geolocation based on the IP address.
     */
    async flyToUser() {
        await this.waitForGeoData();

        if (this.geoData.latitude && this.geoData.longitude) {
            const flyToLocation = [
                [this.geoData.longitude, this.geoData.latitude, 1250, 0.0, -0.5, 0.0, 5, "Flying to your approximate location based on your IP address", 0.0, 0.5, 3, 1]
            ];
            flyToSequence(this.map3D, flyToLocation); // Use the map3D instance
        } else {
            console.error("Geolocation data is not available.");
        }
    }
}

// Expose UserManager to the global scope
window.UserManager = UserManager;


