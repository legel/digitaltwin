/**
 * Pricing Configuration
 * Centralizes all pricing calculations and markup logic for the platform
 */

class PricingConfig {
    constructor() {
        // Ecodash markup percentage - easily adjustable for business needs
        this.MARKUP_PERCENTAGE = 0.10; // 10% markup on nursery wholesale prices
    }

    /**
     * Apply markup to a wholesale price
     * @param {number} wholesalePrice - The nursery wholesale price
     * @returns {number} The price with markup applied
     */
    applyMarkup(wholesalePrice) {
        const price = parseFloat(wholesalePrice);
        if (isNaN(price) || price <= 0) {
            return 0;
        }
        return price * (1 + this.MARKUP_PERCENTAGE);
    }

    /**
     * Get the current markup percentage
     * @returns {number} The markup percentage as a decimal (0.10 for 10%)
     */
    getMarkupPercentage() {
        return this.MARKUP_PERCENTAGE;
    }

    /**
     * Set a new markup percentage
     * @param {number} percentage - New markup percentage as decimal (0.15 for 15%)
     */
    setMarkupPercentage(percentage) {
        this.MARKUP_PERCENTAGE = percentage;
    }

    /**
     * Format a price for display
     * @param {number} price - The price to format
     * @returns {string} Formatted price string
     */
    formatPrice(price) {
        const formattedPrice = parseFloat(price);
        if (isNaN(formattedPrice)) {
            return '$0.00';
        }
        return `$${formattedPrice.toFixed(2)}`;
    }

    /**
     * Convert price to cents for Stripe
     * @param {number} price - Price in dollars
     * @returns {number} Price in cents
     */
    toCents(price) {
        return Math.round(parseFloat(price) * 100);
    }
}

// Initialize global pricing configuration
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pricingConfig = new PricingConfig();
    });
} else {
    window.pricingConfig = new PricingConfig();
}