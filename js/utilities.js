import { ecoLoadingMessages } from './ecoLoadingMessages.js';

// Make messages globally available for main.js
window.ecoLoadingMessages = ecoLoadingMessages;

/**
 * Parses a markdown-style string and converts it to HTML.
 * Supports links in the format [[Link text]](https://url-here.com).
 * Supports bold text using **text** and italic text using __text__.
 * Supports conditional text based on device type.
 * @param {string} text - The markdown-style text to parse.
 * @param {string} deviceType - The device type for conditional text rendering.
 * @returns {string} - The parsed HTML string.
 */
function parseMarkdown(text, deviceType) {
    const linkPattern = /\[\[(.*?)\]\]\((.*?)\)/g;
    const boldPattern = /\*\*(.*?)\*\*/g;
    const italicPattern = /__(.*?)__/g;
    const devicePattern = /\{\{(.*?)\}\}/g;

    // Custom parser to extract and parse device-specific content
    const parseDeviceSpecificText = (content) => {
        try {
            const deviceContent = {};
            const entries = content.split('",').map(entry => entry.trim());

            entries.forEach(entry => {
                const [key, value] = entry.split(/:(.+)/).map(part => part.trim().replace(/^"|"$/g, ''));
                deviceContent[key] = value;
            });

            return deviceContent[deviceType] || "";
        } catch (error) {
            console.error("Failed to parse device-specific content:", error);
            return "";
        }
    };

    // Replace markdown patterns with corresponding HTML
    let parsedText = text
        .replace(linkPattern, '<a href="$2" target="_blank">$1</a>')
        .replace(boldPattern, '<span style="font-weight: 700;">$1</span>')
        .replace(italicPattern, '<span style="font-weight: 200; font-style: italic;">$1</span>')
        .replace(devicePattern, (match, content) => parseDeviceSpecificText(content));

    return parsedText;
}



/**
 * Displays a message in the messageBox with optional fade in/out.
 * @param {string} text - The text to display, can include markdown-style links, bold, italic formatting, and device-specific text.
 * @param {number} fadeInTime - Duration in seconds for the message to fade in.
 * @param {number} displayTime - Duration in seconds for the message to remain visible.
 * @param {number} fadeOutTime - Duration in seconds for the message to fade out.
 */
function displayMessage(text, fadeInTime = 0.5, displayTime = 3, fadeOutTime = 0.5) {
    const messageBox = document.getElementById("messageBox");
    if (!messageBox) {
        console.error("Message box not found in the DOM.");
        return;
    }

    // Get the user's device type
    const deviceType = window.user?.userDevice.replace(/ /g, '_').toLowerCase() || 'desktop_with_mouse';

    // Parse the text for markdown-style links, bold, italic formatting, and device-specific text
    const parsedText = parseMarkdown(text, deviceType);
    messageBox.innerHTML = parsedText;
    messageBox.style.display = "block";
    messageBox.style.opacity = 0;
    messageBox.style.fontWeight = 300; // Set the default font weight to 300

    // Fade in
    messageBox.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fadeInTime * 1000,
        fill: "forwards",
    });

    // Display for a set amount of time, then fade out
    setTimeout(() => {
        messageBox.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: fadeOutTime * 1000,
            fill: "forwards",
        }).onfinish = () => {
            messageBox.style.display = "none";
        };
    }, (fadeInTime + displayTime) * 1000);
}

/**
 * Loads and parses GeoJSON files from the data directory
 * @returns {Promise<Array>} - Array of site objects with name and bounds
 */
async function loadSiteData() {
    const sites = [];
    
    // Define the GeoJSON files to load
    const files = [
        { filename: 'Boyd_Residence_Aerial_and_Ground.geojson', name: 'Winter Garden Residence' }
    ];
    
    for (const file of files) {
        try {
            const dataUrl = window.TerrainConfig ? 
                window.TerrainConfig.getDataUrl(`scott-boyd-residence/${file.filename}`) :
                `/data/scott-boyd-residence/${file.filename}`;
            const response = await fetch(dataUrl);
            const geoJsonData = await response.json();
            
            // Calculate bounds from the GeoJSON features
            const bounds = calculateBounds(geoJsonData);
            
            sites.push({
                name: file.name,
                filename: file.filename,
                bounds: bounds,
                geoJson: geoJsonData
            });
        } catch (error) {
            console.error(`Error loading ${file.filename}:`, error);
        }
    }
    
    return sites;
}

/**
 * Detects coordinate format based on values
 * @param {Array} coords - Coordinate array [x, y]
 * @returns {string} - 'geographic' or 'projected'
 */
function detectCoordinateFormat(coords) {
    const [x, y] = coords;
    // Geographic coordinates are typically -180 to 180 for longitude, -90 to 90 for latitude
    if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
        return 'geographic';
    }
    return 'projected';
}

/**
 * Calculates bounding box from GeoJSON data
 * @param {Object} geoJsonData - The GeoJSON data
 * @returns {Object} - Bounds object with min/max lat/lng
 */
function calculateBounds(geoJsonData) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    // Detect coordinate format from first feature
    let isGeographic = false;
    if (geoJsonData.features.length > 0) {
        const firstFeature = geoJsonData.features[0];
        if (firstFeature.geometry.type === 'Point') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates) === 'geographic';
        } else if (firstFeature.geometry.type === 'Polygon') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates[0][0]) === 'geographic';
        }
    }
    
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
            const [x, y] = feature.geometry.coordinates;
            let latLng;
            
            if (isGeographic) {
                // Already in geographic coordinates [lng, lat]
                latLng = { lat: y, lng: x };
            } else {
                // UTM coordinates - need conversion
                latLng = utmToLatLng(x, y);
            }
            
            minLat = Math.min(minLat, latLng.lat);
            maxLat = Math.max(maxLat, latLng.lat);
            minLng = Math.min(minLng, latLng.lng);
            maxLng = Math.max(maxLng, latLng.lng);
        } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                const [x, y] = coord;
                let latLng;
                
                if (isGeographic) {
                    // Already in geographic coordinates [lng, lat]
                    latLng = { lat: y, lng: x };
                } else {
                    // UTM coordinates - need conversion
                    latLng = utmToLatLng(x, y);
                }
                
                minLat = Math.min(minLat, latLng.lat);
                maxLat = Math.max(maxLat, latLng.lat);
                minLng = Math.min(minLng, latLng.lng);
                maxLng = Math.max(maxLng, latLng.lng);
            });
        }
    });
    
    return { minLat, maxLat, minLng, maxLng };
}

/**
 * Converts UTM coordinates to Lat/Lng using proj4js
 * @param {number} easting - UTM Easting
 * @param {number} northing - UTM Northing 
 * @returns {Object} - {lat, lng}
 */
function utmToLatLng(easting, northing) {
    // Define UTM Zone 17N projection (EPSG:32617) and WGS84 (EPSG:4326)
    const utmProj = '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs';
    const wgs84Proj = '+proj=longlat +datum=WGS84 +no_defs';
    
    try {
        // Convert from UTM to WGS84
        const result = proj4(utmProj, wgs84Proj, [easting, northing]);
        return {
            lng: result[0],
            lat: result[1]
        };
    } catch (error) {
        console.error('UTM conversion error:', error);
        // Fallback to simplified conversion if proj4 fails
        const lat = 25.7617 + (northing - 3174950) / 111320;
        const lng = -80.1918 + (easting - 466050) / (111320 * Math.cos(lat * Math.PI / 180));
        return { lat, lng };
    }
}







/**
 * Initializes the site selector dropdown
 */
async function initializeSiteSelector() {
    const siteDropdown = document.getElementById('siteDropdown');
    if (!siteDropdown) {
        console.error('Site dropdown not found');
        return;
    }
    
    // Load site data
    const sites = await loadSiteData();
    
    // Populate dropdown
    sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site.filename;
        option.textContent = site.name;
        option.dataset.bounds = JSON.stringify(site.bounds);
        siteDropdown.appendChild(option);
    });
    
    // Set default selection to Winter Garden Residence
    const winterGardenOption = Array.from(siteDropdown.options).find(option => 
        option.textContent === 'Winter Garden Residence'
    );
    if (winterGardenOption) {
        siteDropdown.value = winterGardenOption.value;
        
        // Since Scott Boyd site uses Boyd format, show the layer controls immediately
        const layerControls = document.getElementById('layerControls');
        if (layerControls) {
            layerControls.style.display = 'block';
        }
        
        // Manually load the default site to ensure proper initialization
        const selectedOption = siteDropdown.options[siteDropdown.selectedIndex];
        const bounds = JSON.parse(selectedOption.dataset.bounds);
        
        // Load the Winter Garden site data
        const winterGardenSite = sites.find(site => site.filename === winterGardenOption.value);
        if (winterGardenSite) {
            // Store the site data globally
            window.currentSiteData = winterGardenSite.geoJson;
            
            // Initialize layer state with plantable areas checked by default
            window.layerState = {
                showPlantableAreas: true,
                showNonPlantableAreas: false,

                // Unified selection structure
                selectedGroup: null,
                selectedGroupType: null,
                selectedPolygons: [],

                // Categorization data
                npaCategories: new Map(),
                paCategories: new Map(),
                categorizedPAs: new Map()
            };
            
            // Navigate to the site WITHOUT visualizing
            navigateToSite(bounds, false);
            
            // Store current site data globally
            window.currentSiteData = winterGardenSite.geoJson;
            
            // Detect format and initialize parameter filter
            const format = winterGardenSite.geoJson.features.length > 0 ? 
                detectGeoJsonFormat(winterGardenSite.geoJson.features[0]) : 'legacy';
            
            // Initialize layer controls after site is loaded
            if (window.initializeLayerControls) {
                window.initializeLayerControls();
            }
            
            // Initialize layer controls to analyze PA/NPA categories
            if (window.initializeLayerControlsForSite) {
                window.initializeLayerControlsForSite(format);
            }
            
            // Trigger initial visualization with plantable areas
            if (window.superSplatBridge) {
                window.superSplatBridge.renderGeoJSONPolygons(winterGardenSite.geoJson);
            }
            
            // Auto-load Gaussian Splat for Winter Garden site (with small delay to ensure camera is positioned)
            if (window.gaussianSplatManager) {
                setTimeout(() => {
                    window.gaussianSplatManager.loadGaussianSplat('scott-boyd-residence', bounds);
                }, 100);
            }
        }
    }
    
    // Add event listener for site selection
    siteDropdown.addEventListener('change', function() {
        if (this.value) {
            const selectedOption = this.options[this.selectedIndex];
            const bounds = JSON.parse(selectedOption.dataset.bounds);
            
            
            // Find the selected site to determine format
            loadSiteData().then(sites => {
                const selectedSite = sites.find(site => site.filename === this.value);
                if (selectedSite) {
                    // Store current site data globally FIRST
                    window.currentSiteData = selectedSite.geoJson;
                    
                    const format = selectedSite.geoJson.features.length > 0 ? 
                        detectGeoJsonFormat(selectedSite.geoJson.features[0]) : 'legacy';
                    
                    // Initialize layer controls based on format (now with data available)
                    if (window.initializeLayerControlsForSite) {
                        window.initializeLayerControlsForSite(format);
                    }
                    
                    // Load Gaussian Splat if available for this site
                    if (window.gaussianSplatManager) {
                        // Unload any existing splats first
                        window.gaussianSplatManager.unloadAllSplats();
                        
                        // For Winter Garden site, auto-load the splat
                        if (selectedSite.name === 'Winter Garden Residence') {
                            window.gaussianSplatManager.loadGaussianSplat('scott-boyd-residence', bounds);
                        }
                    }
                }
            });
            
            navigateToSite(bounds);
            
            // Dispatch site changed event for other managers
            document.dispatchEvent(new CustomEvent('siteChanged', { 
                detail: { siteId: this.value } 
            }));
        } else {
            // Hide layer controls when no site selected
            if (window.initializeLayerControlsForSite) {
                window.initializeLayerControlsForSite('legacy');
            }
            window.currentSiteData = null;
            
            // Unload all splats when no site is selected
            if (window.gaussianSplatManager) {
                window.gaussianSplatManager.unloadAllSplats();
            }
            
            // Dispatch site changed event for other managers
            document.dispatchEvent(new CustomEvent('siteChanged', { 
                detail: { siteId: null } 
            }));
        }
    });
}


/**
 * Detects GeoJSON format type based on feature properties
 * @param {Object} feature - A GeoJSON feature
 * @returns {string} - 'boyd' or 'legacy'
 */
function detectGeoJsonFormat(feature) {
    // Boyd format has rich properties with description field containing M1-M10 data
    if (feature.properties.description && feature.properties.description.includes('Ecodash.ai Ecological Niche Model')) {
        return 'boyd';
    }
    // Legacy format has Layer property
    if (feature.properties.Layer) {
        return 'legacy';
    }
    // Default to legacy for compatibility
    return 'legacy';
}

/**
 * Determines if feature is plantable based on format and properties
 * @param {Object} feature - A GeoJSON feature
 * @param {string} format - 'boyd' or 'legacy'
 * @returns {boolean} - True if plantable
 */
function isPlantableFeature(feature, format) {
    if (format === 'boyd') {
        // Boyd format: PA in name means plantable, NPA and numeric means non-plantable
        const name = feature.properties.name;
        if (!name) return false;
        
        // Check for PA designation (but not NPA)
        if (name.startsWith('PA') && name.includes('=') && !name.includes('NPA')) {
            return true;
        }
        
        // Numeric names and soil test features are reference points (non-plantable)
        if (/^\d+$/.test(name) || name.includes('Test ID')) {
            return false;
        }
        
        // NPA features are explicitly non-plantable
        if (name.includes('NPA')) {
            return false;
        }
        
        return false; // Default to non-plantable for safety
    } else {
        // Legacy format: check Layer property
        return feature.properties.Layer === 'Plantable_Layers';
    }
}


/**
 * Gets feature category for Boyd format
 * @param {Object} feature - A GeoJSON feature
 * @returns {string} - 'plantable', 'non-plantable', or 'data-point'
 */
function getBoydFeatureCategory(feature) {
    const name = feature.properties.name;
    if (!name) return 'non-plantable';
    
    if (name.startsWith('PA') && name.includes('=') && !name.includes('NPA')) {
        return 'plantable';
    }
    
    if (name.includes('NPA')) {
        return 'non-plantable';
    }
    
    if (/^\d+$/.test(name) || name.includes('Test ID')) {
        return 'data-point';
    }
    
    return 'non-plantable'; // Default
}

/**
 * Parses Boyd format ecological data from description field
 * @param {string} description - Feature description with M1-M10 data
 * @returns {Object} - Parsed ecological measurements
 */
function parseBoydEcologicalData(description) {
    const measurements = {};

    // Extract M1-M10 parameters using regex - using consistent naming with focusPanel
    const patterns = {
        soilMoisture: /M1:\s*Moisture[^=]*=\s*([^\n]+)/,
        sunlight: /M2:\s*Light[^=]*=\s*([^\n]+)/,
        pH: /M3:\s*pH[^=]*=\s*([^\n]+)/,
        nitrogen: /M4:\s*N[^=]*=\s*([^\n]+)/,
        phosphorus: /M5:\s*P[^=]*=\s*([^\n]+)/,
        potassium: /M6:\s*K[^=]*=\s*([^\n]+)/,
        organicMatter: /M7:\s*Organic[^=]*=\s*([^\n]+)/,
        droughtRisk: /M8:\s*Drought[^=]*=\s*([^\n]+)/,
        floodRisk: /M9:\s*Flood[^=]*=\s*([^\n]+)/,
        windExposure: /M10:\s*Wind[^=]*=\s*([^\n]+)/
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = description.match(pattern);
        measurements[key] = match ? match[1].trim() : 'Unknown';
    }

    return measurements;
}

/**
 * Extracts NPA category from name
 * @param {string} name - NPA feature name
 * @returns {string|null} - Category name or null
 */
function extractNPACategory(name) {
    // Parse names like "NPA7='Utilities'" or "NPA15_Tree"
    const match = name.match(/NPA\d+[=_]['"]?([^'"]+)['"]?/);
    if (match) {
        let category = match[1];
        // Clean up category name - only replace underscores, preserve original spacing
        category = category
            .replace(/_/g, ' ')
            .trim();
        return category;
    }
    return null;
}

/**
 * Navigates to a site (SuperSplat-only mode)
 * @param {Object} bounds - Site bounds {minLat, maxLat, minLng, maxLng}
 * @param {boolean} visualize - Whether to visualize the site data (default true)
 */
function navigateToSite(bounds, visualize = true) {
    console.log('🗺️ SuperSplat: Site navigation handled by SuperSplat camera system');

    // No active tutorials to stop in SuperSplat-only mode

    // Calculate center point for messaging
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;

    // Load the corresponding site data and visualize it
    loadSiteData().then(sites => {
        // Find the selected site by bounds (match the bounds passed to this function)
        const selectedSite = sites.find(site =>
            Math.abs(site.bounds.minLat - bounds.minLat) < 0.001 &&
            Math.abs(site.bounds.maxLat - bounds.maxLat) < 0.001 &&
            Math.abs(site.bounds.minLng - bounds.minLng) < 0.001 &&
            Math.abs(site.bounds.maxLng - bounds.maxLng) < 0.001
        );

        if (selectedSite && selectedSite.geoJson && visualize) {
            // Store the site data globally so parameter filter changes work
            window.currentSiteData = selectedSite.geoJson;
            // Polygon visualization now handled by SuperSplatBridge
        }
    });

    displayMessage(`Navigating to site: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`, 0.5, 2, 0.5);
}

/**
 * Initializes the SuperSplat application
 */
async function initializeSupersplat() {
    console.log('🎨 Initializing SuperSplat application...');

    // Wait for SuperSplat manager to be available
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max wait
    while (!window.superSplatManager && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    // Initialize SuperSplat manager
    if (window.superSplatManager) {
        console.log('✅ SuperSplat manager found, activating SuperSplat mode...');

        // Ensure SuperSplat manager is initialized first
        if (!window.superSplatManager.superSplatContainer) {
            console.log('🔄 Initializing SuperSplat manager...');
            window.superSplatManager.initialize();
        }

        // Show SuperSplat container
        const superSplatContainer = document.getElementById('superSplatContainer');
        if (superSplatContainer) {
            superSplatContainer.style.display = 'block';

            // Load SuperSplat editor with default site (scott-boyd-residence has splat file)
            window.superSplatManager.loadSuperSplatEditor('scott-boyd-residence');

            console.log('🎨 SuperSplat editor loaded');
        } else {
            console.error('❌ SuperSplat container not found');
        }
    } else {
        console.error('❌ SuperSplat manager not available after timeout');
    }
}

/**
 * Initialize site data for SuperSplat-only mode (no dropdown UI needed)
 */
async function initializeSupersplatSiteData() {
    console.log('🏠 Loading site data for SuperSplat...');

    // Load site data
    const sites = await loadSiteData();

    // Find the default site (Winter Garden Residence / scott-boyd-residence)
    const defaultSite = sites.find(site =>
        site.name === 'Winter Garden Residence' ||
        site.filename.includes('scott-boyd-residence')
    );

    if (!defaultSite) {
        console.error('❌ Default site (Winter Garden Residence) not found');
        return;
    }

    console.log('✅ Default site found:', defaultSite.name);

    // Show layer controls for Boyd format
    const layerControls = document.getElementById('layerControls');
    if (layerControls) {
        layerControls.style.display = 'block';
        console.log('✅ Layer controls shown');
    }

    // Store the site data globally
    window.currentSiteData = defaultSite.geoJson;

    // Initialize layer state with plantable areas checked by default
    window.layerState = {
        showPlantableAreas: true,
        showNonPlantableAreas: false,

        // Unified selection structure
        selectedGroup: null,
        selectedGroupType: null,
        selectedPolygons: [],

        // Categorization data
        npaCategories: new Map(),
        paCategories: new Map(),
        categorizedPAs: new Map()
    };

    console.log('✅ Layer state initialized');

    // Detect format and initialize parameter filter
    const format = defaultSite.geoJson.features.length > 0 ?
        detectGeoJsonFormat(defaultSite.geoJson.features[0]) : 'legacy';

    console.log('📊 Detected GeoJSON format:', format);

    // Initialize layer controls after site is loaded
    if (window.initializeLayerControls) {
        console.log('🔧 Initializing layer controls...');
        window.initializeLayerControls();
    } else {
        console.warn('⚠️ initializeLayerControls not available');
    }

    // Initialize layer controls to analyze PA/NPA categories
    if (window.initializeLayerControlsForSite) {
        console.log('📈 Analyzing PA/NPA categories...');
        window.initializeLayerControlsForSite(format);
    } else {
        console.warn('⚠️ initializeLayerControlsForSite not available');
    }

    // Trigger initial visualization with plantable areas
    if (window.superSplatBridge) {
        console.log('🎨 Triggering polygon visualization...');
        window.superSplatBridge.renderGeoJSONPolygons(defaultSite.geoJson);
    } else {
        console.warn('⚠️ SuperSplatBridge not available');
    }

    console.log('✅ SuperSplat site data initialization complete');
}

// Syntax error should now be fixed - properly closed functions above

/**
 * Main initialization function for the application
 */
async function allSystemsGo() {
    // Update loading message for initialization
    if (window.independentLoadingState) {
        // window.independentLoadingState.updateMessage('Initializing ecosystem simulation...', 3000);
    }

    // Check loading mode configuration
    // Initialize SuperSplat application
    await initializeSupersplat();

    // SuperSplat initialization complete - no Cesium render management needed in SuperSplat-only mode
    console.log('✅ SuperSplat initialized');

    // GoogleMaps2D removed to improve performance

    // SuperSplat-only mode - Cesium-dependent managers removed
    console.log('✅ SuperSplat - managers initialized as needed');


    // Initialize layer state early
    window.layerState = {
        showPlantableAreas: true,
        showNonPlantableAreas: false,

        // Unified selection structure
        selectedGroup: null,
        selectedGroupType: null,
        selectedPolygons: [],

        // Categorization data
        npaCategories: new Map(),
        paCategories: new Map(),
        categorizedPAs: new Map()
    };


    // Handle final initialization checks
    // Initialize site data for SuperSplat-only mode
    console.log('🎯 Loading SuperSplat site data and UI...');
    await initializeSupersplatSiteData();

    console.log(`[${new Date().toISOString()}] 🎯 ALL SYSTEMS GO COMPLETE - SuperSplat application ready`);
}

// Expose the functions globally
window.parseMarkdown = parseMarkdown;
window.displayMessage = displayMessage;
window.allSystemsGo = allSystemsGo;
window.loadSiteData = loadSiteData;
window.calculateBounds = calculateBounds;
window.utmToLatLng = utmToLatLng;
window.initializeSiteSelector = initializeSiteSelector;
window.initializeSupersplatSiteData = initializeSupersplatSiteData;
window.navigateToSite = navigateToSite;
window.detectCoordinateFormat = detectCoordinateFormat;
window.detectGeoJsonFormat = detectGeoJsonFormat;
window.isPlantableFeature = isPlantableFeature;
window.parseBoydEcologicalData = parseBoydEcologicalData;
window.getBoydFeatureCategory = getBoydFeatureCategory;
