/**
 * GoogleMaps2DManager class manages the initialization and configuration of the Google Maps 2D instance.
 */
class GoogleMaps2DManager {
    /**
     * Constructs the GoogleMaps2DManager instance.
     * @param {string} containerId - The ID of the HTML container element where the map will be rendered.
     * @param {number} lat - The initial latitude for the map center.
     * @param {number} lon - The initial longitude for the map center.
     * @param {number} zoom - The initial zoom level for the map.
     */
    constructor(containerId, lat = 25.74429985083323, lon = -80.21048109754557, zoom = 19) {
        this.containerId = containerId;
        this.lat = lat;
        this.lon = lon;
        this.zoom = zoom;
        this.map = null;
        this.isMapReady = false; // Flag to indicate when the map is fully initialized

        return this.loadGoogleMapsAPI();
    }

    /**
     * Loads the Google Maps API asynchronously and initializes the map.
     * @returns {Promise<GoogleMaps2DManager>} - A promise that resolves with the GoogleMaps2DManager instance.
     */
    loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            if (typeof google !== 'undefined' && google.maps) {
                this.initializeMap();
                resolve(this);
            } else {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyC8ERGIET7MXBQTpnzp6Cd3l3ijDDBgXVA&callback=initMapWrapper&v=3`;
                script.defer = true;
                script.async = true;
                document.head.appendChild(script);

                window.initMapWrapper = () => {
                    this.initializeMap();
                    resolve(this);
                };

                script.onerror = () => {
                    reject(new Error('Failed to load Google Maps API'));
                };
            }
        });
    }

initializeMap() {
    const containerElement = document.getElementById(this.containerId);
    if (!containerElement) {
        throw new Error(`Container element with ID '${this.containerId}' not found.`);
    }

    this.map = new google.maps.Map(containerElement, {
        center: { lat: this.lat, lng: this.lon },
        zoom: this.zoom,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        rotateControl: true,  // Rotate control enabled
    });

    this.configureZoomBehavior();
    this.isMapReady = true; // Set the flag to true once the map is ready
    console.log("Google Map 2D initialized:", this.map);

}


    /**
     * Configures custom zoom behavior based on the tilt level.
     */
    configureZoomBehavior() {
        const originalDesiredMaxZoom = 22;
        const minTiltedZoom = 22;

        const zoomRangeModifier = this.map.__proto__.__proto__.__proto__;
        const originalSetFunc = zoomRangeModifier.set;

        zoomRangeModifier.set = function(name, value) {
            if (name === "maxZoom") {
                value = originalDesiredMaxZoom;
            }
            originalSetFunc.call(this, name, value);
        };

        google.maps.event.addListener(this.map, "tilt_changed", () => {
            let desiredMaxZoom;
            const currentZoom = this.map.getZoom();

            if (this.map.getTilt() === 0) {
                desiredMaxZoom = 22;
            } else if (this.map.getTilt() === 45) {
                desiredMaxZoom = 21;
                if (currentZoom > minTiltedZoom) {
                    this.map.setZoom(minTiltedZoom);
                }
            }
            this.map.setOptions({ maxZoom: desiredMaxZoom });
        });

        this.map.setTilt(0);
        this.map.setTilt(45);
    }

    /**
     * Returns the Google Maps instance.
     * @returns {google.maps.Map} - The Google Maps instance.
     */
    getMap() {
        return this.map;
    }

    /**
     * Waits until the map is fully initialized.
     * @returns {Promise<GoogleMaps2DManager>} - A promise that resolves when the map is ready.
     */
    waitForMapReady() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.isMapReady) {
                    resolve(this);
                } else {
                    setTimeout(checkReady, 50);
                }
            };
            checkReady();
        });
    }
}

// Expose GoogleMaps2DManager to the global scope
window.GoogleMaps2DManager = GoogleMaps2DManager;

