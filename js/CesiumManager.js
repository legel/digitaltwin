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
            fullscreenButton: false,
            homeButton: false,
            geocoder: false,
            navigationHelpButton: false,
            selectionIndicator: false,  // Disable the green selection box
            infoBox: false,  // Disable the info box popup
        });

        // Enable rendering the sky
        this.viewer.scene.skyAtmosphere.show = true;
        
        // Add Cesium World Terrain for proper ground elevation (without trees/buildings)
        // This gives us the actual terrain elevation without trees/buildings
        this.viewer.terrainProvider = new Cesium.CesiumTerrainProvider({
            url: Cesium.IonResource.fromAssetId(1), // Cesium World Terrain
            requestWaterMask: false,
            requestVertexNormals: false
        });
        
        // Enable depth testing against terrain for proper rendering
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
        
        // Reduce terrain detail for better performance
        this.viewer.scene.globe.terrainExaggeration = 1.0; // No vertical exaggeration
        this.viewer.scene.globe.maximumScreenSpaceError = 4; // Lower quality for better performance (default is 2)
        
        // Add click handler for polygons
        const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        handler.setInputAction((click) => {
            const pickedObject = this.viewer.scene.pick(click.position);
            console.log('Click detected, picked object:', pickedObject);
            
            if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.polygon) {
                const entity = pickedObject.id;
                const entityName = entity.name;
                
                console.log('Clicked on polygon with name:', entityName);
                
                // Parse the entity name to extract PA/NPA info
                const parsed = window.parseBoydName?.(entityName);
                console.log('Parsed entity:', parsed);
                
                if (entityName && entityName.includes('PA') && !entityName.includes('NPA')) {
                    // This is a plantable area
                    const paName = parsed?.description || parsed?.id;
                    console.log('Clicked on plantable area, description:', paName);
                    
                    // Check if this PA is in our categories
                    if (paName && window.layerState?.paCategories?.has(paName)) {
                        console.log('Found PA in categories:', paName);
                        
                        // Ensure the plantable areas dropdown is open
                        const plantableToggle = document.getElementById('plantableAreasToggle');
                        const plantableSubOptions = document.getElementById('plantableSubOptions');
                        if (plantableToggle && plantableSubOptions && plantableSubOptions.style.display !== 'block') {
                            console.log('Opening plantable areas dropdown');
                            plantableToggle.click();
                        }
                        
                        // Find and click the radio button
                        setTimeout(() => {
                            const radio = document.querySelector(`.pa-category input[value="${paName}"]`);
                            console.log('Looking for radio with value:', paName, 'Found:', radio);
                            if (radio) {
                                radio.checked = true;
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log('Selected PA radio button');
                            }
                        }, 100);
                    }
                } else if (entityName && entityName.includes('NPA')) {
                    // This is a non-plantable area
                    const npaCategory = window.extractNPACategory?.(entityName);
                    console.log('Clicked on NPA with category:', npaCategory);
                    
                    if (npaCategory && window.layerState?.npaCategories?.has(npaCategory)) {
                        console.log('Found NPA category in state:', npaCategory);
                        
                        // Ensure the non-plantable areas dropdown is open
                        const npaToggle = document.getElementById('nonPlantableAreasToggle');
                        const npaSubOptions = document.getElementById('nonPlantableSubOptions');
                        if (npaToggle && npaSubOptions && npaSubOptions.style.display !== 'block') {
                            console.log('Opening non-plantable areas dropdown');
                            npaToggle.click();
                        }
                        
                        // Find and click the radio button
                        setTimeout(() => {
                            const radio = document.querySelector(`.npa-category input[value="${npaCategory}"]`);
                            console.log('Looking for NPA radio with value:', npaCategory, 'Found:', radio);
                            if (radio) {
                                radio.checked = true;
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log('Selected NPA radio button');
                            }
                        }, 100);
                    }
                }
            } else {
                console.log('Click was not on a polygon entity');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // Store handler for cleanup
        this.clickHandler = handler;

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
    
    /**
     * Focuses camera on selected ecological niche with proper positioning
     * @param {Entity} entity - The selected entity with polygon
     */
    focusOnEcologicalNiche(entity) {
        if (!entity || !entity.polygon || !entity.polygon.hierarchy) {
            return;
        }
        
        // Get the polygon positions
        const positions = entity.polygon.hierarchy.getValue(this.viewer.clock.currentTime).positions;
        if (!positions || positions.length === 0) {
            return;
        }
        
        // Calculate the center and bounds of the polygon
        let minLat = 90, maxLat = -90;
        let minLon = 180, maxLon = -180;
        let totalLat = 0, totalLon = 0;
        
        positions.forEach((position) => {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lon = Cesium.Math.toDegrees(cartographic.longitude);
            
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            
            totalLat += lat;
            totalLon += lon;
        });
        
        // Calculate center
        const centerLat = totalLat / positions.length;
        const centerLon = totalLon / positions.length;
        
        // Calculate the span in meters
        const latSpan = (maxLat - minLat) * 111320; // Approximate meters per degree latitude
        const lonSpan = (maxLon - minLon) * 111320 * Math.cos(centerLat * Math.PI / 180);
        
        // Get the viewport aspect ratio
        const aspectRatio = this.viewer.canvas.width / this.viewer.canvas.height;
        
        // Calculate height based on vertical constraint (50% of screen height)
        // The polygon should fit within 50% of vertical space
        const fov = this.viewer.camera.frustum.fov;
        const verticalHeight = (latSpan * 2) / Math.tan(fov / 2); // *2 for 50% vertical
        
        // Check if horizontal span would exceed screen width at this height
        const horizontalFOV = 2 * Math.atan(Math.tan(fov / 2) * aspectRatio);
        const maxHorizontalSpan = 2 * verticalHeight * Math.tan(horizontalFOV / 2);
        
        // If horizontal span would exceed screen width, adjust height based on horizontal constraint
        let height = verticalHeight;
        if (lonSpan > maxHorizontalSpan) {
            height = lonSpan / (2 * Math.tan(horizontalFOV / 2));
        }
        
        // Add 20% padding for better framing
        height = height * 1.2;
        
        // Fly to position with camera facing straight down
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height),
            orientation: {
                heading: 0.0,  // North
                pitch: -Math.PI / 2,  // Looking straight down
                roll: 0.0
            },
            duration: 1.5,
            complete: () => {
                // Apply focus mode highlighting
                this.applyFocusMode(entity);
            }
        });
    }
    
    /**
     * Apply focus mode highlighting to selected entity
     * @param {Entity} selectedEntity - The selected entity to highlight
     */
    applyFocusMode(selectedEntity) {
        const entities = this.viewer.entities.values;
        
        // Store original polygon properties if not already stored
        if (!this.originalEntityColors) {
            this.originalEntityColors = new Map();
            entities.forEach((entity) => {
                if (entity.polygon && entity.polygon.outline) {
                    this.originalEntityColors.set(entity.id, {
                        outlineWidth: entity.polygon.outlineWidth || 2,
                        outlineColor: entity.polygon.outlineColor ? entity.polygon.outlineColor.getValue().clone() : Cesium.Color.BLACK,
                        material: entity.polygon.material
                    });
                }
            });
        }
        
        entities.forEach((entity) => {
            if (entity.polygon) {
                const original = this.originalEntityColors.get(entity.id);
                if (!original) return;
                
                if (entity === selectedEntity) {
                    // Elegant highlight for selected entity - white outline, slightly more opaque
                    entity.polygon.outlineWidth = window.debugSettings?.selectedOutlineWidth || 5;
                    entity.polygon.outlineColor = Cesium.Color.WHITE;
                    entity.polygon.material = original.material.color.getValue().withAlpha(0.3);
                } else {
                    // Keep other entities with original appearance
                    entity.polygon.outlineWidth = original.outlineWidth;
                    entity.polygon.outlineColor = original.outlineColor;
                    entity.polygon.material = original.material;
                }
            }
        });
    }
    
    /**
     * Clear focus mode when deselecting
     */
    clearFocusMode() {
        // Restore original polygon properties from stored values
        if (this.originalEntityColors) {
            const entities = this.viewer.entities.values;
            entities.forEach((entity) => {
                if (entity.polygon && this.originalEntityColors.has(entity.id)) {
                    const original = this.originalEntityColors.get(entity.id);
                    entity.polygon.outlineWidth = original.outlineWidth;
                    entity.polygon.outlineColor = original.outlineColor;
                    entity.polygon.material = original.material;
                }
            });
        }
        
        // Clear stored colors
        this.originalEntityColors = null;
    }

}

// Expose CesiumManager to the global scope
window.CesiumManager = CesiumManager;

