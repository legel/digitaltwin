import { ecoLoadingMessages } from './ecoLoadingMessages.js';

// Make messages globally available for main.js
window.ecoLoadingMessages = ecoLoadingMessages;

/**
 * Creates a reusable button with an "x" sub-button for closing.
 * @param {string} buttonText - The text to display on the button.
 * @param {Function} onClick - The function to execute when the main button is clicked.
 * @param {Object} options - Additional options for the button (e.g., position, ID).
 */
function createReusableButton(text, onClick, options = {}) {
    const button = document.createElement("div");
    button.style.position = "absolute";
    button.style.backgroundColor = "#072b2eff";
    button.style.color = "white";
    button.style.borderRadius = "40px";
    button.style.fontSize = "14px";
    button.style.fontWeight = "700";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.cursor = "pointer";
    button.style.padding = "10px 20px 10px 30px"; // Padding around the content

    // Create a temporary span to measure text width and height
    const tempSpan = document.createElement("span");
    tempSpan.style.fontSize = "14px";
    tempSpan.style.fontWeight = "700";
    tempSpan.style.visibility = "hidden"; // Hide it from view
    tempSpan.style.whiteSpace = "nowrap"; // Prevent text from wrapping
    tempSpan.textContent = text;
    document.body.appendChild(tempSpan);

    const textWidth = tempSpan.offsetWidth;
    const textHeight = tempSpan.offsetHeight;
    document.body.removeChild(tempSpan); // Remove the temporary span

    // Calculate the button's height dynamically
    const buttonHeight = textHeight + 20 + "px"; // Add 10px padding above and below text

    // Calculate the button's width dynamically
    const xButtonWidth = 25 + 5 + 20; // Width of the x button (25px) + right padding (5px) + left padding (20px)
    const buttonWidth = textWidth + xButtonWidth + "px";

    button.style.height = buttonHeight;
    button.style.width = buttonWidth;

    // Add the close "x" button
    const closeButton = document.createElement("div");
    closeButton.style.width = "25px";
    closeButton.style.height = "25px";
    closeButton.style.backgroundImage = "url('/images/x.png')";
    closeButton.style.backgroundSize = "contain";
    closeButton.style.backgroundRepeat = "no-repeat";
    closeButton.style.border = "2px solid white"; // Circular white border
    closeButton.style.borderRadius = "50%"; // Ensuring it's a circle
    closeButton.style.cursor = "pointer";
    closeButton.style.position = "absolute";
    closeButton.style.right = "20px"; // 20px padding to the right of the "x" button
    closeButton.style.top = "50%"; // Center vertically
    closeButton.style.transform = "translateY(-50%)"; // Adjust positioning

    closeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the main button's click event
        button.style.display = "none";
    });

    // Create a container for text and the "x" button to align them properly
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.width = `calc(${buttonWidth} - 40px)`; // Subtract padding for proper width
    container.style.height = buttonHeight; // Explicitly set the height

    // Wrap the text in a div to explicitly define its dimensions
    const textDiv = document.createElement("div");
    textDiv.style.flexGrow = "1";
    textDiv.style.overflow = "hidden"; // Prevent overflow
    textDiv.style.whiteSpace = "nowrap"; // Prevent text wrapping
    textDiv.textContent = text;

    container.appendChild(textDiv);
    container.appendChild(closeButton);

    button.appendChild(container);

    // Apply custom styles from options
    if (options.id) button.id = options.id;
    if (options.bottom) button.style.bottom = options.bottom;
    if (options.left) button.style.left = options.left;
    if (options.transform) button.style.transform = options.transform;

    // Add the click event listener for the main button
    button.addEventListener("click", (e) => {
        onClick(e);  // Call the provided callback function when the button is clicked
    });

    document.body.appendChild(button);

    return button;
}

/**
 * Initialize test clipping button
 */
function initializeTestClippingButton() {
    const button = document.getElementById('testClippingButton');
    if (button) {
        button.addEventListener('click', () => {
            console.log('=== TEST CLIPPING BUTTON CLICKED ===');
            testClippingVisualization();
        });
        console.log('Test clipping button initialized successfully');
    } else {
        console.error('Test clipping button not found in DOM');
    }
}

/**
 * Test function to create clipping visualizations from JSON
 */
async function testClippingVisualization() {
    console.log('=== STARTING TEST CLIPPING VISUALIZATION ===');
    
    if (!window.gaussianSplatManager) {
        console.error('GaussianSplatManager not available');
        return;
    }
    
    // Get current tileset
    let tileset = null;
    if (window.map3D && window.map3D.photorealisticTileset) {
        tileset = window.map3D.photorealisticTileset;
        console.log('Found photorealistic tileset:', tileset);
    } else {
        console.error('No photorealistic tileset found');
        console.log('window.map3D:', window.map3D);
        if (window.map3D) {
            console.log('window.map3D.photorealisticTileset:', window.map3D.photorealisticTileset);
        }
    }
    
    // Test with known site IDs
    const testSiteIds = ['scott-boyd-residence'];
    
    for (const siteId of testSiteIds) {
        try {
            console.log(`=== TESTING CLIPPING FOR SITE: ${siteId} ===`);
            const success = await window.gaussianSplatManager.loadPrecomputedClipping(siteId, tileset);
            if (success) {
                console.log(`✓ Successfully loaded clipping for ${siteId}`);
            } else {
                console.log(`✗ No clipping data found for ${siteId}`);
            }
        } catch (error) {
            console.error(`✗ Error testing clipping for ${siteId}:`, error);
        }
    }
    
    console.log('=== TEST CLIPPING VISUALIZATION COMPLETE ===');
}

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

// Global variable to store current parameter filter
window.currentParameterFilter = null;

/**
 * Extracts numeric value from parameter string for color mapping
 * @param {string} paramValue - Parameter value like "4 - 6" or "Dry - Moderate"
 * @param {string} paramType - Type of parameter for appropriate parsing
 * @returns {number} - Numeric value for color mapping
 */
function parseParameterValue(paramValue, paramType) {
    if (!paramValue || paramValue === 'Unknown') return 0;
    
    // Handle different parameter types
    switch (paramType) {
        case 'lightHours':
        case 'pH':
        case 'nitrogen':
        case 'phosphorus':
        case 'potassium':
        case 'organic':
            // Extract numeric ranges like "4 - 6" or "6.7 - 7.2"
            const numMatch = paramValue.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
            if (numMatch) {
                const min = parseFloat(numMatch[1]);
                const max = parseFloat(numMatch[2]);
                return (min + max) / 2; // Return average
            }
            // Try single number
            const singleNum = paramValue.match(/(\d+\.?\d*)/);
            if (singleNum) {
                return parseFloat(singleNum[1]);
            }
            break;
            
        case 'moisture':
            // Map moisture levels to numbers
            const moistureMap = {
                'dry': 1,
                'dry - moderate': 2,
                'moderate': 3,
                'moderate - wet': 4,
                'wet': 5
            };
            return moistureMap[paramValue.toLowerCase()] || 3;
            
        case 'drought':
        case 'flood':
            // Extract percentage ranges like "5 - 10"
            const riskMatch = paramValue.match(/(\d+)\s*-\s*(\d+)/);
            if (riskMatch) {
                const min = parseInt(riskMatch[1]);
                const max = parseInt(riskMatch[2]);
                return (min + max) / 2;
            }
            break;
            
        case 'wind':
            // Extract wind scale like "0 - 5"
            const windMatch = paramValue.match(/(\d+)\s*-\s*(\d+)/);
            if (windMatch) {
                const min = parseInt(windMatch[1]);
                const max = parseInt(windMatch[2]);
                return (min + max) / 2;
            }
            break;
    }
    
    return 0; // Default fallback
}

/**
 * Viridis colormap implementation
 * @param {number} t - Value from 0 to 1
 * @returns {Array} - RGB values [r, g, b] from 0 to 1
 */
function viridisColormap(t) {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));
    
    // Viridis colormap values (sampled at key points)
    const colors = [
        [0.267004, 0.004874, 0.329415],
        [0.282623, 0.140926, 0.457517],
        [0.253935, 0.265254, 0.529983],
        [0.206756, 0.371758, 0.553117],
        [0.163625, 0.471133, 0.558148],
        [0.127568, 0.566949, 0.550556],
        [0.134692, 0.658636, 0.517649],
        [0.266941, 0.748751, 0.440573],
        [0.477504, 0.821444, 0.318195],
        [0.741388, 0.873449, 0.149561],
        [0.993248, 0.906157, 0.143936]
    ];
    
    // Interpolate between colors
    const index = t * (colors.length - 1);
    const i = Math.floor(index);
    const f = index - i;
    
    if (i >= colors.length - 1) {
        return colors[colors.length - 1];
    }
    
    const c1 = colors[i];
    const c2 = colors[i + 1];
    
    return [
        c1[0] + (c2[0] - c1[0]) * f,
        c1[1] + (c2[1] - c1[1]) * f,
        c1[2] + (c2[2] - c1[2]) * f
    ];
}

/**
 * Maps parameter value to color using Viridis colormap (SuperSplat-only mode returns RGB array)
 * @param {number} value - Numeric parameter value
 * @param {number} minVal - Minimum value in dataset
 * @param {number} maxVal - Maximum value in dataset
 * @param {string} paramType - Type of parameter for color scheme selection
 * @returns {Array} - RGB array [r, g, b] with values 0-1
 */
function getParameterColor(value, minVal, maxVal, paramType) {
    // Normalize value to 0-1 range
    const normalized = maxVal > minVal ? (value - minVal) / (maxVal - minVal) : 0.5;

    // For categorical parameters, use discrete colors
    if (paramType === 'moisture') {
        const moistureColors = [
            viridisColormap(0.1),  // dry
            viridisColormap(0.3),  // dry-moderate
            viridisColormap(0.5),  // moderate
            viridisColormap(0.7),  // moderate-wet
            viridisColormap(0.9)   // wet
        ];
        const colorIndex = Math.round(normalized * 4);
        return moistureColors[Math.min(colorIndex, 4)];
    }

    // For continuous parameters, use Viridis colormap
    return viridisColormap(normalized);
}

/**
 * Shows or hides the parameter filter based on site format
 * @param {string} format - 'boyd' or 'legacy'
 */
function toggleParameterFilter(format) {
    const parameterFilter = document.getElementById('parameterFilter');
    const parameterDropdown = document.getElementById('parameterDropdown');
    
    // Skip if elements don't exist
    if (!parameterFilter || !parameterDropdown) {
        return;
    }
    
    if (format === 'boyd') {
        parameterFilter.style.display = 'block';
    } else {
        parameterFilter.style.display = 'none';
        // Reset filter when hiding
        parameterDropdown.value = '';
        window.currentParameterFilter = null;
    }
}

/**
 * Creates a color legend for the current parameter
 * @param {string} paramType - The parameter type
 * @param {number} minVal - Minimum value in dataset
 * @param {number} maxVal - Maximum value in dataset
 */
function createColorLegend(paramType, minVal, maxVal) {
    // Remove existing legend if any
    const existingLegend = document.getElementById('colorLegend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    if (!paramType) {
        return; // No legend for default view
    }
    
    // Create legend container
    const legend = document.createElement('div');
    legend.id = 'colorLegend';
    legend.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(7, 43, 46, 0.9);
        border-radius: 25px;
        padding: 15px 20px;
        color: white;
        font-family: 'Oxygen', sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 1000;
    `;
    
    // Create gradient bar
    const gradientBar = document.createElement('div');
    gradientBar.style.cssText = `
        width: 200px;
        height: 20px;
        border-radius: 10px;
        border: 1px solid white;
        position: relative;
    `;
    
    // Create gradient or discrete colors
    if (paramType === 'moisture') {
        // Discrete colors for categorical data
        const categories = ['Dry', 'Dry-Mod', 'Moderate', 'Mod-Wet', 'Wet'];
        const segmentWidth = 100 / categories.length;
        
        categories.forEach((cat, i) => {
            const segment = document.createElement('div');
            const rgb = viridisColormap(i / (categories.length - 1));
            segment.style.cssText = `
                position: absolute;
                left: ${i * segmentWidth}%;
                width: ${segmentWidth}%;
                height: 100%;
                background: rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)});
                ${i === 0 ? 'border-radius: 10px 0 0 10px;' : ''}
                ${i === categories.length - 1 ? 'border-radius: 0 10px 10px 0;' : ''}
            `;
            gradientBar.appendChild(segment);
        });
        
        // Add category labels
        const labelsDiv = document.createElement('div');
        labelsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        labelsDiv.innerHTML = `
            <div style="font-weight: 700;">${getParameterDisplayName(paramType)}</div>
            <div style="font-size: 12px;">${categories.join(' | ')}</div>
        `;
        
        legend.appendChild(gradientBar);
        legend.appendChild(labelsDiv);
    } else {
        // Continuous gradient for numerical data
        const gradientStops = [];
        for (let i = 0; i <= 100; i += 10) {
            const rgb = viridisColormap(i / 100);
            gradientStops.push(`rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}) ${i}%`);
        }
        gradientBar.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;
        
        // Add value labels
        const labelsDiv = document.createElement('div');
        labelsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        
        // Format values based on parameter type
        let minLabel = minVal.toFixed(1);
        let maxLabel = maxVal.toFixed(1);
        let unit = '';
        
        switch (paramType) {
            case 'lightHours':
                unit = ' hrs';
                break;
            case 'pH':
                unit = '';
                break;
            case 'nitrogen':
            case 'phosphorus':
            case 'potassium':
                unit = ' ppm';
                break;
            case 'organic':
            case 'drought':
            case 'flood':
                unit = '%';
                break;
            case 'wind':
                unit = ' (scale)';
                break;
        }
        
        labelsDiv.innerHTML = `
            <div style="font-weight: 700;">${getParameterDisplayName(paramType)}</div>
            <div style="font-size: 12px;">${minLabel}${unit} - ${maxLabel}${unit}</div>
        `;
        
        legend.appendChild(gradientBar);
        legend.appendChild(labelsDiv);
    }
    
    document.body.appendChild(legend);
}

/**
 * Gets display name for parameter
 * @param {string} paramType - Parameter type
 * @returns {string} - Display name
 */
function getParameterDisplayName(paramType) {
    const names = {
        'moisture': 'Soil Moisture',
        'lightHours': 'Light Hours',
        'pH': 'Soil pH',
        'nitrogen': 'Nitrogen (N)',
        'phosphorus': 'Phosphorus (P)',
        'potassium': 'Potassium (K)',
        'organic': 'Organic Matter',
        'drought': 'Drought Risk',
        'flood': 'Flood Risk',
        'wind': 'Wind Exposure'
    };
    return names[paramType] || paramType;
}

/**
 * Initializes the parameter filter dropdown
 */
function initializeParameterFilter() {
    // This function is now replaced by the layer control system
    // Keep it for compatibility but it doesn't do anything
    // Parameter filter replaced by layer control system
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
            
            // Toggle parameter filter to analyze PA/NPA categories
            if (window.toggleParameterFilter) {
                window.toggleParameterFilter(format);
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
            
            // Reset height offset for new site
            window.currentHeightOffset = undefined;
            window.lastHeightOffset = undefined;
            console.log('Height offset reset for new site selection');
            
            // Find the selected site to determine format
            loadSiteData().then(sites => {
                const selectedSite = sites.find(site => site.filename === this.value);
                if (selectedSite) {
                    // Store current site data globally FIRST
                    window.currentSiteData = selectedSite.geoJson;
                    
                    const format = selectedSite.geoJson.features.length > 0 ? 
                        detectGeoJsonFormat(selectedSite.geoJson.features[0]) : 'legacy';
                    
                    // Show/hide parameter filter based on format (now with data available)
                    toggleParameterFilter(format);
                    
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
            // Hide parameter filter when no site selected
            toggleParameterFilter('legacy');
            window.currentSiteData = null;
            window.currentHeightOffset = undefined;
            window.lastHeightOffset = undefined;
            
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
 * Extracts light level from plantable area name
 * @param {string} name - Feature name containing light level info
 * @returns {number} - Average light level (0-10 scale)
 */
function extractLightLevel(name) {
    const lightMatch = name.match(/Light=(\d+)-(\d+)/);
    if (lightMatch) {
        const min = parseInt(lightMatch[1]);
        const max = parseInt(lightMatch[2]);
        return (min + max) / 2;
    }
    return 5; // Default to medium light
}

/**
 * Gets green color based on light level (SuperSplat-only mode returns RGBA array)
 * @param {number} lightLevel - Light level from 0-10
 * @returns {Array} - RGBA array [r, g, b, a] with values 0-1
 */
function getGreenShadeByLight(lightLevel) {
    // Map light levels to different shades of green
    // Higher light = brighter/lighter green, Lower light = darker green
    if (lightLevel >= 8) return [0.5, 1, 0.5, 0.7];      // Light green
    if (lightLevel >= 6) return [0.2, 1, 0.2, 0.7];      // Lime green
    if (lightLevel >= 4) return [0, 0.8, 0, 0.7];        // Medium green
    if (lightLevel >= 2) return [0.1, 0.5, 0.1, 0.7];    // Forest green
    return [0, 0.3, 0, 0.7];                              // Dark green
}

/**
 * Gets outline color based on light level (SuperSplat-only mode returns RGB array)
 * @param {number} lightLevel - Light level from 0-10
 * @returns {Array} - RGB array [r, g, b] with values 0-1
 */
function getOutlineColorByLight(lightLevel) {
    // Higher light = dark green outline, lower light = black outline
    if (lightLevel >= 6) return [0, 0.3, 0];  // Dark green
    return [0, 0, 0];                          // Black
}

/**
 * Parses non-plantable area names into ID and description
 * @param {string} name - Feature name like "NPA=15_Tree"
 * @returns {Object} - {id, description}
 */
function parseNonPlantableName(name) {
    const match = name.match(/NPA=(\d+)_(.+)/);
    if (match) {
        const id = `NPA ${match[1]}`;
        let description = match[2];
        
        // Clean up common abbreviations and formatting
        description = description
            .replace(/([A-Z])/g, ' $1') // Add spaces before capitals
            .replace(/TireStop/g, 'Tire Stop')
            .replace(/UnderGroundBox/g, 'Underground Box')
            .replace(/LightPole/g, 'Light Pole')
            .replace(/PowerPole/g, 'Power Pole')
            .replace(/BirdofParadise/g, 'Bird of Paradise')
            .replace(/PalmTree/g, 'Palm Tree')
            .trim();
        
        return { id, description };
    }
    return { id: name, description: 'Unknown' };
}

/**
 * Parses plantable area measurements from name
 * @param {string} name - Feature name with measurements
 * @returns {Object} - Parsed measurements
 */
function parsePlantableMeasurements(name) {
    const measurements = {};
    
    // Extract PA number
    const paMatch = name.match(/PA=(\d+)/);
    measurements.id = paMatch ? `PA ${paMatch[1]}` : 'PA Unknown';
    
    // Extract soil moisture
    const moistureMatch = name.match(/SoilMoisture=([^_]+)/);
    measurements.soilMoisture = moistureMatch ? moistureMatch[1] : 'Unknown';
    
    // Extract light level (already have this function)
    const lightMatch = name.match(/Light=(\d+)-(\d+)/);
    if (lightMatch) {
        measurements.lightLevel = `${lightMatch[1]}-${lightMatch[2]}`;
    }
    
    // Extract pH
    const pHMatch = name.match(/pH=([^_]+)/);
    measurements.pH = pHMatch ? pHMatch[1] : 'Unknown';
    
    // Extract nutrients
    const nMatch = name.match(/N=([^_]+)/);
    measurements.nitrogen = nMatch ? nMatch[1] : 'Unknown';
    
    const pMatch = name.match(/P=([^_]+)/);
    measurements.phosphorus = pMatch ? pMatch[1] : 'Unknown';
    
    const kMatch = name.match(/K=([^_]+)/);
    measurements.potassium = kMatch ? kMatch[1] : 'Unknown';
    
    // Extract risk factors
    const droughtMatch = name.match(/Drought=([^_]+)/);
    measurements.drought = droughtMatch ? droughtMatch[1] : 'Unknown';
    
    const floodMatch = name.match(/Flood=([^_]+)/);
    measurements.flood = floodMatch ? floodMatch[1] : 'Unknown';
    
    const windMatch = name.match(/Wind=([^_]+)/);
    measurements.wind = windMatch ? windMatch[1] : 'Unknown';
    
    return measurements;
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
    
    // Extract M1-M10 parameters using regex
    const patterns = {
        moisture: /M1:\s*Moisture[^=]*=\s*([^\n]+)/,
        lightHours: /M2:\s*Light[^=]*=\s*([^\n]+)/,
        pH: /M3:\s*pH[^=]*=\s*([^\n]+)/,
        nitrogen: /M4:\s*N[^=]*=\s*([^\n]+)/,
        phosphorus: /M5:\s*P[^=]*=\s*([^\n]+)/,
        potassium: /M6:\s*K[^=]*=\s*([^\n]+)/,
        organic: /M7:\s*Organic[^=]*=\s*([^\n]+)/,
        drought: /M8:\s*Drought[^=]*=\s*([^\n]+)/,
        flood: /M9:\s*Flood[^=]*=\s*([^\n]+)/,
        wind: /M10:\s*Wind[^=]*=\s*([^\n]+)/
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
        const match = description.match(pattern);
        measurements[key] = match ? match[1].trim() : 'Unknown';
    }
    
    return measurements;
}

/**
 * Parses Boyd format name to extract ID and description
 * @param {string} name - Feature name like 'PA1="Southeast Front Door Entrance"'
 * @returns {Object} - {id, description}
 */
function parseBoydName(name) {
    // Extract PA/NPA number and description
    const match = name.match(/((?:N)?PA)(\d+)(?:="([^"]+)")?/);
    if (match) {
        const prefix = match[1];
        const number = match[2];
        const description = match[3] || '';
        return {
            id: `${prefix}${number}`,
            description: description || name,
            number: parseInt(number)
        };
    }
    // For names that don't match the pattern, return the name as both id and description
    return { id: name, description: name, number: 0 };
}

/**
 * Gets light level from Boyd format data
 * @param {Object} boydData - Parsed Boyd ecological data
 * @returns {number} - Average light level (0-12 scale, converted to 0-10)
 */
function getBoydLightLevel(boydData) {
    if (!boydData.lightHours) return 5;
    
    // Parse light hours range like "4 - 6"
    const match = boydData.lightHours.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        const average = (min + max) / 2;
        // Convert from 0-12 scale to 0-10 scale
        return Math.min(10, Math.round(average * 10 / 12));
    }
    
    // Try to parse single number
    const singleMatch = boydData.lightHours.match(/(\d+)/);
    if (singleMatch) {
        const value = parseInt(singleMatch[1]);
        return Math.min(10, Math.round(value * 10 / 12));
    }
    
    return 5; // Default
}



/**
 * Manually adjust the height offset for debugging
 * @param {number} adjustment - Amount to adjust the height offset by
 */
function adjustHeightOffset(adjustment) {
    if (window.currentHeightOffset === undefined) {
        window.currentHeightOffset = 0;
    }

    window.currentHeightOffset += adjustment;
    console.log(`Height offset adjusted to: ${window.currentHeightOffset.toFixed(2)}m`);

    // Re-visualize with new offset - handled by SuperSplat in SuperSplat-only mode
    console.log('⚠️ Height adjustment with SuperSplat - polygon visualization handled by SuperSplatBridge');
}

/**
 * Stops any active tutorial/flythrough sequence
 */
function stopActiveTutorial() {
    // Set global flag to stop flythrough
    window.stopFlyThrough = true;
    window.currentFlyThroughActive = false;

    // Hide any continue buttons
    const continueButton = document.getElementById('continueFlythroughButton');
    if (continueButton) {
        continueButton.style.display = 'none';
    }

    // Hide any learn more buttons
    const learnMoreButton = document.getElementById('learnMoreButton');
    if (learnMoreButton) {
        learnMoreButton.style.display = 'none';
    }

    // Clear any active camera animations - handled by SuperSplat

    // Tutorial/flythrough stopped by site selection
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

    // Stop any active tutorial first
    stopActiveTutorial();

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
            window.superSplatManager.updateButtonStates();

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

    // Toggle parameter filter to analyze PA/NPA categories
    if (window.toggleParameterFilter) {
        console.log('📈 Analyzing PA/NPA categories...');
        window.toggleParameterFilter(format);
    } else {
        console.warn('⚠️ toggleParameterFilter not available');
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

    // Initialize the parameter filter (now does nothing but kept for compatibility)
    initializeParameterFilter();

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
window.createReusableButton = createReusableButton;
window.testClippingVisualization = testClippingVisualization;
window.loadSiteData = loadSiteData;
window.calculateBounds = calculateBounds;
window.utmToLatLng = utmToLatLng;
window.initializeSiteSelector = initializeSiteSelector;
window.initializeSupersplatSiteData = initializeSupersplatSiteData;
window.navigateToSite = navigateToSite;
window.extractLightLevel = extractLightLevel;
window.getGreenShadeByLight = getGreenShadeByLight;
window.getOutlineColorByLight = getOutlineColorByLight;
window.parseNonPlantableName = parseNonPlantableName;
window.parsePlantableMeasurements = parsePlantableMeasurements;
window.stopActiveTutorial = stopActiveTutorial;
window.detectCoordinateFormat = detectCoordinateFormat;
window.detectGeoJsonFormat = detectGeoJsonFormat;
window.isPlantableFeature = isPlantableFeature;
window.parseBoydEcologicalData = parseBoydEcologicalData;
window.parseBoydName = parseBoydName;
window.getBoydLightLevel = getBoydLightLevel;
window.getBoydFeatureCategory = getBoydFeatureCategory;
window.parseParameterValue = parseParameterValue;
window.getParameterColor = getParameterColor;
window.toggleParameterFilter = toggleParameterFilter;
window.initializeParameterFilter = initializeParameterFilter;
window.adjustHeightOffset = adjustHeightOffset;
window.viridisColormap = viridisColormap;
window.createColorLegend = createColorLegend;
