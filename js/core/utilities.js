import { ecoLoadingMessages } from '../ui/loading/ecoLoadingMessages.js';

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
 * @returns {Object} - Bounds object with minLat, maxLat, minLng, maxLng
 */
function calculateBounds(geoJsonData) {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    let isGeographic = true;

    // Check first feature to determine coordinate type
    if (geoJsonData.features && geoJsonData.features.length > 0) {
        const firstFeature = geoJsonData.features[0];
        if (firstFeature.geometry.type === 'Polygon') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates) === 'geographic';
        } else if (firstFeature.geometry.type === 'Point') {
            isGeographic = detectCoordinateFormat(firstFeature.geometry.coordinates[0][0]) === 'geographic';
        }
    }

    geoJsonData.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                const [x, y] = coord;
                let latLng;

                if (isGeographic) {
                    latLng = { lat: y, lng: x };
                } else {
                    // Convert UTM to lat/lng
                    latLng = utmToLatLng(x, y);
                }

                if (latLng) {
                    minLng = Math.min(minLng, latLng.lng);
                    maxLng = Math.max(maxLng, latLng.lng);
                    minLat = Math.min(minLat, latLng.lat);
                    maxLat = Math.max(maxLat, latLng.lat);
                }
            });
        } else if (feature.geometry.type === 'Point') {
            const [x, y] = feature.geometry.coordinates;
            let latLng;

            if (isGeographic) {
                latLng = { lat: y, lng: x };
            } else {
                // Convert UTM to lat/lng
                latLng = utmToLatLng(x, y);
            }

            if (latLng) {
                minLng = Math.min(minLng, latLng.lng);
                maxLng = Math.max(maxLng, latLng.lng);
                minLat = Math.min(minLat, latLng.lat);
                maxLat = Math.max(maxLat, latLng.lat);
            }
        }
    });

    return { minLat, maxLat, minLng, maxLng };
}

/**
 * Converts UTM coordinates to latitude/longitude
 * @param {number} easting - UTM easting coordinate
 * @param {number} northing - UTM northing coordinate
 * @returns {Object|null} - Object with lat and lng properties, or null if conversion fails
 */
function utmToLatLng(easting, northing) {
    try {
        // Define the UTM Zone 17N projection (EPSG:32617) - common for Florida
        const utmProjection = '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs';
        const wgs84Projection = '+proj=longlat +datum=WGS84 +no_defs';

        // Convert UTM to WGS84
        const converted = proj4(utmProjection, wgs84Projection, [easting, northing]);

        return {
            lng: converted[0],
            lat: converted[1]
        };
    } catch (error) {
        console.warn('UTM to LatLng conversion failed:', error);
        return null;
    }
}

/**
 * Detects GeoJSON format type based on feature properties
 * @param {Object} feature - A GeoJSON feature
 * @returns {string} - 'ecological' or 'legacy'
 */
function detectGeoJsonFormat(feature) {
    // Ecological data format has rich properties with description field containing M1-M10 data
    if (feature.properties.description && feature.properties.description.includes('Ecodash.ai Ecological Niche Model')) {
        return 'ecological';
    }
    // Legacy format has Layer property
    if (feature.properties.Layer) {
        return 'legacy';
    }
    // Default to legacy for unknown formats
    return 'legacy';
}

/**
 * Determines if feature is plantable based on format and properties
 * @param {Object} feature - A GeoJSON feature
 * @param {string} geoJsonFormat - 'ecological' or 'legacy'
 * @returns {boolean} - True if plantable
 */
function isPlantableFeature(feature, geoJsonFormat) {
    if (geoJsonFormat === 'ecological') {
        // Ecological data format: PA in name means plantable, NPA and numeric means non-plantable
        const name = feature.properties.name;
        if (!name) return false;

        // Check for PA designation (but not NPA)
        if (name.startsWith('PA') && name.includes('=') && !name.includes('NPA')) {
            return true;
        }

        // NPA features are explicitly non-plantable
        if (name.includes('NPA')) {
            return false;
        }

        // Numeric-only names are non-plantable
        if (/^\d+$/.test(name.trim())) {
            return false;
        }

        return false; // Default for unknown patterns
    } else {
        // Legacy format: Layer determines plantability
        return feature.properties.Layer === 'Plantable Areas';
    }
}

/**
 * Determines feature category for Ecological data format data
 * @param {Object} feature - A GeoJSON feature
 * @returns {string} - 'plantable', 'non-plantable', or 'unknown'
 */
function getEcologicalFeatureCategory(feature) {
    const name = feature.properties.name;
    if (!name) return 'unknown';

    // Check for PA designation (but not NPA)
    if (name.startsWith('PA') && name.includes('=') && !name.includes('NPA')) {
        return 'plantable';
    }

    // NPA features are non-plantable
    if (name.includes('NPA')) {
        return 'non-plantable';
    }

    // Numeric-only names are non-plantable
    if (/^\d+$/.test(name.trim())) {
        return 'non-plantable';
    }

    return 'unknown';
}

/**
 * Parses ecological data from Ecological data format description field
 * @param {string} description - Description field containing M1-M10 data
 * @returns {Object} - Parsed ecological parameters
 */
function parseEcologicalData(description) {
    const data = {};

    if (!description) return data;

    // Extract M1-M10 parameter values using regex
    const params = {
        'M1': 'soilMoisture',  // Moisture
        'M2': 'sunlight',      // Light Hours
        'M3': 'pH',            // Soil pH
        'M4': 'nitrogen',      // Nitrogen
        'M5': 'phosphorus',    // Phosphorus
        'M6': 'potassium',     // Potassium
        'M7': 'organicMatter', // Organic Matter
        'M8': 'droughtRisk',   // Drought Risk
        'M9': 'floodRisk',     // Flood Risk
        'M10': 'windExposure'  // Extreme Wind Exposure
    };

    Object.entries(params).forEach(([key, paramName]) => {
        // Match pattern like "M2: Light (hours) = 4 - 6"
        const regex = new RegExp(`${key}:[^=]+=\\s*([^\\n]+)`);
        const match = description.match(regex);
        if (match) {
            data[paramName] = match[1].trim();
        }
    });

    return data;
}

/**
 * Extracts NPA category from name string
 * @param {string} name - Feature name like "NPA04=\"Buildings and Structures\""
 * @returns {string} - Category name like "Buildings and Structures"
 */
function extractNPACategory(name) {
    if (!name) return 'Unknown';

    // Check if it's in the format NPA##="Description"
    const npaMatch = name.match(/NPA\d+="([^"]+)"/);
    if (npaMatch) {
        return npaMatch[1];
    }

    // Check if it's in the format NPA##='Description' (single quotes)
    const npaSingleMatch = name.match(/NPA\d+='([^']+)'/);
    if (npaSingleMatch) {
        return npaSingleMatch[1];
    }

    // Fallback to returning the whole name
    return name;
}

// Expose the functions globally for cross-file access
window.parseMarkdown = parseMarkdown;
window.displayMessage = displayMessage;
window.calculateBounds = calculateBounds;
window.utmToLatLng = utmToLatLng;
window.detectCoordinateFormat = detectCoordinateFormat;
window.detectGeoJsonFormat = detectGeoJsonFormat;
window.isPlantableFeature = isPlantableFeature;
window.parseEcologicalData = parseEcologicalData;
window.getEcologicalFeatureCategory = getEcologicalFeatureCategory;