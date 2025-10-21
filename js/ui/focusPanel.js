/**
 * Focus Panel Controller
 * Manages the slide-out panel for displaying detailed ecological metrics
 */

class FocusPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.currentPA = null;
        this.metricOrder = [
            'sunlight',      // formerly lightHours
            'soilMoisture',  // formerly moisture
            'pH',
            'nitrogen',
            'phosphorus',
            'potassium',
            'organicMatter',
            'droughtRisk',
            'floodRisk',
            'windExposure'
        ];
        
        this.metricDefinitions = {
            sunlight: {
                name: 'Sunlight',
                unit: 'hours/day',
                definition: 'Direct sunlight hours per day',
                interpretations: {
                    low: 'Full Shade',
                    medium: 'Partial Sun',
                    high: 'Full Sun'
                },
                thresholds: [3, 6] // < 3 = shade, 3-6 = partial, > 6 = full sun
            },
            soilMoisture: {
                name: 'Soil Moisture',
                unit: '%VWC', // Volumetric Water Content - industry standard
                definition: 'Volumetric water content in soil',
                interpretations: {
                    low: 'Dry',
                    medium: 'Moderate',
                    high: 'Wet'
                },
                thresholds: [20, 40], // <20% = dry, 20-40% = moderate, >40% = wet
                // Mapping for legacy categorical values
                categoryMap: {
                    'dry': 10,
                    'dry - moderate': 20,
                    'moderate': 30,
                    'moderate - wet': 40,
                    'wet': 50
                }
            },
            pH: {
                name: 'Soil pH',
                unit: 'pH',
                definition: 'Soil acidity/alkalinity measure',
                interpretations: {
                    low: 'Acidic',
                    medium: 'Neutral',
                    high: 'Alkaline'
                },
                thresholds: [6.0, 7.5]
            },
            nitrogen: {
                name: 'Soil Nitrogen',
                unit: 'ppm',
                definition: 'Nitrogen content in parts per million',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [10, 30]
            },
            phosphorus: {
                name: 'Soil Phosphorus',
                unit: 'ppm',
                definition: 'Phosphorus content in parts per million',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [15, 30]
            },
            potassium: {
                name: 'Soil Potassium',
                unit: 'ppm',
                definition: 'Potassium content in parts per million',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [60, 120]
            },
            organicMatter: {
                name: 'Soil Organic Matter',
                unit: '%',
                definition: 'Percentage of soil composition',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [2, 5]
            },
            droughtRisk: {
                name: 'Drought Risk',
                unit: '%/year',
                definition: 'Annual drought probability',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [20, 50]
            },
            floodRisk: {
                name: 'Flood Risk',
                unit: '%/year',
                definition: 'Annual flood probability',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [5, 20]
            },
            windExposure: {
                name: 'Wind Exposure',
                unit: '%/year',
                definition: 'Annual severe wind probability',
                interpretations: {
                    low: 'Low',
                    medium: 'Moderate',
                    high: 'High'
                },
                thresholds: [30, 60]
            }
        };
        
        this.init();
    }
    
    init() {
        // Create panel HTML structure
        this.createPanelHTML();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Initialize chart renderer
        this.chartRenderer = new MetricChart();
    }
    
    createPanelHTML() {
        const panelHTML = `
            <div id="focusPanel" class="focus-panel">
                <div class="focus-panel-header">
                    <h3 class="pa-name"></h3>
                    <button class="close-button" aria-label="Close panel">×</button>
                </div>
                <div class="focus-panel-content">
                    <div class="focus-panel-loading">Loading ecological data...</div>
                </div>
            </div>
        `;
        
        // Add panel to body
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('focusPanel');
    }
    
    setupEventListeners() {
        // Close button
        const closeBtn = this.panel.querySelector('.close-button');
        closeBtn.addEventListener('click', () => this.hide());
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                if (window.clearPAConnection) {
                    window.clearPAConnection();
                } else {
                    this.hide();
                }
            }
        });
    }
    
    show(paName, paData) {
        // console.log('Showing focus panel for:', paName);
        
        if (!this.panel || !document.body.contains(this.panel)) {
            this.init();
        }
        
        this.currentPA = paName;
        
        // Update header with location name in ALL CAPS and subtitle
        const headerHTML = `
            <div>
                <h3 class="pa-name">${paName.toUpperCase()}</h3>
                <p class="pa-subtitle">Ecological Niche Metrics</p>
            </div>
            <button class="close-button" aria-label="Close panel">×</button>
        `;
        this.panel.querySelector('.focus-panel-header').innerHTML = headerHTML;
        
        // Re-attach close button listener to trigger full animation
        const closeBtn = this.panel.querySelector('.close-button');
        closeBtn.addEventListener('click', () => {
            if (window.clearPAConnection) {
                window.clearPAConnection();
            } else {
                this.hide();
            }
        });
        
        // Parse and display metrics
        this.displayMetrics(paData);
        
        this.panel.classList.add('visible');
        this.isVisible = true;
    }
    
    hide() {
        // Only handle the panel visibility, let the animation system handle the rest
        this.panel.classList.remove('visible');
        this.isVisible = false;
        this.currentPA = null;
        
        // If called directly (e.g., from close button), trigger the full animation
        if (!this.panel.classList.contains('animating-out') && window.clearPAConnection) {
            window.clearPAConnection();
        }
    }
    
    displayMetrics(paData) {
        const content = this.panel.querySelector('.focus-panel-content');
        content.innerHTML = '';
        
        // Parse ecological data
        const metrics = this.parseEcologicalData(paData);
        
        // Create metric rows
        this.metricOrder.forEach((metricKey, index) => {
            const metricData = metrics[metricKey];
            if (!metricData) return;
            
            const metricDef = this.metricDefinitions[metricKey];
            const row = this.createMetricRow(metricKey, metricData, metricDef, index);
            content.appendChild(row);
        });
    }
    
    parseEcologicalData(paData) {
        const metrics = {};
        
        // Extract metrics from PA data
        if (paData.properties && paData.properties.description) {
            const description = paData.properties.description;
            
            // Parse M1-M10 values with more flexible regex
            // Matches patterns like "M1: Moisture Level = 2-3" or "M2: Light Hours (hours/day) = 6-8"
            // Also matches categorical values like "M1: Moisture Level = Moderate"
            const metricMatches = description.matchAll(/M(\d+):[^=]+=\s*([^\n]+?)(?=\s*M\d+:|$)/g);
            
            // console.log('Parsing ecological data from:', description.substring(0, 200) + '...');
            
            for (const match of metricMatches) {
                const metricNumber = parseInt(match[1]);
                const rawValue = match[2];
                
                // Map M numbers to metric names
                const metricMap = {
                    1: 'soilMoisture',    // M1: Moisture
                    2: 'sunlight',        // M2: Light Hours
                    3: 'pH',              // M3: pH
                    4: 'nitrogen',        // M4: N
                    5: 'phosphorus',      // M5: P
                    6: 'potassium',       // M6: K
                    7: 'organicMatter',   // M7: Organic Matter
                    8: 'droughtRisk',     // M8: Drought Risk
                    9: 'floodRisk',       // M9: Flood Risk
                    10: 'windExposure'    // M10: Wind Exposure
                };
                
                const metricName = metricMap[metricNumber];
                if (metricName) {
                    // Parse the value - could be range (e.g., "2-3") or single value or categorical
                    const rangeMatch = rawValue.match(/([\d.-]+)\s*-\s*([\d.-]+)/);
                    
                    if (rangeMatch) {
                        // Numerical range
                        const value1 = parseFloat(rangeMatch[1]);
                        const value2 = parseFloat(rangeMatch[2]);
                        
                        metrics[metricName] = {
                            min: Math.min(value1, value2),
                            max: Math.max(value1, value2),
                            mean: (value1 + value2) / 2,
                            range: Math.abs(value2 - value1)
                        };
                        // console.log(`Found M${metricNumber}: ${value1}-${value2}`);
                    } else if (metricNumber === 1 && this.metricDefinitions.soilMoisture.categoryMap) {
                        // Check for categorical moisture values
                        const moistureText = rawValue.toLowerCase().trim();
                        const categoryMap = this.metricDefinitions.soilMoisture.categoryMap;
                        
                        if (categoryMap[moistureText]) {
                            const mappedValue = categoryMap[moistureText];
                            metrics[metricName] = {
                                min: mappedValue - 5,
                                max: mappedValue + 5,
                                mean: mappedValue,
                                range: 10
                            };
                            // console.log(`Mapped categorical moisture '${moistureText}' to ${mappedValue}%VWC`);
                        } else {
                            // Try to parse as single number
                            const singleValue = parseFloat(rawValue);
                            if (!isNaN(singleValue)) {
                                metrics[metricName] = {
                                    min: singleValue,
                                    max: singleValue,
                                    mean: singleValue,
                                    range: 0
                                };
                            }
                        }
                    } else {
                        // Try to parse as single number
                        const singleValue = parseFloat(rawValue);
                        if (!isNaN(singleValue)) {
                            metrics[metricName] = {
                                min: singleValue,
                                max: singleValue,
                                mean: singleValue,
                                range: 0
                            };
                            // console.log(`Found M${metricNumber}: ${singleValue}`);
                        }
                    }
                }
            }
        }
        
        // console.log('Parsed metrics:', metrics);
        return metrics;
    }
    
    createMetricRow(metricKey, metricData, metricDef, index) {
        const row = document.createElement('div');
        row.className = 'metric-row';
        row.dataset.metric = metricKey;
        
        // Get interpretation
        const interpretation = this.getInterpretation(metricData.mean, metricDef);
        
        // Calculate normalized position for Viridis color
        const projectRange = this.getProjectRange(metricKey);
        const normalizedPosition = (metricData.mean - projectRange.min) / 
                                 (projectRange.max - projectRange.min);
        const viridisColor = this.chartRenderer.getViridisColor(normalizedPosition);
        
        // Ensure good contrast by lightening dark colors
        const rgb = viridisColor.match(/\d+/g);
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        let contrastColor = viridisColor;
        if (brightness < 128) {
            // Lighten dark colors for better contrast
            const factor = 1.5;
            contrastColor = `rgb(${Math.min(255, rgb[0] * factor)}, ${Math.min(255, rgb[1] * factor)}, ${Math.min(255, rgb[2] * factor)})`;
        }
        
        // Standard deviation calculation for display
        const stdDev = metricData.range / 4 || 0.1;
        
        row.innerHTML = `
            <div class="metric-container">
                <div class="metric-header">
                    <span class="metric-name">${metricDef.name}</span>
                    <span class="metric-interpretation">${interpretation}</span>
                </div>
                <div class="metric-chart">
                    <div class="chart-wrapper">
                        <canvas class="gaussian-canvas" id="canvas-${metricKey}"></canvas>
                        <div class="y-axis-label">probability</div>
                        <div class="y-axis-max" id="y-max-${metricKey}"></div>
                        <div class="y-axis-zero">0%</div>
                        <div class="metric-value-line" id="line-${metricKey}"></div>
                        <div class="metric-dot" id="dot-${metricKey}"></div>
                        <div class="metric-value-label" id="label-${metricKey}">${metricData.mean.toFixed(1)}</div>
                    </div>
                </div>
                <div class="metric-details">
                    <span class="metric-definition">${metricDef.definition}</span>
                </div>
            </div>
        `;
        
        // Render chart after adding to DOM
        setTimeout(() => {
            this.renderMetricChart(metricKey, metricData, metricDef);
        }, 50 + (index * 50));
        
        return row;
    }
    
    getInterpretation(value, metricDef) {
        const { thresholds, interpretations } = metricDef;
        
        if (value < thresholds[0]) {
            return interpretations.low;
        } else if (value > thresholds[1]) {
            return interpretations.high;
        } else {
            return interpretations.medium;
        }
    }
    
    formatValue(metricData, metricDef) {
        const { min, max } = metricData;
        const { unit } = metricDef;
        
        if (min === max) {
            return `${min.toFixed(1)} ${unit}`;
        } else {
            return `${min.toFixed(1)}-${max.toFixed(1)} ${unit}`;
        }
    }
    
    renderMetricChart(metricKey, metricData, metricDef) {
        const canvas = document.getElementById(`canvas-${metricKey}`);
        const dot = document.getElementById(`dot-${metricKey}`);
        const line = document.getElementById(`line-${metricKey}`);
        const label = document.getElementById(`label-${metricKey}`);
        
        if (!canvas || !dot) {
            // console.log(`Missing elements for metric ${metricKey}`);
            return;
        }
        
        // Get project-wide min/max for this metric
        const projectRange = this.getProjectRange(metricKey);
        
        // Ensure canvas has proper dimensions
        // Set fixed dimensions to match the container minus padding
        const containerWidth = canvas.parentElement.offsetWidth;
        canvas.width = containerWidth;
        canvas.height = 100; // Fixed height to match CSS
        
        // Render Gaussian curve and get peak probability
        const peakInfo = this.chartRenderer.drawGaussian(canvas, metricData, projectRange);
        
        // Calculate normalized position
        const normalizedPosition = (metricData.mean - projectRange.min) / 
                                 (projectRange.max - projectRange.min);
        
        // Calculate dot position to match canvas drawing
        const canvasPaddingX = 35; // Internal canvas padding (from metricChart.js)
        const canvasPaddingRight = 20; // Internal canvas padding right
        const drawWidth = canvas.width - canvasPaddingX - canvasPaddingRight;
        
        // Calculate dot position on the canvas
        const dotPosition = canvasPaddingX + (normalizedPosition * drawWidth);
        const dotColor = this.chartRenderer.getViridisColor(normalizedPosition);
        
        // Position dot at the peak of the Gaussian
        // The dot is positioned relative to the metric-chart container
        // Adjust for dot radius (8.5px) so center aligns with peak
        const dotRadius = 8.5; // Half of 17px width
        dot.style.left = `${dotPosition}px`;
        dot.style.top = `${peakInfo.peakY - dotRadius}px`;
        dot.style.backgroundColor = dotColor;
        
        // Update y-axis max label with peak probability
        const yMaxLabel = document.getElementById(`y-max-${metricKey}`);
        if (yMaxLabel) {
            yMaxLabel.textContent = `${Math.round(peakInfo.peakProbability * 100)}%`;
        }
        
        // Adjust line height to connect to dot
        if (line) {
            line.style.left = `${dotPosition}px`;
            // Line should go from top of chart to center of dot
            line.style.height = `${peakInfo.peakY - dotRadius}px`;
            line.style.top = '25px'; // Match canvas paddingTop
        }
        
        if (label) {
            // Position label above the chart area with increased spacing
            label.style.left = `${dotPosition}px`;
            label.style.top = '-7px'; // Increased spacing from dot
        }
    }
    
    getProjectRange(metricKey) {
        // Calculate actual min/max from all PA features in current site
        if (!this.projectRanges) {
            this.calculateProjectRanges();
        }
        
        return this.projectRanges[metricKey] || { min: 0, max: 100 };
    }
    
    calculateProjectRanges() {
        this.projectRanges = {};
        
        // Default ranges if no data
        const defaults = {
            sunlight: { min: 0, max: 12 },
            soilMoisture: { min: 0, max: 60 },  // Changed to %VWC scale
            pH: { min: 4.0, max: 9.0 },
            nitrogen: { min: 0, max: 50 },
            phosphorus: { min: 0, max: 100 },
            potassium: { min: 0, max: 200 },
            organicMatter: { min: 0, max: 10 },
            droughtRisk: { min: 0, max: 100 },
            floodRisk: { min: 0, max: 100 },
            windExposure: { min: 0, max: 100 }
        };
        
        // Initialize with defaults
        Object.keys(defaults).forEach(key => {
            this.projectRanges[key] = { ...defaults[key] };
        });
        
        // Calculate actual ranges from site data
        if (window.currentSiteData && window.currentSiteData.features) {
            const paFeatures = window.currentSiteData.features.filter(f => 
                f.properties.name && f.properties.name.includes('PA') && !f.properties.name.includes('NPA')
            );
            
            // First pass: collect all values to determine actual ranges
            const allValues = {};
            paFeatures.forEach(feature => {
                const metrics = this.parseEcologicalData(feature);
                
                Object.keys(metrics).forEach(metricKey => {
                    const metricData = metrics[metricKey];
                    if (!allValues[metricKey]) {
                        allValues[metricKey] = [];
                    }
                    allValues[metricKey].push(metricData.min, metricData.max);
                });
            });
            
            // Second pass: set ranges with some padding for visualization
            Object.keys(allValues).forEach(metricKey => {
                const values = allValues[metricKey];
                if (values.length > 0) {
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const padding = (max - min) * 0.1 || 1; // 10% padding or at least 1
                    
                    this.projectRanges[metricKey] = {
                        min: Math.max(0, min - padding), // Don't go below 0 for most metrics
                        max: max + padding
                    };
                    
                    // Special handling for pH to keep reasonable bounds
                    if (metricKey === 'pH') {
                        this.projectRanges[metricKey].min = Math.max(4.0, min - padding);
                        this.projectRanges[metricKey].max = Math.min(9.0, max + padding);
                    }
                }
            });
        }
    }
}

// Initialize focus panel when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.focusPanel = new FocusPanel();
    });
} else {
    window.focusPanel = new FocusPanel();
}