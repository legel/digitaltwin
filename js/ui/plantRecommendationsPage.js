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
                <div class="plant-filters-overlay" id="plant-filters-overlay"></div>
                <div class="plant-filters-content">
                    <div class="plant-filters-header">
                        <h3>Refine Plant List</h3>
                        <button class="plant-filters-close" id="plant-filters-close">×</button>
                    </div>
                    <div class="plant-filters-body" id="plant-filters-body">
                        <div class="loading-filters">Loading plant filters...</div>
                    </div>
                </div>
            </div>
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
     * Show the plant filters panel
     */
    showFilters() {
        const filtersPanel = document.getElementById('plant-filters-panel');
        if (filtersPanel) {
            filtersPanel.classList.add('visible');
            this.isFiltersVisible = true;

            // Load filter options if not already loaded
            if (!this.filtersLoaded) {
                this.loadFilters();
            }
        }
    }

    /**
     * Hide the plant filters panel
     */
    hideFilters() {
        const filtersPanel = document.getElementById('plant-filters-panel');
        if (filtersPanel) {
            filtersPanel.classList.remove('visible');
            this.isFiltersVisible = false;
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
            console.log(`PlantRecommendationsPage: Loaded ${plantEntries.length} plants from full dataset`);

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
                    totalImages: photoTypes.length,
                    sunlight: this.inferSunlightRequirement(data),
                    structure: this.inferPlantStructure(scientificName)
                };
            });

            // Store all plants as the full dataset
            this.currentPlants = plants;

            // Apply default filter (first 20 plants) - placeholder for future PA-based filtering
            this.filteredPlants = this.applyDefaultFilter(plants);

            // Initialize PlantDataProcessor if not already done
            if (!this.dataProcessor && window.PlantDataProcessor) {
                await this.initializeDataProcessor(speciesData);
            }

            setTimeout(() => {
                this.displayPlantGrid(this.filteredPlants);
            }, 1000);

        } catch (error) {
            console.error('Error loading plant recommendations:', error);
            this.displayError();
        }
    }

    /**
     * Apply default filter - currently first 20 plants (placeholder for PA-based filtering)
     */
    applyDefaultFilter(plants) {
        console.log(`PlantRecommendationsPage: Applying default filter to ${plants.length} plants`);

        // TODO: Replace with PA ecological metrics-based filtering
        // For now, return first 20 plants as default
        const defaultFiltered = plants.slice(0, 20);

        console.log(`PlantRecommendationsPage: Default filter returned ${defaultFiltered.length} plants`);
        return defaultFiltered;
    }

    /**
     * Initialize the PlantDataProcessor for matrix-based filtering
     */
    async initializeDataProcessor(speciesData) {
        try {
            console.log('PlantRecommendationsPage: Initializing data processor...');

            this.dataProcessor = new window.PlantDataProcessor();

            // Wait for ontology data if not loaded yet
            if (!this.ontologyData) {
                console.log('PlantRecommendationsPage: Waiting for ontology data...');
                return; // Will be initialized when filters are loaded
            }

            await this.dataProcessor.initializeWithPlantData(speciesData, this.ontologyData);
            console.log('PlantRecommendationsPage: Data processor initialized successfully');

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
     * Infer sunlight requirement (placeholder logic)
     */
    inferSunlightRequirement(plantData) {
        // TODO: Use ecophysiology data to determine actual sunlight requirements
        const rand = Math.random();
        return rand < 0.4 ? 'full-sun' : rand < 0.7 ? 'partial-shade' : 'full-shade';
    }

    /**
     * Infer plant structure (placeholder logic)
     */
    inferPlantStructure(scientificName) {
        if (scientificName.includes('Quercus') || scientificName.includes('Pinus')) return 'tree';
        if (scientificName.includes('Spartina') || scientificName.includes('Panicum')) return 'grass';
        if (scientificName.includes('Serenoa') || scientificName.includes('Myrica')) return 'shrub';
        return 'groundcover';
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

        const plantsHTML = plants.map(plant => {
            // Handle plants with no valid images after strict filtering
            if (plant.photoTypes.length === 0 || !plant.currentPhotoType) {
                return `
                    <div class="plant-item image-wrapper"
                         data-plant="${plant.name}"
                         data-species-key="${plant.speciesKey}"
                         data-current-index="1"
                         data-photo-count="0">

                        <div class="plant-image-container">
                            <!-- Plant name overlay -->
                            <div class="plant-name-overlay">
                                <h4 class="species">${plant.name}</h4>
                            </div>

                            <!-- Black box for no images -->
                            <img src="${this.getFallbackImageUrl()}"
                                 alt="${plant.name} - No images available"
                                 class="species-image plant-image">

                            <!-- No indicators for plants with no images -->
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
                        <!-- Plant name overlay -->
                        <div class="plant-name-overlay">
                            <h4 class="species">${plant.name}</h4>
                        </div>

                        <!-- Main image with silent error handling -->
                        <img src="${initialImageUrl}"
                             alt="${plant.name}"
                             class="species-image plant-image"
                             data-species-key="${plant.speciesKey}"
                             data-photo-type="${plant.currentPhotoType}"
                             onerror="this.style.visibility='hidden'">

                        <!-- Navigation arrows -->
                        ${plant.photoTypes.length > 1 ? `
                            <div class="img-arrow left" aria-label="Previous image">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M15 18L9 12L15 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <div class="img-arrow right" aria-label="Next image">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 18L15 12L9 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        ` : ''}

                        <!-- Image indicators -->
                        ${plant.photoTypes.length > 1 ? `
                            <div class="img-indicators">
                                ${indicators}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        plantGrid.innerHTML = plantsHTML.join('');

        // Initialize image gallery functionality
        this.initializeImageNavigation();
        this.attachPlantItemListeners();
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
     * Update indicator states
     */
    updateIndicators(wrapper, activeIndex) {
        const indicators = wrapper.querySelectorAll('.indicator-wrapper .indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', (index + 1) === activeIndex);
        });
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

                // Initialize data processor if we have plant data
                if (!this.dataProcessor && this.currentPlants.length > 0 && window.PlantDataProcessor) {
                    // Convert current plants back to the original format for data processor
                    const speciesData = {};
                    this.currentPlants.forEach(plant => {
                        speciesData[plant.name] = {
                            speciesKey: plant.speciesKey,
                            name: plant.name,
                            photos: plant.photos
                        };
                    });
                    this.initializeDataProcessor(speciesData);
                }
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
        }
    }

    /**
     * Attach filter control event listeners
     */
    attachFilterListeners() {
        const applyBtn = document.getElementById('apply-filters');
        const clearBtn = document.getElementById('clear-filters');
        const checkboxes = document.querySelectorAll('.filter-checkbox');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyFilters();
                this.hideFilters();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Apply filters when checkboxes change
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedFilters();
            });
        });
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
     * Apply current filters to plant list using PlantDataProcessor
     */
    applyFilters() {
        if (this.selectedFilters.size === 0) {
            // No filters selected - show all plants (matches clearFilters behavior)
            console.log(`PlantRecommendationsPage: No filters selected - showing all ${this.currentPlants.length} plants`);
            this.filteredPlants = [...this.currentPlants];
        } else if (this.dataProcessor) {
            // Use PlantDataProcessor for matrix-based filtering on FULL dataset
            console.log("Applying filters to full dataset:", Array.from(this.selectedFilters));
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
        console.log(`PlantRecommendationsPage: Clearing filters - showing all ${this.currentPlants.length} plants`);
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
        // TODO: Implement plant detail view or additional actions
    }

    /**
     * Update recommendations based on ecological metrics
     */
    updateRecommendationsForMetrics(metrics) {
        // TODO: Implement ecological matching logic
        console.log('Updating recommendations for metrics:', metrics);
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