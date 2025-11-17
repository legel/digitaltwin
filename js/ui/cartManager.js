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
        // Create unique identifier for specific inventory items
        const itemId = inventoryItem ?
            `${plantName}-${speciesKey}-${inventoryItem.item_code || inventoryItem.container_size}` :
            `${plantName}-${speciesKey}`;

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
                inventoryDetails: inventoryItem ? {
                    nursery: inventoryItem.nursery,
                    containerSize: inventoryItem.container_size,
                    containerType: inventoryItem.container_type,
                    price: inventoryItem.wholesale_price,
                    itemCode: inventoryItem.item_code
                } : null
            });
        }

        this.updateCartDisplay();
        console.log(`Added to cart: ${quantity}x ${plantName}`);
    }

    /**
     * Remove item from cart by item ID
     */
    removeFromCartById(itemId) {
        const item = this.cart.find(item => item.itemId === itemId);
        this.cart = this.cart.filter(item => item.itemId !== itemId);
        this.updateCartDisplay();
        console.log(`Removed from cart: ${item ? item.plantName : 'Unknown item'}`);
    }

    /**
     * Remove item from cart (legacy method)
     */
    removeFromCart(plantName, speciesKey) {
        this.cart = this.cart.filter(item =>
            !(item.plantName === plantName && item.speciesKey === speciesKey)
        );
        this.updateCartDisplay();
        console.log(`Removed from cart: ${plantName}`);
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
        const itemId = inventoryItem ?
            `${plantName}-${speciesKey}-${inventoryItem.item_code || inventoryItem.container_size}` :
            `${plantName}-${speciesKey}`;

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
     * Update cart popup content
     */
    updateCartPopup() {
        const cartItems = document.getElementById('cart-items');
        const cartEmpty = document.getElementById('cart-empty');

        if (this.cart.length === 0) {
            cartEmpty.style.display = 'block';
            cartItems.querySelectorAll('.cart-item').forEach(item => item.remove());
        } else {
            cartEmpty.style.display = 'none';

            // Clear existing items
            cartItems.querySelectorAll('.cart-item').forEach(item => item.remove());

            // Add current cart items
            this.cart.forEach((item, index) => {
                const inventoryInfo = item.inventoryDetails ?
                    `<div class="cart-item-details">${item.inventoryDetails.containerSize} ${item.inventoryDetails.containerType} - ${item.inventoryDetails.nursery}</div>` :
                    '';

                const itemHTML = `
                    <div class="cart-item" data-index="${index}">
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.plantName}</div>
                            ${inventoryInfo}
                            <div class="cart-item-quantity">Quantity: ${item.quantity}</div>
                        </div>
                        <button class="cart-item-remove"
                                data-item-id="${item.itemId}">
                            Remove
                        </button>
                    </div>
                `;
                cartItems.insertAdjacentHTML('beforeend', itemHTML);
            });

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