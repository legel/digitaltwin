/**
 * PlantDataProcessor - Simplified version of terrain's DataProcessor
 * Handles plant filtering using TensorFlow.js for terrain-3d
 */

class PlantDataProcessor {
    constructor() {
        this.plants = [];
        this.matrixColumnMap = {};
        this.tfMatrix = null;
        this.numPlants = 0;
        this.numAttributes = 0;
    }

    /**
     * Initialize with plant data from terrain-3d format
     */
    async initializeWithPlantData(plantData, ontologyData) {
        console.log("PlantDataProcessor: Initializing with plant data...");

        try {
            // Convert plant data to array format
            this.plants = Object.values(plantData);
            this.numPlants = this.plants.length;

            // Build matrix column map from ontology
            this.buildMatrixColumnMap(ontologyData);

            // Build matrix from actual ecophysiologyVector data
            this.numAttributes = Object.keys(this.matrixColumnMap).length;
            const matrixData = this.buildMatrixFromPlantData(plantData);

            if (window.tf) {
                this.tfMatrix = window.tf.tensor2d(matrixData, [this.numPlants, this.numAttributes]);
                console.log(`PlantDataProcessor: Matrix initialized - ${this.numPlants} plants x ${this.numAttributes} attributes`);
            } else {
                console.warn("PlantDataProcessor: TensorFlow.js not available, filtering disabled");
            }

            return true;
        } catch (error) {
            console.error('PlantDataProcessor: Error in initialization:', error);
            throw error;
        }
    }

    /**
     * Build matrix from actual plant ecophysiologyVector data
     */
    buildMatrixFromPlantData(plantData) {
        console.log("PlantDataProcessor: Building matrix from ecophysiology data...");

        const matrixData = [];
        const plantEntries = Object.values(plantData);

        for (let plantIndex = 0; plantIndex < this.numPlants; plantIndex++) {
            const plant = plantEntries[plantIndex];

            // Get the ecophysiologyVector or create empty vector if not available
            const ecophysiologyVector = plant.ecophysiologyVector || [];

            // For each attribute column
            for (let attrIndex = 0; attrIndex < this.numAttributes; attrIndex++) {
                // Use actual ecophysiology data or default to 0 if not available
                const value = ecophysiologyVector[attrIndex] || 0;
                matrixData.push(value);
            }
        }

        console.log(`PlantDataProcessor: Built matrix with ${matrixData.length} values (${this.numPlants} x ${this.numAttributes})`);

        // Debug: Log first few plants and their column 4 values (Grass filter)
        console.log("PlantDataProcessor: First 5 plants column 4 values (Grass filter):");
        for (let i = 0; i < Math.min(5, this.numPlants); i++) {
            const plantName = plantEntries[i].name || "Unknown";
            const col4Value = matrixData[i * this.numAttributes + 4];
            console.log(`  ${i + 1}. ${plantName}: ${col4Value}`);
        }

        return matrixData;
    }

    /**
     * Build matrix column mapping from ontology data
     */
    buildMatrixColumnMap(ontologyData) {
        this.matrixColumnMap = {};

        ontologyData.forEach((node, index) => {
            if (node.type === 'selector') {
                this.matrixColumnMap[node.name] = node.matrix_column_index || index;
            }
        });

        console.log(`PlantDataProcessor: Built matrix column map with ${Object.keys(this.matrixColumnMap).length} filters`);
    }

    /**
     * Filter plants using TensorFlow.js operations (matching terrain implementation)
     */
    filterPlants(selectedFilters, plantsToFilter) {
        console.log("PlantDataProcessor: Applying filters...", Array.from(selectedFilters));

        if (!this.tfMatrix || !window.tf) {
            console.warn("PlantDataProcessor: Matrix or TensorFlow.js not available, returning all plants");
            return plantsToFilter;
        }

        if (selectedFilters.size === 0) {
            console.log("PlantDataProcessor: No filters selected, showing all plants");
            return plantsToFilter;
        }

        try {
            // Create result vector starting with all ones
            let resultVector = window.tf.ones([this.numPlants], 'int32');

            // Apply each selected filter using matrix operations
            selectedFilters.forEach(columnIndex => {
                if (columnIndex < this.numAttributes) {
                    const filterVector = this.tfMatrix.slice([0, columnIndex], [this.numPlants, 1]).squeeze();
                    resultVector = resultVector.mul(filterVector);
                }
            });

            // Get visibility array from tensor
            const visibilityArray = resultVector.dataSync();
            console.log("PlantDataProcessor: Filter results:", visibilityArray);

            // Filter plants based on visibility
            const filteredPlants = plantsToFilter.filter((plant, index) => {
                return index < visibilityArray.length && visibilityArray[index] === 1;
            });

            console.log(`PlantDataProcessor: Filtered from ${plantsToFilter.length} to ${filteredPlants.length} plants`);
            return filteredPlants;

        } catch (error) {
            console.error('PlantDataProcessor: Error in filtering:', error);
            return plantsToFilter; // Return all plants on error
        }
    }

    /**
     * Get matrix column index for a filter name
     */
    getColumnIndex(filterName) {
        return this.matrixColumnMap[filterName] || -1;
    }

    /**
     * Clean up TensorFlow.js resources
     */
    dispose() {
        if (this.tfMatrix) {
            this.tfMatrix.dispose();
            this.tfMatrix = null;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PlantDataProcessor = PlantDataProcessor;
}