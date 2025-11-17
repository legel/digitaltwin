/**
 * Ecological Metrics Utilities
 * Centralized utilities for ecological data processing, visualization, and color mapping
 * Used by layerControls.js, metricChart.js, and focusPanel.js
 */

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
        case 'sunlight':
        case 'pH':
        case 'nitrogen':
        case 'phosphorus':
        case 'potassium':
        case 'organicMatter':
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

        case 'soilMoisture':
            // Map moisture levels to numbers
            const moistureMap = {
                'dry': 1,
                'dry - moderate': 2,
                'moderate': 3,
                'moderate - wet': 4,
                'wet': 5
            };
            return moistureMap[paramValue.toLowerCase()] || 3;

        case 'droughtRisk':
        case 'floodRisk':
            // Extract percentage ranges like "5 - 10"
            const riskMatch = paramValue.match(/(\d+)\s*-\s*(\d+)/);
            if (riskMatch) {
                const min = parseInt(riskMatch[1]);
                const max = parseInt(riskMatch[2]);
                return (min + max) / 2;
            }
            break;

        case 'windExposure':
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
 * Viridis colormap implementation for scientific data visualization
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
        c1[0] + f * (c2[0] - c1[0]),
        c1[1] + f * (c2[1] - c1[1]),
        c1[2] + f * (c2[2] - c1[2])
    ];
}

/**
 * Maps parameter value to color using Viridis colormap
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
    if (paramType === 'soilMoisture') {
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
    if (paramType === 'soilMoisture') {
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
        let suffix = '';

        switch (paramType) {
            case 'sunlight':
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
            case 'organicMatter':
                unit = '%';
                break;
            case 'droughtRisk':
            case 'floodRisk':
            case 'windExposure':
                unit = '%';
                suffix = ' annual probability';
                break;
        }

        labelsDiv.innerHTML = `
            <div style="font-weight: 700;">${getParameterDisplayName(paramType)}</div>
            <div style="font-size: 12px;">${minLabel}${unit} - ${maxLabel}${unit}${suffix}</div>
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
        'soilMoisture': 'Soil Moisture',
        'sunlight': 'Light Hours',
        'pH': 'Soil pH',
        'nitrogen': 'Nitrogen (N)',
        'phosphorus': 'Phosphorus (P)',
        'potassium': 'Potassium (K)',
        'organicMatter': 'Organic Matter',
        'droughtRisk': 'Drought Risk',
        'floodRisk': 'Flood Risk',
        'windExposure': 'Extreme Wind Exposure'
    };
    return names[paramType] || paramType;
}

// Expose functions to global scope for compatibility with existing code
window.parseParameterValue = parseParameterValue;
window.viridisColormap = viridisColormap;
window.getParameterColor = getParameterColor;
window.createColorLegend = createColorLegend;
window.getParameterDisplayName = getParameterDisplayName;