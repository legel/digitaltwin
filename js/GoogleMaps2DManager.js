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
        this.isMapReady = false; // Flag to track map readiness
    }

    /**
     * Asynchronously initializes the Google Maps API and creates the map instance.
     * @returns {Promise<GoogleMaps2DManager>} A promise that resolves to this instance.
     */
    async initialize() {
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

    /**
     * Initializes the Google Map instance.
     */
    initializeMap() {
        const containerElement = document.getElementById(this.containerId);
        if (!containerElement) {
            throw new Error(`Container element with ID '${this.containerId}' not found.`);
        }

        this.map = new google.maps.Map(containerElement, {
            center: { lat: this.lat, lng: this.lon },
            zoom: this.zoom,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            },
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
        if (zoomRangeModifier && zoomRangeModifier.getMinZoom) {
            zoomRangeModifier.getMinZoom = () => {
                return this.map.getTilt() > 0 ? minTiltedZoom : this.map.getMinZoom();
            };
        }

        this.map.addListener('tilt_changed', () => {
            const currentZoom = this.map.getZoom();
            const currentTilt = this.map.getTilt();

            if (currentTilt > 0 && currentZoom < minTiltedZoom) {
                this.map.setZoom(minTiltedZoom);
            } else if (currentTilt === 0 && currentZoom > originalDesiredMaxZoom) {
                this.map.setZoom(originalDesiredMaxZoom);
            }
        });
    }
}

// Expose GoogleMaps2DManager to the global scope
window.GoogleMaps2DManager = GoogleMaps2DManager;