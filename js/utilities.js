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
 * Creates and appends the "Save View" button to the DOM if it doesn't already exist.
 * The button will call printViewConfiguration on click.
 */
function addSaveViewButton() {
    createReusableButton("Save 6D Camera View", () => {
        printViewConfiguration(window.map3D.viewer);
    }, {
        id: "saveViewButton",
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)"
    });
}



/**
 * Function to print the current view configuration to the console.
 * @param {object} viewer - The Cesium viewer object.
 */
function printViewConfiguration(viewer) {
    const camera = viewer.scene.camera;
    const cartographic = Cesium.Cartographic.fromCartesian(camera.position);

    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const height = cartographic.height;

    const heading = camera.heading;
    const pitch = camera.pitch;
    const roll = camera.roll;

    console.log(`${longitude.toFixed(8)}, ${latitude.toFixed(8)}, ${height.toFixed(2)}, ${heading.toFixed(8)}, ${pitch.toFixed(8)}, ${roll.toFixed(8)}, 0,`);
}


/**
 * Calls the addSaveViewButton function to add the debug button.
 */
function debug() {
    addSaveViewButton();
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
            const response = await fetch(`/data/scott-boyd-residence/${file.filename}`);
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
 * Maps parameter value to color using Viridis colormap
 * @param {number} value - Numeric parameter value
 * @param {number} minVal - Minimum value in dataset
 * @param {number} maxVal - Maximum value in dataset
 * @param {string} paramType - Type of parameter for color scheme selection
 * @returns {Cesium.Color} - Color representing the value
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
        const rgb = moistureColors[Math.min(colorIndex, 4)];
        return new Cesium.Color(rgb[0], rgb[1], rgb[2], 0.7);
    }
    
    // For continuous parameters, use Viridis colormap
    const rgb = viridisColormap(normalized);
    return new Cesium.Color(rgb[0], rgb[1], rgb[2], 0.7);
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
                showEcologicalMetrics: false,
                selectedMetric: null,
                showNonPlantableAreas: false,
                selectedPA: null,
                selectedNPA: null,
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
            if (window.visualizeGeoJsonPolygonsWithLayers) {
                window.visualizeGeoJsonPolygonsWithLayers(winterGardenSite.geoJson);
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
 * Gets green color based on light level
 * @param {number} lightLevel - Light level from 0-10
 * @returns {Cesium.Color} - Color object with alpha
 */
function getGreenShadeByLight(lightLevel) {
    // Map light levels to different shades of green
    // Higher light = brighter/lighter green, Lower light = darker green
    if (lightLevel >= 8) return Cesium.Color.LIGHTGREEN.withAlpha(0.7);      // 8-10: Light green
    if (lightLevel >= 6) return Cesium.Color.LIME.withAlpha(0.7);            // 6-8: Lime green  
    if (lightLevel >= 4) return Cesium.Color.GREEN.withAlpha(0.7);           // 4-6: Medium green
    if (lightLevel >= 2) return Cesium.Color.FORESTGREEN.withAlpha(0.7);     // 2-4: Forest green
    return Cesium.Color.DARKGREEN.withAlpha(0.7);                            // 0-2: Dark green
}

/**
 * Gets outline color based on light level
 * @param {number} lightLevel - Light level from 0-10
 * @returns {Cesium.Color} - Outline color
 */
function getOutlineColorByLight(lightLevel) {
    if (lightLevel >= 6) return Cesium.Color.DARKGREEN;
    return Cesium.Color.BLACK;
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
 * Converts normalized RGBA array to Cesium Color
 * @param {Array} colorArray - [r, g, b, a] with values 0-1
 * @returns {Cesium.Color} - Cesium color object
 */
function normalizedArrayToCesiumColor(colorArray) {
    if (!colorArray || colorArray.length < 3) {
        return Cesium.Color.WHITE; // Default fallback
    }
    
    const [r, g, b, a = 1] = colorArray;
    return new Cesium.Color(r, g, b, a);
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
 * Visualizes GeoJSON polygons on the Cesium viewer
 * @param {Object} geoJsonData - The GeoJSON data to visualize
 */
function visualizeGeoJsonPolygons(geoJsonData) {
    if (!window.map3D || !window.map3D.viewer) {
        console.error('Cesium viewer not available');
        return;
    }
    
    const viewer = window.map3D.viewer;
    
    // Clear any existing site entities (polygons and points)
    // Use a more robust clearing method
    const entitiesToRemove = [];
    viewer.entities.values.forEach(entity => {
        if (entity.name && (entity.name.startsWith('Site_') || 
            entity.name.includes('PA') || 
            entity.name.includes('NPA') ||
            entity.polygon || 
            entity.point)) {
            entitiesToRemove.push(entity);
        }
    });
    
    // Remove entities after collecting them to avoid modification during iteration
    entitiesToRemove.forEach(entity => {
        viewer.entities.remove(entity);
    });
    
    // Cleared existing entities
    
    // Detect format from first feature
    const format = geoJsonData.features.length > 0 ? detectGeoJsonFormat(geoJsonData.features[0]) : 'legacy';
    
    // Detect coordinate system
    let isGeographic = false;
    if (geoJsonData.features.length > 0) {
        const firstFeature = geoJsonData.features[0];
        if (firstFeature.geometry.type === 'Point') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates) === 'geographic';
        } else if (firstFeature.geometry.type === 'Polygon') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates[0][0]) === 'geographic';
        }
    }
    
    // Visualizing GeoJSON format
    
    // Find the vertex with maximum altitude from the GeoJSON data
    let maxAltitude = -Infinity;
    let maxAltitudeCoord = null;
    let minAltitude = Infinity;
    let allAltitudes = [];
    
    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                // Check if altitude (z) is provided
                if (coord.length >= 3) {
                    const altitude = coord[2];
                    allAltitudes.push(altitude);
                    if (altitude > maxAltitude) {
                        maxAltitude = altitude;
                        maxAltitudeCoord = coord;
                    }
                    if (altitude < minAltitude) {
                        minAltitude = altitude;
                    }
                }
            });
        } else if (feature.geometry.type === 'Point' && feature.geometry.coordinates.length >= 3) {
            const altitude = feature.geometry.coordinates[2];
            allAltitudes.push(altitude);
            if (altitude > maxAltitude) {
                maxAltitude = altitude;
                maxAltitudeCoord = feature.geometry.coordinates;
            }
            if (altitude < minAltitude) {
                minAltitude = altitude;
            }
        }
    });
    
    const avgAltitude = allAltitudes.length > 0 ? allAltitudes.reduce((a, b) => a + b, 0) / allAltitudes.length : 0;
    // GeoJSON altitude analysis completed
    
    // If we found a max altitude coordinate, sample the Google 3D Tiles height at that location
    let fixedHeight = maxAltitude + 0.1; // Default to GeoJSON altitude + 0.1m
    
    if (maxAltitudeCoord && window.currentHeightOffset === undefined) {
        const [x, y] = maxAltitudeCoord;
        let latLng;
        
        if (isGeographic) {
            latLng = { lat: y, lng: x };
        } else {
            latLng = utmToLatLng(x, y);
        }
        
        // Create multiple sample points around the max altitude location
        const samplePoints = [];
        const cartographic = Cesium.Cartographic.fromDegrees(latLng.lng, latLng.lat);
        samplePoints.push(cartographic);
        
        // Add 4 more sample points in a small radius (about 5 meters)
        const offsetDegrees = 0.00005; // Roughly 5 meters
        samplePoints.push(Cesium.Cartographic.fromDegrees(latLng.lng + offsetDegrees, latLng.lat));
        samplePoints.push(Cesium.Cartographic.fromDegrees(latLng.lng - offsetDegrees, latLng.lat));
        samplePoints.push(Cesium.Cartographic.fromDegrees(latLng.lng, latLng.lat + offsetDegrees));
        samplePoints.push(Cesium.Cartographic.fromDegrees(latLng.lng, latLng.lat - offsetDegrees));
        
        // Wait a frame to ensure scene is ready, then sample height
        requestAnimationFrame(() => {
            // Sample height from the scene (includes 3D tiles)
            viewer.scene.sampleHeightMostDetailed(samplePoints).then(function(updatedPositions) {
                if (updatedPositions && updatedPositions.length > 0) {
                    // Get the median height from all samples
                    const sampledHeights = updatedPositions
                        .filter(pos => pos && pos.height !== undefined)
                        .map(pos => pos.height);
                    
                    if (sampledHeights.length > 0) {
                        sampledHeights.sort((a, b) => a - b);
                        const medianHeight = sampledHeights[Math.floor(sampledHeights.length / 2)];
                        
                        // Calculate the offset between GeoJSON altitude and Google Earth height
                        // Add a small additional offset to ensure polygons float above surface
                        const heightOffset = medianHeight - maxAltitude + 0.5;
                        // Height sampling results logging removed for cleaner console output
                        
                        // Store the offset to apply to all vertices
                        window.currentHeightOffset = heightOffset;
                        
                        // Trigger re-visualization with the new offset
                        if (!window.lastHeightOffset || Math.abs(window.lastHeightOffset - heightOffset) > 0.01) {
                            window.lastHeightOffset = heightOffset;
                            visualizeGeoJsonPolygons(geoJsonData);
                        }
                    } else {
                        console.warn('No valid heights sampled, using fallback');
                        window.currentHeightOffset = 0;
                    }
                } else {
                    // Fallback: no offset
                    window.currentHeightOffset = 0;
                    console.log(`Could not sample Google Earth height, using no offset`);
                }
            }).catch(function(error) {
                console.error('Height sampling failed:', error);
                // Fallback: use a reasonable offset based on typical Google Earth elevations
                // For the sites in the data, ground level is typically around 5-15m
                const estimatedGroundHeight = 10; // Reasonable estimate
                window.currentHeightOffset = estimatedGroundHeight - maxAltitude + 0.5;
                console.log(`Height sampling failed, using estimated offset: ${window.currentHeightOffset.toFixed(2)}m`);
                
                // Trigger re-visualization with fallback offset
                if (!window.lastHeightOffset || Math.abs(window.lastHeightOffset - window.currentHeightOffset) > 0.01) {
                    window.lastHeightOffset = window.currentHeightOffset;
                    visualizeGeoJsonPolygons(geoJsonData);
                }
            });
        });
    } else if (window.currentHeightOffset !== undefined) {
        console.log(`Using existing height offset: ${window.currentHeightOffset.toFixed(2)}m`);
    } else {
        // No altitude data available, use zero offset
        window.currentHeightOffset = 0;
        console.log('No altitude data available, using zero offset');
    }
    
    // Check if we should show anything at all
    if (!window.currentParameterFilter && !window.layerState?.showPlantableAreas && 
        !window.layerState?.showNonPlantableAreas && !window.layerState?.showEcologicalMetrics) {
        // No layers selected, don't show anything
        console.log('No layers selected, skipping visualization');
        return;
    }
    
    // Collect parameter values for color mapping when filter is active
    let parameterValues = [];
    let minParamValue = 0, maxParamValue = 1;
    
    if (window.currentParameterFilter && format === 'boyd') {
        console.log(`Applying parameter filter: ${window.currentParameterFilter}`);
        
        // Collect all parameter values from plantable features
        geoJsonData.features.forEach(feature => {
            const category = getBoydFeatureCategory(feature);
            if (category === 'plantable') {
                const boydData = parseBoydEcologicalData(feature.properties.description || '');
                const paramValue = boydData[window.currentParameterFilter];
                if (paramValue) {
                    const numericValue = parseParameterValue(paramValue, window.currentParameterFilter);
                    parameterValues.push(numericValue);
                }
            }
        });
        
        // Calculate min/max for color scaling
        if (parameterValues.length > 0) {
            minParamValue = Math.min(...parameterValues);
            maxParamValue = Math.max(...parameterValues);
        }
        
        console.log(`Parameter range: ${minParamValue} - ${maxParamValue}`);
        
        // Create color legend for the current parameter
        createColorLegend(window.currentParameterFilter, minParamValue, maxParamValue);
    } else {
        // Remove legend when no filter is active
        createColorLegend(null, 0, 0);
    }
    
    geoJsonData.features.forEach((feature, index) => {
        // For Boyd format, filter out non PA/NPA features (numeric names and test features)
        if (format === 'boyd') {
            const name = feature.properties.name;
            const category = getBoydFeatureCategory(feature);
            if (category === 'data-point') {
                return; // Skip data points/reference features
            }
            
            // Apply layer filtering for Boyd format
            const isPlantable = category === 'plantable';
            const isNonPlantable = category === 'non-plantable';
            
            // Check if we should show this feature based on layer settings
            if (isPlantable && !window.layerState?.showPlantableAreas && !window.layerState?.temporaryShowPlantable) {
                return; // Skip plantable areas if not showing them
            }
            
            if (isNonPlantable && !window.layerState?.showNonPlantableAreas) {
                return; // Skip non-plantable areas if not showing them
            }
        }
        
        if (feature.geometry.type === 'Polygon') {
        
        // Flatten coordinates for Cesium (lng, lat, lng, lat, ...)
        const flatCoords = [];
        for (let i = 0; i < feature.geometry.coordinates[0].length; i++) {
            const [x, y, z] = feature.geometry.coordinates[0][i];
            let latLng;
            
            if (isGeographic) {
                // Already in geographic coordinates [lng, lat]
                latLng = { lat: y, lng: x };
            } else {
                // UTM coordinates - need conversion
                latLng = utmToLatLng(x, y);
            }
            
            flatCoords.push(latLng.lng, latLng.lat);
        }
            
            // Determine colors based on layer type and light level
            const isPlantable = isPlantableFeature(feature, format);
            let polygonColor, outlineColor;
            
            let descriptionContent = '';
            
            let entityName = `Site_Polygon_${index}`;  // Default name
            
            // Apply layer-specific settings
            let polygonAlpha = window.debugSettings?.polygonAlpha || 0.1;
            let outlineWidth = window.debugSettings?.outlineWidth || 2;
            
            if (isPlantable) {
                // Apply plantable area settings when showing plantable layer
                if (window.layerState?.showPlantableAreas && !window.currentParameterFilter) {
                    polygonAlpha = window.layerSettings?.plantableAreas.polygonAlpha || 0.01; // Minimum alpha for pickability
                    outlineWidth = window.layerSettings?.plantableAreas.outlineWidth || 2;
                    outlineColor = window.layerSettings?.plantableAreas.outlineColor || Cesium.Color.WHITE;
                }
                let lightLevel, measurements;
                
                if (format === 'boyd') {
                    // Parse Boyd format data
                    const parsed = parseBoydName(feature.properties.name);
                    const boydData = parseBoydEcologicalData(feature.properties.description || '');
                    lightLevel = getBoydLightLevel(boydData);
                    
                    // Use the description as the entity name
                    entityName = parsed.description || parsed.id;
                    
                    descriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Plantable Area</p>
                            <p><strong>Description:</strong> ${parsed.description}</p>
                            <p><strong>Moisture:</strong> ${boydData.moisture}</p>
                            <p><strong>Light Hours:</strong> ${boydData.lightHours}</p>
                            <p><strong>pH:</strong> ${boydData.pH}</p>
                            <p><strong>Nitrogen (N):</strong> ${boydData.nitrogen}</p>
                            <p><strong>Phosphorus (P):</strong> ${boydData.phosphorus}</p>
                            <p><strong>Potassium (K):</strong> ${boydData.potassium}</p>
                            <p><strong>Organic Matter:</strong> ${boydData.organic}</p>
                            <p><strong>Drought Risk:</strong> ${boydData.drought}</p>
                            <p><strong>Flood Risk:</strong> ${boydData.flood}</p>
                            <p><strong>Wind Exposure:</strong> ${boydData.wind}</p>
                        </div>
                    `;
                    
                    // Use parameter-based coloring if filter is active
                    if (window.currentParameterFilter) {
                        const paramValue = boydData[window.currentParameterFilter];
                        if (paramValue) {
                            const numericValue = parseParameterValue(paramValue, window.currentParameterFilter);
                            polygonColor = getParameterColor(numericValue, minParamValue, maxParamValue, window.currentParameterFilter);
                            outlineColor = polygonColor.darken(0.3, new Cesium.Color());
                            polygonAlpha = window.layerSettings?.ecologicalMetrics.polygonAlpha || 0.7;
                            outlineWidth = window.layerSettings?.ecologicalMetrics.outlineWidth || 2;
                        } else {
                            // No data for this parameter - don't show polygon
                            return; // Skip this polygon
                        }
                    } else if (window.layerState?.showPlantableAreas) {
                        // Check if this PA is selected
                        const paName = parsed.description || parsed.id;
                        if (paName && paName === window.layerState?.selectedPA) {
                            // Use thicker outline for selected PA
                            outlineColor = window.layerSettings?.plantableAreas.outlineColor || Cesium.Color.WHITE;
                            outlineWidth = window.layerSettings?.plantableAreas.selectedOutlineWidth || 10;
                        } else {
                            // Use thin white outline for unselected areas
                            outlineColor = window.layerSettings?.plantableAreas.outlineColor || Cesium.Color.WHITE;
                            outlineWidth = window.layerSettings?.plantableAreas.outlineWidth || 2;
                        }
                        polygonColor = Cesium.Color.TRANSPARENT;
                        polygonAlpha = 0.01; // Minimum alpha for pickability
                    } else {
                        // Don't show if no layer is active
                        return;
                    }
                } else {
                    // Parse legacy format data
                    lightLevel = extractLightLevel(feature.properties.name);
                    measurements = parsePlantableMeasurements(feature.properties.name);
                    
                    // Use the PA ID as the entity name for legacy format
                    entityName = measurements.id;
                    
                    descriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${measurements.id}</h3>
                            <p><strong>Type:</strong> Plantable Area</p>
                            <p><strong>Soil Moisture:</strong> ${measurements.soilMoisture}</p>
                            <p><strong>Light Level:</strong> ${measurements.lightLevel || 'Unknown'}</p>
                            <p><strong>pH:</strong> ${measurements.pH}</p>
                            <p><strong>Nitrogen (N):</strong> ${measurements.nitrogen}</p>
                            <p><strong>Phosphorus (P):</strong> ${measurements.phosphorus}</p>
                            <p><strong>Potassium (K):</strong> ${measurements.potassium}</p>
                            <p><strong>Drought Risk:</strong> ${measurements.drought}</p>
                            <p><strong>Flood Risk:</strong> ${measurements.flood}</p>
                            <p><strong>Wind Exposure:</strong> ${measurements.wind}</p>
                        </div>
                    `;
                    
                    polygonColor = getGreenShadeByLight(lightLevel);
                    outlineColor = getOutlineColorByLight(lightLevel);
                }
                
            } else {
                // Non-plantable area or data point
                if (format === 'boyd') {
                    const category = getBoydFeatureCategory(feature);
                    const parsed = parseBoydName(feature.properties.name);
                    
                    // Use the description as the entity name for non-plantable Boyd format
                    entityName = parsed.description || parsed.id;
                    
                    // Apply NPA layer settings
                    if (window.layerState?.showNonPlantableAreas) {
                        const npaCategory = extractNPACategory(feature.properties.name);
                        if (npaCategory && npaCategory === window.layerState?.selectedNPA) {
                            // Use thicker outline for selected NPA
                            outlineColor = window.layerSettings?.nonPlantableAreas.outlineColor || Cesium.Color.RED;
                            outlineWidth = window.layerSettings?.nonPlantableAreas.selectedOutlineWidth || 10;
                        } else {
                            // Use thin red outline for unselected NPAs
                            outlineColor = window.layerSettings?.nonPlantableAreas.outlineColor || Cesium.Color.RED;
                            outlineWidth = window.layerSettings?.nonPlantableAreas.outlineWidth || 2;
                        }
                        polygonColor = Cesium.Color.TRANSPARENT;
                        polygonAlpha = 0.01; // Minimum alpha for pickability
                    } else {
                        // Don't show if NPA layer is not active
                        return;
                    }
                    
                    const typeLabel = category === 'data-point' ? 'Reference/Data Point' : 'Non-Plantable Area';
                    descriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> ${typeLabel}</p>
                            <p><strong>Description:</strong> ${parsed.description}</p>
                        </div>
                    `;
                } else {
                    // Legacy format
                    polygonColor = Cesium.Color.RED.withAlpha(0.6);
                    outlineColor = Cesium.Color.DARKRED;
                    
                    const parsed = parseNonPlantableName(feature.properties.name);
                    
                    // Use the description as the entity name for legacy non-plantable
                    entityName = parsed.description || parsed.id;
                    descriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Non-Plantable Area</p>
                            <p><strong>Feature:</strong> ${parsed.description}</p>
                        </div>
                    `;
                }
            }
            
        // Set appearance based on polygon type if not already set
        if (!outlineWidth) {
            if (isPlantable) {
                // Plantable areas
                outlineWidth = 2;
            } else {
                // Non-plantable areas
                outlineWidth = 3;
            }
        }
        
        // Create polygon with vertices at their relative heights
        // First, create an array of positions with individual heights
        const positions = [];
        const heightOffset = window.currentHeightOffset || 0;
        
        for (let i = 0; i < feature.geometry.coordinates[0].length - 1; i++) { // Skip last point (duplicate of first)
            const coord = feature.geometry.coordinates[0][i];
            const [x, y, z] = coord;
            let latLng;
            
            if (isGeographic) {
                latLng = { lat: y, lng: x };
            } else {
                latLng = utmToLatLng(x, y);
            }
            
            // Calculate this vertex's height
            let vertexHeight;
            if (coord.length >= 3 && z !== undefined && maxAltitude !== -Infinity) {
                // Preserve the relative height differences from the GeoJSON
                // The height offset aligns the max altitude point with Google Earth
                vertexHeight = z + heightOffset;
                
                // Ensure minimum height above ground
                const minHeightAboveGround = 0.1;
                if (vertexHeight < minHeightAboveGround) {
                    console.warn(`Vertex height ${vertexHeight.toFixed(2)}m adjusted to minimum ${minHeightAboveGround}m`);
                    vertexHeight = minHeightAboveGround;
                }
            } else {
                // No altitude data, use the base height
                vertexHeight = maxAltitude + heightOffset;
            }
            
            // Elevate polygons by 0.5m to match outline elevation and render above splat
            positions.push(Cesium.Cartesian3.fromDegrees(latLng.lng, latLng.lat, vertexHeight + 0.5));
        }
        
        // Create polygon with individual vertex heights
        const polygonEntity = viewer.entities.add({
            name: entityName,
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                material: (window.debugSettings?.showFill !== false) ? 
                    polygonColor.withAlpha(Math.max(0.01, polygonAlpha)) : // Ensure minimum alpha
                    Cesium.Color.WHITE.withAlpha(0.01), // Nearly transparent but still pickable
                outline: false, // Disable polygon outline, we'll use separate polylines
                perPositionHeight: true, // Use individual heights for each vertex
                disableDepthTestDistance: Number.POSITIVE_INFINITY, // Always visible
                // Remove heightReference when using perPositionHeight (incompatible)
                extrudedHeight: 0.5 // Slightly extrude to ensure visibility through splat
            },
            description: descriptionContent
        });
        
        // Create separate polyline for outline that renders better through splats
        if (window.debugSettings?.showOutline !== false) {
            // Close the loop by adding first position at the end
            const outlinePositions = [...positions, positions[0]];
            
            // Elevate the polyline positions slightly to render above the splat
            const elevatedPositions = outlinePositions.map(pos => {
                const cartographic = Cesium.Cartographic.fromCartesian(pos);
                return Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    cartographic.height + 0.5 // Elevate by 0.5 meters
                );
            });
            
            viewer.entities.add({
                name: `${entityName}_Outline`,
                polyline: {
                    positions: elevatedPositions,
                    width: outlineWidth || 2,
                    material: outlineColor,
                    clampToGround: false, // Keep unclamped for elevation above splat
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: Cesium.HeightReference.NONE, // Use absolute height
                    // Additional properties to ensure visibility through splats
                    classificationType: Cesium.ClassificationType.BOTH,
                    // Remove zIndex since it conflicts with clampToGround: false
                    // Enhanced visibility settings for splat rendering
                    depthFailMaterial: outlineColor, // Show same color even when depth test fails
                    show: true, // Explicitly set to visible
                    distanceDisplayCondition: undefined, // Always show regardless of distance
                    // Force bright rendering
                    shadows: Cesium.ShadowMode.DISABLED // Disable shadows to ensure visibility
                }
            });
        }
        }
        
        // Handle Point features
        if (feature.geometry.type === 'Point') {
            // For Boyd format, filter out non PA/NPA point features as well
            if (format === 'boyd') {
                const category = getBoydFeatureCategory(feature);
                if (category === 'data-point') {
                    return; // Skip data points/reference features
                }
            }
            
            const [x, y, z] = feature.geometry.coordinates;
            let latLng;
            
            if (isGeographic) {
                // Already in geographic coordinates [lng, lat]
                latLng = { lat: y, lng: x };
            } else {
                // UTM coordinates - need conversion
                latLng = utmToLatLng(x, y);
            }
            
            const isPlantable = isPlantableFeature(feature, format);
            
            let pointDescriptionContent = '';
            
            if (isPlantable) {
                // Plantable points are soil markers - keep as points
                if (format === 'boyd') {
                    const parsed = parseBoydName(feature.properties.name);
                    pointDescriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Survey Point</p>
                            <p><strong>Description:</strong> ${parsed.description}</p>
                            <p><strong>Coordinates:</strong> ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}</p>
                            <p><strong>Elevation:</strong> ${z.toFixed(2)}m</p>
                        </div>
                    `;
                } else {
                    const measurements = parsePlantableMeasurements(feature.properties.name);
                    pointDescriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${measurements.id}</h3>
                            <p><strong>Type:</strong> Soil Sample Point</p>
                            <p><strong>Coordinates:</strong> ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}</p>
                            <p><strong>Original Height:</strong> ${z.toFixed(2)}m</p>
                        </div>
                    `;
                }
                
                // Determine point color
                let pointColor = Cesium.Color.LIGHTGREEN;
                if (format === 'boyd') {
                    if (window.currentParameterFilter) {
                        // Use parameter-based coloring for plantable points when filter is active
                        const boydData = parseBoydEcologicalData(feature.properties.description || '');
                        const paramValue = boydData[window.currentParameterFilter];
                        if (paramValue) {
                            const numericValue = parseParameterValue(paramValue, window.currentParameterFilter);
                            pointColor = getParameterColor(numericValue, minParamValue, maxParamValue, window.currentParameterFilter);
                        } else {
                            pointColor = Cesium.Color.LIGHTGRAY;
                        }
                    } else if (feature.properties.color) {
                        pointColor = normalizedArrayToCesiumColor(feature.properties.color);
                    }
                }
                
                viewer.entities.add({
                    name: `Site_Point_${index}`,
                    position: Cesium.Cartesian3.fromDegrees(latLng.lng, latLng.lat),
                    point: {
                        pixelSize: 15,
                        color: pointColor,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: 2000
                    },
                    description: pointDescriptionContent
                });
            } else {
                // Non-plantable points as small red cylinders
                if (format === 'boyd') {
                    const parsed = parseBoydName(feature.properties.name);
                    pointDescriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Non-Plantable Feature</p>
                            <p><strong>Description:</strong> ${parsed.description}</p>
                            <p><strong>Coordinates:</strong> ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}</p>
                            <p><strong>Elevation:</strong> ${z.toFixed(2)}m</p>
                        </div>
                    `;
                } else {
                    const parsed = parseNonPlantableName(feature.properties.name);
                    pointDescriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Non-Plantable Feature</p>
                            <p><strong>Feature:</strong> ${parsed.description}</p>
                            <p><strong>Coordinates:</strong> ${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}</p>
                            <p><strong>Original Height:</strong> ${z.toFixed(2)}m</p>
                        </div>
                    `;
                }
                
                // Determine cylinder color
                let cylinderColor = Cesium.Color.RED.withAlpha(0.9);
                let cylinderOutlineColor = Cesium.Color.DARKRED;
                
                if (format === 'boyd') {
                    if (window.currentParameterFilter) {
                        // Use grayscale for non-plantable points when filter is active
                        cylinderColor = Cesium.Color.GRAY.withAlpha(0.9);
                        cylinderOutlineColor = Cesium.Color.DARKGRAY;
                    } else if (feature.properties.color) {
                        cylinderColor = normalizedArrayToCesiumColor(feature.properties.color);
                        cylinderOutlineColor = cylinderColor.darken(0.3, new Cesium.Color());
                    }
                }
                
                viewer.entities.add({
                    name: `Site_Point_${index}`,
                    position: Cesium.Cartesian3.fromDegrees(latLng.lng, latLng.lat),
                    cylinder: {
                        length: 2.0,
                        topRadius: 0.3,
                        bottomRadius: 0.3,
                        material: cylinderColor,
                        outline: true,
                        outlineColor: cylinderOutlineColor,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: 2000
                    },
                    description: pointDescriptionContent
                });
            }
        }
    });
    
    // GeoJSON visualization completed
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
        // Clean up category name
        category = category
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim();
        return category;
    }
    return null;
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
    
    // Re-visualize with new offset
    if (window.currentSiteData) {
        visualizeGeoJsonPolygons(window.currentSiteData);
    }
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
    
    // Clear any active camera animations
    if (window.map3D && window.map3D.viewer) {
        window.map3D.viewer.scene.camera.cancelFlight();
    }
    
    // Tutorial/flythrough stopped by site selection
}

/**
 * Navigates the camera to the selected site bounds
 * @param {Object} bounds - Site bounds {minLat, maxLat, minLng, maxLng}
 * @param {boolean} visualize - Whether to visualize the site data (default true)
 */
function navigateToSite(bounds, visualize = true) {
    if (!window.map3D || !window.map3D.viewer) {
        console.error('Cesium viewer not available');
        return;
    }
    
    // Stop any active tutorial first
    stopActiveTutorial();
    
    const viewer = window.map3D.viewer;
    
    // Calculate center point and appropriate height
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    
    // Calculate appropriate viewing height based on bounds (3x closer than before)
    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const maxSpan = Math.max(latSpan, lngSpan);
    const height = Math.max(67, maxSpan * 111320 * 0.67); // 3x closer: was *2, now *0.67
    
    // Fly to the site
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
        duration: 2.0
    });
    
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
            visualizeGeoJsonPolygons(selectedSite.geoJson);
        }
    });
    
    displayMessage(`Flying to site: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`, 0.5, 2, 0.5);
}

/**
 * Initializes all the required systems and sets them on the window object.
 * This includes the CesiumManager, GoogleMaps2DManager, and UserManager.
 */
async function allSystemsGo() {
    // Update loading message for initialization
    if (window.independentLoadingState) {
        // window.independentLoadingState.updateMessage('Initializing ecosystem simulation...', 3000);
    }
    
    // Instantiate the CesiumManager - this starts Cesium rendering immediately
    window.map3D = new CesiumManager('cesiumContainer');

    // Message cycling will be set up independently in main.js
    
    // Make sure Cesium starts rendering in background even while loading screen is visible
    if (window.map3D.viewer) {
        // Force initial render to prevent glitchy transition
        window.map3D.viewer.scene.requestRender();
        
        // Set up camera movement handlers to trigger renders for on-demand rendering
        const camera = window.map3D.viewer.scene.camera;
        camera.moveStart.addEventListener(() => {
            // Start continuous rendering during camera movement
            window.map3D.viewer.scene.requestRender();
        });
        
        camera.moveEnd.addEventListener(() => {
            // Ensure final render when movement stops
            window.map3D.viewer.scene.requestRender();
        });
        
        // Also trigger renders for mouse/touch interactions (with passive listeners)
        const canvas = window.map3D.viewer.scene.canvas;
        canvas.addEventListener('mousedown', () => window.map3D.viewer.scene.requestRender(), { passive: true });
        canvas.addEventListener('wheel', () => window.map3D.viewer.scene.requestRender(), { passive: true });
        canvas.addEventListener('touchstart', () => window.map3D.viewer.scene.requestRender(), { passive: true });
    }

    // Instantiate the GoogleMaps2DManager and wait for it to be ready
    window.map2D = await new GoogleMaps2DManager('map2D');
    // Google Map object is ready

    // Instantiate the UserManager and store it globally
    window.user = new UserManager(window.map3D);
    
    // Instantiate the GaussianSplatManager with independent loading support
    window.gaussianSplatManager = new GaussianSplatManager(window.map3D.viewer);
    await import('./integrate_splat_clipping.js');
    
    // Initialize layer state early
    window.layerState = {
        showPlantableAreas: true,
        showEcologicalMetrics: false,
        selectedMetric: null,
        showNonPlantableAreas: false,
        selectedPA: null,
        selectedNPA: null,
        npaCategories: new Map(),
        paCategories: new Map(),
        categorizedPAs: new Map()
    };
    
    // Initialize the parameter filter (now does nothing but kept for compatibility)
    initializeParameterFilter();
    
    // Initialize terrain toggle button event listener with delay to ensure splatManager is ready
    setTimeout(() => {
        initializeTerrainToggle();
    }, 100);
    
    
    // Update loading message for site data loading
    if (window.independentLoadingState) {
        // window.independentLoadingState.updateMessage('Simulating hummingbird flight paths...', 4000);
    }
    
    // Then initialize the site selector which will trigger the default site load
    await initializeSiteSelector();
    
    // Loading will complete when Gaussian splat is ready (handled by GaussianSplatManager)
    console.log(`[${new Date().toISOString()}] 🎯 ALL SYSTEMS GO COMPLETE - Waiting for Gaussian splat to load`);
}

// Expose the functions globally
window.parseMarkdown = parseMarkdown;
window.displayMessage = displayMessage;
window.addSaveViewButton = addSaveViewButton;
window.printViewConfiguration = printViewConfiguration;
window.allSystemsGo = allSystemsGo;
window.debug = debug;
window.createReusableButton = createReusableButton;
window.testClippingVisualization = testClippingVisualization;
window.loadSiteData = loadSiteData;
window.calculateBounds = calculateBounds;
window.utmToLatLng = utmToLatLng;
window.initializeSiteSelector = initializeSiteSelector;
window.navigateToSite = navigateToSite;
window.visualizeGeoJsonPolygons = visualizeGeoJsonPolygons;
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
window.normalizedArrayToCesiumColor = normalizedArrayToCesiumColor;
window.getBoydFeatureCategory = getBoydFeatureCategory;
window.parseParameterValue = parseParameterValue;
window.getParameterColor = getParameterColor;
window.toggleParameterFilter = toggleParameterFilter;
window.initializeParameterFilter = initializeParameterFilter;
window.adjustHeightOffset = adjustHeightOffset;
window.viridisColormap = viridisColormap;
window.createColorLegend = createColorLegend;

/**
 * Initialize terrain toggle button functionality
 */
function initializeTerrainToggle() {
    const terrainToggleButton = document.getElementById('terrainToggleButton');
    if (!terrainToggleButton) {
        // Terrain toggle button not found - this is expected when button is not in DOM
        return;
    }
    
    // Hide button if debug mode is disabled
    if (window.gaussianSplatManager && !window.gaussianSplatManager.debugMode) {
        terrainToggleButton.style.display = 'none';
        return;
    }
    
    terrainToggleButton.addEventListener('click', async function() {
        if (window.map3D && window.map3D.toggleBaseTerrain) {
            try {
                // Disable button during transition
                terrainToggleButton.disabled = true;
                terrainToggleButton.textContent = '...';
                
                const isUsingTerrain = await window.map3D.toggleBaseTerrain();
                
                // Update button text based on current mode
                terrainToggleButton.textContent = isUsingTerrain ? 'PERF' : 'HQ';
                terrainToggleButton.title = isUsingTerrain ? 
                    'Switch to high quality mode (photorealistic 3D tiles)' : 
                    'Switch to performance mode (basic terrain)';
            } catch (error) {
                console.error('Error toggling terrain mode:', error);
                // Reset button to previous state
                terrainToggleButton.textContent = 'HQ';
            } finally {
                terrainToggleButton.disabled = false;
            }
        }
    });
}

window.initializeTerrainToggle = initializeTerrainToggle;
window.getParameterDisplayName = getParameterDisplayName;
window.extractNPACategory = extractNPACategory;
window.allSystemsGo = allSystemsGo;
