/**
 * Layer control system for managing plantable and non-plantable area visualization
 */

// Layer state management - condensed structure
window.layerState = {
    showPlantableAreas: false,
    showNonPlantableAreas: false,

    // Unified selection structure
    selectedGroup: null,        // PA name, NPA category, or metric name ('moisture', 'pH', etc.)
    selectedGroupType: null,    // 'PA', 'NPA', or 'METRIC'
    selectedPolygons: [],       // Array of polygon names for current selection

    // Categorization data
    npaCategories: new Map(), // Map of NPA category name to metadata
    paCategories: new Map(), // Map of PA name to {number, category}
    categorizedPAs: new Map() // Map of category -> array of PAs
};

// Toggle tracking variables for detecting re-clicks on radio buttons
window.uiToggleState = {
    currentSelectedGroup: null,
    currentSelectedGroupType: null
};

// Default visualization settings for different layer types
const layerSettings = {
    plantableAreas: {
        polygonAlpha: 0,
        outlineWidth: 2,
        selectedOutlineWidth: 10,
        outlineColor: (typeof Cesium !== 'undefined') ? Cesium.Color.WHITE : '#FFFFFF'
    },
    ecologicalMetrics: {
        polygonAlpha: 0.7,
        outlineWidth: 2,
        selectedOutlineWidth: 5
    },
    nonPlantableAreas: {
        polygonAlpha: 0,
        outlineWidth: 2,
        selectedOutlineWidth: 10,
        outlineColor: (typeof Cesium !== 'undefined') ? Cesium.Color.RED : '#FF0000'
    }
};

/**
 * Removes color legend from the UI
 */
function removeColorLegend() {
    const existingLegend = document.getElementById('colorLegend');
    if (existingLegend) {
        existingLegend.remove();
        console.log('🔹 Color legend removed');
    }
}

/**
 * Clears all selected polygons and resets selection state
 * This includes PA selections, NPA selections, AND environmental metric selections
 */
function clearAllPolygonSelections() {
    console.log(`🔧 clearAllPolygonSelections() called - currentSelectedGroup was: "${window.uiToggleState?.currentSelectedGroup}" (${window.uiToggleState?.currentSelectedGroupType})`);

    // Clear unified selection state
    window.layerState.selectedGroup = null;
    window.layerState.selectedGroupType = null;
    window.layerState.selectedPolygons = [];

    // Clear parameter filter
    window.currentParameterFilter = null;

    // Clear toggle tracking state
    window.uiToggleState.currentSelectedGroup = null;
    window.uiToggleState.currentSelectedGroupType = null;

    // Remove color legend if present
    removeColorLegend();

    // Also deselect all polygons in SuperSplat to restore visual properties
    // This restores ALL polygons to their default state regardless of selection type
    if (window.superSplatScene && window.superSplatScene.events) {
        try {
            window.superSplatScene.events.invoke('triangleOverlay.deselectAllPolygons');
            console.log('🔹 All SuperSplat polygons deselected (PA, NPA, and environmental metric properties restored)');
        } catch (error) {
            console.warn('Failed to deselect SuperSplat polygons:', error);
        }
    }

    // Trigger full polygon re-rendering to ensure appearance is restored
    reRenderPolygons();

    console.log('🔹 All polygon selections cleared and visuals restored');
}

/**
 * Finds all polygon names that belong to a specific PA area
 * @param {string} paAreaName - Name of the PA area (e.g., "Southeast Front Door Entrance")
 * @param {Object} geoJsonData - The GeoJSON data to search through
 * @returns {Array} Array of polygon names belonging to this PA area
 */
function findPolygonsForPAArea(paAreaName, geoJsonData) {
    if (!geoJsonData || !geoJsonData.features) return [];

    const polygonNames = [];
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            const parsed = parseBoydName(feature.properties.name);
            const featureDescription = parsed.description || parsed.id;

            // Check if this is a plantable area by calling the utility function
            const isPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'plantable' :
                isPlantableFeature(feature, 'boyd');

            if (featureDescription === paAreaName && isPlantable) {
                // Use full GeoJSON name (unique identifier that SuperSplat stores)
                polygonNames.push(feature.properties.name);
            }
        }
    });

    return polygonNames;
}

/**
 * Finds all polygon names that belong to a specific NPA category
 * @param {string} npaCategory - Name of the NPA category
 * @param {Object} geoJsonData - The GeoJSON data to search through
 * @returns {Array} Array of polygon names belonging to this NPA category
 */
function findPolygonsForNPACategory(npaCategory, geoJsonData) {
    if (!geoJsonData || !geoJsonData.features) return [];

    const polygonNames = [];
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            const featureCategory = extractNPACategory(feature.properties.name);

            // Check if this is a non-plantable area by calling the utility function
            const isNonPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'non-plantable' :
                !isPlantableFeature(feature, 'boyd');

            if (featureCategory === npaCategory && isNonPlantable) {
                // Use full GeoJSON name (unique identifier that SuperSplat stores)
                polygonNames.push(feature.properties.name);
            }
        }
    });

    return polygonNames;
}

/**
 * Selects polygons for a specific PA area
 * @param {string} paAreaName - Name of the PA area to select
 * @param {Object} geoJsonData - The GeoJSON data to search through
 */
/**
 * Unified selection function for PA areas, NPA categories, and metrics
 * @param {string} groupName - The group name to select
 * @param {string} groupType - 'PA', 'NPA', or 'METRIC'
 * @param {Object} geoJsonData - The GeoJSON data containing all polygons
 */
function setSelection(groupName, groupType, geoJsonData) {
    console.log(`🎯 Setting selection: "${groupName}" (${groupType})`);

    // Auto-show relevant polygon groups if they're invisible
    let visibilityChanged = false;

    if (groupType === 'PA' || groupType === 'METRIC') {
        // PA and METRIC selections need plantable areas visible
        if (!window.layerState.showPlantableAreas) {
            console.log(`👁️ Auto-showing plantable areas for ${groupType} selection`);
            window.layerState.showPlantableAreas = true;
            visibilityChanged = true;

            // Update SuperSplat group visibility
            if (window.superSplatScene && window.superSplatScene.events) {
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'plantable-areas', true);
            }
        }
    } else if (groupType === 'NPA') {
        // NPA selections need non-plantable areas visible
        if (!window.layerState.showNonPlantableAreas) {
            console.log(`👁️ Auto-showing non-plantable areas for ${groupType} selection`);
            window.layerState.showNonPlantableAreas = true;
            visibilityChanged = true;

            // Update SuperSplat group visibility
            if (window.superSplatScene && window.superSplatScene.events) {
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'non-plantable-areas', true);
            }
        }
    }

    // Update visibility button icons if visibility changed
    if (visibilityChanged) {
        updateVisibilityButtonIcons();
    }

    // Set unified selection state
    window.layerState.selectedGroup = groupName;
    window.layerState.selectedGroupType = groupType;

    // Find polygons based on type
    let polygons = [];
    switch (groupType) {
        case 'PA':
            polygons = findPolygonsForPAArea(groupName, geoJsonData);
            break;
        case 'NPA':
            polygons = findPolygonsForNPACategory(groupName, geoJsonData);
            break;
        case 'METRIC':
            // For metrics, we select all plantable area polygons
            polygons = geoJsonData.features
                .filter(feature => feature.properties?.PA_Name)
                .map(feature => feature.properties.Name || `polygon_${feature.properties.FID || Math.random()}`);
            window.currentParameterFilter = groupName;
            break;
    }

    window.layerState.selectedPolygons = polygons;

    // Apply visual selection in SuperSplat
    if (window.superSplatScene && window.superSplatScene.events && polygons.length > 0) {
        try {
            window.superSplatScene.events.invoke('triangleOverlay.selectPolygonArea', polygons);
            console.log(`🎯 ${groupType} "${groupName}" visually selected in SuperSplat (${polygons.length} polygons)`);
        } catch (error) {
            console.warn('Failed to apply visual selection in SuperSplat:', error);
        }
    }

    console.log(`🎯 Selected ${groupType} "${groupName}" with ${polygons.length} polygons:`, polygons);
}

function selectPAArea(paAreaName, geoJsonData) {
    // Note: clearAllPolygonSelections() is now handled by the click handlers
    setSelection(paAreaName, 'PA', geoJsonData);
}

/**
 * Selects polygons for a specific NPA category
 * @param {string} npaCategory - Name of the NPA category to select
 * @param {Object} geoJsonData - The GeoJSON data to search through
 */
function selectNPACategory(npaCategory, geoJsonData) {
    // Note: clearAllPolygonSelections() is now handled by the click handlers
    setSelection(npaCategory, 'NPA', geoJsonData);
}

/**
 * Finds all plantable area polygons for environmental metrics visualization
 * @param {Object} geoJsonData - The GeoJSON data to search through
 * @returns {Array} Array of all plantable area polygon names
 */
function findAllPlantablePolygons(geoJsonData) {
    if (!geoJsonData || !geoJsonData.features) return [];

    const plantablePolygons = [];
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            // Check if this is a plantable area by calling the utility function
            const isPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'plantable' :
                isPlantableFeature(feature, 'boyd');

            if (isPlantable) {
                plantablePolygons.push(feature.properties.name);
            }
        }
    });

    return plantablePolygons;
}


/**
 * Processes environmental metric values and generates color mapping for SuperSplat
 * @param {string} metricName - Name of the environmental metric
 * @param {Object} geoJsonData - The GeoJSON data to search through
 * @returns {Object} - Object containing polygon color mappings and stats
 */
function processEnvironmentalMetricColors(metricName, geoJsonData) {
    const polygonColorMap = {};
    const parameterValues = [];

    // Find all plantable polygons and extract their metric values
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            const isPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'plantable' :
                false;

            if (isPlantable && feature.properties.name) {
                const boydData = window.parseBoydEcologicalData(feature.properties.description || '');
                const paramValue = boydData[metricName];

                if (paramValue && paramValue !== 'Unknown') {
                    const numericValue = window.parseParameterValue(paramValue, metricName);
                    parameterValues.push(numericValue);
                    polygonColorMap[feature.properties.name] = {
                        value: numericValue,
                        rawValue: paramValue
                    };
                }
            }
        }
    });

    // Calculate min/max for color scaling
    const minValue = parameterValues.length > 0 ? Math.min(...parameterValues) : 0;
    const maxValue = parameterValues.length > 0 ? Math.max(...parameterValues) : 1;

    // Generate colors using the existing Cesium color logic adapted for SuperSplat
    Object.keys(polygonColorMap).forEach(polygonName => {
        const data = polygonColorMap[polygonName];
        const normalized = maxValue > minValue ? (data.value - minValue) / (maxValue - minValue) : 0.5;

        let colorInfo;
        if (metricName === 'moisture') {
            // Use discrete moisture colors
            const moistureColors = [
                { r: 68, g: 1, b: 84 },    // viridis(0.1) - dry
                { r: 59, g: 82, b: 139 },  // viridis(0.3) - dry-moderate
                { r: 33, g: 145, b: 140 }, // viridis(0.5) - moderate
                { r: 94, g: 201, b: 98 },  // viridis(0.7) - moderate-wet
                { r: 253, g: 231, b: 37 }  // viridis(0.9) - wet
            ];
            const colorIndex = Math.round(normalized * 4);
            colorInfo = moistureColors[Math.min(colorIndex, 4)];
        } else {
            // Use continuous Viridis colormap for other metrics
            const viridisRgb = window.viridisColormap(normalized);
            colorInfo = {
                r: Math.round(viridisRgb[0] * 255),
                g: Math.round(viridisRgb[1] * 255),
                b: Math.round(viridisRgb[2] * 255)
            };
        }

        polygonColorMap[polygonName].color = colorInfo;
    });

    return {
        polygonColorMap,
        minValue,
        maxValue,
        totalPolygons: Object.keys(polygonColorMap).length
    };
}

/**
 * Selects environmental metrics and applies metric-based colors to plantable polygons
 * @param {string} metricName - Name of the environmental metric
 * @param {Object} geoJsonData - The GeoJSON data to search through
 */
function selectEnvironmentalMetric(metricName, geoJsonData) {
    // Note: clearAllPolygonSelections() is now handled by the click handlers
    // Set new environmental metric selection using unified structure
    setSelection(metricName, 'METRIC', geoJsonData);

    // Process environmental metric data and generate colors
    const metricData = processEnvironmentalMetricColors(metricName, geoJsonData);
    console.log(`🎯 Selected environmental metric "${metricName}" - processed ${metricData.totalPolygons} polygons (range: ${metricData.minValue.toFixed(2)} - ${metricData.maxValue.toFixed(2)})`);

    // Apply metric-based colors via SuperSplat
    if (window.superSplatScene && window.superSplatScene.events && metricData.totalPolygons > 0) {
        try {
            // Note: PA visibility is controlled by visibility toggle buttons only
            // Environmental metrics don't change group visibility
            console.log('🔹 Environmental metrics applied - visibility controlled by toggle buttons');

            // Group polygons by color to minimize SuperSplat calls
            const colorGroups = {};
            Object.keys(metricData.polygonColorMap).forEach(polygonName => {
                const colorInfo = metricData.polygonColorMap[polygonName].color;
                const colorKey = `${colorInfo.r},${colorInfo.g},${colorInfo.b}`;

                if (!colorGroups[colorKey]) {
                    colorGroups[colorKey] = {
                        polygons: [],
                        color: colorInfo
                    };
                }
                colorGroups[colorKey].polygons.push(polygonName);
            });

            // Apply colors to each group
            Object.keys(colorGroups).forEach(colorKey => {
                const group = colorGroups[colorKey];
                const hexColor = `#${group.color.r.toString(16).padStart(2, '0')}${group.color.g.toString(16).padStart(2, '0')}${group.color.b.toString(16).padStart(2, '0')}`;

                window.superSplatScene.events.invoke('triangleOverlay.selectEnvironmentalMetricPolygons',
                    group.polygons, hexColor);

                console.log(`🎨 Applied color ${hexColor} to ${group.polygons.length} polygons`);
            });

            // Create color legend for the environmental metric
            if (window.createColorLegend) {
                window.createColorLegend(metricName, metricData.minValue, metricData.maxValue);
                console.log(`📊 Created color legend for ${metricName} (${metricData.minValue.toFixed(2)} - ${metricData.maxValue.toFixed(2)})`);
            }

        } catch (error) {
            console.warn('Failed to apply environmental metric colors:', error);
        }
    } else if (metricData.totalPolygons === 0) {
        console.warn(`⚠️ No plantable polygons found with ${metricName} data`);
    }
}

/**
 * Closes other dropdowns and any focus views
 * @param {string} currentDropdown - The dropdown being opened ('plantable', 'nonplantable', 'metrics')
 */
function closeOtherDropdowns(currentDropdown) {
    // Close plantable areas if not current
    if (currentDropdown !== 'plantable') {
        const plantableToggle = document.getElementById('plantableAreasToggle');
        const plantableSubOptions = document.getElementById('plantableSubOptions');
        if (plantableToggle && plantableSubOptions) {
            plantableSubOptions.style.display = 'none';
            plantableToggle.classList.remove('expanded');

            // Clear any focus view and connection
            if (window.clearPAConnection) {
                window.clearPAConnection();
            }

            // Note: Do not automatically hide polygon groups when dropdowns close
            // Group visibility should only be controlled by individual area selections
        }
    }

    // Close non-plantable areas if not current
    if (currentDropdown !== 'nonplantable') {
        const nonPlantableToggle = document.getElementById('nonPlantableAreasToggle');
        const nonPlantableSubOptions = document.getElementById('nonPlantableSubOptions');
        if (nonPlantableToggle && nonPlantableSubOptions) {
            nonPlantableSubOptions.style.display = 'none';
            nonPlantableToggle.classList.remove('expanded');

            // Note: Do not automatically hide polygon groups when dropdowns close
            // Group visibility should only be controlled by individual area selections
        }
    }

    // Close ecological metrics if not current
    if (currentDropdown !== 'metrics') {
        const ecologicalToggle = document.getElementById('ecologicalMetricsToggle');
        const metricsOptions = document.getElementById('metricsOptions');
        if (ecologicalToggle && metricsOptions) {
            metricsOptions.style.display = 'none';
            ecologicalToggle.classList.remove('expanded');

            // Remove color legend when closing metrics dropdown
            if (window.layerState.selectedGroupType === 'METRIC') {
                removeColorLegend();
            }
        }
    }

    // Note: Polygons are no longer deselected when switching dropdowns
    // Selection state is maintained until group visibility changes
}

/**
 * Automatically loads site data for the SuperSplat application
 * This bypasses the need for site selection dropdown
 */
async function autoLoadSiteData() {
    try {
        console.log('🏠 AUTO-LOAD: Starting site data auto-load...');

        // Check if data is already loaded
        if (window.currentSiteData) {
            console.log('✅ AUTO-LOAD: Site data already loaded, skipping...');
            return true;
        }

        // Use the same loading logic as the original loadSiteData function
        const dataUrl = window.TerrainConfig ?
            window.TerrainConfig.getDataUrl('scott-boyd-residence/Boyd_Residence_Aerial_and_Ground.geojson') :
            '/data/scott-boyd-residence/Boyd_Residence_Aerial_and_Ground.geojson';

        console.log('🔗 AUTO-LOAD: Fetching from URL:', dataUrl);

        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }

        const geoJsonData = await response.json();
        console.log('✅ AUTO-LOAD: Successfully loaded GeoJSON data:', {
            features: geoJsonData.features?.length || 0,
            firstFeature: geoJsonData.features?.[0]?.properties?.name || 'Unknown',
            sampleFeatures: geoJsonData.features?.slice(0, 3).map(f => f.properties?.name || 'Unnamed')
        });

        // Store the data globally (same as site selection would do)
        window.currentSiteData = geoJsonData;
        console.log('✅ AUTO-LOAD: Stored as window.currentSiteData');

        // Store current site info for future reference
        window.currentSiteInfo = {
            name: 'Winter Garden Residence',
            filename: 'Boyd_Residence_Aerial_and_Ground.geojson',
            id: 'scott-boyd-residence',
            bounds: window.calculateBounds ? window.calculateBounds(geoJsonData) : null
        };

        console.log('🗂️ AUTO-LOAD: Site info stored:', window.currentSiteInfo);

        // Trigger the detection system
        if (window.detectGeoJsonFormat) {
            const format = window.detectGeoJsonFormat(geoJsonData.features[0]);
            console.log('🔍 AUTO-LOAD: Detected format:', format);
        }

        return true;

    } catch (error) {
        console.error('❌ AUTO-LOAD: Failed to auto-load site data:', error);
        return false;
    }
}

/**
 * Initializes the layer control system
 */
function initializeLayerControls() {
    console.log('🎯 INIT-CONTROLS: initializeLayerControls() called');

    const layerControls = document.getElementById('layerControls');
    if (!layerControls) {
        console.error('❌ INIT-CONTROLS: Layer controls element not found!');
        return;
    }

    // Prevent duplicate initialization
    if (layerControls.dataset.initialized === 'true') {
        console.log('⚠️ INIT-CONTROLS: Layer controls already initialized, skipping...');
        return;
    }
    layerControls.dataset.initialized = 'true';
    console.log('✅ INIT-CONTROLS: Layer controls marked as initialized');

    // Initialize layer state if not already initialized
    if (!window.layerState) {
        window.layerState = {
            showPlantableAreas: true,
            showNonPlantableAreas: true, // Match SuperSplat default: both PA and NPA visible

            // Unified selection structure
            selectedGroup: null,
            selectedGroupType: null,
            selectedPolygons: [],

            // Categorization data
            npaCategories: new Map(),
            paCategories: new Map(),
            categorizedPAs: new Map()
        };
    }

    // Set up controls and initialize state after a brief delay to ensure DOM is ready
    setTimeout(async () => {
        // Auto-load site data if not available
        if (!window.currentSiteData) {
            console.log('🎨 Auto-loading site data...');
            const loadSuccess = await autoLoadSiteData();
            if (!loadSuccess) {
                console.error('❌ Failed to auto-load site data');
                return;
            }
        }

        // Check site data and format
        // Layer controls initialization logging removed for cleaner console output
        if (window.currentSiteData) {
            console.log('🔍 Found currentSiteData with features:', window.currentSiteData.features?.length || 0);
            const format = detectGeoJsonFormat(window.currentSiteData.features[0]);
            console.log('🔍 Detected format:', format);
            if (format === 'boyd') {
                console.log('✅ Boyd format detected - showing layer controls');
                document.getElementById('layerControls').style.display = 'block';
                analyzeNPACategories(window.currentSiteData);
                analyzePACategories(window.currentSiteData);
                // Initialize visibility button icons on startup
                updateVisibilityButtonIcons();
            } else {
                console.log('❌ Not Boyd format - layer controls hidden');
            }
        } else {
            console.log('❌ No currentSiteData available during initialization - setting up retry');
            // Try again later when data might be available
            let retryCount = 0;
            const maxRetries = 10;

            const retryDataCheck = async () => {
                retryCount++;
                console.log(`🔄 Retry ${retryCount}/${maxRetries} - checking for currentSiteData`);

                // If still no data, try auto-loading again
                if (!window.currentSiteData && retryCount <= 3) {
                    console.log('🔄 Attempting auto-load on retry...');
                    await autoLoadSiteData();
                }

                if (window.currentSiteData) {
                    console.log('✅ Found currentSiteData on retry!', window.currentSiteData);
                    const format = detectGeoJsonFormat(window.currentSiteData.features[0]);
                    console.log('🔍 Detected format on retry:', format);
                    if (format === 'boyd') {
                        console.log('✅ Boyd format detected on retry - showing layer controls');
                        document.getElementById('layerControls').style.display = 'block';
                        analyzeNPACategories(window.currentSiteData);
                        analyzePACategories(window.currentSiteData);
                        // Initialize visibility button icons after retry setup
                        updateVisibilityButtonIcons();
                    }
                } else if (retryCount < maxRetries) {
                    setTimeout(retryDataCheck, 1000); // Retry every second
                } else {
                    console.error('❌ Failed to find currentSiteData after all retries');
                }
            };

            setTimeout(retryDataCheck, 1000);
        }
        
        // Then set up the controls
        setupPlantableAreaControls();
        setupNonPlantableAreaControls();
        setupEcologicalMetricsControls();

        // Set up visibility toggle buttons AFTER cloning to ensure handlers aren't lost
        setupVisibilityToggleButtons();

        // Finally, set initial state for plantable areas
        const plantableToggle = document.getElementById('plantableAreasToggle');
        const plantableSubOptions = document.getElementById('plantableSubOptions');
        if (plantableToggle && plantableSubOptions) {
            plantableToggle.classList.add('expanded');
            plantableSubOptions.style.display = 'block';
            window.layerState.showPlantableAreas = true;
            // Clear all polygon selections for "All" mode
            clearAllPolygonSelections();
            
            // Check the "All" radio button if it exists
            const allRadio = document.querySelector('input[name="plantableArea"][value="all"]');
            if (allRadio) {
                allRadio.checked = true;
            }
        }
        
        // Trigger initial polygon rendering
        if (window.currentSiteData) {
            reRenderPolygons();
        }

        // Note: Visibility button icons will be updated after GeoJSON polygons load
        // in SuperSplatBridge.js to match actual polygon visibility state
    }, 100);
}

/**
 * Sets up visibility toggle buttons for PA and NPA groups
 */
function setupVisibilityToggleButtons() {
    console.log('🔧 Setting up visibility toggle buttons');

    // PA visibility toggle
    const paVisibilityToggle = document.getElementById('paVisibilityToggle');
    console.log('🔧 PA visibility toggle found:', !!paVisibilityToggle, paVisibilityToggle);
    if (paVisibilityToggle) {
        paVisibilityToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent dropdown toggle
            e.stopImmediatePropagation(); // Prevent other handlers on same element
            console.log('PA visibility toggle clicked');

            // Toggle the state
            window.layerState.showPlantableAreas = !window.layerState.showPlantableAreas;

            // Update button image
            const img = paVisibilityToggle.querySelector('img');
            if (img) {
                img.src = window.layerState.showPlantableAreas ? '/images/visible.png' : '/images/invisible.png';
                img.alt = window.layerState.showPlantableAreas ? 'Visible' : 'Hidden';
            }

            // Update SuperSplat group visibility directly (no re-rendering needed)
            if (window.superSplatScene && window.superSplatScene.events) {
                console.log('🔄 Setting PA group visibility in SuperSplat:', window.layerState.showPlantableAreas);
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'plantable-areas', window.layerState.showPlantableAreas);
            } else {
                console.warn('⚠️ SuperSplat not available for visibility toggle');
            }

            // Remove UI objects when hiding PAs
            if (!window.layerState.showPlantableAreas) {
                // Remove focus panel if visible
                if (window.clearPAConnection) {
                    window.clearPAConnection();
                }

                // Remove color legend if visible (in case metric was selected via PA)
                const existingLegend = document.getElementById('colorLegend');
                if (existingLegend) {
                    existingLegend.remove();
                    console.log('🔹 Color legend removed (PA visibility toggled off)');
                }
            }

            console.log('PA visibility toggled:', window.layerState.showPlantableAreas);
        });

        // Initial state will be set after polygon loading completes
    }

    // NPA visibility toggle
    const npaVisibilityToggle = document.getElementById('npaVisibilityToggle');
    console.log('🔧 NPA visibility toggle found:', !!npaVisibilityToggle, npaVisibilityToggle);
    if (npaVisibilityToggle) {
        npaVisibilityToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent dropdown toggle
            e.stopImmediatePropagation(); // Prevent other handlers on same element
            console.log('NPA visibility toggle clicked');

            // Toggle the state
            window.layerState.showNonPlantableAreas = !window.layerState.showNonPlantableAreas;

            // Update button image
            const img = npaVisibilityToggle.querySelector('img');
            if (img) {
                img.src = window.layerState.showNonPlantableAreas ? '/images/visible.png' : '/images/invisible.png';
                img.alt = window.layerState.showNonPlantableAreas ? 'Visible' : 'Hidden';
            }

            // Update SuperSplat group visibility directly (no re-rendering needed)
            if (window.superSplatScene && window.superSplatScene.events) {
                console.log('🔄 Setting NPA group visibility in SuperSplat:', window.layerState.showNonPlantableAreas);
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'non-plantable-areas', window.layerState.showNonPlantableAreas);
            } else {
                console.warn('⚠️ SuperSplat not available for visibility toggle');
            }
            console.log('NPA visibility toggled:', window.layerState.showNonPlantableAreas);
        });

        // Initial state will be set after polygon loading completes
    }
}

/**
 * Updates visibility toggle button icons to match current layer state
 */
function updateVisibilityButtonIcons() {
    console.log('🔧 Updating visibility button icons to match current state');

    // Update PA visibility button icon
    const paVisibilityToggle = document.getElementById('paVisibilityToggle');
    if (paVisibilityToggle) {
        const img = paVisibilityToggle.querySelector('img');
        if (img) {
            const isVisible = window.layerState.showPlantableAreas;
            const newSrc = isVisible ? '/images/visible.png' : '/images/invisible.png';
            const newAlt = isVisible ? 'Visible' : 'Hidden';

            // Only update if different to prevent unnecessary flashing
            if (img.src !== location.origin + newSrc) {
                img.src = newSrc;
                img.alt = newAlt;
                console.log('👁️ PA button icon updated:', isVisible ? 'visible' : 'hidden');
            }
        } else {
            console.warn('⚠️ PA visibility toggle img not found');
        }
    } else {
        console.warn('⚠️ PA visibility toggle button not found');
    }

    // Update NPA visibility button icon
    const npaVisibilityToggle = document.getElementById('npaVisibilityToggle');
    if (npaVisibilityToggle) {
        const img = npaVisibilityToggle.querySelector('img');
        if (img) {
            const isVisible = window.layerState.showNonPlantableAreas;
            const newSrc = isVisible ? '/images/visible.png' : '/images/invisible.png';
            const newAlt = isVisible ? 'Visible' : 'Hidden';

            // Only update if different to prevent unnecessary flashing
            if (img.src !== location.origin + newSrc) {
                img.src = newSrc;
                img.alt = newAlt;
                console.log('👁️ NPA button icon updated:', isVisible ? 'visible' : 'hidden');
            }
        } else {
            console.warn('⚠️ NPA visibility toggle img not found');
        }
    } else {
        console.warn('⚠️ NPA visibility toggle button not found');
    }

    // Additional verification: log current state
    console.log('📊 Current visibility state - PA:', window.layerState.showPlantableAreas, '| NPA:', window.layerState.showNonPlantableAreas);
}

/**
 * Sets up plantable area controls
 */
function setupPlantableAreaControls() {
    const plantableToggle = document.getElementById('plantableAreasToggle');
    const plantableSubOptions = document.getElementById('plantableSubOptions');
    
    if (!plantableToggle || !plantableSubOptions) {
        console.error('Plantable area controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first by cloning
    const newToggle = plantableToggle.cloneNode(true);
    plantableToggle.parentNode.replaceChild(newToggle, plantableToggle);
    
    // Re-get the plantableSubOptions reference since the DOM structure might have changed
    const updatedSubOptions = document.getElementById('plantableSubOptions');
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Plantable Areas toggle clicked');
        const isExpanded = updatedSubOptions.style.display === 'block';
        console.log('Current expanded state:', isExpanded);
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('plantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            
            // Note: Polygon visibility controlled by visibility toggle buttons only

            // Remove color legend when opening PA dropdown if metrics were active
            if (window.layerState.selectedGroupType === 'METRIC') {
                removeColorLegend();
            }
            
            // Reset any selected radio but restore current selection if active
            document.querySelectorAll('input[name="plantableArea"]').forEach(r => {
                r.checked = (r.value === window.uiToggleState.currentSelectedGroup && window.uiToggleState.currentSelectedGroupType === 'PA');
            });
        } else {
            // Closing dropdown
            updatedSubOptions.style.display = 'none';
            this.classList.remove('expanded');
            
            // Note: Polygon visibility controlled by visibility toggle buttons only
            // Hide focus panel and clear connection when closing dropdown
            if (window.clearPAConnection) {
                window.clearPAConnection();
            }
        }
        
        // Skip reRenderPolygons() to prevent re-rendering that clears selection state
        // setTimeout(() => reRenderPolygons(), 50); // Commented out - causes unwanted re-renders
    });
}

/**
 * Sets up non-plantable area controls
 */
function setupNonPlantableAreaControls() {
    const nonPlantableToggle = document.getElementById('nonPlantableAreasToggle');
    const nonPlantableSubOptions = document.getElementById('nonPlantableSubOptions');
    
    if (!nonPlantableToggle || !nonPlantableSubOptions) {
        console.error('Non-plantable area controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first by cloning
    const newToggle = nonPlantableToggle.cloneNode(true);
    nonPlantableToggle.parentNode.replaceChild(newToggle, nonPlantableToggle);
    
    // Re-get the nonPlantableSubOptions reference since the DOM structure might have changed
    const updatedSubOptions = document.getElementById('nonPlantableSubOptions');
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Non-Plantable Areas toggle clicked');
        const isExpanded = updatedSubOptions.style.display === 'block';
        console.log('Current expanded state:', isExpanded);
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('nonplantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            
            // Note: Polygon visibility controlled by visibility toggle buttons only

            // Remove color legend when opening NPA dropdown if metrics were active
            if (window.layerState.selectedGroupType === 'METRIC') {
                removeColorLegend();
            }
            
            // Reset any selected radio but restore current selection if active
            document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => {
                r.checked = (r.value === window.uiToggleState.currentSelectedGroup && window.uiToggleState.currentSelectedGroupType === 'NPA');
            });
        } else {
            // Closing dropdown
            updatedSubOptions.style.display = 'none';
            this.classList.remove('expanded');
            
            // Note: Polygon visibility controlled by visibility toggle buttons only
        }
        
        // Skip reRenderPolygons() to prevent re-rendering that clears selection state
        // setTimeout(() => reRenderPolygons(), 50); // Commented out - causes unwanted re-renders
    });
}

/**
 * Sets up ecological metrics controls
 */
function setupEcologicalMetricsControls() {
    const ecologicalToggle = document.getElementById('ecologicalMetricsToggle');
    const metricsOptions = document.getElementById('metricsOptions');
    
    if (!ecologicalToggle || !metricsOptions) {
        console.error('Ecological metrics controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first
    const newToggle = ecologicalToggle.cloneNode(true);
    ecologicalToggle.parentNode.replaceChild(newToggle, ecologicalToggle);
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        const isExpanded = metricsOptions.style.display === 'block';
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('metrics');
            
            // Show this dropdown
            metricsOptions.style.display = 'block';
            newToggle.classList.add('expanded');

            // Restore current environmental metric selection visual state
            document.querySelectorAll('input[name="metric"]').forEach(r => {
                r.checked = (r.value === window.uiToggleState.currentSelectedGroup && window.uiToggleState.currentSelectedGroupType === 'METRIC');
            });
        } else {
            // Closing dropdown
            metricsOptions.style.display = 'none';
            newToggle.classList.remove('expanded');
        }
    });
    
    // Metric radio buttons with toggle functionality
    document.querySelectorAll('input[name="metric"]').forEach(radio => {
        radio.addEventListener('click', function(event) {
            // Simple toggle logic: if already checked, uncheck and deselect
            if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'METRIC') {
                this.checked = false;
                window.uiToggleState.currentSelectedGroup = null;
                window.uiToggleState.currentSelectedGroupType = null;
                clearAllPolygonSelections();
                return;
            }

            // New selection: clear all previous selections first
            clearAllPolygonSelections();
            window.uiToggleState.currentSelectedGroup = this.value;
            window.uiToggleState.currentSelectedGroupType = 'METRIC';

            // Clear focus panel when switching to environmental metrics
            if (window.clearPAConnection) {
                window.clearPAConnection();
            }

            // Re-check this button since clearAllPolygonSelections() unchecked it
            this.checked = true;

            selectEnvironmentalMetric(this.value, window.currentSiteData);

            // Deselect other layer radio buttons (but don't change visibility)
            document.querySelectorAll('input[name="plantableArea"]').forEach(r => r.checked = false);
            document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => r.checked = false);
        });
    });
}

/**
 * Analyzes GeoJSON to extract PA categories
 */
function analyzePACategories(geoJsonData) {
    // PA categories analysis initialization logging removed for cleaner console output
    // Total features analysis logging removed for cleaner console output
    
    const categories = new Map();
    const categorizedPAs = new Map(); // Map of category -> array of PAs
    
    if (!geoJsonData || !geoJsonData.features) {
        console.error('❌ No geoJsonData or features provided to analyzePACategories');
        return;
    }
    
    let paFeatureCount = 0;
    geoJsonData.features.forEach((feature, index) => {
        // Feature parsing logging removed for cleaner console output
        
        if (feature.properties.name && feature.properties.name.includes('PA') && !feature.properties.name.includes('NPA')) {
            paFeatureCount++;
            // PA feature discovery logging removed for cleaner console output
            
            // Found PA feature
            const parsed = parseBoydName(feature.properties.name);
            // PA name parsing logging removed for cleaner console output
            
            const name = parsed.description || parsed.id;
            if (name && !categories.has(name)) {
                const categoryData = {
                    number: parsed.number,
                    category: categorizePADescription(parsed.description)
                };
                categories.set(name, categoryData);
                // PA category addition logging removed for cleaner console output
            }
        }
    });
    
    // Group by category
    categories.forEach((data, name) => {
        const category = data.category;
        if (!categorizedPAs.has(category)) {
            categorizedPAs.set(category, []);
        }
        categorizedPAs.get(category).push({ name, data });
    });
    
    // Sort PAs within each category by number
    categorizedPAs.forEach((pas, category) => {
        pas.sort((a, b) => a.data.number - b.data.number);
    });
    
    window.layerState.paCategories = categories;
    window.layerState.categorizedPAs = categorizedPAs;
    // Calling populatePACategories
    populatePACategories(categories, categorizedPAs);
}

/**
 * Populates PA category checkboxes
 */
function populatePACategories(categories, categorizedPAs) {
    // PA categories population logging removed for cleaner console output
    // PA categories and data logging removed for cleaner console output
    
    const container = document.getElementById('plantableSubOptions');
    if (!container) {
        console.error('❌ plantableSubOptions container not found!');
        return;
    }
    
    // Container clearing logging removed for cleaner console output
    container.innerHTML = '';
    
    if (!categories || categories.size === 0) {
        console.error('❌ No categories provided to populatePACategories');
        container.innerHTML = '<div style="color: white; padding: 10px;">No plantable areas found in data</div>';
        return;
    }
    
    if (!categorizedPAs || categorizedPAs.size === 0) {
        console.error('❌ No categorizedPAs provided to populatePACategories');
        container.innerHTML = '<div style="color: white; padding: 10px;">No categorized areas found</div>';
        return;
    }
    
    // Define category order
    const categoryOrder = [
        'Foundations',
        'Perimeter Areas',
        'Forested & Semi-Forested',
        'Garden & Landscaped Areas',
        'Other Areas'
    ];
    
    let paIndex = 1; // Start numbering from 1
    
    // Create groups for each category
    categoryOrder.forEach(categoryName => {
        if (!categorizedPAs.has(categoryName)) return;
        
        const group = document.createElement('div');
        group.className = 'pa-category-group';
        
        const title = document.createElement('div');
        title.className = 'pa-category-group-title';
        title.textContent = categoryName;
        group.appendChild(title);
        
        const pas = categorizedPAs.get(categoryName);

        pas.forEach(({ name, data }) => {
            const label = document.createElement('label');
            label.className = 'pa-category';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'plantableArea';
            radio.value = name;

            // No need for hidden radio anymore since we have "All" option

            const number = document.createElement('span');
            number.className = 'pa-number';
            number.textContent = `#${paIndex}`;
            paIndex++;

            const text = document.createElement('span');
            text.textContent = name;
            text.title = name; // Show full text on hover if truncated

            label.appendChild(radio);
            label.appendChild(number);
            label.appendChild(text);

            radio.addEventListener('click', function(event) {
                console.log(`🔧 PA CLICK: "${this.value}", currentSelected: "${window.uiToggleState.currentSelectedGroup}", type: "${window.uiToggleState.currentSelectedGroupType}", checked: ${this.checked}`);

                // Simple toggle logic: if already checked, uncheck and deselect
                // BUT: Don't toggle off if this click was triggered by a polygon click
                if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'PA' && !window.isPolygonTriggeredClick) {
                    console.log(`🔧 TOGGLING OFF: "${this.value}"`);
                    this.checked = false;
                    window.uiToggleState.currentSelectedGroup = null;
                    window.uiToggleState.currentSelectedGroupType = null;

                    // Remove focus panel if visible
                    if (window.clearPAConnection) {
                        window.clearPAConnection();
                    }

                    clearAllPolygonSelections();
                    return;
                } else if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'PA' && window.isPolygonTriggeredClick) {
                    console.log(`🔵 POLYGON-TRIGGERED CLICK: Keeping "${this.value}" selected, ensuring visual selection`);
                    // Re-trigger selection to ensure visual state is applied
                    selectPAArea(name, window.currentSiteData);
                    return;
                }

                // New selection: clear all previous selections first
                console.log(`🔧 NEW SELECTION: "${this.value}"`);
                clearAllPolygonSelections();
                window.uiToggleState.currentSelectedGroup = this.value;
                window.uiToggleState.currentSelectedGroupType = 'PA';

                // Use the new helper function to select PA area and its polygons
                selectPAArea(name, window.currentSiteData);

                // Deselect ecological metrics and NPAs
                if (window.layerState.selectedGroupType === 'METRIC') {
                    clearAllPolygonSelections();
                    document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
                }
                if (window.layerState.selectedGroupType === 'NPA') {
                    clearAllPolygonSelections();
                }

                // Deselect any NPA radio buttons (but don't change visibility)
                document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => r.checked = false);

                // Show plantable areas group and select all polygons for this PA in SuperSplat
                if (window.superSplatScene && window.superSplatScene.events) {
                    try {
                        // Note: PA visibility is controlled by visibility toggle buttons only
                        // This PA selection does not change group visibility
                        console.log('🔹 PA selection made - visibility controlled by toggle buttons');

                        // Select all polygons for this PA area
                        const selectedPolygons = window.layerState.selectedPolygons || [];
                        if (selectedPolygons.length > 0) {
                            window.superSplatScene.events.invoke('triangleOverlay.selectPolygonArea', selectedPolygons);
                            console.log(`🎯 SuperSplat PA area "${name}" selected (${selectedPolygons.length} polygons)`);
                        }
                    } catch (error) {
                        console.warn('Failed to select SuperSplat PA polygons:', error);
                    }
                }

                // Trigger focus panel animation for the selected PA
                if (window.focusPanel && window.currentSiteData) {
                    const paFeature = window.currentSiteData.features.find(f => {
                        const parsed = parseBoydName(f.properties.name);
                        return (parsed.description || parsed.id) === name;
                    });
                    if (paFeature) {
                        console.log(`🎬 Triggering focus panel animation for PA: ${name}`);
                        updateSelectedPAHighlight(name);
                        orchestrateFocusAnimation(label, name, paFeature);
                    }
                }

                // Skip reRenderPolygons() to preserve SuperSplat polygon selection state
                // reRenderPolygons(); // Commented out - this was clearing selection state
                // Zoom to the selected PA
                zoomToFeature(name, 'PA');

                // Note: Focus panel animation is already triggered above in the radio button handler
            });
            
            group.appendChild(label);
        });
        
        container.appendChild(group);
    });
}

/**
 * Analyzes GeoJSON to extract NPA categories
 */
function analyzeNPACategories(geoJsonData) {
    // analyzeNPACategories called
    const categories = new Map();
    
    geoJsonData.features.forEach(feature => {
        if (feature.properties.name && feature.properties.name.includes('NPA')) {
            // Found NPA feature
            const category = extractNPACategory(feature.properties.name);
            if (category && !categories.has(category)) {
                categories.set(category, true);
            }
        }
    });
    
    // Found NPA categories
    window.layerState.npaCategories = categories;
    populateNPACategories(categories);
}

/**
 * Parses Boyd format name to extract ID and description
 * @param {string} name - Feature name like 'PA1="Southeast Front Door Entrance"'
 * @returns {Object} - {id, description, number}
 */
function parseBoydName(name) {
    // Extract PA/NPA number and description
    // Handle both single and double quotes
    const match = name.match(/((?:N)?PA)(\d+)(?:=[\"']([^\"']+)[\"'])?/);
    if (match) {
        const prefix = match[1];
        const number = match[2];
        let description = match[3] || '';
        
        // If no description in quotes, check if there's an equals sign without quotes
        if (!description && name.includes('=')) {
            const parts = name.split('=');
            if (parts.length > 1) {
                description = parts[1].trim();
            }
        }
        
        // If still no description, use the full name
        if (!description) {
            description = name;
        }
        
        return {
            id: `${prefix}${number}`,
            description: description,
            number: parseInt(number)
        };
    }
    
    // For names that don't match the pattern (like "Southeast Front Door Entrance"),
    // return the name as both id and description
    return { id: name, description: name, number: 0 };
}

/**
 * Categorizes plantable areas based on their descriptions
 * @param {string} description - PA description
 * @returns {string} - Category name
 */
function categorizePADescription(description) {
    const desc = description.toLowerCase();
    
    // Forested & Semi-Forested
    if (desc.includes('forest') || desc.includes('tree') || desc.includes('canopy') || 
        desc.includes('woods') || desc.includes('grove')) {
        return 'Forested & Semi-Forested';
    }
    
    // Foundations - includes building-related areas and specific locations
    if (desc.includes('foundation') || desc.includes('building') || desc.includes('house') || 
        desc.includes('structure') || desc.includes('wall') || desc.includes('door') || 
        desc.includes('entrance') || desc.includes('window') || desc.includes('northside') ||
        desc.includes('southside') || desc.includes('pool') || desc.includes('backyard')) {
        return 'Foundations';
    }
    
    // Perimeter Areas
    if (desc.includes('perimeter') || desc.includes('boundary') || desc.includes('edge') || 
        desc.includes('fence') || desc.includes('property line') || desc.includes('border')) {
        return 'Perimeter Areas';
    }
    
    // Garden & Landscaped Areas - now includes lawn areas
    if (desc.includes('garden') || desc.includes('bed') || desc.includes('planting') || 
        desc.includes('landscape') || desc.includes('ornamental') || desc.includes('lawn') || 
        desc.includes('grass') || desc.includes('turf')) {
        return 'Garden & Landscaped Areas';
    }
    
    // Default - includes driveway areas and other uncategorized areas
    return 'Other Areas';
}

/**
 * Extracts NPA category from name
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
 * Populates NPA category radio buttons
 */
function populateNPACategories(categories) {
    const container = document.getElementById('nonPlantableSubOptions');
    container.innerHTML = '';
    
    let npaIndex = 1;
    categories.forEach((metadata, category) => {
        const label = document.createElement('label');
        label.className = 'npa-category';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'nonPlantableArea';
        radio.value = category;
        
        const number = document.createElement('span');
        number.className = 'pa-number';
        number.textContent = `#${npaIndex}`;
        npaIndex++;
        
        const text = document.createElement('span');
        text.textContent = category;
        
        label.appendChild(radio);
        label.appendChild(number);
        label.appendChild(text);
        
        radio.addEventListener('click', function(event) {
            // Simple toggle logic: if already checked, uncheck and deselect
            // BUT: Don't toggle off if this click was triggered by a polygon click
            if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'NPA' && !window.isPolygonTriggeredClick) {
                this.checked = false;
                window.uiToggleState.currentSelectedGroup = null;
                window.uiToggleState.currentSelectedGroupType = null;
                clearAllPolygonSelections();
                return;
            } else if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'NPA' && window.isPolygonTriggeredClick) {
                console.log(`🔵 POLYGON-TRIGGERED NPA CLICK: Keeping "${this.value}" selected, ensuring visual selection`);
                // Re-trigger selection to ensure visual state is applied
                selectNPACategory(category, window.currentSiteData);
                return;
            }

            // New selection: clear all previous selections first
            clearAllPolygonSelections();
            window.uiToggleState.currentSelectedGroup = this.value;
            window.uiToggleState.currentSelectedGroupType = 'NPA';

            // Use the new helper function to select NPA category and its polygons
            selectNPACategory(category, window.currentSiteData);

            // Deselect ecological metrics and PAs
            if (window.layerState.selectedGroupType === 'METRIC') {
                clearAllPolygonSelections();
                document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
            }
            if (window.layerState.selectedGroupType === 'PA') {
                clearAllPolygonSelections();
            }

            // Deselect any PA radio buttons (but don't change visibility)
            document.querySelectorAll('input[name="plantableArea"]').forEach(r => r.checked = false);

            // Show non-plantable areas group and select first polygon in this category
            if (window.superSplatScene && window.superSplatScene.events && window.currentSiteData) {
                try {
                    // Note: NPA visibility is controlled by visibility toggle buttons only
                    // This NPA selection does not change group visibility
                    console.log('🔹 NPA selection made - visibility controlled by toggle buttons');

                    // Find first NPA in this category for selection
                    const npaFeatures = window.currentSiteData.features.filter(f => {
                        if (!f.properties.name || !f.properties.name.includes('NPA')) return false;
                        const extractedCategory = extractNPACategory(f.properties.name);
                        return extractedCategory === category;
                    });

                    // Select all polygons for this NPA category
                    const selectedPolygons = window.layerState.selectedPolygons || [];
                    if (selectedPolygons.length > 0) {
                        window.superSplatScene.events.invoke('triangleOverlay.selectPolygonArea', selectedPolygons);
                        console.log(`🎯 SuperSplat NPA category "${category}" selected (${selectedPolygons.length} polygons)`);
                    }
                } catch (error) {
                    console.warn('Failed to show/select SuperSplat NPA polygons:', error);
                }
            }

            // Note: NPAs do not show flyouts as they don't have environmental metrics

            // Zoom to all features in this NPA category
            zoomToNPACategory(category);
        });
        
        container.appendChild(label);
    });
}

/**
 * Re-renders all polygons with current layer state
 * Sets parameter filters and triggers full polygon re-rendering via SuperSplat
 */
function reRenderPolygons() {
    // Apply appropriate settings based on active layers
    if (window.layerState.selectedGroupType === 'METRIC' && window.layerState.selectedGroup) {
        // Use ecological metrics settings
        window.currentParameterFilter = window.layerState.selectedGroup;
        // Force show plantable areas for metrics visualization
        window.layerState.temporaryShowPlantable = true;
    } else {
        window.currentParameterFilter = null;
        window.layerState.temporaryShowPlantable = false;
    }

    // Re-render polygons with current settings
    if (window.currentSiteData && window.superSplatBridge) {
        window.superSplatBridge.renderGeoJSONPolygons(window.currentSiteData);
    }
}


/**
 * Initialize layer controls based on site data format
 * Shows/hides layer controls and analyzes PA/NPA categories for Boyd format sites
 */
function initializeLayerControlsForSite(format) {
    console.log(`🔧 Initializing layer controls for format: ${format}`);
    const layerControls = document.getElementById('layerControls');

    if (format === 'boyd') {
        layerControls.style.display = 'block';
        // Analyze PA and NPA categories for this site
        if (window.currentSiteData) {
            console.log('📊 Analyzing PA/NPA categories for Boyd format site');
            analyzePACategories(window.currentSiteData);
            analyzeNPACategories(window.currentSiteData);
        } else {
            console.log('⚠️ No currentSiteData available for PA/NPA analysis');
        }

        // Ensure plantable areas checkbox is checked
        const plantableToggle = document.getElementById('plantableAreasToggle');
        if (plantableToggle && !plantableToggle.checked) {
            plantableToggle.checked = true;
            document.getElementById('plantableSubOptions').style.display = 'block';
        }
    } else {
        layerControls.style.display = 'none';
        console.log('📊 Resetting layer state for non-Boyd format site');
        // Reset layer state
        window.layerState = {
            showPlantableAreas: false,
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
    }
}

/**
 * Calculate polygon center and bounding information for camera positioning
 * @param {string} featureName - Name of the feature to analyze
 * @param {string} featureType - 'PA' or 'NPA'
 * @returns {Object|null} - Object with center coordinates and radius, or null if not found
 */
function calculatePolygonBounds(featureName, featureType) {
    if (!window.currentSiteData) {
        console.warn('⚠️ No site data available for polygon bounds calculation');
        return null;
    }

    // Find the feature in the GeoJSON data
    const feature = window.currentSiteData.features.find(f => {
        if (!f.properties.name) return false;
        const parsed = parseBoydName(f.properties.name);
        const name = parsed.description || parsed.id;
        return name === featureName;
    });

    if (!feature || feature.geometry.type !== 'Polygon') {
        console.warn(`⚠️ Feature "${featureName}" not found or not a polygon`);
        return null;
    }

    return calculatePolygonCenterAndRadius(feature.geometry.coordinates[0]);
}

/**
 * Calculate center point and radius for a set of coordinates using geographic calculations
 * @param {Array} coords - Array of [lng, lat] coordinate pairs
 * @returns {Object} - Object with centerLat, centerLng, and radius properties
 */
function calculatePolygonCenterAndRadius(coords) {
    // Calculate polygon center (centroid)
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => {
        const [lng, lat] = coord;
        sumLat += lat;
        sumLng += lng;
    });
    const centerLat = sumLat / coords.length;
    const centerLng = sumLng / coords.length;

    // Calculate maximum distance between any two vertices using Haversine formula
    let maxDistance = 0;
    for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
            const distance = calculateHaversineDistance(coords[i], coords[j]);
            maxDistance = Math.max(maxDistance, distance);
        }
    }
    const radius = maxDistance / 2;

    return {
        centerLat,
        centerLng,
        radius,
        vertexCount: coords.length
    };
}

/**
 * Calculate great circle distance between two lat/lng points using Haversine formula
 * @param {Array} coord1 - [lng, lat] of first point
 * @param {Array} coord2 - [lng, lat] of second point
 * @returns {number} - Distance in meters
 */
function calculateHaversineDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// TODO: Implement SuperSplat camera positioning
// This function previously used Cesium for camera control - needs SuperSplat integration
function zoomToFeature(featureName, featureType) {
    const bounds = calculatePolygonBounds(featureName, featureType);
    if (!bounds) return;

    console.log(`🎯 [TODO] SuperSplat zoom to feature "${featureName}":`, {
        center: { lat: bounds.centerLat, lng: bounds.centerLng },
        radius: bounds.radius
    });

    // TODO: Integrate with SuperSplat camera controls
    // See SUPERSPLAT_REFACTOR.md for implementation details
}

/**
 * Calculate bounds for all features in an NPA category
 * @param {string} categoryName - Name of the NPA category to analyze
 * @returns {Object|null} - Object with center coordinates and radius, or null if not found
 */
function calculateNPACategoryBounds(categoryName) {
    if (!window.currentSiteData) {
        console.warn('⚠️ No site data available for NPA category bounds calculation');
        return null;
    }

    // Find all features that belong to this NPA category
    const npaFeatures = window.currentSiteData.features.filter(f => {
        if (!f.properties.name || !f.properties.name.includes('NPA')) return false;
        const category = extractNPACategory(f.properties.name);
        return category === categoryName;
    });

    if (npaFeatures.length === 0) {
        console.warn(`⚠️ No features found for NPA category "${categoryName}"`);
        return null;
    }

    // Collect all coordinates from all features
    const allCoords = [];
    npaFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                allCoords.push(coord);
            });
        }
    });

    if (allCoords.length === 0) {
        console.warn(`⚠️ No valid polygon coordinates found for NPA category "${categoryName}"`);
        return null;
    }

    const bounds = calculatePolygonCenterAndRadius(allCoords);
    return {
        ...bounds,
        featureCount: npaFeatures.length
    };
}

// TODO: Implement SuperSplat camera positioning for NPA categories
// This function previously used Cesium for camera control - needs SuperSplat integration
function zoomToNPACategory(categoryName) {
    const bounds = calculateNPACategoryBounds(categoryName);
    if (!bounds) return;

    console.log(`🎯 [TODO] SuperSplat zoom to NPA category "${categoryName}":`, {
        center: { lat: bounds.centerLat, lng: bounds.centerLng },
        radius: bounds.radius,
        features: bounds.featureCount
    });

    // TODO: Integrate with SuperSplat camera controls
    // See SUPERSPLAT_REFACTOR.md for implementation details
}

// Expose layer controls initialization function globally
window.initializeLayerControlsForSite = initializeLayerControlsForSite;

// Layer controls are initialized from the main SuperSplat initialization
// No automatic initialization here - controlled by main app flow

/**
 * Updates the selected PA visual highlight
 * @param {string} selectedName - Name of selected PA
 */
function updateSelectedPAHighlight(selectedName) {
    // Remove previous selections and dynamic styles
    document.querySelectorAll('.pa-category.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Remove any existing dynamic style
    const existingStyle = document.getElementById('selected-pa-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Add selection to current PA
    const labels = document.querySelectorAll('.pa-category');
    labels.forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio && radio.value === selectedName) {
            label.classList.add('selected');
            
            // Create dynamic style for the oval border positioning
            const rect = label.getBoundingClientRect();
            const style = document.createElement('style');
            style.id = 'selected-pa-style';
            style.textContent = `
                .pa-category.selected::before {
                    left: ${rect.left - 4}px;
                    top: ${rect.top - 4}px;
                    width: ${rect.width + 8}px;
                    height: ${rect.height + 8}px;
                }
            `;
            document.head.appendChild(style);
        }
    });
}

// Global state for animation management
let currentAnimationState = {
    selectedLabel: null,
    selectedPA: null,
    isAnimating: false,
    animationTimeline: null
};

/**
 * Orchestrates the complete focus panel animation sequence
 * @param {HTMLElement} label - The PA label that was clicked
 * @param {string} paName - The name of the PA
 * @param {Object} paFeature - The GeoJSON feature data
 */
function orchestrateFocusAnimation(label, paName, paFeature) {
    // If currently animating, queue this after current animation
    if (currentAnimationState.isAnimating) {
        // First reverse current animation
        reverseCurrentAnimation(() => {
            // Then start new animation
            startFocusAnimation(label, paName, paFeature);
        });
    } else if (currentAnimationState.selectedLabel && currentAnimationState.selectedLabel !== label) {
        // If different PA selected, reverse current then start new
        reverseCurrentAnimation(() => {
            startFocusAnimation(label, paName, paFeature);
        });
    } else {
        // Fresh start
        startFocusAnimation(label, paName, paFeature);
    }
}

/**
 * Starts the focus animation sequence
 */
function startFocusAnimation(label, paName, paFeature) {
    currentAnimationState.isAnimating = true;
    currentAnimationState.selectedLabel = label;
    currentAnimationState.selectedPA = paName;
    
    // Ensure the label has the selected class for the oval to appear
    label.classList.add('selected');
    
    // Wait for oval to render (CSS transition time)
    setTimeout(() => {
        // Check if animation was cancelled while we were waiting
        if (currentAnimationState.selectedLabel !== label || currentAnimationState.selectedPA !== paName) {
            console.log('🚫 Animation cancelled during setTimeout - aborting');
            return;
        }

        // Phase 1: Extend connection line
        createAnimatedConnectionLine(label, () => {
            console.log('🔗 Connection line animation completed, starting vertical edge...');
            // Phase 2: Create vertical edge line
            createVerticalEdge(() => {
                console.log('📏 Vertical edge animation completed, expanding to focus panel...');
                // Phase 3: Expand edge to oval and reveal content
                expandToFocusPanel(paName, paFeature, () => {
                    console.log('📋 Focus panel expansion completed');
                    currentAnimationState.isAnimating = false;
                });
            });
        });
    }, 100); // Small delay to ensure oval CSS has rendered
}

/**
 * Reverses the current animation
 */
function reverseCurrentAnimation(callback) {
    if (!currentAnimationState.selectedLabel) {
        if (callback) callback();
        return;
    }
    
    currentAnimationState.isAnimating = true;
    
    // Phase 1: Collapse focus panel to edge
    collapseFocusPanel(() => {
        // Phase 2: Collapse vertical edge
        collapseVerticalEdge(() => {
            // Phase 3: Retract connection line
            retractConnectionLine(() => {
                currentAnimationState.selectedLabel = null;
                currentAnimationState.selectedPA = null;
                currentAnimationState.isAnimating = false;
                if (callback) callback();
            });
        });
    });
}

/**
 * Creates animated connection line extending from PA label
 */
function createAnimatedConnectionLine(paLabel, callback) {
    try {
        console.log('🔗 Creating animated connection line');
        
        const paRect = paLabel.getBoundingClientRect();
        const layerControlsPanel = document.getElementById('layerControls');
        const panelRect = layerControlsPanel.getBoundingClientRect();
        
        if (!paRect || !panelRect) {
            console.error('❌ Could not get bounding rects for connection line');
            if (callback) callback();
            return;
        }
    
    // The oval extends 4px outside the label bounds
    const ovalPadding = 4;
    const startY = paRect.top + paRect.height / 2;
    
    // The selected::before pseudo-element creates an oval that's 4px outside the PA label
    // For precise alignment, get the actual PA label position within the panel
    const labelOffsetFromPanel = paRect.left - panelRect.left;
    const ovalLeftEdge = paRect.left - ovalPadding;
    
    // Fixed connection line length - shorter for cleaner look
    const connectionLineLength = 40; // Reduced to 40px for better visual balance
    
    // Line position and dimensions
    const lineLeft = ovalLeftEdge - connectionLineLength;
    const lineWidth = connectionLineLength;
    
    // Create line element
    const line = document.createElement('div');
    line.className = 'connection-line animated';
    line.style.left = `${lineLeft}px`;
    line.style.top = `${startY - 1}px`; // Center on 2px height
    line.style.width = '0px';
    line.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    line.style.transformOrigin = 'right center'; // Grow from right edge (oval side)
    line.style.opacity = '1'; // Make sure it's visible
    line.style.background = 'white'; // Ensure white color
    line.style.height = '2px'; // Ensure height
    line.style.zIndex = '1002'; // Ensure it's above other elements
    
    document.body.appendChild(line);
    
    // Store reference for later phases
    currentAnimationState.connectionLine = line;
    currentAnimationState.lineEndX = lineLeft; // Where the line ends (left side)
    currentAnimationState.lineStartX = ovalLeftEdge; // Where the line starts (oval side)
    currentAnimationState.lineY = startY;
    
    console.log('Creating connection line:', {
        ovalLeftEdge,
        lineY: startY,
        lineLeft,
        lineWidth: connectionLineLength,
        lineEndX: lineLeft
    });
    
        // Animate line extension
        requestAnimationFrame(() => {
            try {
                if (line && line.parentNode) {
                    line.style.width = `${lineWidth}px`;
                }
                setTimeout(() => {
                    console.log('🔗 Connection line setTimeout callback executed, calling next phase...');
                    // Check if animation was cancelled during this phase
                    if (!currentAnimationState.selectedLabel) {
                        console.log('🚫 Connection line phase cancelled - aborting callback');
                        return;
                    }
                    if (callback) callback();
                }, 300);
            } catch (error) {
                console.error('❌ Error during connection line animation:', error);
                if (callback) callback();
            }
        });
        
    } catch (error) {
        console.error('❌ Error creating animated connection line:', error);
        if (callback) callback();
    }
}

/**
 * Creates vertical edge at the end of connection line
 */
function createVerticalEdge(callback) {
    console.log('📏 Creating vertical edge...');
    const edge = document.createElement('div');
    edge.className = 'focus-edge animated';
    edge.style.position = 'fixed';
    edge.style.left = `${currentAnimationState.lineEndX}px`; // Left end of connection line
    edge.style.top = `${currentAnimationState.lineY}px`;
    edge.style.width = '2px';
    edge.style.height = '0px';
    edge.style.background = 'white';
    edge.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    edge.style.zIndex = '999';
    
    document.body.appendChild(edge);
    currentAnimationState.verticalEdge = edge;
    
    // Animate edge expansion (from center outward)
    requestAnimationFrame(() => {
        const targetHeight = window.innerHeight - 200; // 100px margins
        edge.style.height = `${targetHeight}px`;
        edge.style.top = '100px';
        setTimeout(() => {
            console.log('📏 Vertical edge animation completed, calling next phase...');
            // Check if animation was cancelled during this phase
            if (!currentAnimationState.selectedLabel) {
                console.log('🚫 Vertical edge phase cancelled - aborting callback');
                return;
            }
            callback();
        }, 300);
    });
}

/**
 * Expands vertical edge into full focus panel
 */
function expandToFocusPanel(paName, paFeature, callback) {
    console.log('📋 Expanding to focus panel for PA:', paName);

    // Check if animation was cancelled before we start panel creation
    if (!currentAnimationState.selectedLabel || currentAnimationState.selectedPA !== paName) {
        console.log('🚫 Panel expansion cancelled - aborting');
        return;
    }

    // Remove the vertical edge
    if (currentAnimationState.verticalEdge) {
        currentAnimationState.verticalEdge.remove();
    }

    // Ensure focus panel exists (recreate if it was removed)
    if (!window.focusPanel.panel || !document.body.contains(window.focusPanel.panel)) {
        console.log('📋 Focus panel missing, initializing...');
        window.focusPanel.init();
    }

    // Get focus panel reference
    const panel = window.focusPanel.panel;
    console.log('📋 Panel reference:', panel ? 'Found' : 'NULL', 'isInDOM:', panel ? document.body.contains(panel) : false);

    if (!panel) {
        console.error('❌ Focus panel could not be created or found!');
        if (callback) callback();
        return;
    }

    // Temporarily remove visible class to prevent ghost appearance
    panel.classList.remove('visible');
    panel.classList.add('animating-in');
    
    // Position panel at the connection line end point
    // Panel width is 420px, so its right edge should be at lineEndX
    const panelWidth = 420;
    const panelLeft = currentAnimationState.lineEndX - panelWidth;

    console.log('📋 Panel positioning:', {
        lineEndX: currentAnimationState.lineEndX,
        panelWidth,
        panelLeft,
        windowWidth: window.innerWidth
    });

    // Hide panel initially to prevent position jump
    panel.style.visibility = 'hidden';
    panel.style.opacity = '1'; // Keep opacity for the scale animation

    // Override default CSS position temporarily - use !important to override CSS
    panel.style.setProperty('left', `${panelLeft}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.transition = 'none'; // Clear any existing transitions
    panel.style.transform = 'scaleX(0)';
    panel.style.transformOrigin = 'left center';

    console.log('📋 Panel computed styles:', {
        left: panel.style.left,
        right: panel.style.right,
        transform: panel.style.transform,
        visibility: panel.style.visibility,
        display: getComputedStyle(panel).display,
        position: getComputedStyle(panel).position
    });
    
    // Populate panel content without triggering visibility
    window.focusPanel.currentPA = paName;
    window.focusPanel.displayMetrics(paFeature);
    window.focusPanel.isVisible = true;
    
    // Update header
    const headerHTML = `
        <div>
            <h3 class="pa-name">${paName.toUpperCase()}</h3>
            <p class="pa-subtitle">Ecological Niche Metrics</p>
        </div>
        <button class="close-button" aria-label="Close panel">×</button>
    `;
    panel.querySelector('.focus-panel-header').innerHTML = headerHTML;
    
    // Re-attach close button listener to trigger full animation
    const closeBtn = panel.querySelector('.close-button');
    closeBtn.addEventListener('click', () => {
        if (window.clearPAConnection) {
            window.clearPAConnection();
        }
    });
    
    // Make panel visible and animate expansion in next frame
    requestAnimationFrame(() => {
        // Check if animation was cancelled during panel setup
        if (!currentAnimationState.selectedLabel || currentAnimationState.selectedPA !== paName) {
            console.log('🚫 Panel animation cancelled during setup - hiding panel');
            if (panel) {
                panel.classList.remove('visible', 'animating-in');
                panel.style.visibility = 'hidden';
                if (window.focusPanel) {
                    window.focusPanel.isVisible = false;
                }
            }
            return;
        }

        console.log('📋 Making panel visible and starting expansion...');
        panel.style.visibility = 'visible';
        panel.style.opacity = '1'; // Force opacity to 1 to override CSS
        panel.classList.add('visible'); // Add visible class now that positioning is set
        panel.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

        console.log('📋 Panel final pre-animation state:', {
            boundingRect: panel.getBoundingClientRect(),
            offsetWidth: panel.offsetWidth,
            offsetHeight: panel.offsetHeight,
            scrollWidth: panel.scrollWidth,
            scrollHeight: panel.scrollHeight
        });

        requestAnimationFrame(() => {
            // Check cancellation again before final animation
            if (!currentAnimationState.selectedLabel || currentAnimationState.selectedPA !== paName) {
                console.log('🚫 Panel animation cancelled before final transform - hiding panel');
                if (panel) {
                    panel.classList.remove('visible', 'animating-in');
                    panel.style.visibility = 'hidden';
                    if (window.focusPanel) {
                        window.focusPanel.isVisible = false;
                    }
                }
                return;
            }

            console.log('📋 Animating panel scale from 0 to 1...');
            panel.style.transform = 'scaleX(1)';

            // Log final state after transform
            setTimeout(() => {
                console.log('📋 Panel final post-animation state:', {
                    boundingRect: panel.getBoundingClientRect(),
                    finalTransform: getComputedStyle(panel).transform
                });
            }, 100);
        });

        setTimeout(() => {
            // Final check before completing animation
            if (!currentAnimationState.selectedLabel || currentAnimationState.selectedPA !== paName) {
                console.log('🚫 Panel animation cancelled during final timeout - hiding panel');
                if (panel) {
                    panel.classList.remove('visible', 'animating-in');
                    panel.style.visibility = 'hidden';
                    if (window.focusPanel) {
                        window.focusPanel.isVisible = false;
                    }
                }
                return;
            }

            panel.classList.remove('animating-in');
            // Reset animation properties but KEEP positioning fixes
            panel.style.transform = '';
            panel.style.transformOrigin = '';
            panel.style.transition = '';
            panel.style.visibility = '';
            // DON'T reset left/right - keep the !important positioning fixes
            if (callback) callback();
        }, 400);
    });
}

/**
 * Collapses focus panel back to edge
 */
function collapseFocusPanel(callback) {
    const panel = window.focusPanel.panel;
    if (!panel || (!panel.classList.contains('visible') && !panel.classList.contains('animating-in'))) {
        if (callback) callback();
        return;
    }
    
    // Remove visible class immediately to prevent ghost
    panel.classList.remove('visible');
    
    // Position panel at the connection line end point for collapse
    if (currentAnimationState.lineEndX) {
        const panelWidth = 420;
        const panelLeft = currentAnimationState.lineEndX - panelWidth;
        panel.style.left = `${panelLeft}px`;
        panel.style.right = 'auto';
    }
    
    panel.classList.add('animating-out');
    panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    panel.style.transformOrigin = 'right center';
    panel.style.transform = 'scaleX(0)';
    
    setTimeout(() => {
        // Call hide to update state
        window.focusPanel.hide();
        
        // Remove the panel element completely to prevent ghost
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
            window.focusPanel.panel = null; // Clear the reference
        }
        
        // Create vertical edge in its place
        createVerticalEdgeForCollapse(callback);
    }, 300);
}

/**
 * Creates vertical edge during collapse animation
 */
function createVerticalEdgeForCollapse(callback) {
    const edge = document.createElement('div');
    edge.className = 'focus-edge animated';
    edge.style.position = 'fixed';
    edge.style.left = `${currentAnimationState.lineEndX}px`; // Same position as expansion
    edge.style.top = '100px';
    edge.style.width = '2px';
    edge.style.height = `${window.innerHeight - 200}px`;
    edge.style.background = 'white';
    edge.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    edge.style.zIndex = '999';
    
    document.body.appendChild(edge);
    
    // Animate collapse
    requestAnimationFrame(() => {
        edge.style.height = '0px';
        edge.style.top = `${currentAnimationState.lineY}px`;
        
        setTimeout(() => {
            edge.remove();
            if (callback) callback();
        }, 300);
    });
}

/**
 * Collapses vertical edge (called from reverseCurrentAnimation)
 */
function collapseVerticalEdge(callback) {
    // Since we create the edge during collapse, we just call the callback
    // The actual edge collapse happens in createVerticalEdgeForCollapse
    if (callback) callback();
}

/**
 * Retracts connection line
 */
function retractConnectionLine(callback) {
    const line = currentAnimationState.connectionLine;
    if (!line) {
        if (callback) callback();
        return;
    }
    
    line.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    line.style.width = '0px';
    line.style.opacity = '0';
    
    setTimeout(() => {
        line.remove();
        currentAnimationState.connectionLine = null;
        
        // Clear PA selection highlight
        document.querySelectorAll('.pa-category.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (callback) callback();
    }, 300);
}


// Clean up connection when closing dropdown or deselecting
function clearPAConnection() {
    // Use the animation system if there's an active connection
    if (currentAnimationState.selectedLabel) {
        reverseCurrentAnimation();
    } else {
        // Direct cleanup for when no animation is tracked
        // First handle focus panel without triggering circular calls
        const panel = window.focusPanel?.panel;
        if (panel && window.focusPanel) {
            // Mark as animating-out to prevent focusPanel.hide() from calling clearPAConnection again
            panel.classList.add('animating-out');
            window.focusPanel.hide();
        }

        // Clean up connection line
        const line = document.querySelector('.connection-line');
        if (line) {
            line.classList.remove('visible');
            setTimeout(() => line.remove(), 500);
        }

        // Remove selected class
        document.querySelectorAll('.pa-category.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }
}

// Expose functions globally
window.autoLoadSiteData = autoLoadSiteData;
window.initializeLayerControls = initializeLayerControls;
window.reRenderPolygons = reRenderPolygons;
window.layerSettings = layerSettings;
window.parseBoydName = parseBoydName;
window.extractNPACategory = extractNPACategory;
window.updateSelectedPAHighlight = updateSelectedPAHighlight;
window.clearPAConnection = clearPAConnection;
window.orchestrateFocusAnimation = orchestrateFocusAnimation;
window.updateVisibilityButtonIcons = updateVisibilityButtonIcons;


// Expose new functions globally
window.setSelection = setSelection;
window.removeColorLegend = removeColorLegend;

