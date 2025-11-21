/**
 * Nursery Data Manager
 * Handles loading and matching nursery inventory data with plant species
 */

class NurseryDataManager {
    constructor() {
        this.cherrylakeInventory = null;
        this.speciesMatches = new Map(); // Maps our species names to nursery inventory items
        this.inventoryCache = new Map(); // Cache parsed inventory data
    }

    /**
     * Load Cherrylake inventory CSV data
     */
    async loadCherrylakeInventory() {
        if (this.cherrylakeInventory) {
            return this.cherrylakeInventory;
        }

        try {
            const response = await fetch('/data/nursery-inventories/cherrylake_inventory_20251114.csv');
            const csvText = await response.text();
            this.cherrylakeInventory = this.parseCSV(csvText);
            return this.cherrylakeInventory;
        } catch (error) {
            console.error('NurseryDataManager: Error loading Cherrylake inventory:', error);
            return [];
        }
    }

    /**
     * Parse CSV text into array of objects
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index].trim();
                });

                // Filter out rows with invalid wholesale_price values
                const price = parseFloat(row.wholesale_price);
                if (isNaN(price) || price <= 0 || !row.wholesale_price || row.wholesale_price.trim() === '') {
                    continue; // Skip this row
                }

                data.push(row);
            }
        }

        return data;
    }

    /**
     * Parse a single CSV line, handling quoted values
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        return values;
    }

    /**
     * Extract genus and species from scientific name
     * More flexible parsing that looks for the first two non-quoted words
     * Handles cases like:
     * - "Acca sellowiana" -> "Acca sellowiana"
     * - "Acer rubrum 'Florida Flame'" -> "Acer rubrum"
     * - "Callistemon 'Red Cluster' FTG" -> null (no two non-quoted words)
     * - "X Cupressocyparis leylandii FTG" -> "Cupressocyparis leylandii" (skip X, find next two)
     * - "'Red Cluster' Callistemon viminalis" -> "Callistemon viminalis"
     */
    extractGenusSpecies(scientificName) {
        if (!scientificName || scientificName.trim() === '') {
            return null;
        }

        const trimmed = scientificName.trim();

        // Split into words
        const words = trimmed.split(/\s+/);
        if (words.length < 2) {
            return null;
        }

        // Find the first two words that are not quoted and not "X"
        const validWords = [];

        for (let i = 0; i < words.length && validWords.length < 2; i++) {
            const word = words[i];

            // Skip quoted words (cultivar names)
            if (word.startsWith("'") || word.startsWith('"') ||
                word.endsWith("'") || word.endsWith('"')) {
                continue;
            }

            // Skip hybrid marker "X"
            if (word === 'X') {
                continue;
            }

            // Skip words that are clearly not genus/species (common suffixes)
            if (['FTG', 'PP', '®', '™'].includes(word)) {
                continue;
            }

            validWords.push(word);
        }

        // Need exactly two valid words for genus + species
        if (validWords.length >= 2) {
            return `${validWords[0]} ${validWords[1]}`;
        }

        return null;
    }

    /**
     * Build species matches between our plant data and nursery inventory
     */
    async buildSpeciesMatches(ourSpeciesList) {
        const inventory = await this.loadCherrylakeInventory();
        this.speciesMatches.clear();

        // Create a map of our species names for quick lookup
        const ourSpeciesMap = new Set(ourSpeciesList.map(name => name.toLowerCase()));

        let totalProcessed = 0;
        let totalMatched = 0;
        let totalSkipped = 0;
        let totalNullParsed = 0;

        // Track unmatched species for detailed logging
        const unmatchedSpecies = new Set();
        const unmatchedOriginals = new Map(); // Maps parsed species to original scientific_name values

        // Process each inventory item
        inventory.forEach(item => {
            totalProcessed++;

            const genusSpecies = this.extractGenusSpecies(item.scientific_name);

            if (!genusSpecies) {
                totalNullParsed++;
                return;
            }

            const normalizedGenusSpecies = genusSpecies.toLowerCase();

            // Check if this species exists in our data
            if (ourSpeciesMap.has(normalizedGenusSpecies)) {
                // Store the match (use original case for the key)
                const matchKey = ourSpeciesList.find(name =>
                    name.toLowerCase() === normalizedGenusSpecies
                );

                if (!this.speciesMatches.has(matchKey)) {
                    this.speciesMatches.set(matchKey, []);
                }

                this.speciesMatches.get(matchKey).push(item);
                totalMatched++;
            } else {
                // Track unmatched species (only if we successfully parsed genus+species)
                if (!unmatchedSpecies.has(normalizedGenusSpecies)) {
                    unmatchedSpecies.add(normalizedGenusSpecies);
                    unmatchedOriginals.set(normalizedGenusSpecies, item.scientific_name);
                }
                totalSkipped++;
            }
        });


        return this.speciesMatches;
    }

    /**
     * Get nursery inventory data for a specific species
     */
    getInventoryForSpecies(speciesName) {
        const matches = this.speciesMatches.get(speciesName);
        if (!matches || matches.length === 0) {
            return [];
        }

        // Return formatted inventory data with the fields we need
        return matches.map(item => ({
            nursery: 'CHERRYLAKE',
            common_name: item.common_name || '',
            container_size: item.container_size || '',
            container_type: item.container_type || '',
            quantity_available: parseInt(item.quantity_available) || 0,
            published_height: item.published_height || '',
            published_spread: item.published_spread || '',
            wholesale_price: window.pricingConfig ? window.pricingConfig.applyMarkup(item.wholesale_price) : (parseFloat(item.wholesale_price) || 0),
            picture_1_url: item.picture_1_url || '',
            item_code: item.item_code || '',
            description: item.description || ''
        }));
    }

    /**
     * Get summary statistics for debugging
     */
    getMatchStats() {
        return {
            totalInventoryItems: this.cherrylakeInventory ? this.cherrylakeInventory.length : 0,
            uniqueSpeciesMatched: this.speciesMatches.size,
            totalMatchedItems: Array.from(this.speciesMatches.values()).reduce((sum, items) => sum + items.length, 0)
        };
    }
}

// Initialize the nursery data manager globally
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.nurseryDataManager = new NurseryDataManager();
    });
} else {
    window.nurseryDataManager = new NurseryDataManager();
}