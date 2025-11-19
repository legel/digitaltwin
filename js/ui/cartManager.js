/**
 * Cart Manager
 * Handles shopping cart functionality for plant purchases
 */

class CartManager {
    constructor() {
        this.cart = []; // Array of cart items {plantName, speciesKey, quantity}
        this.isVisible = false;
        this.cartButton = null;
        this.cartPopup = null;
        this.cartOverlay = null;

        this.init();
    }

    /**
     * Initialize cart UI and event listeners
     */
    init() {
        this.createCartButton();
        this.createCartPopup();
        this.attachEventListeners();
    }

    /**
     * Create the cart button
     */
    createCartButton() {
        const cartHTML = `
            <div class="cart-button" id="cart-button">
                <div class="cart-icon">
                    <div class="cart-counter" id="cart-counter">0</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', cartHTML);
        this.cartButton = document.getElementById('cart-button');
    }

    /**
     * Create the cart popup
     */
    createCartPopup() {
        const popupHTML = `
            <div class="cart-overlay" id="cart-overlay"></div>
            <div class="cart-popup" id="cart-popup">
                <div class="cart-popup-header">
                    <h2 class="cart-title">Shopping Cart</h2>
                    <button class="cart-close" id="cart-close">×</button>
                </div>
                <div class="cart-items" id="cart-items">
                    <div class="cart-empty" id="cart-empty">
                        Your cart is empty
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', popupHTML);
        this.cartPopup = document.getElementById('cart-popup');
        this.cartOverlay = document.getElementById('cart-overlay');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Cart button click
        this.cartButton.addEventListener('click', () => {
            this.toggleCart();
        });

        // Cart close button
        document.getElementById('cart-close').addEventListener('click', () => {
            this.hideCart();
        });

        // Overlay click to close
        this.cartOverlay.addEventListener('click', () => {
            this.hideCart();
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hideCart();
            }
        });
    }

    /**
     * Add item to cart with inventory details
     */
    addToCart(plantName, speciesKey, quantity, inventoryItem = null) {
        // Create ProductNurseryPlant for proper unique identification
        const product = inventoryItem ?
            new ProductNurseryPlant(plantName, speciesKey, inventoryItem) :
            null;

        const itemId = product ? product.uniqueId : `${plantName}-${speciesKey}`;

        // Check if this specific item already exists in cart
        const existingItem = this.cart.find(item => item.itemId === itemId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                itemId,
                plantName,
                speciesKey,
                quantity,
                // Store the COMPLETE inventory data for perfect 1:1 mapping
                inventoryData: inventoryItem ? { ...inventoryItem } : null,
                // Also store the product instance for consistent access to methods
                product: product
            });
        }

        this.updateCartDisplay();
    }

    /**
     * Remove item from cart by item ID
     */
    removeFromCartById(itemId) {
        const item = this.cart.find(item => item.itemId === itemId);
        this.cart = this.cart.filter(item => item.itemId !== itemId);
        this.updateCartDisplay();
    }

    /**
     * Remove item from cart (legacy method)
     */
    removeFromCart(plantName, speciesKey) {
        this.cart = this.cart.filter(item =>
            !(item.plantName === plantName && item.speciesKey === speciesKey)
        );
        this.updateCartDisplay();
    }

    /**
     * Get total quantity in cart
     */
    getTotalQuantity() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    /**
     * Get quantity of specific inventory item already in cart
     */
    getItemQuantity(plantName, speciesKey, inventoryItem) {
        // Create ProductNurseryPlant for proper unique identification
        const product = inventoryItem ?
            new ProductNurseryPlant(plantName, speciesKey, inventoryItem) :
            null;

        const itemId = product ? product.uniqueId : `${plantName}-${speciesKey}`;

        const existingItem = this.cart.find(item => item.itemId === itemId);
        return existingItem ? existingItem.quantity : 0;
    }

    /**
     * Update cart counter and popup display
     */
    updateCartDisplay() {
        const counter = document.getElementById('cart-counter');
        const totalQuantity = this.getTotalQuantity();

        // Update counter
        counter.textContent = totalQuantity;

        if (totalQuantity > 0) {
            counter.classList.add('visible');
        } else {
            counter.classList.remove('visible');
        }

        // Update popup content
        this.updateCartPopup();
    }

    /**
     * Get shipping cost (placeholder)
     */
    getShippingCost() {
        return 150.00;
    }

    /**
     * Get sales tax rate (placeholder)
     */
    getSalesTaxRate() {
        return 1.06;
    }

    /**
     * Calculate subtotal for all plants
     */
    getSubtotal() {
        return this.cart.reduce((total, item) => {
            const unitPrice = this.getItemUnitPrice(item);
            return total + (unitPrice * item.quantity);
        }, 0);
    }

    /**
     * Get unit price for a cart item
     */
    getItemUnitPrice(item) {
        if (item.product) {
            return parseFloat(item.product.nurseryData.wholesale_price) || 0;
        } else if (item.inventoryData) {
            return parseFloat(item.inventoryData.wholesale_price) || 0;
        }
        return 0;
    }

    /**
     * Calculate total cost including shipping and tax
     */
    getTotalCost() {
        const subtotal = this.getSubtotal();
        const shipping = this.getShippingCost();
        const beforeTax = subtotal + shipping;
        return beforeTax * this.getSalesTaxRate();
    }

    /**
     * Update cart popup content
     */
    updateCartPopup() {
        const cartItems = document.getElementById('cart-items');
        const cartEmpty = document.getElementById('cart-empty');

        if (this.cart.length === 0) {
            cartEmpty.style.display = 'block';
            cartItems.querySelectorAll('.cart-item').forEach(item => item.remove());
            cartItems.querySelectorAll('.cart-summary').forEach(summary => summary.remove());
        } else {
            cartEmpty.style.display = 'none';

            // Clear existing items and summary
            cartItems.querySelectorAll('.cart-item').forEach(item => item.remove());
            cartItems.querySelectorAll('.cart-summary').forEach(summary => summary.remove());

            // Add current cart items
            this.cart.forEach((item, index) => {
                // Use the stored product for consistent display, fallback to legacy data
                let inventoryInfo = '';
                if (item.product) {
                    // Use ProductNurseryPlant methods for consistent formatting
                    const containerInfo = item.product.getContainerInfo();
                    const dimensions = item.product.getDimensions();
                    const nursery = item.product.getNurseryDisplayName();

                    inventoryInfo = `<div class="cart-item-details">${containerInfo}${dimensions ? ' - ' + dimensions : ''} - ${nursery}</div>`;
                } else if (item.inventoryData) {
                    // Fallback using complete inventory data
                    const containerInfo = `${item.inventoryData.container_size || ''} ${item.inventoryData.container_type || ''}`.trim();
                    const dimensions = item.inventoryData.published_height && item.inventoryData.published_spread ?
                        `${item.inventoryData.published_height} x ${item.inventoryData.published_spread} ft` : '';
                    const nursery = item.inventoryData.nursery || '';

                    inventoryInfo = `<div class="cart-item-details">${containerInfo}${dimensions ? ' - ' + dimensions : ''} - ${nursery}</div>`;
                } else if (item.inventoryDetails) {
                    // Legacy fallback
                    inventoryInfo = `<div class="cart-item-details">${item.inventoryDetails.containerSize} ${item.inventoryDetails.containerType} - ${item.inventoryDetails.nursery}</div>`;
                }

                const unitPrice = this.getItemUnitPrice(item);
                const itemTotal = unitPrice * item.quantity;

                const itemHTML = `
                    <div class="cart-item" data-index="${index}" data-item-id="${item.itemId}">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.plantName}</div>
                            ${inventoryInfo}
                            <div class="cart-item-quantity">Quantity: ${item.quantity} × $${unitPrice.toFixed(2)} = $${itemTotal.toFixed(2)}</div>
                        </div>
                        <button class="cart-item-remove"
                                data-item-id="${item.itemId}">
                            Remove
                        </button>
                    </div>
                `;
                cartItems.insertAdjacentHTML('beforeend', itemHTML);
            });

            // Add cart summary
            const subtotal = this.getSubtotal();
            const shipping = this.getShippingCost();
            const totalCost = this.getTotalCost();

            const summaryHTML = `
                <div class="cart-summary">
                    <div class="cart-summary-line">
                        <span>Subtotal:</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="cart-summary-line">
                        <span>Shipping:</span>
                        <span>$${shipping.toFixed(2)}</span>
                    </div>
                    <div class="cart-summary-line">
                        <span>Tax (6%):</span>
                        <span>$${((subtotal + shipping) * 0.06).toFixed(2)}</span>
                    </div>
                    <div class="cart-summary-line cart-total">
                        <span>Total:</span>
                        <span>$${totalCost.toFixed(2)}</span>
                    </div>
                </div>
            `;
            cartItems.insertAdjacentHTML('beforeend', summaryHTML);

            // Attach remove event listeners
            cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemId = e.target.dataset.itemId;
                    this.removeFromCartById(itemId);
                });
            });
        }
    }

    /**
     * Show cart popup
     */
    showCart() {
        this.updateCartPopup();
        this.cartOverlay.classList.add('visible');
        this.cartPopup.classList.add('visible');
        this.isVisible = true;
    }

    /**
     * Hide cart popup
     */
    hideCart() {
        this.cartOverlay.classList.remove('visible');
        this.cartPopup.classList.remove('visible');
        this.isVisible = false;
    }

    /**
     * Toggle cart popup visibility
     */
    toggleCart() {
        if (this.isVisible) {
            this.hideCart();
        } else {
            this.showCart();
        }
    }

    /**
     * Clear entire cart
     */
    clearCart() {
        this.cart = [];
        this.updateCartDisplay();
    }
}

// Initialize cart manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cartManager = new CartManager();
    });
} else {
    window.cartManager = new CartManager();
}