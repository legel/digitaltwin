/**
 * ProductNurseryPlant Class
 * Represents a specific plant variety from a specific nursery
 * Provides unique identification and standardized data handling
 */

class ProductNurseryPlant {
    constructor(plantName, speciesKey, nurseryData) {
        this.plantName = plantName;
        this.speciesKey = speciesKey;
        this.nurseryData = nurseryData;

        // Generate unique identifier for this specific plant-nursery combination
        this.uniqueId = this.generateUniqueId();
    }

    /**
     * Generate a unique identifier for this specific nursery plant item
     * Uses ALL available fields to ensure perfect uniqueness
     */
    generateUniqueId() {
        const components = [
            this.plantName,
            this.speciesKey,
            this.nurseryData.nursery || 'unknown',
            this.nurseryData.item_code || '',
            this.nurseryData.container_size || '',
            this.nurseryData.container_type || '',
            this.nurseryData.published_height || '',
            this.nurseryData.published_spread || '',
            this.nurseryData.wholesale_price || '',
            this.nurseryData.description || '',
            this.nurseryData.common_name || '',
            this.nurseryData.picture_1_url || ''
        ];

        // Filter out empty components and join with delimiters
        // Use a delimiter that's unlikely to appear in the data
        const cleanComponents = components
            .map(comp => String(comp).trim())
            .filter(comp => comp.length > 0);

        return cleanComponents.join('::');
    }

    /**
     * Get display name for this plant variety
     */
    getDisplayName() {
        const parts = [];

        if (this.plantName) parts.push(this.plantName);
        if (this.nurseryData.container_size) parts.push(`${this.nurseryData.container_size}`);
        if (this.nurseryData.nursery) parts.push(`from ${this.nurseryData.nursery}`);

        return parts.join(' ');
    }

    /**
     * Get nursery display name
     */
    getNurseryDisplayName() {
        const nurseryMapping = {
            'CHERRYLAKE': 'CHERRYLAKE, INC.'
        };
        return nurseryMapping[this.nurseryData.nursery] || this.nurseryData.nursery;
    }

    /**
     * Get formatted price
     */
    getFormattedPrice() {
        const price = parseFloat(this.nurseryData.wholesale_price) || 0;
        return `$${price.toFixed(2)}`;
    }

    /**
     * Get container information
     */
    getContainerInfo() {
        const size = this.nurseryData.container_size || '';
        const type = this.nurseryData.container_type || '';

        if (size && type) {
            return `${size} ${type}`;
        } else if (size) {
            return size;
        } else if (type) {
            return type;
        }
        return '';
    }

    /**
     * Get plant dimensions
     */
    getDimensions() {
        const height = this.nurseryData.published_height || '';
        const spread = this.nurseryData.published_spread || '';

        if (height && spread) {
            return `${height} x ${spread} ft`;
        } else if (height) {
            return `${height} ft tall`;
        } else if (spread) {
            return `${spread} ft spread`;
        }
        return '';
    }

    /**
     * Get available quantity
     */
    getQuantityAvailable() {
        return parseInt(this.nurseryData.quantity_available) || 0;
    }

    /**
     * Get plant image URL
     */
    getImageUrl() {
        return this.nurseryData.picture_1_url || '';
    }

    /**
     * Check if this product matches another ProductNurseryPlant exactly
     */
    matches(other) {
        if (!(other instanceof ProductNurseryPlant)) {
            return false;
        }
        return this.uniqueId === other.uniqueId;
    }

    /**
     * Get raw nursery data
     */
    getNurseryData() {
        return this.nurseryData;
    }

    /**
     * Create ProductNurseryPlant from existing inventory data format
     */
    static fromInventoryData(plantName, speciesKey, inventoryData) {
        return new ProductNurseryPlant(plantName, speciesKey, inventoryData);
    }

    /**
     * Create multiple ProductNurseryPlant instances from inventory array
     */
    static fromInventoryArray(plantName, speciesKey, inventoryArray) {
        return inventoryArray.map(item =>
            ProductNurseryPlant.fromInventoryData(plantName, speciesKey, item)
        );
    }

    /**
     * Generate HTML for product card display
     */
    generateCardHTML(index, cartQuantity = 0) {
        const remainingInventory = Math.max(0, this.getQuantityAvailable() - cartQuantity);
        const defaultQuantity = Math.min(10, remainingInventory);
        const isOutOfStock = remainingInventory === 0;

        const nurseryDisplay = this.getNurseryDisplayName();
        const containerInfo = this.getContainerInfo();
        const dimensions = this.getDimensions();

        return `
            <div class="inventory-card" data-unique-id="${this.uniqueId}">
                <div class="card-image-container">
                    <img class="card-image" src="${this.getImageUrl()}" alt="${this.plantName}" loading="lazy">
                    <div class="card-caption">${this.nurseryData.common_name || this.plantName}</div>
                </div>
                <div class="card-content">
                    <div class="card-info-top">
                        <div class="card-left-info">
                            <div class="quantity-available"><span class="qty-number">${remainingInventory}</span> AVAILABLE${cartQuantity > 0 ? ` (${cartQuantity} in cart)` : ''}</div>
                            <div class="nursery-info">${nurseryDisplay}</div>
                        </div>
                        <div class="price-display">${this.getFormattedPrice()}</div>
                    </div>
                    <div class="card-info-bottom">
                        <div class="container-info">${containerInfo}</div>
                        <div class="dimensions-info">${dimensions}</div>
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
                                <span class="quantity-display">${defaultQuantity}</span>
                                <button class="quantity-btn quantity-plus" data-action="increase" data-item-index="${index}">+</button>
                            </div>
                            <button class="add-to-cart-btn" data-item-index="${index}">Add to Cart</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Make available globally
window.ProductNurseryPlant = ProductNurseryPlant;