/**
 * CesiumManager class manages the initialization and configuration of the Cesium Viewer.
 */
class CesiumManager {
    constructor(containerId, debug = false) {
        console.log("Initializing Cesium Viewer");

	this.debug = debug;

        // Ensure the container element exists
        const containerElement = document.getElementById(containerId);
        if (!containerElement) {
            throw new Error(`Container element with ID '${containerId}' not found.`);
        }

        // Set the Cesium Ion access token
        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4YWU4NTA5OC1mNDk4LTRjM2EtYmViZS1kZmFlZWE1OWUzNzUiLCJpZCI6MjQzMTg3LCJpYXQiOjE3MjY5Nzc3NzZ9.VvafdUTRTMh-QrH-ut-_l8SLL99Z9VIdCwRs-25PUDM";

        // Initialize the Cesium Viewer with the desired configuration
        this.viewer = new Cesium.Viewer(containerId, {
            timeline: false,
            animation: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            globe: false,
            fullscreenButton: false,
            homeButton: false,
            geocoder: false,
            navigationHelpButton: false,
        });

        // Enable rendering the sky
        this.viewer.scene.skyAtmosphere.show = true;

        this.finalDestination = null;

        console.log("Cesium Viewer initialized:", this.viewer);

        // Remove the credit container from the DOM
        const creditContainer = this.viewer._element.querySelector('.cesium-viewer-bottom');
        if (creditContainer) {
            creditContainer.remove();
            console.log("Cesium credits removed from the DOM.");
        }

        // Add Photorealistic 3D Tileset
        this.addTileset();

        // Set a default final destination
        this.setFinalDestination(-80.21104660, 25.74188074, 194.69, 0.03691171, -0.80323003, 0.00000814);

        const viewer3D = this.getViewer(); // Get the viewer from CesiumManager

        // Add event listener to the "Save View" button if debug is true
        if (debug) {
           addSaveViewButton();
           document.getElementById("saveViewButton").addEventListener("click", () => printViewConfiguration(viewer3D));
        }
    }

    /**
     * Sets the final destination for the camera.
     * @param {number} lat - Latitude in degrees.
     * @param {number} lon - Longitude in degrees.
     * @param {number} height - Height in meters.
     * @param {number} heading - Heading in radians.
     * @param {number} pitch - Pitch in radians.
     * @param {number} roll - Roll in radians.
     */
    setFinalDestination(lat, lon, height, heading, pitch, roll) {
        this.finalDestination = { lat, lon, height, heading, pitch, roll };
    }

    /**
     * Returns the Cesium Viewer instance.
     * @returns {Cesium.Viewer} - The Cesium Viewer instance.
     */
    getViewer() {
        return this.viewer;
    }

    /**
     * Adds the Google Photorealistic 3D Tileset to the scene.
     * @returns {Promise<void>} - A promise that resolves when the tileset is added.
     */
    addTileset() {
        console.log("Adding photorealistic tileset");
        return Cesium.createGooglePhotorealistic3DTileset()
            .then(tileset => {
                this.viewer.scene.primitives.add(tileset);
            })
            .catch(error => {
                console.error(`Error loading Photorealistic 3D Tiles tileset: ${error}`);
            });
    }

}

// Expose CesiumManager to the global scope
window.CesiumManager = CesiumManager;

