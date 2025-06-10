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
        
        // Enable picking through translucent objects
        this.viewer.scene.pickTranslucentDepth = true;
        
        // Add click handler for debugging (can be removed later)
        const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        handler.setInputAction((click) => {
            const pickedObject = this.viewer.scene.pick(click.position);
            // console.log('Click detected, picked object:', pickedObject); // Commented out to reduce noise
            
            // Check if we picked an entity (pickedObject.id) or if the pickedObject has a primitive
            let entity = null;
            if (Cesium.defined(pickedObject)) {
                if (pickedObject.id && pickedObject.id.polygon) {
                    // Standard entity pick
                    entity = pickedObject.id;
                } else if (pickedObject.primitive && pickedObject.primitive.id && pickedObject.primitive.id.polygon) {
                    // Picked the primitive, get entity from primitive.id
                    entity = pickedObject.primitive.id;
                }
            }
            
            // If we didn't find an entity, try drillPick to see through 3D tiles
            if (!entity) {
                const drillPickResults = this.viewer.scene.drillPick(click.position);
                console.log('Drill pick results:', drillPickResults.length);
                for (let i = 0; i < drillPickResults.length; i++) {
                    const picked = drillPickResults[i];
                    console.log(`DrillPick result ${i}:`, {
                        hasId: !!picked.id,
                        idType: picked.id ? typeof picked.id : 'none',
                        idName: picked.id?.name,
                        hasPolygon: picked.id?.polygon ? true : false,
                        primitive: !!picked.primitive,
                        content: !!picked.content
                    });
                    
                    if (picked.id && picked.id.polygon) {
                        entity = picked.id;
                        console.log('Found entity via drillPick:', entity.name);
                        break;
                    }
                }
            }
            
            // If still no entity, try getting entity at the clicked position
            if (!entity && this.viewer.scene.globe.pick) {
                const ray = this.viewer.camera.getPickRay(click.position);
                const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
                if (cartesian) {
                    // Check all entities to see if click is inside any polygon
                    const entities = this.viewer.entities.values;
                    for (let i = 0; i < entities.length; i++) {
                        const ent = entities[i];
                        if (ent.polygon) {
                            // This is a simplified check - just looking for any polygon entity
                            // In production, you'd want to check if the click is actually inside the polygon
                            console.log('Found polygon entity in collection:', ent.name);
                            // For now, just log what we find
                        }
                    }
                }
            }
            
            if (entity) {
                const entityName = entity.name;
                
                console.log('Clicked on polygon with name:', entityName);
                
                // Parse the entity name to extract PA/NPA info
                const parsed = window.parseBoydName?.(entityName);
                console.log('Parsed entity:', parsed);
                
                // Check if this is a plantable area by looking at all PA radio values
                const allPARadios = document.querySelectorAll('.pa-category input[type="radio"][name="plantableArea"]');
                let isPlantableArea = false;
                for (const radio of allPARadios) {
                    if (radio.value === entityName) {
                        isPlantableArea = true;
                        break;
                    }
                }
                
                if (isPlantableArea) {
                    // This is a plantable area
                    console.log('Clicked on plantable area:', entityName);
                    
                    // Ensure the plantable areas dropdown is open
                    const plantableToggle = document.getElementById('plantableAreasToggle');
                    const plantableSubOptions = document.getElementById('plantableSubOptions');
                    if (plantableToggle && plantableSubOptions && plantableSubOptions.style.display !== 'block') {
                        console.log('Opening plantable areas dropdown');
                        plantableToggle.click();
                    }
                    
                    // Find and click the PA label (entire row)
                    setTimeout(() => {
                        console.log(`Searching for PA label with entity name: "${entityName}"`);
                        
                        // Find all PA category labels
                        const allLabels = document.querySelectorAll('.pa-category');
                        console.log(`Found ${allLabels.length} PA category labels`);
                        
                        let targetLabel = null;
                        
                        // Look through all labels to find the matching one
                        for (const label of allLabels) {
                            // Check the radio input value inside this label
                            const radio = label.querySelector('input[type="radio"]');
                            if (radio) {
                                console.log(`Checking label with radio value: "${radio.value}"`);
                                
                                if (radio.value === entityName) {
                                    targetLabel = label;
                                    console.log(`Found matching label for: "${entityName}"`);
                                    break;
                                }
                            }
                        }
                        
                        if (targetLabel) {
                            console.log('Target label found, simulating click on entire label element');
                            
                            // Create and dispatch mouse events on the label
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            targetLabel.dispatchEvent(clickEvent);
                            console.log('Dispatched click event on label');
                            
                            // Also try native click method
                            targetLabel.click();
                            console.log('Called native click() method on label');
                            
                            // Check if radio got selected
                            const radio = targetLabel.querySelector('input[type="radio"]');
                            if (radio) {
                                console.log(`Radio checked state after click: ${radio.checked}`);
                                
                                // Update visual highlighting
                                if (window.updateSelectedPAHighlight) {
                                    window.updateSelectedPAHighlight(entityName);
                                }
                                
                                // Create connection after a delay
                                setTimeout(() => {
                                    if (window.createPAConnection) {
                                        window.createPAConnection(targetLabel);
                                    }
                                }, 300);
                            }
                        } else {
                            console.warn(`Could not find PA label for: "${entityName}"`);
                            console.warn('Available PA values:');
                            allLabels.forEach(label => {
                                const radio = label.querySelector('input[type="radio"]');
                                if (radio) {
                                    console.log(` - "${radio.value}"`);
                                }
                            });
                        }
                    }, 300);
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
                // console.log('Click was not on a polygon entity'); // Commented out to reduce noise
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // Store handler for cleanup
        this.clickHandler = handler;
        
        // Debug function to list all polygon entities
        this.debugListPolygons = () => {
            const entities = this.viewer.entities.values;
            console.log(`Total entities: ${entities.length}`);
            let polygonCount = 0;
            entities.forEach(entity => {
                if (entity.polygon) {
                    polygonCount++;
                    console.log(`Polygon entity: ${entity.name}`);
                }
            });
            console.log(`Total polygon entities: ${polygonCount}`);
        };
        
        // Call debug function after a delay to ensure entities are loaded
        setTimeout(() => this.debugListPolygons(), 5000);
        
        // Handle entity selection
        this.viewer.selectedEntityChanged.addEventListener((entity) => {
            console.log('Selected entity changed:', entity?.name);
            if (entity && entity.polygon) {
                console.log('Polygon entity selected via selectedEntityChanged:', entity.name);
                const entityName = entity.name;
                
                // Parse the entity name to extract PA/NPA info
                const parsed = window.parseBoydName?.(entityName);
                console.log('Parsed entity:', parsed);
                
                // Check if this is a plantable area by looking at all PA radio values
                const allPARadios = document.querySelectorAll('.pa-category input[type="radio"][name="plantableArea"]');
                let isPlantableArea = false;
                for (const radio of allPARadios) {
                    if (radio.value === entityName) {
                        isPlantableArea = true;
                        break;
                    }
                }
                
                if (isPlantableArea) {
                    // This is a plantable area
                    console.log('Selected plantable area:', entityName);
                    
                    // Ensure the plantable areas dropdown is open
                    const plantableToggle = document.getElementById('plantableAreasToggle');
                    const plantableSubOptions = document.getElementById('plantableSubOptions');
                    if (plantableToggle && plantableSubOptions && plantableSubOptions.style.display !== 'block') {
                        console.log('Opening plantable areas dropdown');
                        plantableToggle.click();
                    }
                    
                    // Find and click the PA label (entire row)
                    setTimeout(() => {
                        console.log(`Searching for PA label with entity name: "${entityName}"`);
                        
                        // Find all PA category labels
                        const allLabels = document.querySelectorAll('.pa-category');
                        console.log(`Found ${allLabels.length} PA category labels`);
                        
                        let targetLabel = null;
                        
                        // Look through all labels to find the matching one
                        for (const label of allLabels) {
                            // Check the radio input value inside this label
                            const radio = label.querySelector('input[type="radio"]');
                            if (radio) {
                                console.log(`Checking label with radio value: "${radio.value}"`);
                                
                                if (radio.value === entityName) {
                                    targetLabel = label;
                                    console.log(`Found matching label for: "${entityName}"`);
                                    break;
                                }
                            }
                            
                            // Also check the span title as backup
                            const span = label.querySelector('span[title]');
                            if (span && span.title === entityName) {
                                targetLabel = label;
                                console.log(`Found matching label by span title: "${entityName}"`);
                                break;
                            }
                        }
                        
                        if (targetLabel) {
                            console.log('Target label found, simulating click on entire label element');
                            
                            // Create and dispatch mouse events on the label
                            const mouseDownEvent = new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            targetLabel.dispatchEvent(mouseDownEvent);
                            console.log('Dispatched mousedown event on label');
                            
                            const mouseUpEvent = new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            targetLabel.dispatchEvent(mouseUpEvent);
                            console.log('Dispatched mouseup event on label');
                            
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            targetLabel.dispatchEvent(clickEvent);
                            console.log('Dispatched click event on label');
                            
                            // Also try native click method
                            targetLabel.click();
                            console.log('Called native click() method on label');
                            
                            // Check if radio got selected
                            const radio = targetLabel.querySelector('input[type="radio"]');
                            if (radio) {
                                console.log(`Radio checked state after click: ${radio.checked}`);
                                
                                // Update visual highlighting
                                if (window.updateSelectedPAHighlight) {
                                    window.updateSelectedPAHighlight(entityName);
                                }
                                
                                // Create connection after a delay
                                setTimeout(() => {
                                    if (window.createPAConnection) {
                                        window.createPAConnection(targetLabel);
                                    }
                                }, 300);
                            }
                        } else {
                            console.warn(`Could not find PA label for: "${entityName}"`);
                            console.warn('Make sure the Plantable Areas section is expanded');
                            
                            // List all available values for debugging
                            console.log('Available PA values:');
                            allLabels.forEach(label => {
                                const radio = label.querySelector('input[type="radio"]');
                                if (radio) {
                                    console.log(` - "${radio.value}"`);
                                }
                            });
                        }
                    }, 300); // Wait for dropdown to be fully rendered
                }
            }
        });

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
        
        // Get the viewport dimensions
        const viewportWidth = this.viewer.canvas.width;
        const viewportHeight = this.viewer.canvas.height;
        const aspectRatio = viewportWidth / viewportHeight;
        
        // Camera field of view
        const fov = this.viewer.camera.frustum.fov; // Vertical FOV in radians
        const hfov = 2 * Math.atan(Math.tan(fov / 2) * aspectRatio); // Horizontal FOV
        
        // Calculate required height for constraints:
        // 1. Polygon should occupy no more than 25% of horizontal screen width
        // 2. Polygon should occupy no more than 50% of vertical screen height
        
        // For horizontal constraint (25% of screen width)
        const targetHorizontalCoverage = 0.25;
        const requiredHorizontalViewSpan = lonSpan / targetHorizontalCoverage;
        const heightForHorizontal = requiredHorizontalViewSpan / (2 * Math.tan(hfov / 2));
        
        // Double the height to ensure we're zoomed out enough
        const heightForHorizontalAdjusted = heightForHorizontal * 2;
        
        // For vertical constraint (50% of screen height)
        const targetVerticalCoverage = 0.5;
        const requiredVerticalViewSpan = latSpan / targetVerticalCoverage;
        const heightForVertical = requiredVerticalViewSpan / (2 * Math.tan(fov / 2));
        
        // Use the larger height to ensure both constraints are met
        let height = Math.max(heightForHorizontalAdjusted, heightForVertical);
        
        // Add 20% padding for visual comfort
        height = height * 1.2;
        
        // Apply minimum height constraint
        const minHeight = 100; // 100 meters minimum for better overview
        height = Math.max(height, minHeight);
        
        // Now calculate the camera position to place polygon center at (25% horizontal, 50% vertical)
        // Target screen position: 25% from left, 50% from top
        const targetScreenX = 0.25; // 25% from left
        const targetScreenY = 0.5;  // 50% from top (center)
        
        // Calculate world-space offset needed
        // When looking straight down, screen X maps to longitude, screen Y to latitude
        const viewWidthMeters = 2 * height * Math.tan(hfov / 2);
        const viewHeightMeters = 2 * height * Math.tan(fov / 2);
        
        // Convert screen position offset to world coordinates
        const screenOffsetX = targetScreenX - 0.5; // -0.25 (left of center)
        const screenOffsetY = targetScreenY - 0.5; // 0 (center)
        
        // Convert to degrees
        const metersPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180);
        const metersPerDegreeLat = 111320;
        
        const lonOffset = -(screenOffsetX * viewWidthMeters) / metersPerDegreeLon;
        const latOffset = -(screenOffsetY * viewHeightMeters) / metersPerDegreeLat;
        
        // Apply offsets to position polygon correctly on screen
        const adjustedCenterLon = centerLon + lonOffset;
        const adjustedCenterLat = centerLat + latOffset;
        
        // Fly to position with camera facing straight down
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(adjustedCenterLon, adjustedCenterLat, height),
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

