/**
 * Two.js 2D Mode Integration
 * Manages 2D polygon rendering and interaction using Two.js multi-renderer system
 * Replaces Fabric.js implementation with superior performance and cleaner API
 * Integrates with existing 3D visualization system and UI controls
 */

class Two2DManager {
    constructor() {
        this.two = null;
        this.isActive = false;
        
        // Scene organization groups
        this.backgroundGroup = null;
        this.polygonGroup = null;
        this.uiGroup = null;
        
        // Background image management
        this.backgroundImage = null;
        this.backgroundTexture = null;
        
        // State tracking for hover and click interactions
        this.currentHoveredObject = null;
        this.currentClickedObject = null;
        
        // Mouse interaction state
        this.isDragging = false;
        this.dragThreshold = 10;
        this.mousePosition = null;
        this.isMouseDown = false;
        this.dragStartPosition = null;
        
        // Color legend
        this.colorLegend = null;
        
        // Performance optimizations
        this._boundsLogged = false;
        this._outsideBoundsLogged = false;
    }

    /**
     * Initializes the 2D Two.js manager (lightweight initialization)
     */
    initialize() {
        // DO NOT create Two.js instance during initialization
        // Instance will be created only when switching to 2D mode
        console.log('Two2DManager initialized (Two.js instance will be created on demand)');
    }

    /**
     * Activates 2D mode by creating Two.js instance and rendering scene
     */
    activate() {
        if (this.isActive) return;

        console.log('🔄 Transitioning to 2D Two.js mode...');

        // STEP 1: Create Two.js instance with optimal renderer
        this.createTwoInstance();

        // STEP 2: Hide Cesium container (keep control panel visible) 
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'none';
            console.log('✅ Cesium container hidden');
        }

        // STEP 3: Setup scene structure
        this.setupSceneGroups();

        // STEP 4: Hide scrollbars for full-screen experience
        document.body.style.overflow = 'hidden';

        // STEP 5: Set background image from screenshot if available
        this.setBackgroundImage();

        // STEP 6: Set black background for better contrast with blue UI elements
        this.setBackgroundColor('#000000');

        // STEP 7: Render GeoJSON polygons on scene
        this.renderGeoJsonPolygons();

        // STEP 8: Setup event handlers for interaction
        this.setupEventHandlers();

        // STEP 9: Setup pan and zoom functionality
        this.setupPanAndZoom();

        this.isActive = true;
        console.log('🎯 2D Two.js mode activated successfully!');
        console.log('💡 Debug tip: Run window.two2DManager.debugEventHandling() to test event system');
    }

    /**
     * Creates Two.js instance with optimal renderer selection
     * FORCE Canvas renderer for reliable mouse events!
     */
    createTwoInstance() {
        // FORCE Canvas renderer - WebGL doesn't support direct shape mouse events reliably!
        let rendererType = Two.Types.canvas;
        
        console.log('🔧 FORCING Canvas renderer for reliable mouse event support');
        
        // Canvas renderer forced - skip WebGL detection to ensure mouse events work
        console.log('✅ Canvas renderer selected for reliable mouse event support');

        // Create Two.js instance
        this.two = new Two({
            type: rendererType,
            width: window.innerWidth,
            height: window.innerHeight,
            autostart: false, // We'll control updates manually
            fitted: false,
            fullscreen: false
        });

        // Append to document body
        this.two.appendTo(document.body);

        // Style the canvas
        const canvas = this.two.renderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '999';
        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'default';

        console.log(`📐 Two.js instance created: ${this.two.width}x${this.two.height}`);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.two && this.isActive) {
                this.updateCanvasDimensions();
            }
        });
    }

    /**
     * Setup hierarchical scene groups for organized rendering
     */
    setupSceneGroups() {
        // Create organized scene structure
        this.backgroundGroup = this.two.makeGroup();
        this.polygonGroup = this.two.makeGroup();
        this.uiGroup = this.two.makeGroup();

        // Name groups for debugging
        this.backgroundGroup.id = 'backgroundGroup';
        this.polygonGroup.id = 'polygonGroup'; 
        this.uiGroup.id = 'uiGroup';

        console.log('📁 Scene groups created: background, polygons, UI');
    }

    /**
     * Updates canvas dimensions to match current viewport
     */
    updateCanvasDimensions() {
        if (!this.two) return;

        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        // Update Two.js dimensions
        this.two.width = newWidth;
        this.two.height = newHeight;
        this.two.renderer.setSize(newWidth, newHeight);

        console.log(`📐 Canvas resized to: ${newWidth}x${newHeight}`);
        this.two.update();
    }

    /**
     * Sets the background color for areas outside the screenshot
     */
    setBackgroundColor(color) {
        if (!this.two || !this.two.renderer.domElement) return;
        
        // Set background color on the canvas element
        this.two.renderer.domElement.style.backgroundColor = color;
        console.log(`🎨 Background color set to: ${color}`);
    }

    /**
     * Sets the background image from the screenshot capture system
     */
    setBackgroundImage() {
        if (!this.two) return;

        const backgroundImageData = window.view2DManager?.background2DImage;
        console.log('🔍 Checking for background image:', backgroundImageData ? 'Found' : 'Not found');

        if (backgroundImageData && backgroundImageData.length > 100) { // Basic validation
            console.log('📸 Setting background image from screenshot...');

            // Create Two.js texture from image data
            const img = new Image();
            img.onload = () => {
                try {
                    // Create Two.js texture and sprite
                    const texture = new Two.Texture(img);
                    const sprite = this.two.makeImageSequence(texture);
                    
                    // Position and scale to fill canvas
                    sprite.translation.set(this.two.width / 2, this.two.height / 2);
                    
                    // Calculate scale to fill screen
                    const scaleX = this.two.width / img.width;
                    const scaleY = this.two.height / img.height;
                    const scale = Math.max(scaleX, scaleY); // Fill entire screen
                    sprite.scale = scale;
                    
                    // Add to background group
                    this.backgroundGroup.add(sprite);
                    this.backgroundImage = sprite;
                    this.backgroundTexture = texture;
                    
                    console.log(`✅ Background image set with scale: ${scale.toFixed(3)}`);
                    this.two.update();
                } catch (error) {
                    console.error('❌ Error creating background texture:', error);
                    console.log('🔄 Continuing without background image...');
                }
            };
            
            img.onerror = (error) => {
                console.error('❌ Error loading background image:', error);
                console.log('🔄 Continuing without background image...');
            };
            
            img.src = backgroundImageData;
        } else {
            console.warn('⚠️ No valid background image available - using solid color background');
            console.warn('   Background image data:', backgroundImageData ? `${backgroundImageData.length} chars` : 'null/undefined');
        }
    }

    /**
     * Renders all GeoJSON polygons using Two.js
     * Uses the same logic as the original Fabric.js implementation
     */
    renderGeoJsonPolygons() {
        if (!this.two || !window.currentSiteData || !window.currentSiteData.features) {
            console.warn('Cannot render polygons - missing Two.js instance or site data');
            return;
        }

        console.log('🎨 Rendering GeoJSON polygons with Two.js...');

        const geoJsonData = window.currentSiteData;
        
        // Detect format from first feature (same as Cesium implementation)
        const format = geoJsonData.features.length > 0 ? window.detectGeoJsonFormat(geoJsonData.features[0]) : 'legacy';
        
        // Detect coordinate system
        let isGeographic = false;
        if (geoJsonData.features.length > 0) {
            const firstFeature = geoJsonData.features[0];
            if (firstFeature.geometry.type === 'Point') {
                isGeographic = window.detectCoordinateFormat(firstFeature.geometry.coordinates) === 'geographic';
            } else if (firstFeature.geometry.type === 'Polygon') {
                isGeographic = window.detectCoordinateFormat(firstFeature.geometry.coordinates[0][0]) === 'geographic';
            }
        }

        console.log(`📋 Detected format: ${format}, geographic coordinates: ${isGeographic}`);

        // Collect parameter values for ecological metrics color mapping (same as Cesium)
        let parameterValues = [];
        let minParamValue = 0, maxParamValue = 1;
        
        if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric && format === 'boyd') {
            console.log(`🎨 Applying ecological metrics filter: ${window.layerState.selectedMetric}`);
            
            // Collect all parameter values from plantable features
            geoJsonData.features.forEach(feature => {
                const category = window.getBoydFeatureCategory(feature);
                if (category === 'plantable') {
                    const boydData = window.parseBoydEcologicalData(feature.properties.description || '');
                    const paramValue = boydData[window.layerState.selectedMetric];
                    if (paramValue) {
                        const numericValue = window.parseParameterValue(paramValue, window.layerState.selectedMetric);
                        parameterValues.push(numericValue);
                    }
                }
            });
            
            // Calculate min/max for color scaling
            if (parameterValues.length > 0) {
                minParamValue = Math.min(...parameterValues);
                maxParamValue = Math.max(...parameterValues);
            }
            
            console.log(`🎨 Parameter range: ${minParamValue} - ${maxParamValue}`);
            
            // Create color legend for the current parameter
            this.createColorLegend(window.layerState.selectedMetric, minParamValue, maxParamValue);
        } else {
            // Remove legend when no ecological metrics are active
            this.removeColorLegend();
        }

        // Process each feature
        let renderedCount = 0;
        geoJsonData.features.forEach((feature, index) => {
            // Apply same filtering logic as Cesium implementation
            if (format === 'boyd') {
                const category = window.getBoydFeatureCategory(feature);
                if (category === 'data-point') {
                    return; // Skip data points
                }
                
                // Apply layer filtering
                const isPlantable = category === 'plantable';
                const isNonPlantable = category === 'non-plantable';
                
                if (isPlantable && !window.layerState?.showPlantableAreas && !window.layerState?.temporaryShowPlantable && !window.layerState?.showEcologicalMetrics) {
                    return; // Skip plantable areas if not showing them (unless showing metrics)
                }
                
                if (isNonPlantable && !window.layerState?.showNonPlantableAreas) {
                    return; // Skip non-plantable areas if not showing them
                }
            }

            // Only render polygon features
            if (feature.geometry.type === 'Polygon') {
                const polygon = this.createTwoPolygon(feature, format, isGeographic, index, {
                    minParamValue,
                    maxParamValue,
                    showEcologicalMetrics: window.layerState?.showEcologicalMetrics,
                    selectedMetric: window.layerState?.selectedMetric
                });
                if (polygon) {
                    this.polygonGroup.add(polygon);
                    renderedCount++;
                }
            }
        });

        // Event handling is set up once in setupEventHandlers() - no per-polygon binding needed

        // Update the scene
        this.two.update();
        console.log(`✅ Rendered ${renderedCount} polygons with Two.js`);
        console.log(`🔍 Two.js scene objects: ${this.two.scene.children.length}`);
    }

    /**
     * Creates a Two.js polygon from a GeoJSON feature
     * Replaces Fabric.js polygon creation with Two.js Path
     */
    createTwoPolygon(feature, format, isGeographic, index, metricsData = {}) {
        // Convert coordinates to Two.js vertices
        const vertices = [];
        
        for (let i = 0; i < feature.geometry.coordinates[0].length - 1; i++) { // Skip last point (duplicate of first)
            const coord = feature.geometry.coordinates[0][i];
            const [x, y] = coord;
            let latLng;
            
            if (isGeographic) {
                latLng = { lat: y, lng: x };
            } else {
                latLng = window.utmToLatLng(x, y);
            }
            
            const screenPos = this.latLonToScreenPixel(latLng.lng, latLng.lat);
            if (screenPos) {
                vertices.push(new Two.Vector(screenPos.x, screenPos.y));
                
                // Vertex conversion complete
            }
        }

        if (vertices.length < 3) {
            console.warn(`Polygon ${index} has insufficient valid points:`, vertices.length);
            return null;
        }

        // Create Two.js closed path (equivalent to Fabric.js Polygon)
        const polygon = this.two.makePath(vertices, true); // true = closed path
        
        // Explicitly ensure the path is closed (belt and suspenders approach)
        polygon.closed = true;
        
        // Determine entity name first (needed for debugging)
        const isPlantable = window.isPlantableFeature(feature, format);
        let fillColor, strokeColor, strokeWidth;
        let entityName = `Site_Polygon_${index}`;
        
        // DEBUG: Check polygon creation details
        console.log(`🔧 Created Two.js polygon:`, {
            vertexCount: vertices.length,
            polygonType: polygon.constructor.name,
            isPath: polygon instanceof Two.Path,
            hasBind: typeof polygon.bind === 'function',
            vertices: polygon.vertices ? polygon.vertices.length : 'none'
        });
        
        // DEBUG: Show path closure status
        console.log(`🔒 Polygon ${entityName}: closed=${polygon.closed}, vertices=${polygon.vertices.length}`);

        if (isPlantable) {
            // Plantable area styling
            if (format === 'boyd') {
                const parsed = window.parseBoydName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                
                // Handle ecological metrics coloring (same as Cesium implementation)
                if (metricsData.showEcologicalMetrics && metricsData.selectedMetric) {
                    const boydData = window.parseBoydEcologicalData(feature.properties.description || '');
                    const paramValue = boydData[metricsData.selectedMetric];
                    if (paramValue) {
                        const numericValue = window.parseParameterValue(paramValue, metricsData.selectedMetric);
                        const cesiumColor = window.getParameterColor(numericValue, metricsData.minParamValue, metricsData.maxParamValue, metricsData.selectedMetric);
                        
                        // Convert Cesium color to CSS for Two.js
                        fillColor = `rgba(${Math.round(cesiumColor.red * 255)}, ${Math.round(cesiumColor.green * 255)}, ${Math.round(cesiumColor.blue * 255)}, 0.7)`;
                        strokeColor = `rgba(${Math.round(cesiumColor.red * 0.7 * 255)}, ${Math.round(cesiumColor.green * 0.7 * 255)}, ${Math.round(cesiumColor.blue * 0.7 * 255)}, 1.0)`;
                        strokeWidth = 2;
                        
                        console.log(`🎨 Applied ecological metrics color for ${entityName}: ${fillColor}`);
                    } else {
                        // No data for this parameter - don't render (same as Cesium)
                        console.log(`⚠️ No data for ${metricsData.selectedMetric} in ${entityName}, skipping`);
                        return null;
                    }
                } else {
                    // Regular PA styling
                    const paName = parsed.description || parsed.id;
                    if (paName && paName === window.layerState?.selectedPA) {
                        strokeColor = '#072b2e'; // Ecodash blue outline for selected
                        strokeWidth = 10;
                    } else {
                        strokeColor = '#072b2e'; // Ecodash blue outline for unselected
                        strokeWidth = 2;
                    }
                    fillColor = 'rgba(0, 0, 0, 0.001)'; // Nearly transparent but detectable for hover
                }
            } else {
                // Legacy format
                const measurements = window.parsePlantableMeasurements(feature.properties.name);
                entityName = measurements.id;
                const lightLevel = window.extractLightLevel(feature.properties.name);
                strokeColor = window.getOutlineColorByLight ? window.getOutlineColorByLight(lightLevel).toCssColorString() : '#FFFFFF';
                strokeWidth = 2;
                fillColor = 'rgba(0, 0, 0, 0.001)'; // Nearly transparent but detectable for hover
            }
            
        } else {
            // Non-plantable area styling
            if (format === 'boyd') {
                const parsed = window.parseBoydName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                
                // Check if this NPA is selected
                const npaCategory = window.extractNPACategory(feature.properties.name);
                if (npaCategory && npaCategory === window.layerState?.selectedNPA) {
                    strokeColor = '#FF0000'; // Red outline for selected
                    strokeWidth = 10;
                } else {
                    strokeColor = '#FF0000'; // Red outline for unselected
                    strokeWidth = 2;
                }
            } else {
                // Legacy format
                const parsed = window.parseNonPlantableName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                strokeColor = '#8B0000'; // Dark red
                strokeWidth = 3;
            }
            
            fillColor = 'rgba(0, 0, 0, 0.1)'; // More visible for better click detection
        }

        // Apply Two.js styling
        polygon.fill = fillColor;
        polygon.stroke = strokeColor;
        polygon.linewidth = strokeWidth;
        polygon.noStroke(); // Start with no stroke, will be added dynamically
        if (strokeColor && strokeWidth > 0) {
            polygon.stroke = strokeColor;
            polygon.linewidth = strokeWidth;
        }

        // Store original feature data for interaction (same as Fabric.js version)
        polygon.featureData = {
            originalFeature: feature,
            format: format,
            isPlantable: isPlantable,
            entityName: entityName,
            index: index
        };

        // Store original styling for hover effects
        polygon.originalFill = fillColor;
        polygon.originalStroke = strokeColor;
        polygon.originalStrokeWidth = strokeWidth;

        console.log(`🔧 Created Two.js polygon: ${entityName}`);
        return polygon;
    }

    /**
     * Converts geographic coordinates (lat/lon) to screen pixel coordinates
     * Uses the exact same bounds as the screenshot for perfect alignment
     * Same implementation as Fabric.js version
     */
    latLonToScreenPixel(longitude, latitude) {
        const bounds = window.view2DManager?.screenshotBounds;
        if (!bounds || !this.two) {
            console.warn('Cannot convert coordinates - no screenshot bounds available');
            return null;
        }

        // DEBUG: Log bounds on first few conversions to diagnose polygon positioning
        if (!this._boundsLogged) {
            console.log('🗺️ Using screenshot bounds for polygon conversion:', bounds);
            console.log(`   Bounds span: ${(bounds.east - bounds.west).toFixed(6)}° x ${(bounds.north - bounds.south).toFixed(6)}°`);
            this._boundsLogged = true;
        }

        // Check if point is within screenshot bounds
        if (longitude < bounds.west || longitude > bounds.east ||
            latitude < bounds.south || latitude > bounds.north) {
            // DEBUG: Log points that are outside bounds
            if (!this._outsideBoundsLogged) {
                console.log(`⚠️ Point outside bounds: ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`);
                console.log(`   Bounds: ${bounds.west.toFixed(6)} to ${bounds.east.toFixed(6)}, ${bounds.south.toFixed(6)} to ${bounds.north.toFixed(6)}`);
                this._outsideBoundsLogged = true;
            }
            return null;
        }

        // CRITICAL: Convert to normalized coordinates (0-1) using EXACT same bounds as screenshot
        const normalizedX = (longitude - bounds.west) / (bounds.east - bounds.west);
        const normalizedY = (bounds.north - latitude) / (bounds.north - bounds.south); // Flip Y for screen coordinates

        // CRITICAL: Convert to screen pixels using EXACT canvas dimensions
        const screenX = normalizedX * this.two.width;
        const screenY = normalizedY * this.two.height;

        return { x: screenX, y: screenY };
    }

    /**
     * Sets up event handlers for mouse interaction
     * Uses DOM events on canvas element with manual hit testing (correct Two.js approach)
     */
    setupEventHandlers() {
        if (!this.two) return;
        
        console.log('🔧 Setting up Two.js DOM event handlers...');
        
        const domElement = this.two.renderer.domElement;
        if (!domElement) {
            console.error('❌ Two.js DOM element not available');
            return;
        }
        
        // Track mouse state for hover effects
        this.mousePosition = new Two.Vector();
        this.isMouseDown = false;
        this.dragStartPosition = new Two.Vector();
        
        // Set up DOM event listeners (proper Two.js approach)
        domElement.addEventListener('pointerdown', (e) => this.handlePointerDown(e), false);
        domElement.addEventListener('pointermove', (e) => this.handlePointerMove(e), false);
        domElement.addEventListener('pointerup', (e) => this.handlePointerUp(e), false);
        
        // Also support mouse events for broader compatibility
        domElement.addEventListener('mousedown', (e) => this.handlePointerDown(e), false);
        domElement.addEventListener('mousemove', (e) => this.handlePointerMove(e), false);
        domElement.addEventListener('mouseup', (e) => this.handlePointerUp(e), false);
        
        console.log('✅ Two.js DOM event handlers initialized');
    }

    /**
     * Handles pointer/mouse down events
     * Records initial position for drag detection and prepares for click/hover testing
     */
    handlePointerDown(e) {
        const rect = this.two.renderer.domElement.getBoundingClientRect();
        this.mousePosition.set(e.clientX - rect.left, e.clientY - rect.top);
        this.dragStartPosition.copy(this.mousePosition);
        this.isMouseDown = true;
        
        console.log(`🖱️ Pointer down at: (${this.mousePosition.x.toFixed(1)}, ${this.mousePosition.y.toFixed(1)})`);
    }
    
    /**
     * Handles pointer/mouse move events
     * Updates hover effects and tracks potential dragging
     */
    handlePointerMove(e) {
        const rect = this.two.renderer.domElement.getBoundingClientRect();
        this.mousePosition.set(e.clientX - rect.left, e.clientY - rect.top);
        
        // Convert screen coordinates to scene coordinates (accounting for pan/zoom)
        const sceneCoords = this.screenToSceneCoordinates(this.mousePosition.x, this.mousePosition.y);
        
        // Perform hit testing to find polygon under cursor
        const hitPolygon = this.getPolygonAt(sceneCoords.x, sceneCoords.y);
        
        // Handle hover effects
        if (hitPolygon !== this.currentHoveredObject) {
            // Mouse left previous polygon
            if (this.currentHoveredObject) {
                this.handlePolygonHover(this.currentHoveredObject, false);
            }
            
            // Mouse entered new polygon
            if (hitPolygon) {
                this.handlePolygonHover(hitPolygon, true);
                this.two.renderer.domElement.style.cursor = 'pointer';
            } else {
                this.two.renderer.domElement.style.cursor = 'default';
            }
            
            this.currentHoveredObject = hitPolygon;
        }
        
        // Handle dragging if mouse is down
        if (this.isMouseDown) {
            const dragDistance = Two.Vector.distanceBetween(this.mousePosition, this.dragStartPosition);
            if (dragDistance > this.dragThreshold) {
                this.isDragging = true;
                this.two.renderer.domElement.style.cursor = 'grabbing';
                
                // Calculate drag delta
                const deltaX = this.mousePosition.x - this.dragStartPosition.x;
                const deltaY = this.mousePosition.y - this.dragStartPosition.y;
                
                // Apply pan transformation
                this.two.scene.translation.x += deltaX;
                this.two.scene.translation.y += deltaY;
                
                // Update drag start for next frame
                this.dragStartPosition.copy(this.mousePosition);
                
                this.two.update();
            }
        }
    }
    
    /**
     * Handles pointer/mouse up events
     * Processes clicks if no dragging occurred
     */
    handlePointerUp(e) {
        const dragDistance = Two.Vector.distanceBetween(this.mousePosition, this.dragStartPosition);
        
        if (!this.isDragging && dragDistance <= this.dragThreshold) {
            // This was a click, not a drag
            const rect = this.two.renderer.domElement.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            console.log(`🖱️ Click detected at: (${clickX.toFixed(1)}, ${clickY.toFixed(1)})`);
            
            // Convert screen coordinates to scene coordinates WITH LOGGING
            const sceneCoords = this.screenToSceneCoordinates(clickX, clickY);
            console.log(`🔄 Screen (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) → Scene (${sceneCoords.x.toFixed(1)}, ${sceneCoords.y.toFixed(1)})`);
            
            // Perform hit testing WITH LOGGING
            console.log(`🔍 Hit testing at scene coordinates: (${sceneCoords.x.toFixed(1)}, ${sceneCoords.y.toFixed(1)}) against ${this.polygonGroup?.children?.length || 0} polygons`);
            const clickedPolygon = this.getPolygonAt(sceneCoords.x, sceneCoords.y, true); // true = isClick
            
            if (clickedPolygon) {
                console.log(`🎯 Clicked polygon: ${clickedPolygon.featureData.entityName}`);
                this.handlePolygonClick(clickedPolygon);
            } else {
                console.log('🖱️ Clicked on background - deselecting polygons');
                this.handleCanvasClick(e);
            }
        }
        
        // Reset drag state
        this.isMouseDown = false;
        this.isDragging = false;
        this.two.renderer.domElement.style.cursor = this.currentHoveredObject ? 'pointer' : 'default';
    }
    
    /**
     * Converts screen pixel coordinates to scene coordinates (accounting for pan/zoom)
     * Screen coords are canvas pixel coordinates (e.g., 0-982, 0-730)
     * Scene coords are the coordinate space where polygon vertices exist
     */
    screenToSceneCoordinates(screenX, screenY) {
        // Get current scene transformation
        const translation = this.two.scene.translation;
        const scale = this.two.scene.scale;
        
        // Convert screen coordinates to scene coordinates by undoing the scene transformation
        // This is the inverse of the transformation applied during rendering
        const sceneX = (screenX - translation.x) / scale;
        const sceneY = (screenY - translation.y) / scale;
        
        // Only log coordinate conversion on clicks, not hover
        // console.log(`🔄 Screen (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) → Scene (${sceneX.toFixed(1)}, ${sceneY.toFixed(1)}) [scale: ${scale.toFixed(2)}, translation: (${translation.x.toFixed(1)}, ${translation.y.toFixed(1)})]`);
        
        return { x: sceneX, y: sceneY };
    }
    
    /**
     * Performs hit testing to find which polygon (if any) is at the given scene coordinates
     * Uses point-in-polygon algorithm for accurate detection
     */
    getPolygonAt(sceneX, sceneY, isClick = false) {
        if (!this.polygonGroup) {
            console.log(`❌ No polygon group for hit testing`);
            return null;
        }
        
        // Only log hit testing on clicks, not hover
        // console.log(`🔍 Hit testing at scene coordinates: (${sceneX.toFixed(1)}, ${sceneY.toFixed(1)}) against ${this.polygonGroup.children.length} polygons`);
        
        // Check polygons from front to back (reverse order since later polygons are on top)
        for (let i = this.polygonGroup.children.length - 1; i >= 0; i--) {
            const polygon = this.polygonGroup.children[i];
            if (!polygon.featureData || !polygon.vertices) {
                continue;
            }
            
            // Show polygon bounds for debugging - ABSOLUTE coordinates (including translation)
            const vertices = polygon.vertices;
            const translation = polygon.translation;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            vertices.forEach(v => {
                const absoluteX = translation.x + v.x;
                const absoluteY = translation.y + v.y;
                minX = Math.min(minX, absoluteX);
                maxX = Math.max(maxX, absoluteX);
                minY = Math.min(minY, absoluteY);
                maxY = Math.max(maxY, absoluteY);
            });
            
            // Only log polygon bounds on clicks, not hover - show ABSOLUTE bounds now
            if (isClick) {
                console.log(`  🔸 Polygon ${i} (${polygon.featureData.entityName}): absolute bounds (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
            }
            // Test point inclusion using scene coordinates
            if (this.isPointInPolygon(sceneX, sceneY, polygon)) {
                console.log(`  ✅ HIT! Found polygon: ${polygon.featureData.entityName}`);
                return polygon;
            }
        }
        
        console.log(`  ❌ No polygon found at scene coordinates`);
        return null;
    }
    
    /**
     * Point-in-polygon test using ray casting algorithm
     * Tests if a point is inside a Two.js polygon, accounting for path translation
     */
    isPointInPolygon(sceneX, sceneY, polygon) {
        if (!polygon.vertices || polygon.vertices.length < 3) {
            return false;
        }
        
        // Convert scene coordinates to path-local coordinates
        // Path vertices are relative to path.translation, so we need to account for that
        const localX = sceneX - polygon.translation.x;
        const localY = sceneY - polygon.translation.y;
        
        let inside = false;
        const vertices = polygon.vertices;
        
        // Ray casting algorithm using path-local coordinates
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x; // These are relative to polygon.translation
            const yi = vertices[i].y;
            const xj = vertices[j].x;
            const yj = vertices[j].y;
            
            if (((yi > localY) !== (yj > localY)) && (localX < (xj - xi) * (localY - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    /**
     * Handles polygon hover effects
     */
    handlePolygonHover(polygon, isHovering) {
        if (!polygon.featureData) return;
        
        const entityName = polygon.featureData.entityName;
        
        if (isHovering && polygon !== this.currentClickedObject) {
            console.log('🎯 Hovering over:', entityName);
            
            // Remove hover from previous object
            if (this.currentHoveredObject && 
                this.currentHoveredObject !== this.currentClickedObject && 
                this.currentHoveredObject.originalStrokeWidth !== undefined) {
                this.restoreOriginalStyling(this.currentHoveredObject);
            }
            
            // Apply hover styling (2x stroke width)
            polygon.stroke = polygon.originalStroke || '#072b2e';
            polygon.linewidth = (polygon.originalStrokeWidth || 2) * 2;
            polygon.fill = 'rgba(0, 0, 0, 0.15)'; // Hover fill
            
            this.currentHoveredObject = polygon;
            this.two.update();
            
        } else if (!isHovering && polygon === this.currentHoveredObject && polygon !== this.currentClickedObject) {
            console.log('🎯 Mouse left polygon:', entityName);
            
            // Restore original styling
            this.restoreOriginalStyling(polygon);
            this.currentHoveredObject = null;
            this.two.update();
        }
    }

    /**
     * Handles polygon click events and integrates with existing PA/NPA selection system
     */
    handlePolygonClick(polygon) {
        const featureData = polygon.featureData;
        const { originalFeature, format, isPlantable, entityName } = featureData;
        
        console.log(`🎯 Processing click for ${isPlantable ? 'plantable' : 'non-plantable'} area: ${entityName}`);
        
        // Reset previous clicked object
        if (this.currentClickedObject && this.currentClickedObject !== polygon) {
            console.log('🔄 Resetting previous clicked polygon:', this.currentClickedObject.featureData?.entityName);
            this.restoreOriginalStyling(this.currentClickedObject);
        }
        
        // Apply clicked styling (3x stroke width, more visible fill)
        polygon.stroke = polygon.originalStroke || '#072b2e';
        polygon.linewidth = (polygon.originalStrokeWidth || 2) * 3;
        polygon.fill = 'rgba(0, 0, 0, 0.1)'; // Clicked fill
        
        // Update clicked state
        this.currentClickedObject = polygon;
        
        // Remove from hover state if it was hovered
        if (this.currentHoveredObject === polygon) {
            this.currentHoveredObject = null;
        }
        
        this.two.update();
        
        // Handle the polygon selection logic (same as Fabric.js version)
        this.processPolygonSelection(featureData);
    }

    /**
     * Processes polygon selection and updates layer state
     * Same logic as Fabric.js version
     */
    processPolygonSelection(featureData) {
        const { originalFeature, format, isPlantable, entityName } = featureData;
        
        if (isPlantable) {
            // Handle plantable area selection
            if (format === 'boyd') {
                const parsed = window.parseBoydName(originalFeature.properties.name);
                const paName = parsed.description || parsed.id;
                
                // Update layer state (same as UI button behavior)
                window.layerState.selectedPA = paName;
                window.layerState.showPlantableAreas = true;
                
                console.log(`🌱 Selected plantable area: ${paName}`);
                
                // Trigger focus panel if available
                if (window.showFocusPanel) {
                    const boydData = window.parseBoydEcologicalData(originalFeature.properties.description || '');
                    window.showFocusPanel(paName, boydData);
                }
                
                // Update UI controls
                if (window.updatePlantableAreasUI) {
                    window.updatePlantableAreasUI();
                }
            }
        } else {
            // Handle non-plantable area selection
            if (format === 'boyd') {
                const npaCategory = window.extractNPACategory(originalFeature.properties.name);
                if (npaCategory) {
                    window.layerState.selectedNPA = npaCategory;
                    window.layerState.showNonPlantableAreas = true;
                    
                    console.log(`🚫 Selected non-plantable area: ${npaCategory}`);
                    
                    // Update UI controls
                    if (window.updateNonPlantableAreasUI) {
                        window.updateNonPlantableAreasUI();
                    }
                }
            }
        }
        
        // Update the scene after selection changes
        this.two.update();
        
        // Re-render polygons to update selection styling
        console.log('🔄 Refreshing polygon styling after selection...');
        this.refreshPolygonStyling();
    }

    /**
     * Refreshes polygon styling based on current selection state
     */
    refreshPolygonStyling() {
        if (!this.polygonGroup) return;
        
        this.polygonGroup.children.forEach(polygon => {
            if (polygon.featureData) {
                const { originalFeature, format, isPlantable } = polygon.featureData;
                
                // Update styling based on current selection
                let strokeColor, strokeWidth;
                
                if (isPlantable) {
                    if (format === 'boyd') {
                        const parsed = window.parseBoydName(originalFeature.properties.name);
                        const paName = parsed.description || parsed.id;
                        
                        // Handle ecological metrics coloring
                        if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric) {
                            strokeColor = '#4a90e2'; // Different blue for metrics mode
                            strokeWidth = 2;
                        } else {
                            // Regular PA styling
                            if (paName === window.layerState?.selectedPA) {
                                strokeColor = '#072b2e';
                                strokeWidth = 10;
                            } else {
                                strokeColor = '#072b2e';
                                strokeWidth = 2;
                            }
                        }
                    }
                } else {
                    if (format === 'boyd') {
                        const npaCategory = window.extractNPACategory(originalFeature.properties.name);
                        
                        if (npaCategory === window.layerState?.selectedNPA) {
                            strokeColor = '#FF0000';
                            strokeWidth = 10;
                        } else {
                            strokeColor = '#FF0000';
                            strokeWidth = 2;
                        }
                    }
                }
                
                if (strokeColor && strokeWidth) {
                    polygon.stroke = strokeColor;
                    polygon.linewidth = strokeWidth;
                    polygon.originalStroke = strokeColor;
                    polygon.originalStrokeWidth = strokeWidth;
                }
            }
        });
        
        this.two.update();
    }

    /**
     * Restores original styling to a polygon
     */
    restoreOriginalStyling(polygon) {
        if (polygon.originalFill !== undefined && 
            polygon.originalStroke !== undefined && 
            polygon.originalStrokeWidth !== undefined) {
            polygon.fill = polygon.originalFill;
            polygon.stroke = polygon.originalStroke;
            polygon.linewidth = polygon.originalStrokeWidth;
        }
    }


    /**
     * Sets up zoom functionality using mouse wheel
     * Pan functionality is handled by the main event handlers
     */
    setupPanAndZoom() {
        if (!this.two) return;
        
        console.log('🔧 Setting up zoom functionality...');
        
        const domElement = this.two.renderer.domElement;
        
        // Zoom constraints
        const minZoom = 0.5; // 50% - allows seeing beyond splat boundaries
        const maxZoom = 5.0; // 500% - detailed view
        
        // Store zoom constraints for use by other methods
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        
        // Zoom with mouse wheel
        domElement.addEventListener('wheel', (e) => {
            const delta = e.deltaY;
            let currentScale = this.two.scene.scale;
            
            // Calculate zoom factor
            const zoomFactor = delta > 0 ? 0.9 : 1.1;
            let newScale = currentScale * zoomFactor;
            
            // Enforce zoom limits
            newScale = Math.max(minZoom, Math.min(maxZoom, newScale));
            
            if (newScale !== currentScale) {
                // Get mouse position for zoom center
                const rect = domElement.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Convert mouse position to scene coordinates
                const sceneX = (mouseX - this.two.scene.translation.x) / currentScale;
                const sceneY = (mouseY - this.two.scene.translation.y) / currentScale;
                
                // Apply new scale
                this.two.scene.scale = newScale;
                
                // Adjust translation to zoom around mouse position
                this.two.scene.translation.x = mouseX - sceneX * newScale;
                this.two.scene.translation.y = mouseY - sceneY * newScale;
                
                console.log(`🔍 Zoom level: ${(newScale * 100).toFixed(1)}%`);
                this.two.update();
            }
            
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        
        console.log('✅ Zoom functionality initialized');
        console.log(`  - Zoom range: ${minZoom * 100}% to ${maxZoom * 100}%`);
        console.log('  - Mouse wheel: zoom in/out around cursor');
        console.log('  - Pan and click: handled by main event system');
    }

    /**
     * Debug function to test event handling - can be called from browser console
     */
    debugEventHandling() {
        console.log('🔧 Two.js Event Handling Debug Info:');
        console.log(`  - Canvas size: ${this.two?.width} x ${this.two?.height}`);
        console.log(`  - Scene scale: ${this.two?.scene?.scale}`);
        console.log(`  - Scene translation: (${this.two?.scene?.translation?.x}, ${this.two?.scene?.translation?.y})`);
        console.log(`  - Polygon count: ${this.polygonGroup?.children?.length || 0}`);
        console.log(`  - Current hovered: ${this.currentHoveredObject?.featureData?.entityName || 'none'}`);
        console.log(`  - Current clicked: ${this.currentClickedObject?.featureData?.entityName || 'none'}`);
        console.log(`  - Mouse position: (${this.mousePosition?.x || 'unknown'}, ${this.mousePosition?.y || 'unknown'})`);
        console.log(`  - Is dragging: ${this.isDragging}`);
        console.log(`  - Drag threshold: ${this.dragThreshold}px`);
        
        // Test hit testing at screen center
        if (this.two && this.polygonGroup) {
            const centerX = this.two.width / 2;
            const centerY = this.two.height / 2;
            const sceneCoords = this.screenToSceneCoordinates(centerX, centerY);
            const hitPolygon = this.getPolygonAt(sceneCoords.x, sceneCoords.y);
            console.log(`  - Hit test at screen center (${centerX}, ${centerY}): ${hitPolygon?.featureData?.entityName || 'no polygon'}`);
        }
    }

    /**
     * Handles clicks on canvas background (deselects polygons)
     */
    handleCanvasClick(e) {
        console.log('🖱️ Clicked on canvas background - deselecting polygons');
        
        if (this.currentClickedObject) {
            console.log('🔄 Deactivating clicked polygon:', this.currentClickedObject.featureData?.entityName);
            
            // Restore original styling
            this.restoreOriginalStyling(this.currentClickedObject);
            this.currentClickedObject = null;
            this.two.update();
        }
    }

    /**
     * Creates color legend for ecological metrics visualization
     * Same functionality as Fabric.js version but using Two.js shapes
     */
    createColorLegend(parameterName, minValue, maxValue) {
        // Remove existing legend first
        this.removeColorLegend();
        
        if (!parameterName || !this.two || !this.uiGroup) return;
        
        console.log(`🎨 Creating color legend for ${parameterName}: ${minValue} - ${maxValue}`);
        
        const legendGroup = this.two.makeGroup();
        const legendWidth = 300;
        const legendHeight = 20;
        const numSteps = 50;
        
        // Create gradient rectangles for color scale
        for (let i = 0; i < numSteps; i++) {
            const rectWidth = legendWidth / numSteps;
            const rectX = i * rectWidth;
            
            const rect = this.two.makeRectangle(rectX, 0, rectWidth, legendHeight);
            const normalizedValue = i / (numSteps - 1);
            const color = this.getViridisColor(normalizedValue);
            
            rect.fill = color;
            rect.noStroke();
            legendGroup.add(rect);
        }
        
        // Add text labels
        const minLabel = this.two.makeText(minValue.toFixed(1), -legendWidth/2, legendHeight + 15);
        const maxLabel = this.two.makeText(maxValue.toFixed(1), legendWidth/2, legendHeight + 15);
        const nameLabel = this.two.makeText(parameterName, 0, -15);
        
        // Style text labels
        [minLabel, maxLabel, nameLabel].forEach(label => {
            label.fill = '#333';
            label.size = 12;
            label.alignment = 'center';
        });
        
        legendGroup.add(minLabel, maxLabel, nameLabel);
        
        // Position at bottom of screen
        legendGroup.translation.set(this.two.width / 2, this.two.height - 60);
        
        this.uiGroup.add(legendGroup);
        this.colorLegend = legendGroup;
        
        console.log('✅ Color legend created');
        this.two.update();
    }

    /**
     * Removes color legend if it exists
     */
    removeColorLegend() {
        if (this.colorLegend) {
            this.colorLegend.remove();
            this.colorLegend = null;
            console.log('🗑️ Color legend removed');
            if (this.two) {
                this.two.update();
            }
        }
    }

    /**
     * Gets viridis color for a normalized value (0-1)
     * Same implementation as existing color mapping system
     */
    getViridisColor(normalizedValue) {
        // Clamp value between 0 and 1
        const t = Math.max(0, Math.min(1, normalizedValue));
        
        // Viridis color map approximation
        // These are key points from the viridis colormap
        if (t <= 0.25) {
            const localT = t / 0.25;
            return this.interpolateColor([68, 1, 84], [59, 82, 139], localT);
        } else if (t <= 0.5) {
            const localT = (t - 0.25) / 0.25;
            return this.interpolateColor([59, 82, 139], [33, 144, 141], localT);
        } else if (t <= 0.75) {
            const localT = (t - 0.5) / 0.25;
            return this.interpolateColor([33, 144, 141], [93, 201, 99], localT);
        } else {
            const localT = (t - 0.75) / 0.25;
            return this.interpolateColor([93, 201, 99], [253, 231, 37], localT);
        }
    }

    /**
     * Interpolates between two RGB colors
     */
    interpolateColor(color1, color2, t) {
        const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
        const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
        const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Deactivates 2D mode by disposing Two.js instance and showing Cesium
     */
    deactivate() {
        if (!this.isActive) return;

        console.log('🔄 Transitioning back to 3D Cesium mode...');

        // STEP 1: Restore scrollbars
        document.body.style.overflow = '';

        // STEP 2: Clean up color legend if it exists
        this.removeColorLegend();

        // STEP 3: Dispose Two.js instance completely
        if (this.two) {
            try {
                // Remove from DOM first
                if (this.two.renderer.domElement && this.two.renderer.domElement.parentNode) {
                    this.two.renderer.domElement.parentNode.removeChild(this.two.renderer.domElement);
                    console.log('✅ Two.js canvas removed from DOM');
                }
                
                // Dispose Two.js instance
                // Note: Two.js doesn't have a built-in dispose method, so we clean up manually
                this.two.scene.children.forEach(child => {
                    if (child.dispose) {
                        child.dispose();
                    }
                });
                this.two = null;
                console.log('✅ Two.js instance disposed');
            } catch (error) {
                console.warn('⚠️ Error disposing Two.js instance:', error);
            }
        }

        // STEP 4: Reset references
        this.backgroundGroup = null;
        this.polygonGroup = null;
        this.uiGroup = null;
        this.backgroundImage = null;
        this.backgroundTexture = null;
        this.colorLegend = null;

        // STEP 5: Show Cesium container
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'block';
            console.log('✅ Cesium container shown');
        }

        // STEP 6: Sync 3D visualization with any changes made in 2D mode
        this.syncWith3DVisualization();

        this.isActive = false;
        console.log('🎯 3D Cesium mode restored - Two.js completely removed!');
    }

    /**
     * Syncs 3D visualization with 2D mode changes
     * Same logic as Fabric.js version
     */
    syncWith3DVisualization() {
        if (window.currentSiteData && window.visualizeGeoJsonPolygonsWithLayers) {
            console.log('🔄 Syncing 3D visualization with 2D changes...');
            
            // Ensure proper parameter filter state for ecological metrics
            if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric) {
                window.currentParameterFilter = window.layerState.selectedMetric;
                console.log('🔄 Restored parameter filter:', window.currentParameterFilter);
            } else {
                window.currentParameterFilter = null;
                console.log('🔄 Cleared parameter filter');
            }
            
            try {
                window.visualizeGeoJsonPolygonsWithLayers(window.currentSiteData);
                console.log('✅ 3D visualization sync completed successfully');
            } catch (error) {
                console.error('❌ Error syncing 3D visualization:', error);
                // Fallback: try direct visualization
                if (window.visualizeGeoJsonPolygons) {
                    console.log('🔄 Attempting fallback visualization...');
                    window.visualizeGeoJsonPolygons(window.currentSiteData);
                }
            }
        }
    }

    /**
     * Updates polygon visibility based on current layer state
     * Call this when layer controls change (PA/NPA visibility toggles)
     */
    updatePolygonVisibility() {
        if (!this.two || !this.isActive) return;
        
        console.log('🔄 Updating 2D polygon visibility based on layer state');
        
        // Clear current polygons and re-render with current layer state
        if (this.polygonGroup) {
            this.polygonGroup.remove();
        }
        this.polygonGroup = this.two.makeGroup();
        this.polygonGroup.id = 'polygonGroup';
        
        // Re-render polygons with current filtering
        this.renderGeoJsonPolygons();
    }
}

// Initialize the Two.js 2D manager and make it globally available
window.two2DManager = new Two2DManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Two.js to be fully loaded
    if (typeof Two !== 'undefined') {
        window.two2DManager.initialize();
        console.log('✅ Two2DManager initialized with Two.js');
    } else {
        console.error('❌ Two.js not loaded - 2D mode will not work');
        console.log('💡 Make sure to include Two.js library in your HTML');
    }
});