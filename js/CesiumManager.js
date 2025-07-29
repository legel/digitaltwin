/**
 * CesiumManager class manages the initialization and configuration of the Cesium Viewer.
 */
class CesiumManager {
    constructor(containerId, debug = false) {
        // Initializing Cesium Viewer

	this.debug = debug;

        // Ensure the container element exists
        const containerElement = document.getElementById(containerId);
        if (!containerElement) {
            throw new Error(`Container element with ID '${containerId}' not found.`);
        }

        // Set the Cesium Ion access token
        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MjliMTAwZC0yNTE4LTQ5MDMtODRlYy00MGIxMTg4NTQ0YzkiLCJpZCI6MjQzMTg3LCJpYXQiOjE3NDk2MDQ4MzZ9.u83AqBjOkC2ESDQsylIlYSwE8Br5Je0Hchir3zi3KG8";

        // Initialize the Cesium Viewer with the desired configuration (no terrain initially)
        this.viewer = new Cesium.Viewer(containerId, {
            timeline: false,
            animation: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            homeButton: false,
            geocoder: false,  // Disable geocoder search bar
            navigationHelpButton: false,
            selectionIndicator: false,  // Disable the green selection box
            infoBox: false,  // Disable the info box popup
        });
        
        // Track current base layer mode
        this.isUsingTerrain = false;
        this.photorealisticTileset = null;
        
        // Track camera projection mode
        this.isOrthographic = false;
        this.savedPerspectiveFrustum = null;
        
        // Suppress console warnings by intercepting console.warn temporarily
        const originalWarn = console.warn;
        console.warn = function(...args) {
            const message = args.join(' ');
            // Suppress the specific Google geocoder warning
            if (message.includes('Only the Google geocoder can be used with Google Photorealistic 3D Tiles')) {
                return; // Suppress this specific warning
            }
            return originalWarn.apply(console, args);
        };
        
        // Restore console.warn after a short delay to allow tileset loading
        setTimeout(() => {
            console.warn = originalWarn;
        }, 5000);

        // Enable rendering the sky
        this.viewer.scene.skyAtmosphere.show = true;
        
        // Enable picking through translucent objects
        this.viewer.scene.pickTranslucentDepth = true;
        
        // GPU Efficiency Settings - Enable on-demand rendering to save GPU
        this.viewer.scene.requestRenderMode = true; // Only render when needed
        this.viewer.scene.maximumRenderTimeChange = Infinity; // Don't auto-render for time changes
        
        // Initial render to ensure scene appears
        this.viewer.scene.requestRender();
        
        // Add click handler for debugging (can be removed later)
        const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        handler.setInputAction((click) => {
            // Request render for click interactions
            this.viewer.scene.requestRender();
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
                    // NPA click logging removed for cleaner console output
                    
                    if (npaCategory && window.layerState?.npaCategories?.has(npaCategory)) {
                        // NPA category state logging removed for cleaner console output
                        
                        // Ensure the non-plantable areas dropdown is open
                        const npaToggle = document.getElementById('nonPlantableAreasToggle');
                        const npaSubOptions = document.getElementById('nonPlantableSubOptions');
                        if (npaToggle && npaSubOptions && npaSubOptions.style.display !== 'block') {
                            // NPA dropdown opening logging removed for cleaner console output
                            npaToggle.click();
                        }
                        
                        // Find and click the radio button
                        setTimeout(() => {
                            const radio = document.querySelector(`.npa-category input[value="${npaCategory}"]`);
                            // NPA radio button search logging removed for cleaner console output
                            if (radio) {
                                radio.checked = true;
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                                // NPA radio selection logging removed for cleaner console output
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
        // Debug function available but not auto-called to reduce console noise
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

        // Cesium Viewer initialized

        // Remove the credit container from the DOM
        const creditContainer = this.viewer._element.querySelector('.cesium-viewer-bottom');
        if (creditContainer) {
            creditContainer.remove();
            // Cesium credits removed
        }

        // Ensure clean state - explicitly disable globe and terrain for HQ mode
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        this.viewer.scene.globe.show = false;
        this.viewer.scene.globe.depthTestAgainstTerrain = false;
        // Globe disabled for photorealistic 3D tiles

        // Add Photorealistic 3D Tileset
        this.addTileset();

        // Set initial camera position facing down at Winter Garden site center
        const centerPosition = {
            longitude: -81.65905485,
            latitude: 28.51935345, 
            height: 67.0,   // 3x closer than previous 200m for better detail view
            heading: 0.0,   // North-facing
            pitch: -1.57,   // Facing straight down (90 degrees)
            roll: 0.0       // No roll
        };
        
        // Position camera immediately at the site center, facing down
        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(centerPosition.longitude, centerPosition.latitude, centerPosition.height),
            orientation: {
                heading: centerPosition.heading,
                pitch: centerPosition.pitch,
                roll: centerPosition.roll
            }
        });
        
        // Set this as the final destination for home button functionality
        this.setFinalDestination(centerPosition.latitude, centerPosition.longitude, centerPosition.height, 
                                centerPosition.heading, centerPosition.pitch, centerPosition.roll);

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
     * Adds the Google Photorealistic 3D Tileset to the scene with performance optimizations.
     * @returns {Promise<void>} - A promise that resolves when the tileset is added.
     */
    addTileset() {
        // Adding photorealistic tileset
        return Cesium.createGooglePhotorealistic3DTileset()
            .then(tileset => {
                this.photorealisticTileset = tileset;
                
                // Apply performance optimizations to Google Photorealistic tileset
                this.configurePhotorealisticPerformance(tileset);
                
                this.viewer.scene.primitives.add(tileset);
                this.isUsingTerrain = false;
                
                // Google Photorealistic tileset loaded
                
                // Return the tileset so we can wait for it to be ready
                return tileset;
            })
            .catch(error => {
                console.error(`Error loading Photorealistic 3D Tiles tileset: ${error}`);
                throw error;
            });
    }
    
    /**
     * Toggle between terrain and photorealistic 3D tiles
     * ONLY manages photorealistic tiles and terrain - leaves everything else untouched
     */
    async toggleBaseTerrain() {
        if (this.isUsingTerrain) {
            // Switch to HQ mode: Remove terrain, add photorealistic tiles
            try {
                console.log("Switching to HQ mode (photorealistic 3D tiles)...");
                
                // 1. Remove terrain provider and disable globe for photorealistic tiles
                this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                this.viewer.scene.globe.show = false;
                this.viewer.scene.globe.depthTestAgainstTerrain = false;
                
                // 2. Add photorealistic tileset if we don't have one
                if (!this.photorealisticTileset) {
                    const tileset = await this.addTileset();
                    
                    // 3. Recreate clipping from scratch (Cesium ownership issue requires fresh collections)
                    if (window.gaussianSplatManager) {
                        setTimeout(() => {
                            console.log("Tileset loaded, recreating clipping polygons from scratch...");
                            // Get site IDs first, then clear and recreate
                            const siteIds = Array.from(window.gaussianSplatManager.clippingPolygons.keys());
                            
                            // Properly clean up outlines before clearing clipping polygons
                            siteIds.forEach(siteId => {
                                if (window.gaussianSplatManager.removeClippingVisualization) {
                                    window.gaussianSplatManager.removeClippingVisualization(siteId);
                                }
                            });
                            
                            window.gaussianSplatManager.clippingPolygons.clear();
                            
                            // Recreate clipping for each site
                            siteIds.forEach(siteId => {
                                console.log(`Recreating clipping for site: ${siteId} due to Cesium ownership issues`);
                                // Reload fresh from file (this creates new ClippingPolygonCollection)
                                window.gaussianSplatManager.loadPrecomputedClipping(siteId, tileset)
                                    .catch(error => {
                                        console.error(`Failed to recreate clipping for ${siteId}:`, error);
                                    });
                            });
                        }, 3000);
                    }
                }
                
                this.isUsingTerrain = false;
                console.log("Successfully switched to HQ mode");
                return false; // Not using terrain
            } catch (error) {
                console.error("Failed to switch to HQ mode:", error);
                return true; // Keep using terrain
            }
        } else {
            // Switch to PERF mode: Remove photorealistic tiles, add terrain
            try {
                console.log("Switching to PERF mode (terrain)...");
                
                // 1. Remove ONLY the tracked photorealistic tileset
                if (this.photorealisticTileset) {
                    // Clear clipping from tileset before removing it to prevent collection destruction
                    if (this.photorealisticTileset.clippingPolygons) {
                        this.photorealisticTileset.clippingPolygons = undefined;
                    }
                    
                    // Clean up Google tileset performance monitoring
                    this.cleanupPhotorealisticPerformance();
                    
                    if (this.viewer.scene.primitives.contains(this.photorealisticTileset)) {
                        this.viewer.scene.primitives.remove(this.photorealisticTileset);
                    }
                    if (this.photorealisticTileset.destroy) {
                        this.photorealisticTileset.destroy();
                    }
                    this.photorealisticTileset = null;
                }
                
                // 2. Load terrain
                this.viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
                    Cesium.IonResource.fromAssetId(1),
                    {
                        requestWaterMask: false,
                        requestVertexNormals: false
                    }
                );
                
                // 3. Configure terrain settings
                this.viewer.scene.globe.show = true;
                this.viewer.scene.skyAtmosphere.show = true;
                this.viewer.scene.globe.depthTestAgainstTerrain = true;
                
                this.isUsingTerrain = true;
                console.log("Successfully switched to PERF mode");
                return true; // Using terrain
            } catch (error) {
                console.error("Failed to switch to PERF mode:", error);
                return false; // Keep using photorealistic
            }
        }
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
    
    /**
     * Configures performance optimizations for Google Photorealistic 3D Tileset
     * @param {Cesium.Cesium3DTileset} tileset - The Google Photorealistic tileset
     */
    configurePhotorealisticPerformance(tileset) {
        try {
            // Configuring Google Photorealistic tileset performance
            
            // Performance optimizations for Google Photorealistic tiles
            // These tiles are typically much larger and more detailed than Gaussian splats
            tileset.maximumScreenSpaceError = 12;           // Slightly higher than Gaussian splats (8) for better performance
            tileset.skipLevelOfDetail = true;               // Enable LOD skipping
            tileset.baseScreenSpaceError = 2048;            // Higher base error for more aggressive LOD
            tileset.skipScreenSpaceErrorFactor = 12;        // Skip intermediate levels
            tileset.skipLevels = 1;                         // Skip levels when possible
            tileset.immediatelyLoadDesiredLevelOfDetail = false; // Don't block on high-detail tiles
            tileset.loadSiblings = false;                   // Don't load unnecessary siblings
            tileset.cullWithChildrenBounds = true;          // Better culling
            tileset.cullRequestsWhileMoving = true;         // Aggressive culling during movement
            tileset.cullRequestsWhileMovingMultiplier = 80.0; // More aggressive than Gaussian splats
            tileset.progressiveResolutionHeightFraction = 0.4; // Load lower resolution first
            tileset.preferLeaves = true;                    // Prefer leaf nodes
            
            // Memory management - Google tiles can be very memory intensive
            tileset.maximumMemoryUsage = 512;               // Higher than Gaussian splats (256MB)
            
            // Dynamic screen space error for better performance at distance
            tileset.dynamicScreenSpaceError = true;
            tileset.dynamicScreenSpaceErrorDensity = 0.00278;
            tileset.dynamicScreenSpaceErrorFactor = 6.0;    // More aggressive than Gaussian splats
            tileset.dynamicScreenSpaceErrorHeightFalloff = 0.25;
            
            // Preload optimization
            tileset.preloadWhenHidden = false;              // Don't preload when not visible
            tileset.preloadFlightDestinations = false;      // Don't preload flight destinations
            
            // DISABLED: Individual camera optimization replaced by unified handler in GaussianSplatManager
            // this.setupPhotorealisticCameraOptimization(tileset);
            
            // Google Photorealistic tileset performance optimizations applied
            
        } catch (error) {
            console.error("Error configuring Google Photorealistic tileset performance:", error);
        }
    }
    
    /**
     * Sets up camera movement optimization specifically for Google Photorealistic tiles
     * @param {Cesium.Cesium3DTileset} tileset - The Google tileset
     */
    setupPhotorealisticCameraOptimization(tileset) {
        if (!this.photorealisticCameraHandler) {
            this.photorealisticCameraHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            this.photorealisticCameraMoving = false;
            this.photorealisticMovementTimeout = null;
            
            // Track camera movement for Google tiles (more aggressive than Gaussian splats)
            const handleCameraMovement = () => {
                const startTime = performance.now();
                
                if (!this.photorealisticCameraMoving) {
                    this.photorealisticCameraMoving = true;
                    const optimizeStart = performance.now();
                    this.optimizePhotorealisticForMovement(true);
                    const optimizeEnd = performance.now();
                    console.log(`🔵 Google Camera Movement START - optimize took ${(optimizeEnd - optimizeStart).toFixed(2)}ms`);
                }
                
                if (this.photorealisticMovementTimeout) {
                    clearTimeout(this.photorealisticMovementTimeout);
                }
                
                this.photorealisticMovementTimeout = setTimeout(() => {
                    const restoreStart = performance.now();
                    this.photorealisticCameraMoving = false;
                    this.optimizePhotorealisticForMovement(false);
                    const restoreEnd = performance.now();
                    console.log(`🔵 Google Camera Movement END - restore took ${(restoreEnd - restoreStart).toFixed(2)}ms`);
                }, 200); // Slightly longer delay than Gaussian splats
                
                const totalTime = performance.now() - startTime;
                if (totalTime > 1) { // Only log if it takes more than 1ms
                    console.log(`🔵 Google handleCameraMovement total: ${totalTime.toFixed(2)}ms`);
                }
            };
            
            // Wrap handlers with timing
            this.photorealisticCameraHandler.setInputAction((event) => {
                const overallStart = performance.now();
                handleCameraMovement(event);
                const overallEnd = performance.now();
                
                if (overallEnd - overallStart > 3) {
                    console.log(`🔵 TOTAL Google mouse event: ${(overallEnd - overallStart).toFixed(2)}ms`);
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            
            this.photorealisticCameraHandler.setInputAction((event) => {
                const overallStart = performance.now();
                handleCameraMovement(event);
                const overallEnd = performance.now();
                
                if (overallEnd - overallStart > 3) {
                    console.log(`🔵 TOTAL Google wheel event: ${(overallEnd - overallStart).toFixed(2)}ms`);
                }
            }, Cesium.ScreenSpaceEventType.WHEEL);
        }
        
        // Monitor Google tile loading with hysteresis to prevent thrashing
        let lastSSEUpdate = Date.now();
        let currentSSE = 12;
        
        tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
            const totalActive = numberOfPendingRequests + numberOfTilesProcessing;
            const now = Date.now();
            
            // Only adjust SSE if enough time has passed (prevent thrashing)
            if (now - lastSSEUpdate > 2000) { // 2 second minimum between changes
                let targetSSE = 12; // Base quality
                
                // Use hysteresis - different thresholds for increasing vs decreasing quality
                if (totalActive > 15) {
                    targetSSE = 32; // Reduce quality more gradually
                } else if (totalActive > 10) {
                    targetSSE = 20; // Intermediate quality
                } // Keep base quality (12) for totalActive <= 10
                
                // Only update if the change is significant and in the right direction
                if (Math.abs(currentSSE - targetSSE) >= 4) {
                    currentSSE = targetSSE;
                    tileset.maximumScreenSpaceError = currentSSE;
                    lastSSEUpdate = now;
                    console.log(`Google Photorealistic SSE updated: ${totalActive} active tiles → SSE: ${currentSSE}`);
                }
            }
            
            // Only log significant loading events to reduce noise
            if (totalActive === 0 || totalActive % 5 === 0) {
                console.log(`Google Photorealistic tiles: ${totalActive} active, SSE: ${tileset.maximumScreenSpaceError}`);
            }
        });
        
        // Set up distance-based optimization for Google tiles
        this.setupPhotorealisticDistanceLOD(tileset);
    }
    
    /**
     * Optimizes Google Photorealistic tileset based on camera movement
     * @param {boolean} isMoving - Whether camera is moving
     */
    optimizePhotorealisticForMovement(isMoving) {
        const startTime = performance.now();
        
        if (this.photorealisticTileset && !this.photorealisticTileset.isDestroyed?.()) {
            const tilesetUpdateStart = performance.now();
            
            if (isMoving) {
                // More aggressive optimization for Google tiles during movement
                this.photorealisticTileset.maximumScreenSpaceError = 32;
                this.photorealisticTileset.cullRequestsWhileMoving = true;
                this.photorealisticTileset.cullRequestsWhileMovingMultiplier = 100.0;
                this.photorealisticTileset.immediatelyLoadDesiredLevelOfDetail = false;
                this.photorealisticTileset.loadSiblings = false;
            } else {
                // Restore quality when movement stops
                this.photorealisticTileset.maximumScreenSpaceError = 12;
                this.photorealisticTileset.cullRequestsWhileMoving = false;
                this.photorealisticTileset.immediatelyLoadDesiredLevelOfDetail = true;
            }
            
            const tilesetUpdateEnd = performance.now();
            const totalTime = performance.now() - startTime;
            
            // Google optimization adjusted
        }
    }
    
    /**
     * Sets up distance-based LOD for Google Photorealistic tiles
     * @param {Cesium.Cesium3DTileset} tileset - The Google tileset
     */
    setupPhotorealisticDistanceLOD(tileset) {
        const distanceInterval = setInterval(() => {
            if (tileset.isDestroyed?.()) {
                clearInterval(distanceInterval);
                return;
            }
            
            try {
                const startTime = performance.now();
                const cameraHeight = this.viewer.camera.positionCartographic.height;
                
                // Adjust quality based on camera height (Google tiles work better with height-based LOD)
                let targetSSE;
                if (cameraHeight < 100) {
                    targetSSE = 8;      // High quality when very close
                } else if (cameraHeight < 300) {
                    targetSSE = 12;     // Medium quality
                } else if (cameraHeight < 1000) {
                    targetSSE = 24;     // Lower quality at medium height
                } else if (cameraHeight < 3000) {
                    targetSSE = 48;     // Low quality at high altitude
                } else {
                    targetSSE = 96;     // Very low quality when very high
                }
                
                // Only update if significantly different
                if (Math.abs(tileset.maximumScreenSpaceError - targetSSE) > 4) {
                    const updateStart = performance.now();
                    tileset.maximumScreenSpaceError = targetSSE;
                    const updateEnd = performance.now();
                    const totalTime = performance.now() - startTime;
                    
                    console.log(`🔵 Google LOD update: height=${cameraHeight.toFixed(0)}m, SSE=${targetSSE} | update: ${(updateEnd - updateStart).toFixed(2)}ms, total: ${totalTime.toFixed(2)}ms`);
                }
                
                // Log if slow even without update
                const totalTime = performance.now() - startTime;
                if (totalTime > 2 && Math.abs(tileset.maximumScreenSpaceError - targetSSE) <= 4) {
                    console.log(`🔵 Google LOD check: no update needed but took ${totalTime.toFixed(2)}ms`);
                }
            } catch (error) {
                console.warn('🔵 Error in Google Photorealistic distance-based LOD:', error);
            }
        }, 750); // Update less frequently than Gaussian splats
        
        // Store interval for cleanup
        this.photorealisticDistanceInterval = distanceInterval;
    }
    
    /**
     * Cleans up Google Photorealistic tileset performance monitoring
     */
    cleanupPhotorealisticPerformance() {
        try {
            // Clean up camera movement handler
            if (this.photorealisticCameraHandler) {
                this.photorealisticCameraHandler.destroy();
                this.photorealisticCameraHandler = null;
                console.log('Google Photorealistic camera handler destroyed');
            }
            
            // Clean up distance interval
            if (this.photorealisticDistanceInterval) {
                clearInterval(this.photorealisticDistanceInterval);
                this.photorealisticDistanceInterval = null;
                console.log('Google Photorealistic distance LOD monitoring stopped');
            }
            
            // Clear movement timeout
            if (this.photorealisticMovementTimeout) {
                clearTimeout(this.photorealisticMovementTimeout);
                this.photorealisticMovementTimeout = null;
            }
            
            console.log('Google Photorealistic performance monitoring cleaned up');
        } catch (error) {
            console.error('Error cleaning up Google Photorealistic performance monitoring:', error);
        }
    }

    /**
     * Toggle between perspective and orthographic camera projection
     */
    toggleOrthographicProjection() {
        if (this.isOrthographic) {
            this.setPerspectiveProjection();
        } else {
            this.setOrthographicProjection();
        }
    }

    /**
     * Set camera to orthographic projection
     */
    setOrthographicProjection() {
        if (this.isOrthographic) return;

        // Save the current perspective frustum
        this.savedPerspectiveFrustum = this.viewer.scene.camera.frustum.clone();

        // Calculate orthographic frustum dimensions based on current view
        const canvas = this.viewer.scene.canvas;
        const camera = this.viewer.scene.camera;
        
        // Get the current camera height above ground
        const cameraHeight = camera.positionCartographic.height;
        
        // Calculate the ground area visible in the current view
        const aspectRatio = canvas.clientWidth / canvas.clientHeight;
        
        // Scale factor based on camera height (larger area for higher cameras)
        const scaleFactor = Math.max(1, cameraHeight / 1000); // Adjust scaling as needed
        
        // Set orthographic frustum dimensions
        const width = 500 * scaleFactor; // Base width in meters
        const height = width / aspectRatio;

        // Create and assign orthographic frustum
        this.viewer.scene.camera.frustum = new Cesium.OrthographicFrustum({
            left: -width / 2,
            right: width / 2,
            top: height / 2,
            bottom: -height / 2,
            near: 1.0,
            far: 10000000.0
        });

        this.isOrthographic = true;
        console.log('Switched to orthographic projection');
    }

    /**
     * Set camera to perspective projection
     */
    setPerspectiveProjection() {
        if (!this.isOrthographic) return;

        // Restore the saved perspective frustum or create a new one
        if (this.savedPerspectiveFrustum) {
            this.viewer.scene.camera.frustum = this.savedPerspectiveFrustum.clone();
        } else {
            // Create default perspective frustum
            this.viewer.scene.camera.frustum = new Cesium.PerspectiveFrustum({
                fov: Cesium.Math.PI_OVER_THREE, // 60 degrees
                aspectRatio: this.viewer.scene.canvas.clientWidth / this.viewer.scene.canvas.clientHeight,
                near: 1.0,
                far: 10000000.0
            });
        }

        this.isOrthographic = false;
        console.log('Switched to perspective projection');
    }

    /**
     * Get current projection mode
     * @returns {boolean} True if orthographic, false if perspective
     */
    isOrthographicProjection() {
        return this.isOrthographic;
    }

}

// Expose CesiumManager to the global scope
window.CesiumManager = CesiumManager;

// Global function to toggle orthographic projection for easy testing
window.toggleOrthographic = function() {
    if (window.map3D && window.map3D.toggleOrthographicProjection) {
        window.map3D.toggleOrthographicProjection();
        console.log(`Camera projection: ${window.map3D.isOrthographicProjection() ? 'Orthographic' : 'Perspective'}`);
    } else {
        console.warn('Cesium manager not available');
    }
};

// Add global performance monitoring functions for both Google and Gaussian splat tilesets
window.tilesetPerformance = {
    /**
     * Gets comprehensive performance info for all tilesets
     */
    getOverallStats: () => {
        const stats = {
            googlePhotorealistic: null,
            gaussianSplats: {},
            combinedMemoryUsage: 0,
            activeTilesets: 0
        };
        
        // Google Photorealistic stats
        if (window.map3D && window.map3D.photorealisticTileset && !window.map3D.photorealisticTileset.isDestroyed?.()) {
            const tileset = window.map3D.photorealisticTileset;
            stats.googlePhotorealistic = {
                maximumScreenSpaceError: tileset.maximumScreenSpaceError,
                skipLevelOfDetail: tileset.skipLevelOfDetail,
                maximumMemoryUsage: tileset.maximumMemoryUsage,
                cullRequestsWhileMoving: tileset.cullRequestsWhileMoving,
                ready: tileset.ready,
                show: tileset.show
            };
            stats.activeTilesets++;
            stats.combinedMemoryUsage += tileset.maximumMemoryUsage || 0;
        }
        
        // Gaussian Splat stats
        if (window.gaussianSplatManager) {
            stats.gaussianSplats = window.gaussianSplatManager.getAllPerformanceStats();
            stats.activeTilesets += Object.keys(stats.gaussianSplats).length;
            
            // Add memory usage from Gaussian splats
            for (const siteStats of Object.values(stats.gaussianSplats)) {
                stats.combinedMemoryUsage += siteStats.memoryUsageMB || 0;
            }
        }
        
        return stats;
    },
    
    /**
     * Logs comprehensive performance stats to console
     */
    logOverallStats: () => {
        const stats = window.tilesetPerformance.getOverallStats();
        console.log('=== COMPREHENSIVE TILESET PERFORMANCE STATS ===');
        console.log(`Active Tilesets: ${stats.activeTilesets}`);
        console.log(`Combined Memory Usage: ${stats.combinedMemoryUsage}MB`);
        console.log('');
        
        if (stats.googlePhotorealistic) {
            console.log('Google Photorealistic 3D Tiles:');
            console.log(`  Screen Space Error: ${stats.googlePhotorealistic.maximumScreenSpaceError}`);
            console.log(`  Skip LOD: ${stats.googlePhotorealistic.skipLevelOfDetail}`);
            console.log(`  Memory Limit: ${stats.googlePhotorealistic.maximumMemoryUsage}MB`);
            console.log(`  Cull During Movement: ${stats.googlePhotorealistic.cullRequestsWhileMoving}`);
            console.log(`  Ready: ${stats.googlePhotorealistic.ready}`);
            console.log(`  Visible: ${stats.googlePhotorealistic.show}`);
            console.log('');
        } else {
            console.log('Google Photorealistic 3D Tiles: Not loaded');
            console.log('');
        }
        
        if (Object.keys(stats.gaussianSplats).length > 0) {
            console.log('Gaussian Splats:');
            for (const [siteId, siteStats] of Object.entries(stats.gaussianSplats)) {
                console.log(`  Site: ${siteId}`);
                console.log(`    FPS: ${siteStats.fps}`);
                console.log(`    Tiles Loaded: ${siteStats.tilesLoaded}`);
                console.log(`    Memory: ${siteStats.memoryUsageMB}MB`);
                console.log(`    Load Time: ${siteStats.averageLoadTimeMs}ms`);
            }
        } else {
            console.log('Gaussian Splats: None loaded');
        }
        
        console.log('==============================================');
    },
    
    /**
     * Optimizes all tilesets for camera movement
     */
    optimizeAllForMovement: () => {
        let optimized = 0;
        
        // Optimize Google Photorealistic
        if (window.map3D && window.map3D.optimizePhotorealisticForMovement) {
            window.map3D.optimizePhotorealisticForMovement(true);
            optimized++;
        }
        
        // Optimize Gaussian Splats
        if (window.gaussianSplatManager && window.gaussianSplatManager.optimizeForMovement) {
            window.gaussianSplatManager.optimizeForMovement(true);
            const splatCount = window.gaussianSplatManager.loadedTilesets.size;
            optimized += splatCount;
        }
        
        console.log(`Optimized ${optimized} tilesets for camera movement`);
    },
    
    /**
     * Restores quality for all tilesets after movement
     */
    restoreAllQuality: () => {
        let restored = 0;
        
        // Restore Google Photorealistic
        if (window.map3D && window.map3D.optimizePhotorealisticForMovement) {
            window.map3D.optimizePhotorealisticForMovement(false);
            restored++;
        }
        
        // Restore Gaussian Splats
        if (window.gaussianSplatManager && window.gaussianSplatManager.optimizeForMovement) {
            window.gaussianSplatManager.optimizeForMovement(false);
            const splatCount = window.gaussianSplatManager.loadedTilesets.size;
            restored += splatCount;
        }
        
        console.log(`Restored quality for ${restored} tilesets`);
    }
};

// Tileset performance monitoring available

