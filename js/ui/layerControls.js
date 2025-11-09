/**
 * Layer control system for managing plantable and non-plantable area visualization
 */

// Layer state management - condensed structure
window.layerState = {
    showPlantableAreas: true,
    showNonPlantableAreas: true,

    // Unified selection structure
    selectedGroup: null,        // PA name, NPA category, or metric name ('soilMoisture', 'pH', etc.)
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
    }
}

/**
 * Clears all selected polygons and resets selection state
 * This includes PA selections, NPA selections, AND environmental metric selections
 */
function clearAllPolygonSelections() {
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
    if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
        try {
            window.superSplatBridge.polygonManager.deselectAllPolygons();
        } catch (error) {
            console.warn('Failed to deselect SuperSplat polygons:', error);
        }
    }

    // Trigger full polygon re-rendering to ensure appearance is restored
    reRenderPolygons();

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

            const isPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'plantable' :
                isPlantableFeature(feature, 'boyd');

            if (featureDescription === paAreaName && isPlantable) {
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

            const isNonPlantable = window.getBoydFeatureCategory ?
                window.getBoydFeatureCategory(feature) === 'non-plantable' :
                !isPlantableFeature(feature, 'boyd');

            if (featureCategory === npaCategory && isNonPlantable) {
                polygonNames.push(feature.properties.name);
            }
        }
    });

    return polygonNames;
}

/**
 * Unified selection function for PA areas, NPA categories, and metrics
 * @param {string} groupName - The group name to select
 * @param {string} groupType - 'PA', 'NPA', or 'METRIC'
 * @param {Object} geoJsonData - The GeoJSON data containing all polygons
 */
function setSelection(groupName, groupType, geoJsonData) {
    // Auto-show relevant polygon groups if they're invisible
    let visibilityChanged = false;

    if (groupType === 'PA' || groupType === 'METRIC') {
        // PA and METRIC selections need plantable areas visible
        if (!window.layerState.showPlantableAreas) {
            window.layerState.showPlantableAreas = true;
            visibilityChanged = true;

            // Update polygonManager visibility directly and trigger renderer update
            if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                window.superSplatBridge.polygonManager.setGroupVisibility('plantable-areas', true);
                window.superSplatBridge.polygonManager.triggerAutoRendererUpdate();
            }
        }
    } else if (groupType === 'NPA') {
        // NPA selections need non-plantable areas visible
        if (!window.layerState.showNonPlantableAreas) {
            window.layerState.showNonPlantableAreas = true;
            visibilityChanged = true;

            // Update polygonManager visibility directly and trigger renderer update
            if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                window.superSplatBridge.polygonManager.setGroupVisibility('non-plantable-areas', true);
                window.superSplatBridge.polygonManager.triggerAutoRendererUpdate();
            }
        }
    }

    // Update visibility button icons if visibility changed
    if (visibilityChanged) {
        updateVisibilityButtonIcons();
    }

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

    if (window.superSplatBridge && window.superSplatBridge.polygonManager && polygons.length > 0) {
        try {
            window.superSplatBridge.polygonManager.selectPolygonArea(polygons);
        } catch (error) {
            console.warn('Failed to apply visual selection in SuperSplat:', error);
        }
    }

}

function selectPAArea(paAreaName, geoJsonData) {
    setSelection(paAreaName, 'PA', geoJsonData);
}

/**
 * Selects polygons for a specific NPA category
 * @param {string} npaCategory - Name of the NPA category to select
 * @param {Object} geoJsonData - The GeoJSON data to search through
 */
function selectNPACategory(npaCategory, geoJsonData) {
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
        if (metricName === 'soilMoisture') {
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
    // Set new environmental metric selection using unified structure
    setSelection(metricName, 'METRIC', geoJsonData);

    // Process environmental metric data and generate colors
    const metricData = processEnvironmentalMetricColors(metricName, geoJsonData);

    // Apply metric-based colors via SuperSplat
    if (window.superSplatBridge && window.superSplatBridge.polygonManager && metricData.totalPolygons > 0) {
        try {
            // Environmental metrics don't change group visibility

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

                window.superSplatBridge.polygonManager.selectEnvironmentalMetricPolygons(
                    group.polygons, hexColor);

            });

            // Create color legend for the environmental metric
            if (window.createColorLegend) {
                window.createColorLegend(metricName, metricData.minValue, metricData.maxValue);
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

        }
    }

    // Close non-plantable areas if not current
    if (currentDropdown !== 'nonplantable') {
        const nonPlantableToggle = document.getElementById('nonPlantableAreasToggle');
        const nonPlantableSubOptions = document.getElementById('nonPlantableSubOptions');
        if (nonPlantableToggle && nonPlantableSubOptions) {
            nonPlantableSubOptions.style.display = 'none';
            nonPlantableToggle.classList.remove('expanded');

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

}

/**
 * Automatically loads site data for the SuperSplat application
 * This bypasses the need for site selection dropdown
 */
async function autoLoadSiteData() {
    try {

        // Check if data is already loaded
        if (window.currentSiteData) {
            return true;
        }

        // Use the same loading logic as the original loadSiteData function
        const dataUrl = window.TerrainConfig ?
            window.TerrainConfig.getDataUrl('scott-boyd-residence/Boyd_Residence_Aerial_and_Ground.geojson') :
            '/data/scott-boyd-residence/Boyd_Residence_Aerial_and_Ground.geojson';


        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
        }

        const geoJsonData = await response.json();

        window.currentSiteData = geoJsonData;

        window.currentSiteInfo = {
            name: 'Winter Garden Residence',
            filename: 'Boyd_Residence_Aerial_and_Ground.geojson',
            id: 'scott-boyd-residence',
            bounds: window.calculateBounds ? window.calculateBounds(geoJsonData) : null
        };


        // Trigger the detection system
        if (window.detectGeoJsonFormat) {
            const geoJsonFormat = window.detectGeoJsonFormat(geoJsonData.features[0]);
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

    const layerControls = document.getElementById('layerControls');
    if (!layerControls) {
        console.error('❌ INIT-CONTROLS: Layer controls element not found!');
        return;
    }

    // Prevent duplicate initialization
    if (layerControls.dataset.initialized === 'true') {
        return;
    }
    layerControls.dataset.initialized = 'true';

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
            const loadSuccess = await autoLoadSiteData();
            if (!loadSuccess) {
                console.error('❌ Failed to auto-load site data');
                return;
            }
        }

        // Check site data and format
        if (window.currentSiteData) {
            const geoJsonFormat = detectGeoJsonFormat(window.currentSiteData.features[0]);
            if (geoJsonFormat === 'boyd') {
                document.getElementById('layerControls').style.display = 'block';
                analyzeNPACategories(window.currentSiteData);
                analyzePACategories(window.currentSiteData);
                // Initialize visibility button icons on startup
                updateVisibilityButtonIcons();
            } else {
            }
        } else {
            // Try again later when data might be available
            let retryCount = 0;
            const maxRetries = 10;

            const retryDataCheck = async () => {
                retryCount++;

                // If still no data, try auto-loading again
                if (!window.currentSiteData && retryCount <= 3) {
                    await autoLoadSiteData();
                }

                if (window.currentSiteData) {
                    const geoJsonFormat = detectGeoJsonFormat(window.currentSiteData.features[0]);
                    if (geoJsonFormat === 'boyd') {
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

        // in SuperSplatBridge.js to match actual polygon visibility state
    }, 100);
}

/**
 * Sets up visibility toggle buttons for PA and NPA groups
 */
function setupVisibilityToggleButtons() {

    // PA visibility toggle
    const paVisibilityToggle = document.getElementById('paVisibilityToggle');
    if (paVisibilityToggle) {
        paVisibilityToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent dropdown toggle
            e.stopImmediatePropagation(); // Prevent other handlers on same element

            // Toggle the state
            window.layerState.showPlantableAreas = !window.layerState.showPlantableAreas;

            // Update button image
            const img = paVisibilityToggle.querySelector('img');
            if (img) {
                img.src = window.layerState.showPlantableAreas ? '/images/visible.png' : '/images/invisible.png';
                img.alt = window.layerState.showPlantableAreas ? 'Visible' : 'Hidden';
            }

            // Update polygonManager visibility directly and trigger renderer update
            if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                const affectedCount = window.superSplatBridge.polygonManager.setGroupVisibility('plantable-areas', window.layerState.showPlantableAreas);
                console.log(`👁️ PA visibility toggle: ${affectedCount} polygons ${window.layerState.showPlantableAreas ? 'shown' : 'hidden'}`);

                // Trigger automatic renderer update
                window.superSplatBridge.polygonManager.triggerAutoRendererUpdate();
            } else {
                console.warn('⚠️ PolygonManager not available for visibility toggle');
            }

            // Remove UI objects when hiding PAs
            if (!window.layerState.showPlantableAreas) {
                // Clear all PA selections when hiding the entire PA group
                if (window.layerState.selectedGroupType === 'PA') {
                    clearAllPolygonSelections();
                    // Uncheck all PA radio buttons
                    document.querySelectorAll('input[name="plantableArea"]').forEach(r => r.checked = false);
                }

                // Remove focus panel if visible
                if (window.clearPAConnection) {
                    window.clearPAConnection();
                }

                // Remove color legend if visible (in case metric was selected via PA)
                const existingLegend = document.getElementById('colorLegend');
                if (existingLegend) {
                    existingLegend.remove();
                }
            }

        });

        // Initial state will be set after polygon loading completes
    }

    // NPA visibility toggle
    const npaVisibilityToggle = document.getElementById('npaVisibilityToggle');
    if (npaVisibilityToggle) {
        npaVisibilityToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent dropdown toggle
            e.stopImmediatePropagation(); // Prevent other handlers on same element

            // Toggle the state
            window.layerState.showNonPlantableAreas = !window.layerState.showNonPlantableAreas;

            // Update button image
            const img = npaVisibilityToggle.querySelector('img');
            if (img) {
                img.src = window.layerState.showNonPlantableAreas ? '/images/visible.png' : '/images/invisible.png';
                img.alt = window.layerState.showNonPlantableAreas ? 'Visible' : 'Hidden';
            }

            // Update polygonManager visibility directly and trigger renderer update
            if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                const affectedCount = window.superSplatBridge.polygonManager.setGroupVisibility('non-plantable-areas', window.layerState.showNonPlantableAreas);
                console.log(`👁️ NPA visibility toggle: ${affectedCount} polygons ${window.layerState.showNonPlantableAreas ? 'shown' : 'hidden'}`);

                // Trigger automatic renderer update
                window.superSplatBridge.polygonManager.triggerAutoRendererUpdate();
            } else {
                console.warn('⚠️ PolygonManager not available for visibility toggle');
            }

            // Clear NPA selections when hiding the entire NPA group
            if (!window.layerState.showNonPlantableAreas && window.layerState.selectedGroupType === 'NPA') {
                clearAllPolygonSelections();
                // Uncheck all NPA radio buttons
                document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => r.checked = false);
            }
        });

        // Initial state will be set after polygon loading completes
    }
}

/**
 * Updates visibility toggle button icons to match current layer state
 */
function updateVisibilityButtonIcons() {

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
            }
        } else {
            console.warn('⚠️ NPA visibility toggle img not found');
        }
    } else {
        console.warn('⚠️ NPA visibility toggle button not found');
    }
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
        const isExpanded = updatedSubOptions.style.display === 'block';
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('plantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            

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
            
            // Hide focus panel and clear connection when closing dropdown
            if (window.clearPAConnection) {
                window.clearPAConnection();
            }
        }
        
        // Skip reRenderPolygons() to prevent re-rendering that clears selection state
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
        const isExpanded = updatedSubOptions.style.display === 'block';
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('nonplantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            

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
            
        }
        
        // Skip reRenderPolygons() to prevent re-rendering that clears selection state
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
    
    const categories = new Map();
    const categorizedPAs = new Map(); // Map of category -> array of PAs
    
    if (!geoJsonData || !geoJsonData.features) {
        console.error('❌ No geoJsonData or features provided to analyzePACategories');
        return;
    }
    
    let paFeatureCount = 0;
    geoJsonData.features.forEach((feature, index) => {
        
        if (feature.properties.name && feature.properties.name.includes('PA') && !feature.properties.name.includes('NPA')) {
            paFeatureCount++;
            
            const parsed = parseBoydName(feature.properties.name);
            
            const name = parsed.description || parsed.id;
            if (name && !categories.has(name)) {
                const categoryData = {
                    number: parsed.number,
                    category: categorizePADescription(parsed.description)
                };
                categories.set(name, categoryData);
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
    populatePACategories(categories, categorizedPAs);
}

/**
 * Populates PA category checkboxes
 */
function populatePACategories(categories, categorizedPAs) {
    
    const container = document.getElementById('plantableSubOptions');
    if (!container) {
        console.error('❌ plantableSubOptions container not found!');
        return;
    }
    
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

                // Simple toggle logic: if already checked, uncheck and deselect
                if (window.uiToggleState.currentSelectedGroup === this.value && window.uiToggleState.currentSelectedGroupType === 'PA' && !window.isPolygonTriggeredClick) {
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
                    // Re-trigger selection to ensure visual state is applied
                    selectPAArea(name, window.currentSiteData);
                    return;
                }

                // Auto zoom-to feature: Set camera to top-down view and position on polygons (only for dropdown button clicks)
                if (!window.isPolygonTriggeredClick && window.superSplatManager) {
                    window.superSplatManager.setTopDownView();

                    // Position camera on the selected PA polygons after a brief delay for top-down to complete
                    setTimeout(() => {
                        const selectedPolygons = findPolygonsForPAArea(name, window.currentSiteData);
                        if (selectedPolygons && selectedPolygons.length > 0) {
                            window.superSplatManager.positionCameraOnPolygons(selectedPolygons);
                        }
                    }, 100);
                }

                // New selection: clear all previous selections first
                clearAllPolygonSelections();
                window.uiToggleState.currentSelectedGroup = this.value;
                window.uiToggleState.currentSelectedGroupType = 'PA';

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
                if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                    try {
                                    // This PA selection does not change group visibility

                        // Select all polygons for this PA area
                        const selectedPolygons = window.layerState.selectedPolygons || [];
                        if (selectedPolygons.length > 0) {
                            window.superSplatBridge.polygonManager.selectPolygonArea(selectedPolygons);
                        }
                    } catch (error) {
                        console.warn('Failed to select SuperSplat PA polygons:', error);
                    }
                }

                if (window.focusPanel && window.currentSiteData) {
                    const paFeature = window.currentSiteData.features.find(f => {
                        const parsed = parseBoydName(f.properties.name);
                        return (parsed.description || parsed.id) === name;
                    });
                    if (paFeature) {
                        updateSelectedPAHighlight(name);
                        orchestrateFocusAnimation(label, name, paFeature);

                        // Refresh plant recommendations only if plants are already loaded (switching between PAs)
                        if (window.plantRecommendations &&
                            typeof window.plantRecommendations.refreshRecommendationsForCurrentPA === 'function' &&
                            window.plantRecommendations.currentPlants &&
                            window.plantRecommendations.currentPlants.length > 0) {
                            setTimeout(() => {
                                window.plantRecommendations.refreshRecommendationsForCurrentPA();
                            }, 500); // Small delay to ensure PA selection is processed
                        }
                    }
                }

                // Skip reRenderPolygons() to preserve SuperSplat polygon selection state

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
    const categories = new Map();
    
    geoJsonData.features.forEach(feature => {
        if (feature.properties.name && feature.properties.name.includes('NPA')) {
            const category = extractNPACategory(feature.properties.name);
            if (category && !categories.has(category)) {
                categories.set(category, true);
            }
        }
    });
    
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
                // Re-trigger selection to ensure visual state is applied
                selectNPACategory(category, window.currentSiteData);
                return;
            }

            // Auto zoom-to feature: Set camera to top-down view and position on polygons (only for dropdown button clicks)
            if (!window.isPolygonTriggeredClick && window.superSplatManager) {
                window.superSplatManager.setTopDownView();

                // Position camera on the selected NPA polygons after a brief delay for top-down to complete
                setTimeout(() => {
                    const selectedPolygons = findPolygonsForNPACategory(category, window.currentSiteData);
                    if (selectedPolygons && selectedPolygons.length > 0) {
                        window.superSplatManager.positionCameraOnPolygons(selectedPolygons);
                    }
                }, 100);
            }

            // New selection: clear all previous selections first
            clearAllPolygonSelections();
            window.uiToggleState.currentSelectedGroup = this.value;
            window.uiToggleState.currentSelectedGroupType = 'NPA';

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
            if (window.superSplatBridge && window.superSplatBridge.polygonManager && window.currentSiteData) {
                try {
                    // This NPA selection does not change group visibility

                    // Find first NPA in this category for selection
                    const npaFeatures = window.currentSiteData.features.filter(f => {
                        if (!f.properties.name || !f.properties.name.includes('NPA')) return false;
                        const extractedCategory = extractNPACategory(f.properties.name);
                        return extractedCategory === category;
                    });

                    // Select all polygons for this NPA category
                    const selectedPolygons = window.layerState.selectedPolygons || [];
                    if (selectedPolygons.length > 0) {
                        window.superSplatBridge.polygonManager.selectPolygonArea(selectedPolygons);
                    }
                } catch (error) {
                    console.warn('Failed to show/select SuperSplat NPA polygons:', error);
                }
            }


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
function initializeLayerControlsForSite(geoJsonFormat) {
    const layerControls = document.getElementById('layerControls');

    if (geoJsonFormat === 'boyd') {
        layerControls.style.display = 'block';
        // Analyze PA and NPA categories for this site
        if (window.currentSiteData) {
            analyzePACategories(window.currentSiteData);
            analyzeNPACategories(window.currentSiteData);
        } else {
        }

        // Ensure plantable areas checkbox is checked
        const plantableToggle = document.getElementById('plantableAreasToggle');
        if (plantableToggle && !plantableToggle.checked) {
            plantableToggle.checked = true;
            document.getElementById('plantableSubOptions').style.display = 'block';
        }
    } else {
        layerControls.style.display = 'none';
        // Reset layer state
        window.layerState = {
            showPlantableAreas: true,
            showNonPlantableAreas: true,

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
        if (currentAnimationState.selectedLabel !== label || currentAnimationState.selectedPA !== paName) {
            return;
        }

        // Phase 1: Extend connection line
        createAnimatedConnectionLine(label, () => {
            // Phase 2: Create vertical edge line
            createVerticalEdge(() => {
                // Vertical edge animation completed, expanding to focus panel
                // Phase 3: Expand edge to oval and reveal content
                expandToFocusPanel(paName, paFeature, () => {
                    // Focus panel expansion completed
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
    
    currentAnimationState.connectionLine = line;
    currentAnimationState.lineEndX = lineLeft; // Where the line ends (left side)
    currentAnimationState.lineStartX = ovalLeftEdge; // Where the line starts (oval side)
    currentAnimationState.lineY = startY;
    
    
        // Animate line extension
        requestAnimationFrame(() => {
            try {
                if (line && line.parentNode) {
                    line.style.width = `${lineWidth}px`;
                }
                setTimeout(() => {
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
            // Vertical edge animation completed, calling next phase
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
    // Expanding to focus panel for PA: ${paName}

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
        // Focus panel missing, initializing
        window.focusPanel.init();
    }

    const panel = window.focusPanel.panel;

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


    // Hide panel initially to prevent position jump
    panel.style.visibility = 'hidden';
    panel.style.opacity = '1'; // Keep opacity for the scale animation

    // Override default CSS position temporarily - use !important to override CSS
    panel.style.setProperty('left', `${panelLeft}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.transition = 'none'; // Clear any existing transitions
    panel.style.transform = 'scaleX(0)';
    panel.style.transformOrigin = 'left center';

    
    // Populate panel content using the proper show method
    window.focusPanel.show(paName, paFeature);
    
    // Make panel visible and animate expansion in next frame
    requestAnimationFrame(() => {
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

        // Making panel visible and starting expansion
        panel.style.visibility = 'visible';
        panel.style.opacity = '1'; // Force opacity to 1 to override CSS
        panel.classList.add('visible'); // Add visible class now that positioning is set
        panel.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';


        requestAnimationFrame(() => {
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

            panel.style.transform = 'scaleX(1)';

            // Log final state after transform
            setTimeout(() => {
            }, 100);
        });

        setTimeout(() => {
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

/**
 * Utility function to manually trigger camera rotation to top-down view
 * Useful for testing and debugging the auto zoom-to feature
 */
function setCameraTopDown() {
    if (window.superSplatManager) {
        const success = window.superSplatManager.setTopDownView();
        if (success) {
            console.log('✅ Camera successfully set to top-down view');
        } else {
            console.warn('⚠️ Failed to set camera to top-down view');
        }
        return success;
    } else {
        console.error('❌ SuperSplatManager not available');
        return false;
    }
}

/**
 * Utility function to check if camera is currently in top-down view
 */
function isCameraTopDown() {
    if (window.superSplatManager) {
        return window.superSplatManager.isTopDownView();
    }
    return false;
}

/**
 * Utility function to manually position camera on current selected polygons
 * Useful for testing and debugging the auto zoom-to feature
 */
function positionCameraOnSelected() {
    if (!window.superSplatManager) {
        console.error('❌ SuperSplatManager not available');
        return false;
    }

    const selectedPolygons = window.layerState?.selectedPolygons;
    if (!selectedPolygons || selectedPolygons.length === 0) {
        console.warn('⚠️ No polygons currently selected');
        return false;
    }

    console.log(`📍 Positioning camera on ${selectedPolygons.length} selected polygons:`, selectedPolygons);
    const success = window.superSplatManager.positionCameraOnPolygons(selectedPolygons);

    if (success) {
        console.log('✅ Camera successfully positioned on selected polygons');
    } else {
        console.warn('⚠️ Failed to position camera on selected polygons');
    }

    return success;
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

// Expose camera utility functions globally
window.setCameraTopDown = setCameraTopDown;
window.isCameraTopDown = isCameraTopDown;
window.positionCameraOnSelected = positionCameraOnSelected;

// Expose new functions globally
window.setSelection = setSelection;
window.removeColorLegend = removeColorLegend;

