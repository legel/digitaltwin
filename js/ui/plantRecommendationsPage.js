/**
 * Plant Recommendations Page Controller
 * Manages the plant recommendations display and filtering system
 */

class PlantRecommendationsPage {
    constructor() {
        this.isFiltersVisible = false;
        this.filtersLoaded = false;
        this.currentPlants = [];
        this.filteredPlants = [];
        this.selectedFilters = new Set();
        this.dataProcessor = null;
        this.ontologyData = null;
        this.imageCache = new Map(); // Cache for image validation results
        this.navigationHandlers = null; // Store navigation event handlers
    }

    /**
     * Initialize the plant recommendations page
     */
    initialize() {
        // Create plant filters panel if not exists
        if (!document.getElementById('plant-filters-panel')) {
            this.createFiltersPanel();
        }
    }

    /**
     * Display the plant recommendations content
     */
    displayContent(paData) {
        const content = document.querySelector('.focus-panel-content');
        if (!content) return;

        content.innerHTML = `
            <div class="plant-recommendations-content">
                <div class="plant-grid-container">
                    <div class="plant-grid" id="plant-grid">
                        <div class="loading-plants">
                            <div class="plant-spinner"></div>
                            <p>Loading native plant recommendations...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load ontology data first, then load plants
        this.loadOntologyAndPlants(paData);
    }

    /**
     * Display the plant recommendations content without resetting filters
     * Used when switching back to plant recommendations page
     */
    displayContentWithoutReset(paData) {
        const content = document.querySelector('.focus-panel-content');
        if (!content) return;

        // Only update content HTML if it's not already showing plant recommendations
        if (!content.querySelector('.plant-recommendations-content')) {
            content.innerHTML = `
                <div class="plant-recommendations-content">
                    <div class="plant-grid-container">
                        <div class="plant-grid" id="plant-grid">
                            <div class="loading-plants">
                                <div class="plant-spinner"></div>
                                <p>Loading native plant recommendations...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // If plants are already loaded, just redisplay the current filtered list
        if (this.filteredPlants && this.filteredPlants.length > 0) {
            this.displayPlantGrid(this.filteredPlants);
        } else if (this.currentPlants && this.currentPlants.length > 0) {
            // Plants are loaded but no filtered list - apply current filter state
            if (this.selectedFilters && this.selectedFilters.size > 0 && this.dataProcessor) {
                // Apply current manual filters
                this.filteredPlants = this.dataProcessor.filterPlants(this.selectedFilters, this.currentPlants);
            } else {
                // No manual filters - apply ecological default
                this.filteredPlants = this.applyDefaultFilter(this.currentPlants);
            }
            this.displayPlantGrid(this.filteredPlants);
        } else {
            // No plants loaded yet - fallback to full load
            this.loadOntologyAndPlants(paData);
        }
    }

    /**
     * Load ontology data first, then plant recommendations
     */
    async loadOntologyAndPlants(paData) {
        try {
            // Load ontology data first if not already loaded
            if (!this.ontologyData) {
                console.log('PlantRecommendationsPage: Loading ontology data...');
                const response = await fetch('data/plant-recommendations/ontology.json');
                if (response.ok) {
                    this.ontologyData = await response.json();
                    console.log('PlantRecommendationsPage: Ontology data loaded successfully');
                } else {
                    console.warn('PlantRecommendationsPage: Failed to load ontology data');
                }
            }

            // Now load plant recommendations
            await this.loadPlantRecommendations(paData);

        } catch (error) {
            console.error('PlantRecommendationsPage: Error in loadOntologyAndPlants:', error);
            // Fallback: load plants without ontology
            await this.loadPlantRecommendations(paData);
        }
    }

    /**
     * Create the plant filters panel
     */
    createFiltersPanel() {
        const filtersHTML = `
            <div id="plant-filters-panel" class="plant-filters-panel">
                <div class="plant-filters-body" id="plant-filters-body">
                    <div class="loading-filters">Loading plant filters...</div>
                </div>
            </div>
            <div class="plant-filters-overlay" id="plant-filters-overlay"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', filtersHTML);

        // Attach filter panel event listeners
        this.attachFilterPanelListeners();
    }

    /**
     * Attach event listeners for the filter panel
     */
    attachFilterPanelListeners() {
        const closeBtn = document.getElementById('plant-filters-close');
        const overlay = document.getElementById('plant-filters-overlay');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideFilters());
        }

        if (overlay) {
            overlay.addEventListener('click', () => this.hideFilters());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFiltersVisible) {
                this.hideFilters();
            }
        });
    }

    /**
     * Toggle the plant filters panel visibility
     */
    toggleFilters() {
        if (this.isFiltersVisible) {
            this.hideFilters();
        } else {
            this.showFilters();
        }
    }

    /**
     * Show the plant filters panel - terrain style
     */
    showFilters() {
        const filtersPanel = document.getElementById('plant-filters-panel');
        if (filtersPanel) {
            // Position panel relative to refine button
            const refineButton = document.getElementById('refine-plants-btn');
            if (refineButton) {
                const buttonRect = refineButton.getBoundingClientRect();

                // Terrain-style seamless positioning - panel flows directly from button
                filtersPanel.style.top = `${buttonRect.bottom - 1}px`; // -1px for seamless connection
                filtersPanel.style.left = `${buttonRect.left + (buttonRect.width / 2)}px`;
                filtersPanel.style.transform = 'translateX(-50%)'; // Center align

                // Terrain-style border radius connection
                refineButton.style.borderBottomLeftRadius = '0px';
                refineButton.style.borderBottomRightRadius = '0px';
                refineButton.style.setProperty('--button-width', `${buttonRect.width}px`);

                // Update button text to terrain-style
                this.updateRefineButtonText(true);
            }

            // Show panel with terrain-style animation
            filtersPanel.classList.add('visible');
            this.isFiltersVisible = true;

            // Show overlay
            const overlay = document.getElementById('plant-filters-overlay');
            if (overlay) {
                overlay.classList.add('visible');
            }

            // Load filter options if not already loaded, then show content
            if (!this.filtersLoaded) {
                this.loadFilters();
            } else {
                // Add content visibility for animation
                setTimeout(() => {
                    filtersPanel.classList.add('content-visible');
                }, 50);
            }
        }
    }

    /**
     * Hide the plant filters panel - terrain style
     */
    hideFilters() {
        const filtersPanel = document.getElementById('plant-filters-panel');
        if (filtersPanel) {
            // Restore button border radius
            const refineButton = document.getElementById('refine-plants-btn');
            if (refineButton) {
                refineButton.style.borderBottomLeftRadius = '25px';
                refineButton.style.borderBottomRightRadius = '25px';
                refineButton.style.removeProperty('--button-width');
            }

            // Update button text back to default
            this.updateRefineButtonText(false);

            // Reverse animation sequence
            filtersPanel.classList.remove('content-visible');

            setTimeout(() => {
                filtersPanel.classList.remove('visible');
                this.isFiltersVisible = false;
            }, 200);

            // Hide overlay
            const overlay = document.getElementById('plant-filters-overlay');
            if (overlay) {
                overlay.classList.remove('visible');
            }
        }
    }

    /**
     * Update refine button text - terrain style
     */
    updateRefineButtonText(isVisible) {
        const refineButton = document.getElementById('refine-plants-btn');
        if (refineButton) {
            const buttonText = refineButton.querySelector('span');
            if (buttonText) {
                buttonText.textContent = isVisible ? 'Hide Criteria' : 'Refine Plant List';
            }
        }
    }

    /**
     * Load plant recommendations based on ecological data
     */
    async loadPlantRecommendations(paData) {
        try {
            // Load the integrated species data
            const response = await fetch('data/plant-recommendations/integrated_species_data.json');
            if (!response.ok) {
                throw new Error('Failed to load plant data');
            }

            const speciesData = await response.json();

            // Convert all plants to array (full dataset)
            const plantEntries = Object.entries(speciesData);

            const plants = plantEntries.map(([scientificName, data]) => {
                // Get only VALID photo types for this species based on data validation
                const allPhotoKeys = Object.keys(data.photos || {});
                const photoTypes = allPhotoKeys.filter(photoType => {
                    const photoInfo = data.photos[photoType];
                    // More strict filtering to exclude problematic images
                    return photoInfo &&
                           photoInfo.type !== 'empty' &&
                           photoInfo.url !== null &&
                           photoInfo.url !== 'no live occurrences' &&
                           photoInfo.url !== '' &&
                           data.speciesKey !== null &&
                           data.speciesKey !== 'null' &&
                           data.speciesKey !== undefined;
                });

                const defaultPhotoType = photoTypes.includes('mature_overall_1') ? 'mature_overall_1' :
                                       photoTypes.includes('mature_overall_2') ? 'mature_overall_2' :
                                       photoTypes[0] || null;

                return {
                    name: scientificName,
                    speciesKey: data.speciesKey,
                    commonName: this.extractCommonName(scientificName),
                    photos: data.photos || {},
                    photoTypes: photoTypes,
                    currentPhotoType: defaultPhotoType,
                    currentIndex: 1,
                    totalImages: photoTypes.length
                };
            });

            // Store all plants as the full dataset
            this.currentPlants = plants;

            // Initialize PlantDataProcessor BEFORE applying filters
            if (!this.dataProcessor && window.PlantDataProcessor) {
                await this.initializeDataProcessor(speciesData);
            }

            // Apply default filter with data processor available
            this.filteredPlants = this.applyDefaultFilter(plants);

            setTimeout(() => {
                this.displayPlantGrid(this.filteredPlants);
            }, 1000);

        } catch (error) {
            console.error('Error loading plant recommendations:', error);
            this.displayError();
        }
    }

    /**
     * Maps GeoJSON ecological values to qualitative filter categories
     * @param {Object} paData - PA ecological data from GeoJSON
     * @returns {Array} - Array of matrix column indices for filtering
     */
    mapEcologicalDataToFilters(paData) {
        const filterIndices = [];

        if (!paData) {
            return filterIndices;
        }

        // Map sunlight hours to categories
        if (paData.sunlight) {
            const sunlightValue = window.parseParameterValue(paData.sunlight, 'sunlight');

            if (sunlightValue <= 4) {
                filterIndices.push(125); // Shaded
            } else if (sunlightValue <= 6) {
                filterIndices.push(126); // Partial Shade/Sun
            } else {
                filterIndices.push(127); // Full Sun
            }
        }

        // Map pH to categories
        if (paData.pH) {
            const pHValue = window.parseParameterValue(paData.pH, 'pH');

            if (pHValue < 6.5) {
                filterIndices.push(139); // Acidic
            } else if (pHValue <= 7.5) {
                filterIndices.push(140); // Neutral
            } else {
                filterIndices.push(141); // Alkaline
            }
        }

        return filterIndices;
    }

    /**
     * Gets ecological data from currently selected PA area
     * @returns {Object|null} - PA ecological data or null if no selection
     */
    getCurrentPAEcologicalData() {
        // Check if a PA area is currently selected
        if (!window.layerState?.selectedGroup || window.layerState?.selectedGroupType !== 'PA') {
            return null;
        }

        if (!window.currentSiteData?.features) {
            return null;
        }

        // Find the selected PA feature
        const selectedPAName = window.layerState.selectedGroup;
        const paFeature = window.currentSiteData.features.find(feature => {
            const parsed = window.parseBoydName(feature.properties.name);
            return (parsed.description || parsed.id) === selectedPAName;
        });

        if (!paFeature) {
            return null;
        }

        // Extract ecological data from the feature description
        return window.parseBoydEcologicalData(paFeature.properties.description || '');
    }

    /**
     * Apply default filter using sunlight and pH from selected PA area
     */
    applyDefaultFilter(plants) {
        // Try to get ecological data from currently selected PA
        const paEcologicalData = this.getCurrentPAEcologicalData();

        if (paEcologicalData && this.dataProcessor && this.ontologyData) {
            // Map ecological data to filter categories
            const filterIndices = this.mapEcologicalDataToFilters(paEcologicalData);

            if (filterIndices.length > 0) {
                // Update selectedFilters to sync with UI
                this.selectedFilters.clear();
                filterIndices.forEach(index => this.selectedFilters.add(index));

                // Update filter UI checkboxes to reflect the ecological selection
                this.updateFilterUIFromSelectedFilters();

                // Use PlantDataProcessor for ecological filtering
                const ecologicallyFiltered = this.dataProcessor.filterPlants(new Set(filterIndices), plants);

                return ecologicallyFiltered;
            }
        }

        // Clear any previous ecological filter selections when falling back
        this.selectedFilters.clear();
        this.updateFilterUIFromSelectedFilters();

        // Fallback: return first 20 plants as default when no PA selected or no ecological data
        return plants.slice(0, 20);
    }

    /**
     * Initialize the PlantDataProcessor for matrix-based filtering
     */
    async initializeDataProcessor(speciesData) {
        try {
            this.dataProcessor = new window.PlantDataProcessor();

            // Wait for ontology data if not loaded yet
            if (!this.ontologyData) {
                return; // Will be initialized when filters are loaded
            }

            await this.dataProcessor.initializeWithPlantData(speciesData, this.ontologyData);

        } catch (error) {
            console.error('PlantRecommendationsPage: Error initializing data processor:', error);
        }
    }

    /**
     * Extract common name from scientific name (simplified)
     */
    extractCommonName(scientificName) {
        const commonNames = {
            'Serenoa repens': 'Saw Palmetto',
            'Zamia integrifolia': 'Coontie',
            'Ilex vomitoria': 'Yaupon Holly',
            'Myrica cerifera': 'Southern Wax Myrtle',
            'Quercus virginiana': 'Live Oak',
            'Spartina patens': 'Saltmeadow Cordgrass',
            'Pinus elliottii': 'Slash Pine',
            'Taxodium distichum': 'Bald Cypress'
        };

        return commonNames[scientificName] || scientificName.split(' ')[0];
    }

    /**
     * Display the plant grid
     */
    displayPlantGrid(plants) {
        const plantGrid = document.getElementById('plant-grid');
        if (!plantGrid) return;

        if (plants.length === 0) {
            plantGrid.innerHTML = `
                <div class="no-plants">
                    <div class="no-plants-icon">🌿</div>
                    <p>No plants match the current criteria</p>
                    <p class="no-plants-suggestion">Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        // Use terrain-style HTML generation from focusPanel
        const plantsHTML = plants.map(plant => {
            if (window.focusPanel && typeof window.focusPanel.getTerrainPlantHTML === 'function') {
                return window.focusPanel.getTerrainPlantHTML(plant);
            }

            // Fallback to simplified version if focusPanel not available
            const initialImageUrl = plant.currentPhotoType ?
                `images/species/${plant.speciesKey}/species_${plant.speciesKey}_${plant.currentPhotoType}_360.webp` :
                this.getFallbackImageUrl();

            return `
                <div class="plant-item image-wrapper"
                     data-plant="${plant.name}"
                     data-species-key="${plant.speciesKey}"
                     data-current-index="${plant.currentIndex || 1}"
                     data-photo-count="${plant.totalImages || 0}">
                    <div class="plant-image-container">
                        <div class="species-name-banner">
                            <div class="text-overlay">
                                <span class="genus">${plant.name.split(' ')[0] || plant.name}</span>
                                <span class="species">${plant.name.split(' ').slice(1).join(' ') || ''}</span>
                            </div>
                        </div>
                        <img src="${initialImageUrl}"
                             alt="${plant.name}"
                             class="species-image plant-image"
                             data-species-key="${plant.speciesKey}"
                             data-photo-type="${plant.currentPhotoType}"
                             onerror="this.style.visibility='hidden'">
                    </div>
                </div>
            `;
        });

        plantGrid.innerHTML = plantsHTML.join('');

        // Initialize image gallery functionality
        this.initializeImageNavigation();
        this.attachPlantItemListeners();

        // Initialize cursor positions for all plant items
        this.initializeCursorPositions();
    }

    /**
     * Get image URL for a species and photo type
     * Note: photoTypes are pre-filtered for validity, so this should always work
     */
    getImageUrl(speciesKey, photoType) {
        return `images/species/${speciesKey}/species_${speciesKey}_${photoType}_360.webp`;
    }

    /**
     * Get fallback image URL for plants with no valid images
     */
    getFallbackImageUrl() {
        // Return a simple black box data URL - no external file dependencies
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDM2MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNjAiIGhlaWdodD0iMzYwIiBmaWxsPSIjMDAwMDAwIi8+Cjwvc3ZnPgo=';
    }


    /**
     * Initialize image navigation functionality
     */
    initializeImageNavigation() {
        // Remove previous event listeners if they exist
        if (this.navigationHandlers) {
            document.removeEventListener('click', this.navigationHandlers.arrowHandler);
            document.removeEventListener('click', this.navigationHandlers.indicatorHandler);
        }

        // Create new event handlers
        const arrowHandler = (e) => {
            if (e.target.closest('.img-arrow')) {
                e.preventDefault();
                this.handleArrowClick(e.target.closest('.img-arrow'));
            }
        };

        const indicatorHandler = (e) => {
            if (e.target.closest('.indicator-wrapper')) {
                e.preventDefault();
                this.handleIndicatorClick(e.target.closest('.indicator-wrapper'));
            }
        };

        // Store handlers for future removal
        this.navigationHandlers = {
            arrowHandler: arrowHandler,
            indicatorHandler: indicatorHandler
        };

        // Add new event listeners
        document.addEventListener('click', arrowHandler);
        document.addEventListener('click', indicatorHandler);
    }

    /**
     * Handle arrow navigation clicks
     */
    handleArrowClick(arrow) {
        const wrapper = arrow.closest('.image-wrapper');
        const currentIndex = parseInt(wrapper.dataset.currentIndex) || 1;
        const speciesKey = wrapper.dataset.speciesKey;
        const plant = this.currentPlants.find(p => p.speciesKey === parseInt(speciesKey));

        if (!plant || plant.photoTypes.length <= 1) return;

        const totalImages = plant.photoTypes.length;
        let newIndex;
        if (arrow.classList.contains('left')) {
            newIndex = currentIndex === 1 ? totalImages : currentIndex - 1;
        } else {
            newIndex = currentIndex === totalImages ? 1 : currentIndex + 1;
        }

        this.goToImage(wrapper, newIndex);
    }

    /**
     * Handle indicator clicks
     */
    handleIndicatorClick(indicator) {
        const wrapper = indicator.closest('.image-wrapper');
        const targetIndex = parseInt(indicator.dataset.index);
        this.goToImage(wrapper, targetIndex);
    }

    /**
     * Navigate to specific image index
     */
    goToImage(wrapper, targetIndex) {
        const speciesKey = wrapper.dataset.speciesKey;
        const plant = this.currentPlants.find(p => p.speciesKey === parseInt(speciesKey));

        if (!plant) return;

        // Get photo type for the target index
        const photoType = plant.photoTypes[targetIndex - 1];
        if (!photoType) return;

        // Update image source with error handling
        const img = wrapper.querySelector('.species-image');
        if (img) {
            const newImageUrl = `images/species/${speciesKey}/species_${speciesKey}_${photoType}_360.webp`;
            img.src = newImageUrl;
            img.dataset.photoType = photoType;
            img.onerror = function() { this.style.visibility = 'hidden'; };
        }

        // Update wrapper data
        wrapper.dataset.currentIndex = targetIndex;

        // Update plant object
        plant.currentIndex = targetIndex;
        plant.currentPhotoType = photoType;

        // Update indicators
        this.updateIndicators(wrapper, targetIndex);
    }

    /**
     * Initialize cursor positions for all plant items
     */
    initializeCursorPositions() {
        const plantItems = document.querySelectorAll('.plant-item');
        plantItems.forEach(item => {
            const currentIndex = parseInt(item.dataset.currentIndex) || 1;
            this.updateIndicators(item, currentIndex);
        });
    }

    /**
     * Update indicator states and cursor position (terrain-style)
     */
    updateIndicators(wrapper, activeIndex) {
        const indicators = wrapper.querySelectorAll('.indicator-wrapper .indicator');
        const cursor = wrapper.querySelector('.indicator-cursor');

        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', (index + 1) === activeIndex);
        });

        // Update cursor position if it exists (terrain-style)
        if (cursor && indicators.length > 0) {
            const activeIndicatorIndex = activeIndex - 1; // Convert to 0-based index
            const indicatorWrapper = wrapper.querySelector(`.indicator-wrapper[data-index="${activeIndex}"]`);

            if (indicatorWrapper) {
                const wrapperLeft = indicatorWrapper.offsetLeft;
                const wrapperWidth = indicatorWrapper.offsetWidth;
                const cursorLeft = wrapperLeft + (wrapperWidth / 2) - 6; // Center cursor (12px wide, so offset by 6px)
                cursor.style.left = `${cursorLeft}px`;
            }
        }
    }

    /**
     * Display error state
     */
    displayError() {
        const plantGrid = document.getElementById('plant-grid');
        if (!plantGrid) return;

        plantGrid.innerHTML = `
            <div class="plant-error">
                <div class="plant-error-icon">⚠️</div>
                <p>Unable to load plant recommendations</p>
                <button class="retry-plants-btn" onclick="window.plantRecommendations.loadPlantRecommendations()">
                    Try Again
                </button>
            </div>
        `;
    }

    /**
     * Load filter options from ontology
     */
    async loadFilters() {
        try {
            // Load the ontology data if not already loaded
            if (!this.ontologyData) {
                console.log('PlantRecommendationsPage: Loading ontology data for filters...');
                const response = await fetch('data/plant-recommendations/ontology.json');
                if (!response.ok) {
                    throw new Error('Failed to load ontology');
                }
                this.ontologyData = await response.json();
            }

            const ontologyData = this.ontologyData;

            // Build the filter hierarchy
            const hierarchy = this.buildFilterHierarchy(ontologyData);

            const filtersBody = document.getElementById('plant-filters-body');
            if (filtersBody) {
                // Clear existing content
                filtersBody.innerHTML = '';

                // Render the filter hierarchy
                this.renderFilterHierarchy(hierarchy, filtersBody);

                // Add action buttons at the bottom
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'filter-actions';
                actionsDiv.innerHTML = `
                    <button class="apply-filters-btn" id="apply-filters">Apply Filters</button>
                    <button class="clear-filters-btn" id="clear-filters">Clear All</button>
                `;
                filtersBody.appendChild(actionsDiv);

                this.attachFilterListeners();
                this.filtersLoaded = true;

                // Add content visibility for animation
                setTimeout(() => {
                    const filtersPanel = document.getElementById('plant-filters-panel');
                    if (filtersPanel) {
                        filtersPanel.classList.add('content-visible');
                    }
                }, 50);

                // Sync filter UI with any existing ecological selections
                this.updateFilterUIFromSelectedFilters();
            }
        } catch (error) {
            console.error('Error loading plant filters:', error);
            // Fallback to simple filters
            this.loadSimpleFilters();
        }
    }

    /**
     * Build hierarchical filter structure from ontology data
     */
    buildFilterHierarchy(ontologyData) {
        const root = { children: [] };
        const map = { null: root };

        ontologyData.forEach(node => {
            if (node.name === '_') {
                const parentNode = map[node.parent];
                node.name = parentNode.name;
                node.parent = parentNode.parent;
                map[node.name] = node;
            } else {
                node.children = [];
                map[node.name] = node;

                if (node.parent in map) {
                    map[node.parent].children.push(node);
                }
            }
        });

        return root.children;
    }

    /**
     * Render filter hierarchy to DOM
     */
    renderFilterHierarchy(nodes, parentElement, level = 0) {
        nodes.forEach((node, index) => {
            if (node.type === 'header' || node.type === 'parameter') {
                // Add terrain-style separator before each top-level section (except the first)
                if (level === 0 && index > 0) {
                    const separator = document.createElement('div');
                    separator.className = 'filter-separator';
                    parentElement.appendChild(separator);
                }

                // Create collapsible header
                const headerDiv = document.createElement('div');
                headerDiv.className = 'filter-header';
                headerDiv.style.paddingLeft = `${level * 15 + 10}px`;

                const toggleIcon = document.createElement('span');
                toggleIcon.className = 'filter-toggle-icon';
                toggleIcon.textContent = (node.open === 'true' || node.open === true) ? '−' : '+';
                toggleIcon.style.marginRight = '8px';

                headerDiv.appendChild(toggleIcon);
                headerDiv.appendChild(document.createTextNode(node.name));

                // Container for children
                const childContainer = document.createElement('div');
                childContainer.className = 'filter-children';
                if (!(node.open === 'true' || node.open === true)) {
                    childContainer.style.display = 'none';
                }

                // Toggle functionality
                headerDiv.addEventListener('click', () => {
                    const isHidden = childContainer.style.display === 'none';
                    childContainer.style.display = isHidden ? 'block' : 'none';
                    toggleIcon.textContent = isHidden ? '−' : '+';
                });

                parentElement.appendChild(headerDiv);
                parentElement.appendChild(childContainer);

                // Render children
                this.renderFilterHierarchy(node.children, childContainer, level + 1);

            } else if (node.type === 'selector') {
                // Create checkbox for selectable filters
                const selectorDiv = document.createElement('div');
                selectorDiv.className = 'filter-selector';
                selectorDiv.style.paddingLeft = `${level * 15 + 20}px`;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'filter-checkbox';
                checkbox.id = `filter-${node.matrix_column_index}`;
                checkbox.value = node.matrix_column_index;
                checkbox.dataset.filterName = node.name;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = node.name;
                label.style.marginLeft = '6px';

                selectorDiv.appendChild(checkbox);
                selectorDiv.appendChild(label);
                parentElement.appendChild(selectorDiv);
            }
        });
    }

    /**
     * Fallback simple filters if ontology fails to load
     */
    loadSimpleFilters() {
        const filtersBody = document.getElementById('plant-filters-body');
        if (filtersBody) {
            filtersBody.innerHTML = `
                <div class="filter-section">
                    <h4>Plant Structure</h4>
                    <label><input type="checkbox" value="tree" data-filter="structure"> Tree</label>
                    <label><input type="checkbox" value="shrub" data-filter="structure"> Shrub</label>
                    <label><input type="checkbox" value="groundcover" data-filter="structure"> Ground Cover</label>
                    <label><input type="checkbox" value="grass" data-filter="structure"> Grass</label>
                </div>
                <div class="filter-section">
                    <h4>Sunlight Requirements</h4>
                    <label><input type="checkbox" value="full-sun" data-filter="sunlight"> Full Sun</label>
                    <label><input type="checkbox" value="partial-shade" data-filter="sunlight"> Partial Shade</label>
                    <label><input type="checkbox" value="full-shade" data-filter="sunlight"> Full Shade</label>
                </div>
                <div class="filter-actions">
                    <button class="apply-filters-btn" id="apply-filters">Apply Filters</button>
                    <button class="clear-filters-btn" id="clear-filters">Clear All</button>
                </div>
            `;
            this.attachFilterListeners();
            this.filtersLoaded = true;

            // Sync filter UI with any existing ecological selections
            this.updateFilterUIFromSelectedFilters();
        }
    }

    /**
     * Attach filter control event listeners - terrain style with instant filtering
     */
    attachFilterListeners() {
        const clearBtn = document.getElementById('clear-filters');
        const checkboxes = document.querySelectorAll('.filter-checkbox');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Apply filters instantly when checkboxes change (terrain-style)
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedFilters();
                // Apply filters immediately
                this.applyFilters();
            });
        });

        // Hide apply button since we do instant filtering
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.style.display = 'none';
        }

        // Auto-hide panel when clicking outside (terrain-style)
        const overlay = document.getElementById('plant-filters-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideFilters();
            });
        }
    }

    /**
     * Update selected filters based on checkbox states
     */
    updateSelectedFilters() {
        const checkboxes = document.querySelectorAll('.filter-checkbox:checked');
        this.selectedFilters.clear();

        checkboxes.forEach(checkbox => {
            this.selectedFilters.add(parseInt(checkbox.value));
        });
    }

    /**
     * Update filter UI checkboxes to reflect current selectedFilters
     * This is used to sync the UI when ecological filters are applied automatically
     */
    updateFilterUIFromSelectedFilters() {
        // Only update if the filter panel exists (has been loaded)
        const checkboxes = document.querySelectorAll('.filter-checkbox');
        if (checkboxes.length === 0) {
            return;
        }

        // Update each checkbox based on selectedFilters
        checkboxes.forEach(checkbox => {
            const filterIndex = parseInt(checkbox.value);
            const shouldBeChecked = this.selectedFilters.has(filterIndex);

            if (checkbox.checked !== shouldBeChecked) {
                checkbox.checked = shouldBeChecked;
            }
        });
    }

    /**
     * Apply current filters to plant list using PlantDataProcessor
     */
    applyFilters() {
        if (this.selectedFilters.size === 0) {
            // No filters selected - show all plants (matches clearFilters behavior)
            this.filteredPlants = [...this.currentPlants];
        } else if (this.dataProcessor) {
            // Use PlantDataProcessor for matrix-based filtering on FULL dataset
            this.filteredPlants = this.dataProcessor.filterPlants(this.selectedFilters, this.currentPlants);
        } else {
            // Fallback: show all plants if data processor not available
            console.warn("PlantDataProcessor not available, showing all plants");
            this.filteredPlants = [...this.currentPlants];
        }

        this.displayPlantGrid(this.filteredPlants);
    }

    /**
     * Clear all filters and show all plants
     */
    clearFilters() {
        this.selectedFilters.clear();
        const checkboxes = document.querySelectorAll('.filter-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Show all plants when filters are cleared
        this.filteredPlants = [...this.currentPlants];
        this.displayPlantGrid(this.filteredPlants);
    }

    /**
     * Attach click listeners to plant items
     */
    attachPlantItemListeners() {
        const plantItems = document.querySelectorAll('.plant-item');
        plantItems.forEach(item => {
            item.addEventListener('click', () => {
                const plantName = item.dataset.plant;
                this.onPlantSelected(plantName);
            });
        });
    }

    /**
     * Handle plant selection
     */
    onPlantSelected(plantName) {
        console.log('Plant selected:', plantName);
    }

    /**
     * Update recommendations based on ecological metrics
     */
    updateRecommendationsForMetrics(metrics) {
        console.log('Updating recommendations for metrics:', metrics);
    }

    /**
     * Refresh plant recommendations based on current PA selection
     * Called when a different PA is selected to update the plant list
     */
    refreshRecommendationsForCurrentPA() {
        if (this.currentPlants.length === 0) {
            return;
        }

        // Re-apply default filter with current PA ecological data
        this.filteredPlants = this.applyDefaultFilter(this.currentPlants);

        // Update the display
        this.displayPlantGrid(this.filteredPlants);
    }

    /**
     * Get current filter state
     */
    getCurrentFilters() {
        return Array.from(this.selectedFilters);
    }

    /**
     * Get filtered plant count
     */
    getFilteredCount() {
        return this.filteredPlants.length;
    }

    /**
     * Get total plant count
     */
    getTotalCount() {
        return this.currentPlants.length;
    }
}

// Initialize plant recommendations page when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.plantRecommendations = new PlantRecommendationsPage();
    });
} else {
    window.plantRecommendations = new PlantRecommendationsPage();
}