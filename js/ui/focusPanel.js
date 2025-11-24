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
        this.currentSubpage = null; // For plant details subpage
        this.selectedPlantData = null; // Store selected plant data for subpage
        this.isStandaloneMode = false; // Track if panel is in standalone mode (not linked to PA)

        // State management for opening behavior
        this.lastOpenedBy = null; // 'pa' or 'button' - tracks how panel was last opened
        this.buttonState = { // State to restore when re-opening via button
            currentPage: 'plantRecommendations',
            selectedPlantData: null,
            filters: [], // Array of filter indices to restore
            scrollPosition: undefined // Saved scroll position for plant recommendations
        };
        this.savedScrollPosition = undefined; // Store scroll position for back navigation
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
            },
            plantDetails: {
                title: 'Plant Details',
                icon: '🌿',
                subtitle: 'Nursery Offers'
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
                name: 'Extreme Wind Exposure',
                unit: '%',
                definition: 'Annual probability',
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
                this.hide();
            }
        });
    }
    
    show(paName, paData) {
        if (!this.panel || !document.body.contains(this.panel)) {
            this.init();
        }

        // Track how this was opened - PA mode
        this.lastOpenedBy = 'pa';
        this.isStandaloneMode = false;
        this.currentPA = paName;

        // Always reset to main plant recommendations page when opening from PA
        this.currentPage = 'plantRecommendations';
        this.selectedPlantData = null;

        // Set initial panel width based on current page
        this.updatePanelWidth(null, this.currentPage);
        
        // Update header with location name in ALL CAPS, page buttons, and close button
        const currentPageData = this.pages[this.currentPage];

        // Handle plant details subpage header differently
        const isPlantDetailsPage = this.currentPage === 'plantDetails';
        let displayTitle;

        if (isPlantDetailsPage) {
            displayTitle = this.formatPlantNameForTitle(this.selectedPlantData?.name || 'Plant Details');
        } else if (this.isStandaloneMode) {
            displayTitle = 'PLANT CATALOG';
        } else {
            displayTitle = paName.toUpperCase();
        }

        const headerHTML = `
            <div class="panel-title-section">
                <h3 class="pa-name">${displayTitle}</h3>
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
                ${isPlantDetailsPage ? `
                <div class="back-button-section">
                    <button id="back-to-plants-btn" class="action-button">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back to Plants</span>
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="page-controls">
                ${!isPlantDetailsPage && !this.isStandaloneMode ? `
                    <button class="page-button ${this.currentPage === 'plantRecommendations' ? 'active' : ''}"
                            data-page="plantRecommendations"
                            aria-label="Plant Recommendations"
                            title="Plant Recommendations">${this.pages.plantRecommendations.icon}</button>
                    <button class="page-button ${this.currentPage === 'ecologicalMetrics' ? 'active' : ''}"
                            data-page="ecologicalMetrics"
                            aria-label="Ecological Metrics"
                            title="Ecological Metrics">${this.pages.ecologicalMetrics.icon}</button>
                ` : ''}
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
        // Save current scroll position before hiding
        this.saveScrollPosition();

        // Clean up any active purchase widgets when focus panel closes
        if (window.plantRecommendations && typeof window.plantRecommendations.onFocusPanelClose === 'function') {
            window.plantRecommendations.onFocusPanelClose();
        }

        // Store mode before clearing
        const wasStandaloneMode = this.isStandaloneMode;

        // Instantly hide panel and clear all state
        this.panel.classList.remove('visible');
        this.panel.classList.remove('animating-in');
        this.panel.classList.remove('animating-out');
        this.isVisible = false;
        this.currentPA = null;
        this.isStandaloneMode = false;

        // Reset panel styles
        this.panel.style.opacity = '';
        this.panel.style.visibility = '';
        this.panel.style.pointerEvents = '';
        this.panel.style.transform = '';
        this.panel.style.transition = '';

        // Always instantly clear all animation elements
        this.clearAllAnimationElements();
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
            // Always use instant hide method
            this.hide();
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

        // Back to plants button
        const backToPlantsBtn = this.panel.querySelector('#back-to-plants-btn');
        if (backToPlantsBtn) {
            backToPlantsBtn.addEventListener('click', () => {
                this.navigateBackToPlants();
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
        } else if (this.currentPage === 'plantDetails') {
            this.displayPlantDetails();
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
            // Optimized path: reuse cached data and preserved filters (back navigation, page switching)
            // Skips expensive data loading and filter recomputation
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
        if (currentPage === 'plantRecommendations' || currentPage === 'plantDetails') {
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

    /**
     * Format plant scientific name for title display
     */
    formatPlantNameForTitle(scientificName) {
        if (!scientificName) return 'PLANT DETAILS';

        // Convert to uppercase for header consistency
        return scientificName.toUpperCase();
    }

    /**
     * Navigate to plant details subpage
     */
    showPlantDetails(plantName, speciesKey) {
        // Save current scroll position before navigating away
        this.saveScrollPosition();

        // Store plant data for the subpage
        this.selectedPlantData = {
            name: plantName,
            speciesKey: speciesKey
        };

        // Store previous page state for back navigation
        this.previousPage = this.currentPage;

        // Switch to plant details page
        this.currentPage = 'plantDetails';

        // Update display without changing opening state tracking
        this.updatePanelForCurrentPage();
    }

    /**
     * Navigate back to plants page
     */
    navigateBackToPlants() {
        // Clear plant details data
        this.selectedPlantData = null;

        // Return to previous page (usually plant recommendations)
        this.currentPage = this.previousPage || 'plantRecommendations';

        // Update display without changing opening state tracking
        this.updatePanelForCurrentPage();

        // Restore scroll position after content loads
        this.restoreScrollPosition();
    }

    /**
     * Show focus panel in standalone mode (not linked to any PA)
     */
    showStandalone() {
        // Store previous opening method before changing it
        const previousOpenedBy = this.lastOpenedBy;

        // Save current state if we're re-opening from button mode
        if (previousOpenedBy === 'button') {
            this.saveButtonState();
        }

        // Track how this was opened - button mode
        this.lastOpenedBy = 'button';
        this.isStandaloneMode = true;
        this.currentPA = null;

        // Determine state to restore based on PREVIOUS opening method
        if (previousOpenedBy === 'pa') {
            // Previous opened by PA - reset to clean state
            this.currentPage = 'plantRecommendations';
            this.selectedPlantData = null;
        } else if (previousOpenedBy === 'button') {
            // Previous opened by button - restore previous state
            this.restoreButtonState();
        } else {
            // First time opening - default state
            this.currentPage = 'plantRecommendations';
            this.selectedPlantData = null;
        }

        // Initialize panel if needed
        if (!this.panel || !document.body.contains(this.panel)) {
            this.init();
        }

        // Set panel width for plant mode
        this.updatePanelWidth(null, 'plantRecommendations');

        // Update header for standalone mode
        const currentPageData = this.pages[this.currentPage];
        const headerHTML = `
            <div class="panel-title-section">
                <h3 class="pa-name">PLANT CATALOG</h3>
                <p class="pa-subtitle">${currentPageData.subtitle}</p>
                <div class="refine-plant-section">
                    <button id="refine-plants-btn" class="action-button">
                        <i class="fas fa-leaf"></i>
                        <i class="fas fa-sliders-h"></i>
                        <span>Refine Plant List</span>
                    </button>
                </div>
            </div>
            <div class="page-controls">
                <button class="close-button" aria-label="Close panel">×</button>
            </div>
        `;
        this.panel.querySelector('.focus-panel-header').innerHTML = headerHTML;

        // Re-attach event listeners for standalone mode
        this.attachHeaderEventListeners();

        // Display content based on current page (after state restoration)
        if (this.currentPage === 'plantDetails') {
            // Use updatePanelForCurrentPage which handles plant details correctly
            this.updatePanelForCurrentPage();
        } else {
            // For plant recommendations page, use standalone method
            this.displayStandalonePlantRecommendations();
        }

        // Show panel with direct positioning (no connection line animation)
        this.positionPanelCorrectly();

        // Add visible class instead of setting inline styles - this triggers CSS transform
        this.panel.classList.add('visible');
        this.isVisible = true;

        // Only restore scroll position when preserving previous button state
        // (not when opening fresh from PA or first time)
        if (previousOpenedBy === 'button') {
            this.restoreScrollPosition();
        }
    }


    /**
     * Display plant recommendations in standalone mode (all plants, no PA filtering)
     */
    displayStandalonePlantRecommendations() {
        const content = this.panel.querySelector('.focus-panel-content');
        if (!content) return;

        if (window.plantRecommendations) {
            // Use clean standalone method that bypasses PA filtering
            window.plantRecommendations.displayStandaloneContent();

            // Apply saved filters immediately if we're restoring button state
            if (this.buttonState.filters.length > 0) {
                // Apply filters immediately after a minimal delay for content to load
                setTimeout(() => this.applySavedFilters(), 50);
            }
        } else {
            content.innerHTML = `
                <div class="standalone-loading">
                    <p>Loading plant catalog...</p>
                </div>
            `;
        }
    }

    /**
     * Display plant details subpage with nursery cards
     */
    displayPlantDetails() {
        const content = this.panel.querySelector('.focus-panel-content');
        if (!content || !this.selectedPlantData) return;

        const plantName = this.selectedPlantData.name;
        const speciesKey = this.selectedPlantData.speciesKey;

        // Get nursery inventory data for this plant and sort it
        const rawInventoryItems = window.plantRecommendations ?
            window.plantRecommendations.getNurseryInventoryData(plantName) : [];
        const inventoryItems = window.plantRecommendations ?
            window.plantRecommendations.sortInventoryItems(rawInventoryItems) : [];

        content.innerHTML = `
            <div class="plant-details-content">
                <div class="plant-details-grid-container">
                    <div class="plant-details-grid" id="plant-details-grid">
                        ${this.generatePlantDetailsCards(inventoryItems, plantName, speciesKey)}
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners for the cards
        this.attachPlantDetailsListeners(inventoryItems, plantName, speciesKey);
    }

    /**
     * Generate inventory cards for plant details page (same as widget cards but in grid layout)
     */
    generatePlantDetailsCards(inventoryItems, plantName, speciesKey) {
        if (!inventoryItems || inventoryItems.length === 0) {
            return `
                <div class="no-inventory-message">
                    <p>No participating nurseries currently stock this plant</p>
                </div>
            `;
        }

        // Use the same card generation logic from plant recommendations
        if (window.plantRecommendations && typeof window.plantRecommendations.generateInventoryCards === 'function') {
            return window.plantRecommendations.generateInventoryCards(inventoryItems, plantName, speciesKey);
        }

        // Fallback if plant recommendations not available
        return `
            <div class="loading-cards">
                <p>Loading nursery offers...</p>
            </div>
        `;
    }

    /**
     * Attach event listeners for plant details cards
     */
    attachPlantDetailsListeners(inventoryItems, plantName, speciesKey) {
        const detailsGrid = document.getElementById('plant-details-grid');
        if (!detailsGrid) return;

        // Use event delegation for all card interactions (same as widget)
        detailsGrid.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Handle BUY button clicks
            if (e.target.classList.contains('card-buy-btn') && !e.target.disabled) {
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                this.showDetailsQuantityControls(itemIndex);
                return;
            }

            // Handle quantity adjustment buttons
            if (e.target.classList.contains('quantity-btn')) {
                const action = e.target.dataset.action;
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                this.updateDetailsCardQuantity(action, itemIndex, inventoryItems[itemIndex]);
                return;
            }

            // Handle Add to Cart button
            if (e.target.classList.contains('add-to-cart-btn')) {
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                const inventoryItem = inventoryItems[itemIndex];
                const quantity = this.getDetailsCardQuantity(itemIndex);

                if (window.cartManager && inventoryItem) {
                    window.cartManager.addToCart(plantName, speciesKey, quantity, inventoryItem);
                    // Stay on details page after adding to cart (don't close like widget did)
                    // Optionally refresh the card to show updated availability
                    this.refreshDetailsCard(itemIndex, inventoryItem, plantName, speciesKey);
                } else {
                    console.error('Cart manager not available or invalid inventory item');
                }
                return;
            }
        });
    }

    /**
     * Show quantity controls for a specific details card
     */
    showDetailsQuantityControls(itemIndex) {
        const card = document.querySelector(`#plant-details-grid [data-item-index="${itemIndex}"]`);
        if (!card) return;

        const buyButton = card.querySelector('.card-buy-btn');
        const quantityControls = card.querySelector('.card-quantity-controls');
        const quantityDisplay = card.querySelector('.quantity-display');
        const quantityAvailableElement = card.querySelector('.qty-number');

        if (buyButton && quantityControls) {
            buyButton.style.display = 'none';
            quantityControls.style.display = 'flex';

            // Update quantity available display to reflect the default quantity selection
            if (quantityDisplay && quantityAvailableElement) {
                const currentQuantity = parseInt(quantityDisplay.textContent) || 10;
                const plantName = this.selectedPlantData?.name;
                const speciesKey = this.selectedPlantData?.speciesKey;
                const rawInventoryItems = window.plantRecommendations ?
                    window.plantRecommendations.getNurseryInventoryData(plantName) : [];
                const inventoryItems = window.plantRecommendations ?
                    window.plantRecommendations.sortInventoryItems(rawInventoryItems) : [];
                const inventoryItem = inventoryItems[itemIndex];

                if (inventoryItem) {
                    const cartQuantity = window.cartManager ?
                        window.cartManager.getItemQuantity(plantName, speciesKey, inventoryItem) : 0;
                    const totalAvailable = inventoryItem.quantity_available || 0;
                    const remainingAfterCart = Math.max(0, totalAvailable - cartQuantity);
                    const remainingAfterSelection = remainingAfterCart - currentQuantity;

                    quantityAvailableElement.textContent = remainingAfterSelection;
                }
            }
        }
    }

    /**
     * Get current quantity for a specific details card
     */
    getDetailsCardQuantity(itemIndex) {
        const card = document.querySelector(`#plant-details-grid [data-item-index="${itemIndex}"]`);
        if (!card) return 10;

        const quantityDisplay = card.querySelector('.quantity-display');
        return quantityDisplay ? parseInt(quantityDisplay.textContent) : 10;
    }

    /**
     * Update quantity for a specific details card
     */
    updateDetailsCardQuantity(action, itemIndex, inventoryItem) {
        const card = document.querySelector(`#plant-details-grid [data-item-index="${itemIndex}"]`);
        if (!card) return;

        const quantityDisplay = card.querySelector('.quantity-display');
        const minusBtn = card.querySelector('.quantity-minus');
        const plusBtn = card.querySelector('.quantity-plus');
        const quantityAvailableElement = card.querySelector('.qty-number');

        if (!quantityDisplay || !quantityAvailableElement) return;

        let currentQuantity = parseInt(quantityDisplay.textContent) || 10;

        // Calculate quantity already in cart for this specific inventory item
        const plantName = this.selectedPlantData?.name;
        const speciesKey = this.selectedPlantData?.speciesKey;
        const cartQuantity = window.cartManager ?
            window.cartManager.getItemQuantity(plantName, speciesKey, inventoryItem) : 0;

        // Calculate remaining inventory after cart items
        const totalAvailable = inventoryItem.quantity_available || 0;
        const remainingInventory = Math.max(0, totalAvailable - cartQuantity);

        // Handle quantity changes with 10-unit intervals (same logic as widget)
        if (action === 'increase') {
            if (remainingInventory < 10) {
                currentQuantity = remainingInventory;
            } else {
                const currentMultiple = Math.floor(currentQuantity / 10) * 10;
                const remainder = remainingInventory % 10;

                if (currentQuantity === currentMultiple && currentQuantity + 10 <= remainingInventory) {
                    currentQuantity += 10;
                } else if (remainder > 0 && currentQuantity === Math.floor(remainingInventory / 10) * 10) {
                    currentQuantity = remainingInventory;
                }
            }
        } else if (action === 'decrease') {
            if (remainingInventory < 10) {
                return;
            } else {
                const currentMultiple = Math.floor(currentQuantity / 10) * 10;

                if (currentQuantity > currentMultiple) {
                    currentQuantity = currentMultiple;
                } else if (currentQuantity >= 20) {
                    currentQuantity -= 10;
                } else {
                    return;
                }
            }
        }

        // Update displays
        quantityDisplay.textContent = currentQuantity;

        // Update quantity available display to reflect selection
        const updatedRemaining = remainingInventory - currentQuantity;
        quantityAvailableElement.textContent = updatedRemaining;

        // Update button states
        const minQuantity = remainingInventory < 10 ? remainingInventory : 10;
        if (minusBtn) minusBtn.disabled = currentQuantity <= minQuantity;
        if (plusBtn) plusBtn.disabled = currentQuantity >= remainingInventory;
    }

    /**
     * Refresh a specific details card after cart changes
     */
    refreshDetailsCard(itemIndex, inventoryItem, plantName, speciesKey) {
        const card = document.querySelector(`#plant-details-grid [data-item-index="${itemIndex}"]`);
        if (!card) return;

        const quantityAvailableElement = card.querySelector('.qty-number');
        const buyButton = card.querySelector('.card-buy-btn');
        const quantityControls = card.querySelector('.card-quantity-controls');

        if (quantityAvailableElement) {
            // Recalculate availability
            const cartQuantity = window.cartManager ?
                window.cartManager.getItemQuantity(plantName, speciesKey, inventoryItem) : 0;
            const totalAvailable = inventoryItem.quantity_available || 0;
            const remainingInventory = Math.max(0, totalAvailable - cartQuantity);

            // Update display with cart info
            quantityAvailableElement.textContent = remainingInventory;
            const qtyContainer = quantityAvailableElement.parentElement;
            if (qtyContainer) {
                qtyContainer.innerHTML = `<span class="qty-number">${remainingInventory}</span> AVAILABLE${cartQuantity > 0 ? ` (${cartQuantity} in cart)` : ''}`;
            }

            // Reset to buy button state
            if (buyButton && quantityControls) {
                buyButton.style.display = 'block';
                quantityControls.style.display = 'none';

                // Update button state based on availability
                if (remainingInventory === 0) {
                    buyButton.disabled = true;
                    buyButton.classList.add('disabled');
                } else {
                    buyButton.disabled = false;
                    buyButton.classList.remove('disabled');
                }
            }
        }
    }

    /**
     * Position panel correctly relative to layer controls
     * This unified method should be used for both standalone and PA modes
     */
    /**
     * Instantly clear all animation elements (connection lines, vertical edges, highlights)
     */
    clearAllAnimationElements() {
        // Clear connection lines
        document.querySelectorAll('.connection-line').forEach(line => line.remove());

        // Clear vertical edges
        document.querySelectorAll('.vertical-edge').forEach(edge => edge.remove());

        // Clear PA highlights
        document.querySelectorAll('.pa-row-highlight').forEach(highlight => highlight.remove());

        // Clear any animation state in layer controls
        if (window.currentAnimationState) {
            window.currentAnimationState.isAnimating = false;
            window.currentAnimationState.selectedLabel = null;
            window.currentAnimationState.selectedPA = null;
            window.currentAnimationState.lineEndX = null;
            window.currentAnimationState.verticalEdge = null;
        }

        // Force remove any in-progress animations by clearing transform and transitions
        document.querySelectorAll('[style*="transform"], [style*="transition"]').forEach(el => {
            if (el.classList.contains('connection-line') ||
                el.classList.contains('vertical-edge') ||
                el.classList.contains('pa-row-highlight')) {
                el.remove();
            }
        });
    }

    /**
     * Update panel display for current page without resetting opening method tracking
     * Used for navigation within the same session (e.g., to plant details page)
     */
    updatePanelForCurrentPage() {
        // Set panel width for current page
        this.updatePanelWidth(null, this.currentPage);

        // Update header
        const currentPageData = this.pages[this.currentPage];
        const isPlantDetailsPage = this.currentPage === 'plantDetails';

        let displayTitle;
        if (isPlantDetailsPage) {
            displayTitle = this.formatPlantNameForTitle(this.selectedPlantData?.name || 'Plant Details');
        } else if (this.isStandaloneMode) {
            displayTitle = 'PLANT CATALOG';
        } else {
            displayTitle = this.currentPA ? this.currentPA.toUpperCase() : 'PLANT CATALOG';
        }

        const headerHTML = `
            <div class="panel-title-section">
                <h3 class="pa-name">${displayTitle}</h3>
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
                ${isPlantDetailsPage ? `
                <div class="back-button-section">
                    <button id="back-to-plants-btn" class="action-button">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back to Plants</span>
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="page-controls">
                ${!isPlantDetailsPage && !this.isStandaloneMode ? `
                    <button class="page-button ${this.currentPage === 'plantRecommendations' ? 'active' : ''}"
                            data-page="plantRecommendations"
                            aria-label="Plant Recommendations"
                            title="Plant Recommendations">${this.pages.plantRecommendations.icon}</button>
                    <button class="page-button ${this.currentPage === 'ecologicalMetrics' ? 'active' : ''}"
                            data-page="ecologicalMetrics"
                            aria-label="Ecological Metrics"
                            title="Ecological Metrics">${this.pages.ecologicalMetrics.icon}</button>
                ` : ''}
                <button class="close-button" aria-label="Close panel">×</button>
            </div>
        `;
        this.panel.querySelector('.focus-panel-header').innerHTML = headerHTML;

        // Re-attach event listeners
        this.attachHeaderEventListeners();

        // Display content for current page
        if (this.currentPage === 'plantDetails') {
            this.displayPlantDetails();
        } else if (this.currentPage === 'plantRecommendations') {
            if (this.isStandaloneMode) {
                this.displayStandalonePlantRecommendations();
            } else {
                // Don't reset filters when navigating within the same session (e.g., back from plant details)
                this.displayCurrentPage(this.currentPAData, false);
            }
        } else if (this.currentPage === 'ecologicalMetrics') {
            this.displayCurrentPage(this.currentPAData, false);
        }
    }

    /**
     * Save current button mode state for restoration
     */
    saveButtonState() {
        this.buttonState.currentPage = this.currentPage;
        this.buttonState.selectedPlantData = this.selectedPlantData ? { ...this.selectedPlantData } : null;

        // Save current filter state from plantRecommendations module
        if (window.plantRecommendations && typeof window.plantRecommendations.getCurrentFilters === 'function') {
            this.buttonState.filters = window.plantRecommendations.getCurrentFilters();
        } else {
            this.buttonState.filters = [];
        }

        // Save current scroll position if on plant recommendations page
        this.saveScrollPosition();
        this.buttonState.scrollPosition = this.savedScrollPosition;
    }

    /**
     * Restore button mode state
     */
    restoreButtonState() {
        this.currentPage = this.buttonState.currentPage;
        this.selectedPlantData = this.buttonState.selectedPlantData ? { ...this.buttonState.selectedPlantData } : null;

        // Restore saved scroll position
        this.savedScrollPosition = this.buttonState.scrollPosition;
    }

    /**
     * Save current scroll position for plant recommendations page
     */
    saveScrollPosition() {
        const contentElement = this.panel.querySelector('.focus-panel-content');
        if (contentElement && this.currentPage === 'plantRecommendations') {
            this.savedScrollPosition = contentElement.scrollTop;
        }
    }

    /**
     * Restore saved scroll position for plant recommendations page
     */
    restoreScrollPosition() {
        if (this.savedScrollPosition !== undefined) {
            // Use setTimeout to ensure content is fully loaded before scrolling
            setTimeout(() => {
                const contentElement = this.panel.querySelector('.focus-panel-content');
                if (contentElement) {
                    contentElement.scrollTop = this.savedScrollPosition;
                    this.savedScrollPosition = undefined; // Clear after use
                }
            }, 50); // Small delay to ensure DOM is updated
        }
    }

    /**
     * Apply saved filters after plant recommendations content is loaded
     */
    applySavedFilters() {
        if (this.buttonState.filters && this.buttonState.filters.length > 0 && window.plantRecommendations) {
            // Restore filters to plantRecommendations module
            window.plantRecommendations.selectedFilters.clear();
            this.buttonState.filters.forEach(filterIndex => {
                window.plantRecommendations.selectedFilters.add(filterIndex);
            });

            // Update filter UI to reflect restored state
            if (typeof window.plantRecommendations.updateFilterUIFromSelectedFilters === 'function') {
                window.plantRecommendations.updateFilterUIFromSelectedFilters();
            }

            // Apply the filters to show filtered plants
            if (typeof window.plantRecommendations.applyCurrentFilters === 'function') {
                window.plantRecommendations.applyCurrentFilters();
            }
        }
    }


    positionPanelCorrectly() {
        // Calculate correct position based on control panel location
        // Control panel is at right: 10px, layer controls width is 290px
        // Panel should end 40px to the left of layer controls
        const controlPanelRightMargin = 10; // from CSS: right: 10px
        const layerControlsWidth = 290; // from CSS: width: 290px
        const connectionGap = 40; // connection line length
        const panelWidth = 1160;

        // Calculate panel left position
        // Panel right edge should be: window.innerWidth - controlPanelRightMargin - layerControlsWidth - connectionGap
        const panelRightEdge = window.innerWidth - controlPanelRightMargin - layerControlsWidth - connectionGap;
        const panelLeft = panelRightEdge - panelWidth;

        this.panel.style.left = `${panelLeft}px`;
        this.panel.style.right = 'auto';
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