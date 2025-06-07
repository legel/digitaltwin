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
        { filename: '4.18.2025-layers.geojson', name: 'Dix.Hite HQ' },
        { filename: 'Boyd_Residence_Aerial_and_Ground.geojson', name: 'Scott Boyd Residence' }
    ];
    
    for (const file of files) {
        try {
            const response = await fetch(`/data/${file.filename}`);
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
 * Maps parameter value to color gradient using RGB interpolation
 * @param {number} value - Numeric parameter value
 * @param {number} minVal - Minimum value in dataset
 * @param {number} maxVal - Maximum value in dataset
 * @param {string} paramType - Type of parameter for color scheme selection
 * @returns {Cesium.Color} - Color representing the value
 */
function getParameterColor(value, minVal, maxVal, paramType) {
    // Normalize value to 0-1 range
    const normalized = maxVal > minVal ? (value - minVal) / (maxVal - minVal) : 0.5;
    
    let startColor, endColor;
    
    // Define RGB color pairs for each parameter type
    switch (paramType) {
        case 'lightHours':
            // Dark yellow to bright green (more light = brighter)
            startColor = [0.8, 0.8, 0.2]; // Dark yellow
            endColor = [0.2, 1.0, 0.2];   // Bright green
            break;
            
        case 'pH':
            // Red (acidic) to blue (basic)
            startColor = [1.0, 0.2, 0.2]; // Red
            endColor = [0.2, 0.2, 1.0];   // Blue
            break;
            
        case 'moisture':
            // Brown (dry) to blue (wet)
            startColor = [0.6, 0.4, 0.2]; // Brown
            endColor = [0.2, 0.6, 1.0];   // Blue
            break;
            
        case 'nitrogen':
        case 'phosphorus':
        case 'potassium':
            // Dark purple to bright green (nutrients)
            startColor = [0.5, 0.2, 0.8]; // Purple
            endColor = [0.2, 0.8, 0.2];   // Green
            break;
            
        case 'organic':
            // Light brown to dark brown
            startColor = [0.7, 0.5, 0.3]; // Light brown
            endColor = [0.4, 0.2, 0.1];   // Dark brown
            break;
            
        case 'drought':
        case 'flood':
            // Green (low risk) to red (high risk)
            startColor = [0.2, 0.8, 0.2]; // Green
            endColor = [1.0, 0.2, 0.2];   // Red
            break;
            
        case 'wind':
            // Light blue to dark blue
            startColor = [0.7, 0.9, 1.0]; // Light blue
            endColor = [0.1, 0.3, 0.8];   // Dark blue
            break;
            
        default:
            // Default light to dark green
            startColor = [0.6, 1.0, 0.6]; // Light green
            endColor = [0.1, 0.6, 0.1];   // Dark green
            break;
    }
    
    // Interpolate between start and end colors
    const r = startColor[0] + (endColor[0] - startColor[0]) * normalized;
    const g = startColor[1] + (endColor[1] - startColor[1]) * normalized;
    const b = startColor[2] + (endColor[2] - startColor[2]) * normalized;
    
    return new Cesium.Color(r, g, b, 0.7);
}

/**
 * Shows or hides the parameter filter based on site format
 * @param {string} format - 'boyd' or 'legacy'
 */
function toggleParameterFilter(format) {
    const parameterFilter = document.getElementById('parameterFilter');
    const parameterDropdown = document.getElementById('parameterDropdown');
    
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
 * Initializes the parameter filter dropdown
 */
function initializeParameterFilter() {
    const parameterDropdown = document.getElementById('parameterDropdown');
    if (!parameterDropdown) {
        console.error('Parameter dropdown not found');
        return;
    }
    
    parameterDropdown.addEventListener('change', function() {
        const selectedParameter = this.value;
        window.currentParameterFilter = selectedParameter || null;
        
        // Re-visualize with the new filter
        if (window.currentSiteData) {
            visualizeGeoJsonPolygons(window.currentSiteData);
        }
    });
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
    
    // Add event listener for site selection
    siteDropdown.addEventListener('change', function() {
        if (this.value) {
            const selectedOption = this.options[this.selectedIndex];
            const bounds = JSON.parse(selectedOption.dataset.bounds);
            
            // Find the selected site to determine format
            loadSiteData().then(sites => {
                const selectedSite = sites.find(site => site.filename === this.value);
                if (selectedSite) {
                    const format = selectedSite.geoJson.features.length > 0 ? 
                        detectGeoJsonFormat(selectedSite.geoJson.features[0]) : 'legacy';
                    
                    // Show/hide parameter filter based on format
                    toggleParameterFilter(format);
                    
                    // Store current site data globally for filter re-rendering
                    window.currentSiteData = selectedSite.geoJson;
                }
            });
            
            navigateToSite(bounds);
        } else {
            // Hide parameter filter when no site selected
            toggleParameterFilter('legacy');
            window.currentSiteData = null;
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
            description: description || 'Unknown'
        };
    }
    return { id: name, description: 'Unknown' };
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
    const existingEntities = viewer.entities.values.filter(entity => entity.name?.startsWith('Site_'));
    existingEntities.forEach(entity => viewer.entities.remove(entity));
    
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
    
    console.log(`Visualizing ${format} format GeoJSON with ${isGeographic ? 'geographic' : 'projected'} coordinates`);
    
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
    }
    
    geoJsonData.features.forEach((feature, index) => {
        // For Boyd format, filter out non PA/NPA features (numeric names and test features)
        if (format === 'boyd') {
            const name = feature.properties.name;
            const category = getBoydFeatureCategory(feature);
            if (category === 'data-point') {
                return; // Skip data points/reference features
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
            
            if (isPlantable) {
                let lightLevel, measurements;
                
                if (format === 'boyd') {
                    // Parse Boyd format data
                    const parsed = parseBoydName(feature.properties.name);
                    const boydData = parseBoydEcologicalData(feature.properties.description || '');
                    lightLevel = getBoydLightLevel(boydData);
                    
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
                        } else {
                            // No data for this parameter - use gray
                            polygonColor = Cesium.Color.LIGHTGRAY.withAlpha(0.5);
                            outlineColor = Cesium.Color.GRAY;
                        }
                    } else {
                        // Use original GeoJSON color if available, otherwise use light-level based color
                        if (feature.properties.color) {
                            polygonColor = normalizedArrayToCesiumColor(feature.properties.color);
                            outlineColor = polygonColor.darken(0.3, new Cesium.Color());
                        } else {
                            polygonColor = getGreenShadeByLight(lightLevel);
                            outlineColor = getOutlineColorByLight(lightLevel);
                        }
                    }
                } else {
                    // Parse legacy format data
                    lightLevel = extractLightLevel(feature.properties.name);
                    measurements = parsePlantableMeasurements(feature.properties.name);
                    
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
                    
                    // Use grayscale when parameter filter is active, otherwise use original colors
                    if (window.currentParameterFilter) {
                        // Make NPAs grayscale when filter is active
                        polygonColor = Cesium.Color.GRAY.withAlpha(0.6);
                        outlineColor = Cesium.Color.DARKGRAY;
                    } else {
                        // Use original GeoJSON color if available
                        if (feature.properties.color) {
                            polygonColor = normalizedArrayToCesiumColor(feature.properties.color);
                            outlineColor = polygonColor.darken(0.3, new Cesium.Color());
                        } else {
                            // Fallback colors based on category
                            if (category === 'data-point') {
                                polygonColor = Cesium.Color.ORANGE.withAlpha(0.7);
                                outlineColor = Cesium.Color.DARKORANGE;
                            } else {
                                polygonColor = Cesium.Color.RED.withAlpha(0.6);
                                outlineColor = Cesium.Color.DARKRED;
                            }
                        }
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
                    descriptionContent = `
                        <div style="font-family: 'Oxygen', sans-serif;">
                            <h3>${parsed.id}</h3>
                            <p><strong>Type:</strong> Non-Plantable Area</p>
                            <p><strong>Feature:</strong> ${parsed.description}</p>
                        </div>
                    `;
                }
            }
            
        // Set heights based on polygon type - non-plantable areas are taller for easy clicking
        let baseHeight, extrudedHeight, outlineWidth, polygonAlpha;
        
        if (isPlantable) {
            // Plantable areas at base level
            baseHeight = 5.5;
            extrudedHeight = 6.0;
            outlineWidth = 2;
            polygonAlpha = 0.7;
        } else {
            // Non-plantable areas elevated to stick out above plantable areas
            baseHeight = 6.5;
            extrudedHeight = 7;
            outlineWidth = 3;
            polygonAlpha = 0.8;
        }
        
        // Create ground-level polygon for classification (plantable areas only)
        if (isPlantable) {
            viewer.entities.add({
                name: `Site_Polygon_Ground_${index}`,
                polygon: {
                    hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
                    material: polygonColor.withAlpha(0.3),
                    height: 0,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    classificationType: Cesium.ClassificationType.BOTH,
                    show: true
                }
            });
        }
        
        // Create the main clickable polygon
        viewer.entities.add({
            name: `Site_Polygon_${index}`,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
                material: polygonColor.withAlpha(polygonAlpha),
                outline: true,
                outlineColor: outlineColor,
                outlineWidth: outlineWidth,
                extrudedHeight: extrudedHeight,
                height: baseHeight,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: 2000
            },
            description: descriptionContent
        });
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
                    position: Cesium.Cartesian3.fromDegrees(latLng.lng, latLng.lat, 12.0), // Above plantable polygons
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
                    position: Cesium.Cartesian3.fromDegrees(latLng.lng, latLng.lat, 12.0), // Above non-plantable polygons
                    cylinder: {
                        length: 6.5,
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
    
    console.log(`Visualized ${geoJsonData.features.length} features from GeoJSON`);
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
    
    console.log('Tutorial/flythrough stopped by site selection');
}

/**
 * Navigates the camera to the selected site bounds
 * @param {Object} bounds - Site bounds {minLat, maxLat, minLng, maxLng}
 */
function navigateToSite(bounds) {
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
    
    // Calculate appropriate viewing height based on bounds
    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const maxSpan = Math.max(latSpan, lngSpan);
    const height = Math.max(500, maxSpan * 111320 * 2); // Convert degrees to meters roughly
    
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
        
        if (selectedSite && selectedSite.geoJson) {
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
    // Instantiate the CesiumManager
    window.map3D = new CesiumManager('cesiumContainer');

    // Instantiate the GoogleMaps2DManager and wait for it to be ready
    window.map2D = await new GoogleMaps2DManager('map2D');
    console.log("Google Map object is ready:", window.map2D);

    // Instantiate the UserManager and store it globally
    window.user = new UserManager(window.map3D);
    
    // Initialize the site selector and parameter filter
    await initializeSiteSelector();
    initializeParameterFilter();
}

// Expose the functions globally
window.parseMarkdown = parseMarkdown;
window.displayMessage = displayMessage;
window.addSaveViewButton = addSaveViewButton;
window.printViewConfiguration = printViewConfiguration;
window.allSystemsGo = allSystemsGo;
window.debug = debug;
window.createReusableButton = createReusableButton;
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
