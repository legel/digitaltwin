/**
 * Focus Panel Controller
 * Manages the slide-out panel for displaying detailed ecological metrics
 */

class FocusPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.currentPA = null;
        this.currentPage = 'plantRecommendations'; // Default to plant recommendations page
        this.pages = {
            plantRecommendations: {
                title: 'Plant Recommendations',
                icon: '🌱',
                subtitle: 'Plant Recommendations'
            },
            ecologicalMetrics: {
                title: 'Ecological Metrics',
                icon: '📊',
                subtitle: 'Ecological Niche Metrics'
            }
        };
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

        // Ensure panel starts with correct width mode
        this.updatePanelWidth(null, this.currentPage);
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
        if (!this.panel || !document.body.contains(this.panel)) {
            this.init();
        }
        this.currentPA = paName;

        // Set initial panel width based on current page
        this.updatePanelWidth(null, this.currentPage);
        
        // Update header with location name in ALL CAPS, page buttons, and close button
        const currentPageData = this.pages[this.currentPage];
        const headerHTML = `
            <div class="panel-title-section">
                <h3 class="pa-name">${paName.toUpperCase()}</h3>
                <p class="pa-subtitle">${currentPageData.subtitle}</p>
                ${this.currentPage === 'plantRecommendations' ? `
                <div class="refine-plant-section">
                    <button id="refine-plants-btn" class="action-button">
                        <i class="fas fa-leaf"></i>
                        <i class="fas fa-sliders-h"></i>
                        <span>Refine Plant List</span>
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="page-controls">
                <button class="page-button ${this.currentPage === 'plantRecommendations' ? 'active' : ''}"
                        data-page="plantRecommendations"
                        aria-label="Plant Recommendations"
                        title="Plant Recommendations">${this.pages.plantRecommendations.icon}</button>
                <button class="page-button ${this.currentPage === 'ecologicalMetrics' ? 'active' : ''}"
                        data-page="ecologicalMetrics"
                        aria-label="Ecological Metrics"
                        title="Ecological Metrics">${this.pages.ecologicalMetrics.icon}</button>
                <button class="close-button" aria-label="Close panel">×</button>
            </div>
        `;
        this.panel.querySelector('.focus-panel-header').innerHTML = headerHTML;
        
        // Re-attach event listeners
        this.attachHeaderEventListeners();
        
        // Display content for current page
        this.displayCurrentPage(paData);
        
        this.panel.classList.add('visible');
        this.isVisible = true;
    }
    
    hide() {
        // Clean up any active purchase widgets when focus panel closes
        if (window.plantRecommendations && typeof window.plantRecommendations.onFocusPanelClose === 'function') {
            window.plantRecommendations.onFocusPanelClose();
        }

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
                        }
                    }
                }
            }
        }
        
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

    attachHeaderEventListeners() {
        // Close button
        const closeBtn = this.panel.querySelector('.close-button');
        closeBtn.addEventListener('click', () => {
            if (window.clearPAConnection) {
                window.clearPAConnection();
            } else {
                this.hide();
            }
        });

        // Page buttons
        const pageButtons = this.panel.querySelectorAll('.page-button');
        pageButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetPage = e.target.dataset.page;
                if (targetPage && targetPage !== this.currentPage) {
                    this.switchToPage(targetPage);
                }
            });
        });

        // Refine plants button
        const refinePlantsBtn = this.panel.querySelector('#refine-plants-btn');
        if (refinePlantsBtn) {
            refinePlantsBtn.addEventListener('click', () => {
                if (window.plantRecommendations) {
                    window.plantRecommendations.toggleFilters();
                }
            });
        }
    }

    /**
     * Update Refine Plant List button visibility based on current page
     */
    updateRefinePlantButtonVisibility() {
        // Find existing refine plant section
        let refinePlantSection = this.panel.querySelector('.refine-plant-section');

        if (this.currentPage === 'plantRecommendations') {
            // Show button on plant recommendations page
            if (!refinePlantSection) {
                // Create the section if it doesn't exist
                const titleSection = this.panel.querySelector('.panel-title-section');
                if (titleSection) {
                    const refinePlantHTML = `
                        <div class="refine-plant-section">
                            <button id="refine-plants-btn" class="refine-plants-button">
                                <i class="fas fa-filter"></i> Refine Plant List
                            </button>
                        </div>
                    `;
                    titleSection.insertAdjacentHTML('beforeend', refinePlantHTML);

                    // Attach event listener to the new button
                    const refinePlantsBtn = this.panel.querySelector('#refine-plants-btn');
                    if (refinePlantsBtn) {
                        refinePlantsBtn.addEventListener('click', () => {
                            if (window.plantRecommendations) {
                                window.plantRecommendations.toggleFilters();
                            }
                        });
                    }
                }
            } else {
                // Show existing section
                refinePlantSection.style.display = 'block';
            }
        } else {
            // Hide button on other pages
            if (refinePlantSection) {
                refinePlantSection.style.display = 'none';
            }
        }
    }

    switchToPage(pageName) {
        if (this.pages[pageName] && pageName !== this.currentPage) {
            const previousPage = this.currentPage;
            this.currentPage = pageName;

            // Update header to reflect new page
            const currentPageData = this.pages[this.currentPage];
            const subtitle = this.panel.querySelector('.pa-subtitle');
            subtitle.textContent = currentPageData.subtitle;

            // Update Refine Plant List button visibility based on current page
            this.updateRefinePlantButtonVisibility();

            // Update page button states
            const pageButtons = this.panel.querySelectorAll('.page-button');
            pageButtons.forEach(button => {
                const isActive = button.dataset.page === this.currentPage;
                button.classList.toggle('active', isActive);
            });

            // Update panel width class and animate if needed
            this.updatePanelWidth(previousPage, this.currentPage);

            // Refresh content for new page (don't reset filters when switching pages)
            this.displayCurrentPage(null, false);
        }
    }

    displayCurrentPage(paData, resetFilters = true) {
        if (this.currentPage === 'ecologicalMetrics') {
            this.displayMetrics(paData || this.currentPAData);
        } else if (this.currentPage === 'plantRecommendations') {
            this.displayPlantRecommendations(paData || this.currentPAData, resetFilters);
        }

        // Store PA data for page switching
        if (paData) {
            this.currentPAData = paData;
        }
    }

    displayPlantRecommendations(paData, resetFilters = true) {
        // Initialize plant recommendations page if not already done
        if (!window.plantRecommendations) {
            // Plant recommendations will be initialized by its own script
            setTimeout(() => this.displayPlantRecommendations(paData, resetFilters), 100);
            return;
        }

        // Initialize the plant recommendations system
        window.plantRecommendations.initialize();

        if (resetFilters) {
            // Full reload with new ecological data (first time or reopening focus panel)
            window.plantRecommendations.displayContent(paData);
        } else {
            // Just switch to plant recommendations page without resetting filters (page switching)
            window.plantRecommendations.displayContentWithoutReset(paData);
        }
    }

    /**
     * Update panel width based on page type with smooth animation
     */
    updatePanelWidth(previousPage, currentPage) {
        if (!this.panel) return;

        // Store current left position to preserve it during width changes
        const currentLeft = this.panel.style.left;

        // Remove existing width classes
        this.panel.classList.remove('plant-mode', 'metrics-mode');

        // Add appropriate width class
        if (currentPage === 'plantRecommendations') {
            this.panel.classList.add('plant-mode');
        } else if (currentPage === 'ecologicalMetrics') {
            this.panel.classList.add('metrics-mode');
        }

        // Restore left position if it was animation-set (contains px value)
        if (currentLeft && currentLeft.includes('px')) {
            this.panel.style.setProperty('left', currentLeft, 'important');
            this.panel.style.setProperty('right', 'auto', 'important');
        }
    }

    /**
     * Get terrain-style HTML structure for plant items
     */
    getTerrainPlantHTML(plant) {
        if (plant.photoTypes.length === 0 || !plant.currentPhotoType) {
            return `
                <div class="plant-item image-wrapper"
                     data-plant="${plant.name}"
                     data-species-key="${plant.speciesKey}"
                     data-current-index="1"
                     data-photo-count="0">
                    <div class="plant-image-container">
                        <div class="species-name-banner">
                            <div class="text-overlay">
                                <span class="genus">${this.getGenusFromName(plant.name)}</span>
                                <span class="species">${this.getSpeciesFromName(plant.name)}</span>
                            </div>
                        </div>
                        <img src="${this.getFallbackImageUrl()}"
                             alt="${plant.name} - No images available"
                             class="species-image plant-image">
                        <div class="plant-purchase-icon" data-plant-name="${plant.name}" data-species-key="${plant.speciesKey}">
                            <div class="purchase-icon-content">
                                <span class="purchase-plus">+</span>
                                <div class="purchase-truck"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Generate image indicators for plants with valid images
        const indicators = plant.photoTypes.map((photoType, index) => `
            <div class="indicator-wrapper" data-index="${index + 1}" data-photo-type="${photoType}">
                <span class="indicator ${index === 0 ? 'active' : ''}"></span>
            </div>
        `).join('');

        // Use the image URL - errors will be handled silently by onError handler
        const initialImageUrl = `images/species/${plant.speciesKey}/species_${plant.speciesKey}_${plant.currentPhotoType}_360.webp`;

        return `
            <div class="plant-item image-wrapper"
                 data-plant="${plant.name}"
                 data-species-key="${plant.speciesKey}"
                 data-current-index="${plant.currentIndex}"
                 data-photo-count="${plant.totalImages}">
                <div class="plant-image-container">
                    <div class="species-name-banner">
                        <div class="text-overlay">
                            <span class="genus">${this.getGenusFromName(plant.name)}</span>
                            <span class="species">${this.getSpeciesFromName(plant.name)}</span>
                        </div>
                    </div>

                    <img src="${initialImageUrl}"
                         alt="${plant.name}"
                         class="species-image plant-image"
                         data-species-key="${plant.speciesKey}"
                         data-photo-type="${plant.currentPhotoType}"
                         onerror="this.style.visibility='hidden'">

                    <div class="plant-purchase-icon" data-plant-name="${plant.name}" data-species-key="${plant.speciesKey}">
                        <div class="purchase-icon-content">
                            <span class="purchase-plus">+</span>
                            <div class="purchase-truck"></div>
                        </div>
                    </div>

                    ${plant.photoTypes.length > 1 ? `
                        <div class="image-selector">
                            <div class="img-arrow left" aria-label="Previous image">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M15 18L9 12L15 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="img-indicators">
                                ${indicators}
                                <div class="indicator-cursor"></div>
                            </div>
                            <div class="img-arrow right" aria-label="Next image">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 18L15 12L9 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Extract genus from scientific name
     */
    getGenusFromName(scientificName) {
        return scientificName.split(' ')[0] || scientificName;
    }

    /**
     * Extract species from scientific name
     */
    getSpeciesFromName(scientificName) {
        const parts = scientificName.split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : '';
    }

    /**
     * Get fallback image URL for plants with no valid images
     */
    getFallbackImageUrl() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDM2MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNjAiIGhlaWdodD0iMzYwIiBmaWxsPSIjMDAwMDAwIi8+Cjwvc3ZnPgo=';
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