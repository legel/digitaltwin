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
        this.activePurchaseWidget = null; // Track current purchase widget
        this.currentQuantity = 1; // Current quantity selection
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

        // Close any existing purchase widget when loading new content
        this.closePurchaseWidget();

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

            // Initialize nursery data matching
            await this.initializeNurseryData();

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
            const parsed = window.parseEcologicalName(feature.properties.name);
            return (parsed.description || parsed.id) === selectedPAName;
        });

        if (!paFeature) {
            return null;
        }

        // Extract ecological data from the feature description
        return window.parseEcologicalData(paFeature.properties.description || '');
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
     * Initialize nursery data matching for the current plant list
     */
    async initializeNurseryData() {
        try {
            if (!window.nurseryDataManager) {
                console.warn('PlantRecommendationsPage: Nursery data manager not available');
                return;
            }

            // Get list of all our species names
            const ourSpeciesList = this.currentPlants.map(plant => plant.name);

            // Build matches between our species and nursery inventory
            await window.nurseryDataManager.buildSpeciesMatches(ourSpeciesList);


        } catch (error) {
            console.error('PlantRecommendationsPage: Error initializing nursery data:', error);
        }
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
                        <div class="plant-purchase-icon" data-plant-name="${plant.name}" data-species-key="${plant.speciesKey}">
                            <div class="purchase-icon-content">
                                <span class="purchase-plus">+</span>
                                <div class="purchase-truck"></div>
                            </div>
                        </div>
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

        plantItems.forEach((item) => {
            const plantName = item.dataset.plant;
            const speciesKey = item.dataset.speciesKey;

            item.addEventListener('click', (e) => {
                // Check if navigation elements were clicked - don't show purchase widget
                if (e.target.closest('.img-arrow') || e.target.closest('.indicator-wrapper')) {
                    return; // Let navigation handle this
                }

                // Check if purchase widget elements were clicked - don't close/reopen widget
                if (e.target.closest('.plant-purchase-widget')) {
                    return; // Let widget handle its own events
                }

                // Check if the purchase icon was clicked
                if (e.target.closest('.plant-purchase-icon')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const purchaseIcon = e.target.closest('.plant-purchase-icon');
                    const plantName = purchaseIcon.dataset.plantName;
                    const speciesKey = purchaseIcon.dataset.speciesKey;
                    this.onPurchaseIconClicked(plantName, speciesKey);
                    return;
                }

                // Plant item click (including image clicks) - show purchase widget
                // Directly show widget for this plant (onPurchaseIconClicked will handle closing existing)
                this.onPurchaseIconClicked(plantName, speciesKey);
            });
        });
    }

    /**
     * Handle plant selection (legacy method - now mostly handled by direct clicks)
     */
    onPlantSelected(plantName) {
    }

    /**
     * Handle purchase icon click
     */
    onPurchaseIconClicked(plantName, speciesKey) {
        // Find the plant item - try by species key first, then by plant name
        let plantItem = document.querySelector(`[data-species-key="${speciesKey}"].plant-item`);
        if (!plantItem) {
            plantItem = document.querySelector(`[data-plant="${plantName}"].plant-item`);
        }

        if (!plantItem) {
            console.error('Could not find plant item for:', plantName, speciesKey);
            return;
        }

        // Check if this is the same plant that already has a widget
        if (this.activePurchaseWidget &&
            this.activePurchaseWidget.dataset.plant === plantName &&
            this.activePurchaseWidget.dataset.speciesKey === speciesKey) {
            return; // Same plant, don't recreate widget
        }

        // Close any existing purchase widget
        this.closePurchaseWidget();

        // Immediately create new widget since cleanup is now immediate
        this.showPurchaseWidget(plantItem, plantName, speciesKey);
    }

    /**
     * Create and show purchase widget below the selected plant
     */
    showPurchaseWidget(plantItem, plantName, speciesKey) {
        // Get all nursery inventory data
        const inventoryItems = this.getNurseryInventoryData(plantName);

        const hasInventory = inventoryItems && inventoryItems.length > 0;
        const widgetClass = hasInventory ? 'plant-purchase-widget' : 'plant-purchase-widget no-inventory';

        const widgetHTML = `
            <div class="${widgetClass}" data-plant="${plantName}" data-species-key="${speciesKey}">
                <div class="purchase-widget-header">
                    <button class="purchase-widget-close" aria-label="Close purchase options">×</button>
                </div>
                <div class="purchase-cards-container">
                    ${this.generateInventoryCards(inventoryItems, plantName, speciesKey)}
                </div>
            </div>
        `;

        // Add widget to the plant item itself (not the image container to avoid overflow hidden)
        plantItem.insertAdjacentHTML('beforeend', widgetHTML);

        // Store reference to active widget
        this.activePurchaseWidget = plantItem.querySelector('.plant-purchase-widget');

        if (!this.activePurchaseWidget) {
            console.error('Could not find inserted widget in DOM');
            return;
        }

        // Add spacing classes to handle grid layout
        this.updatePlantSpacing(plantItem, true, !hasInventory);

        // Show widget with animation
        setTimeout(() => {
            if (this.activePurchaseWidget) {
                this.activePurchaseWidget.classList.add('visible');
            }
        }, 50);

        // Attach event listeners
        this.attachPurchaseWidgetListeners();

        // Reset quantity displays to default values
        this.resetQuantityDisplays();
    }

    /**
     * Generate inventory cards HTML for the purchase widget
     */
    generateInventoryCards(inventoryItems, plantName, speciesKey) {
        if (!inventoryItems || inventoryItems.length === 0) {
            // No matching nursery inventory
            return `
                <div class="no-inventory-message">
                    <p>No participating nurseries currently stock this plant</p>
                </div>
            `;
        }

        // Convert to ProductNurseryPlant instances for consistent handling
        const products = ProductNurseryPlant.fromInventoryArray(plantName, speciesKey, inventoryItems);

        // Generate cards for each product
        return products.map((product, index) => {
            const item = product.getNurseryData();

            // Calculate quantity already in cart for this specific inventory item
            const cartQuantity = window.cartManager ?
                window.cartManager.getItemQuantity(plantName, speciesKey, item) : 0;

            // Calculate max quantity: available inventory minus what's already in cart, capped at 20 per transaction
            const remainingInventory = Math.max(0, (item.quantity_available || 0) - cartQuantity);
            const maxQuantity = Math.min(remainingInventory, 20);
            const isOutOfStock = maxQuantity === 0;

            // Map nursery names to display format
            const nurseryDisplayName = this.getNurseryDisplayName(item.nursery || 'NURSERY');

            // Extract dimensions with proper formatting
            const height = item.published_height || '';
            const spread = item.published_spread || '';
            const containerInfo = `${item.container_size || ''} ${item.container_type || 'GALLON'}`;

            return `
                <div class="inventory-card" data-item-index="${index}" data-max-quantity="${maxQuantity}" data-product-id="${product.uniqueId}">
                    <div class="card-image-container">
                        <img src="${item.picture_1_url || this.getFallbackImageUrl()}"
                             alt="${item.common_name || plantName}"
                             class="card-image"
                             onerror="this.src='${this.getFallbackImageUrl()}'">
                        <div class="card-caption">${item.common_name || ''}</div>
                    </div>
                    <div class="card-content">
                        <div class="card-info-top">
                            <div class="card-left-info">
                                <div class="quantity-available"><span class="qty-number">${remainingInventory}</span> AVAILABLE${cartQuantity > 0 ? ` (${cartQuantity} in cart)` : ''}</div>
                                <div class="nursery-name">${nurseryDisplayName}</div>
                            </div>
                            <div class="card-price">${window.pricingConfig ? window.pricingConfig.formatPrice(item.wholesale_price) : `$${(item.wholesale_price || 0).toFixed(2)}`}</div>
                        </div>
                        <div class="card-info-bottom">
                            <div class="card-size">
                                <div class="container-size">${containerInfo}</div>
                                <div class="plant-dimensions"><span class="dimension-numbers">${height} x ${spread}</span> ft</div>
                            </div>
                            <div class="card-actions">
                                <button class="card-buy-btn ${isOutOfStock ? 'disabled' : ''}"
                                        ${isOutOfStock ? 'disabled' : ''}
                                        data-item-index="${index}">
                                    BUY
                                </button>
                                <div class="card-quantity-controls" style="display: none;">
                                    <div class="quantity-selector">
                                        <button class="quantity-btn quantity-minus" data-action="decrease" data-item-index="${index}">−</button>
                                        <span class="quantity-display">${Math.min(10, remainingInventory)}</span>
                                        <button class="quantity-btn quantity-plus" data-action="increase" data-item-index="${index}">+</button>
                                    </div>
                                    <button class="add-to-cart-btn" data-item-index="${index}">Add to Cart</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-divider"></div>
                </div>
            `;
        }).join('');
    }

    /**
     * Map nursery names to display format as shown in mockup
     */
    getNurseryDisplayName(nurseryCode) {
        const nurseryMapping = {
            'CHERRYLAKE': 'CHERRYLAKE, INC.'
        };

        return nurseryMapping[nurseryCode] || nurseryCode;
    }

    /**
     * Get all nursery inventory data for a plant species
     */
    getNurseryInventoryData(plantName) {
        // Log the number of matches for debugging (as requested)
        let matchCount = 0;
        let inventoryItems = [];

        if (window.nurseryDataManager) {
            inventoryItems = window.nurseryDataManager.getInventoryForSpecies(plantName);
            matchCount = inventoryItems.length;
        }

        // Return all inventory items for multi-card display
        return inventoryItems;
    }

    /**
     * Generate mock inventory data (placeholder until real data is available)
     */
    generateMockInventoryData(plantName) {
        // Generate consistent mock data based on plant name hash
        const hash = this.simpleHash(plantName);
        const available = 50 + (hash % 200); // 50-249 available
        const basePrice = 15 + (hash % 85); // $15-99
        const price = (basePrice + 0.99).toFixed(2); // Add .99 for realistic pricing

        return {
            available: available,
            location: 'EXAMPLE, INC.',
            price: price,
            size: '15 GALLON 1.5 x 2.0 ft'
        };
    }

    /**
     * Simple hash function for consistent mock data
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Attach event listeners to purchase widget elements (multi-card system)
     */
    attachPurchaseWidgetListeners() {
        if (!this.activePurchaseWidget) return;

        // Mark widget as having listeners attached to prevent duplicates
        if (this.activePurchaseWidget.dataset.listenersAttached === 'true') {
            return;
        }
        this.activePurchaseWidget.dataset.listenersAttached = 'true';

        // Store reference to inventory data for event handlers
        const plantName = this.activePurchaseWidget.dataset.plant;
        const speciesKey = this.activePurchaseWidget.dataset.speciesKey;
        const inventoryItems = this.getNurseryInventoryData(plantName);

        // Close button
        const closeBtn = this.activePurchaseWidget.querySelector('.purchase-widget-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closePurchaseWidget();
            });
        }

        // Use event delegation for all card interactions
        this.activePurchaseWidget.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Handle BUY button clicks
            if (e.target.classList.contains('card-buy-btn') && !e.target.disabled) {
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                this.showQuantityControls(itemIndex);
                return;
            }

            // Handle quantity adjustment buttons
            if (e.target.classList.contains('quantity-btn')) {
                const action = e.target.dataset.action;
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                this.updateCardQuantity(action, itemIndex, inventoryItems[itemIndex]);
                return;
            }

            // Handle Add to Cart button
            if (e.target.classList.contains('add-to-cart-btn')) {
                const itemIndex = parseInt(e.target.dataset.itemIndex);
                const inventoryItem = inventoryItems[itemIndex];
                const quantity = this.getCardQuantity(itemIndex);

                if (window.cartManager && inventoryItem) {
                    window.cartManager.addToCart(plantName, speciesKey, quantity, inventoryItem);
                    this.closePurchaseWidget();
                } else {
                    console.error('Cart manager not available or invalid inventory item');
                }
                return;
            }
        });
    }

    /**
     * Show quantity controls for a specific inventory card
     */
    showQuantityControls(itemIndex) {
        const card = this.activePurchaseWidget.querySelector(`[data-item-index="${itemIndex}"]`);
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
                const plantName = this.activePurchaseWidget?.dataset.plant;
                const speciesKey = this.activePurchaseWidget?.dataset.speciesKey;
                const inventoryItems = this.getNurseryInventoryData(plantName);
                const inventoryItem = inventoryItems[itemIndex];

                if (inventoryItem) {
                    // Calculate remaining inventory after cart items and current selection
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
     * Get current quantity for a specific card
     */
    getCardQuantity(itemIndex) {
        const card = this.activePurchaseWidget.querySelector(`[data-item-index="${itemIndex}"]`);
        if (!card) return 10;

        const quantityDisplay = card.querySelector('.quantity-display');
        return quantityDisplay ? parseInt(quantityDisplay.textContent) : 10;
    }

    /**
     * Update quantity for a specific card with 10-unit intervals and remainder handling
     */
    updateCardQuantity(action, itemIndex, inventoryItem) {
        const card = this.activePurchaseWidget.querySelector(`[data-item-index="${itemIndex}"]`);
        if (!card) return;

        const quantityDisplay = card.querySelector('.quantity-display');
        const minusBtn = card.querySelector('.quantity-minus');
        const plusBtn = card.querySelector('.quantity-plus');
        const quantityAvailableElement = card.querySelector('.qty-number');

        if (!quantityDisplay || !quantityAvailableElement) return;

        let currentQuantity = parseInt(quantityDisplay.textContent) || 10;

        // Calculate quantity already in cart for this specific inventory item
        const plantName = this.activePurchaseWidget?.dataset.plant;
        const speciesKey = this.activePurchaseWidget?.dataset.speciesKey;
        const cartQuantity = window.cartManager ?
            window.cartManager.getItemQuantity(plantName, speciesKey, inventoryItem) : 0;

        // Calculate remaining inventory after cart items
        const totalAvailable = inventoryItem.quantity_available || 0;
        const remainingInventory = Math.max(0, totalAvailable - cartQuantity);

        // Handle quantity changes with 10-unit intervals
        if (action === 'increase') {
            if (remainingInventory < 10) {
                // If less than 10 available, lock to available amount
                currentQuantity = remainingInventory;
            } else {
                const currentMultiple = Math.floor(currentQuantity / 10) * 10;
                const remainder = remainingInventory % 10;

                if (currentQuantity === currentMultiple && currentQuantity + 10 <= remainingInventory) {
                    // Normal increment by 10
                    currentQuantity += 10;
                } else if (remainder > 0 && currentQuantity === Math.floor(remainingInventory / 10) * 10) {
                    // Add remainder when at highest multiple of 10
                    currentQuantity = remainingInventory;
                }
            }
        } else if (action === 'decrease') {
            if (remainingInventory < 10) {
                // Can't decrease if locked to available amount less than 10
                return;
            } else {
                const currentMultiple = Math.floor(currentQuantity / 10) * 10;

                if (currentQuantity > currentMultiple) {
                    // Go back to nearest multiple of 10
                    currentQuantity = currentMultiple;
                } else if (currentQuantity >= 20) {
                    // Normal decrement by 10
                    currentQuantity -= 10;
                } else {
                    // At minimum (10), can't decrease further
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
     * Update quantity with +/- buttons (legacy method - now per-card)
     */
    updateQuantity(action) {
        if (!this.activePurchaseWidget) return;

        if (action === 'increase' && this.currentQuantity < 20) {
            this.currentQuantity++;
        } else if (action === 'decrease' && this.currentQuantity > 1) {
            this.currentQuantity--;
        }

        // Update display
        const quantityDisplay = this.activePurchaseWidget.querySelector('.quantity-display');
        quantityDisplay.textContent = this.currentQuantity;

        // Update button states
        const minusBtn = this.activePurchaseWidget.querySelector('.quantity-minus');
        const plusBtn = this.activePurchaseWidget.querySelector('.quantity-plus');

        minusBtn.disabled = this.currentQuantity <= 1;
        plusBtn.disabled = this.currentQuantity >= 20;
    }

    /**
     * Close the active purchase widget
     */
    closePurchaseWidget() {
        if (this.activePurchaseWidget) {
            const plantItem = this.activePurchaseWidget.parentElement;

            // Immediately remove from DOM to prevent event conflicts
            this.activePurchaseWidget.remove();
            this.activePurchaseWidget = null;
            this.currentQuantity = 1; // Reset quantity

            // Remove spacing classes
            this.updatePlantSpacing(plantItem, false);
        }
    }

    /**
     * Reset quantity displays to original values when widget is recreated
     */
    resetQuantityDisplays() {
        if (!this.activePurchaseWidget) return;

        const plantName = this.activePurchaseWidget.dataset.plant;
        const speciesKey = this.activePurchaseWidget.dataset.speciesKey;
        const inventoryItems = this.getNurseryInventoryData(plantName);

        inventoryItems.forEach((item, index) => {
            const card = this.activePurchaseWidget.querySelector(`[data-item-index="${index}"]`);
            if (!card) return;

            // Reset quantity display to default (10 or available if less than 10)
            const quantityDisplay = card.querySelector('.quantity-display');
            const quantityAvailableElement = card.querySelector('.qty-number');

            if (quantityDisplay && quantityAvailableElement) {
                // Calculate current cart quantity and remaining inventory
                const cartQuantity = window.cartManager ?
                    window.cartManager.getItemQuantity(plantName, speciesKey, item) : 0;
                const remainingInventory = Math.max(0, (item.quantity_available || 0) - cartQuantity);

                // Reset to default quantity and display
                const defaultQuantity = Math.min(10, remainingInventory);
                quantityDisplay.textContent = defaultQuantity;
                quantityAvailableElement.textContent = remainingInventory;

                // Reset quantity controls to be hidden
                const buyButton = card.querySelector('.card-buy-btn');
                const quantityControls = card.querySelector('.card-quantity-controls');
                if (buyButton && quantityControls) {
                    buyButton.style.display = 'block';
                    quantityControls.style.display = 'none';
                }
            }
        });
    }

    /**
     * Update plant spacing to accommodate active widget
     */
    updatePlantSpacing(activeItem, isShowing, isNoInventory = false) {
        const allPlantItems = document.querySelectorAll('.plant-item');

        // Clear all spacing classes first
        allPlantItems.forEach(item => {
            item.classList.remove('has-active-widget', 'has-active-widget-small', 'push-down', 'push-down-small');
        });

        if (isShowing && activeItem) {
            // Choose the appropriate spacing class based on widget type
            const widgetClass = isNoInventory ? 'has-active-widget-small' : 'has-active-widget';
            const pushDownClass = isNoInventory ? 'push-down-small' : 'push-down';

            // Mark the active item
            activeItem.classList.add(widgetClass);

            // Find the grid column of the active item (0 or 1 for 2-column grid)
            const allItems = Array.from(allPlantItems);
            const activeIndex = allItems.indexOf(activeItem);
            const activeColumn = activeIndex % 2; // 0 for left, 1 for right

            // Find items in the next row that need to be pushed down
            const nextRowStart = Math.ceil((activeIndex + 1) / 2) * 2;

            // Push down items starting from the next row
            for (let i = nextRowStart; i < allItems.length; i++) {
                allItems[i].classList.add(pushDownClass);
            }
        }
    }

    /**
     * Update recommendations based on ecological metrics
     */
    updateRecommendationsForMetrics(metrics) {
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

    /**
     * Handle focus panel closing - clean up any active purchase widgets
     */
    onFocusPanelClose() {
        this.closePurchaseWidget();
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