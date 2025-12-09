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
        this.checkoutPopup = null;
        this.checkoutOverlay = null;
        this.checkoutVisible = false;
        this.successPopup = null;
        this.successOverlay = null;
        this.successVisible = false;

        // Stripe integration
        this.stripe = null;
        this.cardElement = null;
        this.stripeReady = false;

        // Initialize Stripe when window loads to ensure script is ready
        if (document.readyState === 'loading') {
            window.addEventListener('load', () => this.initializeStripe());
        } else {
            // DOM already loaded, check if Stripe is available
            if (typeof Stripe !== 'undefined') {
                this.initializeStripe();
            } else {
                // Wait for Stripe script to load
                window.addEventListener('load', () => this.initializeStripe());
            }
        }

        this.init();
    }

    /**
     * Initialize Stripe Elements for PCI-compliant card collection
     */
    async initializeStripe() {
        try {
            // Check if Stripe is available
            if (typeof Stripe === 'undefined') {
                console.error('Stripe.js not loaded');
                return;
            }

            // Fetch Stripe configuration from backend
            const configResponse = await fetch('/api/stripe-config');
            const config = await configResponse.json();

            this.stripe = Stripe(config.publishable_key);

            if (this.stripe) {
                this.setupCardElement();
                this.stripeReady = true;
            } else {
                console.error('Failed to create Stripe instance');
            }
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
        }
    }

    /**
     * Set up Stripe Card Element
     */
    setupCardElement() {
        if (!this.stripe) {
            console.error('Stripe not initialized');
            return;
        }

        const elements = this.stripe.elements();

        // Create card element with minimal styling
        this.cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                }
            }
        });

        // Listen for realtime validation errors from the card Element
        this.cardElement.on('change', ({error}) => {
            const displayError = document.getElementById('stripe-card-errors');
            if (displayError) {
                if (error) {
                    displayError.textContent = error.message;
                    displayError.style.display = 'block';
                } else {
                    displayError.style.display = 'none';
                    displayError.textContent = '';
                }
            }
        });

    }


    /**
     * Initialize cart UI and event listeners
     */
    init() {
        this.createCartButton();
        this.createCartPopup();
        this.createCheckoutPopup();
        this.createSuccessPopup();
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
            <div class="plant-browse-button" id="plant-browse-button">
                <div class="plant-browse-icon">🌱</div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', cartHTML);
        this.cartButton = document.getElementById('cart-button');
        this.plantBrowseButton = document.getElementById('plant-browse-button');
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
     * Create the checkout popup
     */
    createCheckoutPopup() {
        const checkoutHTML = `
            <div class="checkout-overlay" id="checkout-overlay"></div>
            <div class="checkout-popup" id="checkout-popup">
                <div class="checkout-popup-header">
                    <h2 class="checkout-title">Checkout</h2>
                    <button class="checkout-close" id="checkout-close">×</button>
                </div>
                <div class="checkout-content" id="checkout-content">

                    <!-- Delivery Address Section -->
                    <div class="checkout-section">
                        <h3 class="checkout-section-title">Delivery Address</h3>
                        <div class="checkout-form-row">
                            <input type="text" class="checkout-input" id="checkout-first-name"
                                   placeholder="First Name" autocomplete="given-name">
                            <input type="text" class="checkout-input" id="checkout-last-name"
                                   placeholder="Last Name" autocomplete="family-name">
                        </div>
                        <div class="checkout-form-row">
                            <input type="text" class="checkout-input full-width" id="checkout-address"
                                   placeholder="Street Address" autocomplete="street-address">
                        </div>
                        <div class="checkout-form-row">
                            <input type="text" class="checkout-input" id="checkout-city"
                                   placeholder="City" autocomplete="address-level2">
                            <select class="checkout-input" id="checkout-state" autocomplete="address-level1">
                                <option value="">Select State</option>
                                <option value="AL">Alabama</option>
                                <option value="AK">Alaska</option>
                                <option value="AZ">Arizona</option>
                                <option value="AR">Arkansas</option>
                                <option value="CA">California</option>
                                <option value="CO">Colorado</option>
                                <option value="CT">Connecticut</option>
                                <option value="DE">Delaware</option>
                                <option value="FL">Florida</option>
                                <option value="GA">Georgia</option>
                                <option value="HI">Hawaii</option>
                                <option value="ID">Idaho</option>
                                <option value="IL">Illinois</option>
                                <option value="IN">Indiana</option>
                                <option value="IA">Iowa</option>
                                <option value="KS">Kansas</option>
                                <option value="KY">Kentucky</option>
                                <option value="LA">Louisiana</option>
                                <option value="ME">Maine</option>
                                <option value="MD">Maryland</option>
                                <option value="MA">Massachusetts</option>
                                <option value="MI">Michigan</option>
                                <option value="MN">Minnesota</option>
                                <option value="MS">Mississippi</option>
                                <option value="MO">Missouri</option>
                                <option value="MT">Montana</option>
                                <option value="NE">Nebraska</option>
                                <option value="NV">Nevada</option>
                                <option value="NH">New Hampshire</option>
                                <option value="NJ">New Jersey</option>
                                <option value="NM">New Mexico</option>
                                <option value="NY">New York</option>
                                <option value="NC">North Carolina</option>
                                <option value="ND">North Dakota</option>
                                <option value="OH">Ohio</option>
                                <option value="OK">Oklahoma</option>
                                <option value="OR">Oregon</option>
                                <option value="PA">Pennsylvania</option>
                                <option value="RI">Rhode Island</option>
                                <option value="SC">South Carolina</option>
                                <option value="SD">South Dakota</option>
                                <option value="TN">Tennessee</option>
                                <option value="TX">Texas</option>
                                <option value="UT">Utah</option>
                                <option value="VT">Vermont</option>
                                <option value="VA">Virginia</option>
                                <option value="WA">Washington</option>
                                <option value="WV">West Virginia</option>
                                <option value="WI">Wisconsin</option>
                                <option value="WY">Wyoming</option>
                            </select>
                            <input type="text" class="checkout-input" id="checkout-zip"
                                   placeholder="ZIP Code" autocomplete="postal-code">
                        </div>
                        <div class="checkout-form-row">
                            <input type="tel" class="checkout-input" id="checkout-phone"
                                   placeholder="Phone Number" autocomplete="tel">
                            <input type="email" class="checkout-input" id="checkout-email"
                                   placeholder="Email Address" autocomplete="email">
                        </div>
                    </div>

                    <!-- Shipping Date Section -->
                    <div class="checkout-section">
                        <h3 class="checkout-section-title">Shipping Date & Time</h3>
                        <div class="checkout-form-row">
                            <input type="date" class="checkout-input" id="checkout-date"
                                   placeholder="Delivery Date">
                            <select class="checkout-input" id="checkout-time">
                                <option value="08:00">8:00 AM</option>
                                <option value="08:30">8:30 AM</option>
                                <option value="09:00">9:00 AM</option>
                                <option value="09:30">9:30 AM</option>
                                <option value="10:00" selected>10:00 AM</option>
                                <option value="10:30">10:30 AM</option>
                                <option value="11:00">11:00 AM</option>
                                <option value="11:30">11:30 AM</option>
                                <option value="12:00">12:00 PM</option>
                                <option value="12:30">12:30 PM</option>
                                <option value="13:00">1:00 PM</option>
                                <option value="13:30">1:30 PM</option>
                                <option value="14:00">2:00 PM</option>
                                <option value="14:30">2:30 PM</option>
                                <option value="15:00">3:00 PM</option>
                                <option value="15:30">3:30 PM</option>
                                <option value="16:00">4:00 PM</option>
                            </select>
                        </div>
                        <div class="checkout-form-row">
                            <textarea class="checkout-textarea" id="checkout-instructions"
                                      placeholder="Special delivery instructions (optional)"></textarea>
                        </div>
                    </div>

                    <!-- Payment Information Section -->
                    <div class="checkout-section">
                        <h3 class="checkout-section-title">Payment Information</h3>
                        <div class="checkout-form-row">
                            <div id="stripe-card-element" style="
                                padding: 10px;
                                border: 1px solid #ccc;
                                border-radius: 4px;
                                background: white;
                                height: 40px;
                                width: 100%;
                                box-sizing: border-box;
                            "></div>
                            <div id="stripe-card-errors" style="margin-top: 5px; display: none; color: #e25950; font-size: 14px;"></div>
                        </div>
                        <div class="checkout-form-row">
                            <select class="checkout-input full-width" id="checkout-billing-same">
                                <option value="true">Billing address same as delivery address</option>
                                <option value="false">Use different billing address</option>
                            </select>
                        </div>

                        <!-- Billing Address Section (hidden by default) -->
                        <div class="checkout-billing-address" id="checkout-billing-address-section" style="display: none;">
                            <h4 class="checkout-subsection-title">Billing Address</h4>
                            <div class="checkout-form-row">
                                <input type="text" class="checkout-input" id="checkout-billing-first-name"
                                       placeholder="First Name" autocomplete="billing given-name">
                                <input type="text" class="checkout-input" id="checkout-billing-last-name"
                                       placeholder="Last Name" autocomplete="billing family-name">
                            </div>
                            <div class="checkout-form-row">
                                <input type="text" class="checkout-input full-width" id="checkout-billing-address"
                                       placeholder="Street Address" autocomplete="billing street-address">
                            </div>
                            <div class="checkout-form-row">
                                <input type="text" class="checkout-input" id="checkout-billing-city"
                                       placeholder="City" autocomplete="billing address-level2">
                                <select class="checkout-input" id="checkout-billing-state" autocomplete="billing address-level1">
                                    <option value="">Select State</option>
                                    <option value="AL">Alabama</option>
                                    <option value="AK">Alaska</option>
                                    <option value="AZ">Arizona</option>
                                    <option value="AR">Arkansas</option>
                                    <option value="CA">California</option>
                                    <option value="CO">Colorado</option>
                                    <option value="CT">Connecticut</option>
                                    <option value="DE">Delaware</option>
                                    <option value="FL">Florida</option>
                                    <option value="GA">Georgia</option>
                                    <option value="HI">Hawaii</option>
                                    <option value="ID">Idaho</option>
                                    <option value="IL">Illinois</option>
                                    <option value="IN">Indiana</option>
                                    <option value="IA">Iowa</option>
                                    <option value="KS">Kansas</option>
                                    <option value="KY">Kentucky</option>
                                    <option value="LA">Louisiana</option>
                                    <option value="ME">Maine</option>
                                    <option value="MD">Maryland</option>
                                    <option value="MA">Massachusetts</option>
                                    <option value="MI">Michigan</option>
                                    <option value="MN">Minnesota</option>
                                    <option value="MS">Mississippi</option>
                                    <option value="MO">Missouri</option>
                                    <option value="MT">Montana</option>
                                    <option value="NE">Nebraska</option>
                                    <option value="NV">Nevada</option>
                                    <option value="NH">New Hampshire</option>
                                    <option value="NJ">New Jersey</option>
                                    <option value="NM">New Mexico</option>
                                    <option value="NY">New York</option>
                                    <option value="NC">North Carolina</option>
                                    <option value="ND">North Dakota</option>
                                    <option value="OH">Ohio</option>
                                    <option value="OK">Oklahoma</option>
                                    <option value="OR">Oregon</option>
                                    <option value="PA">Pennsylvania</option>
                                    <option value="RI">Rhode Island</option>
                                    <option value="SC">South Carolina</option>
                                    <option value="SD">South Dakota</option>
                                    <option value="TN">Tennessee</option>
                                    <option value="TX">Texas</option>
                                    <option value="UT">Utah</option>
                                    <option value="VT">Vermont</option>
                                    <option value="VA">Virginia</option>
                                    <option value="WA">Washington</option>
                                    <option value="WV">West Virginia</option>
                                    <option value="WI">Wisconsin</option>
                                    <option value="WY">Wyoming</option>
                                </select>
                                <input type="text" class="checkout-input" id="checkout-billing-zip"
                                       placeholder="ZIP Code" autocomplete="billing postal-code">
                            </div>
                        </div>
                    </div>

                    <!-- Order Summary Section -->
                    <div class="checkout-section">
                        <h3 class="checkout-section-title">Order Summary</h3>
                        <div class="checkout-order-summary" id="checkout-order-summary">
                            <!-- Order summary will be populated here -->
                        </div>
                    </div>

                    <!-- Purchase Button -->
                    <div class="checkout-section">
                        <button class="checkout-purchase-btn" id="checkout-purchase-btn">
                            Complete Purchase
                        </button>
                    </div>

                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', checkoutHTML);
        this.checkoutPopup = document.getElementById('checkout-popup');
        this.checkoutOverlay = document.getElementById('checkout-overlay');
    }

    /**
     * Create the success popup
     */
    createSuccessPopup() {
        const successHTML = `
            <div class="success-overlay" id="success-overlay"></div>
            <div class="success-popup" id="success-popup">
                <div class="success-popup-header">
                    <h2 class="success-title">Purchase Successful!</h2>
                    <button class="success-close" id="success-close">×</button>
                </div>
                <div class="success-content">
                    <p class="success-message">Thank you for your order! Your plants will be delivered on the selected date.</p>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', successHTML);
        this.successPopup = document.getElementById('success-popup');
        this.successOverlay = document.getElementById('success-overlay');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Cart button click
        this.cartButton.addEventListener('click', () => {
            this.toggleCart();
        });

        // Plant browse button click
        this.plantBrowseButton.addEventListener('click', () => {
            this.openStandalonePlantRecommendations();
        });

        // Cart close button
        document.getElementById('cart-close').addEventListener('click', () => {
            this.hideCart();
        });

        // Overlay click to close
        this.cartOverlay.addEventListener('click', () => {
            this.hideCart();
        });

        // Checkout close button
        document.getElementById('checkout-close').addEventListener('click', () => {
            this.hideCheckout();
        });

        // Checkout overlay click to close
        this.checkoutOverlay.addEventListener('click', () => {
            this.hideCheckout();
        });

        // Success close button
        document.getElementById('success-close').addEventListener('click', () => {
            this.hideSuccess();
        });

        // Success overlay click to close
        this.successOverlay.addEventListener('click', () => {
            this.hideSuccess();
        });

        // Handle billing address dropdown
        document.addEventListener('change', (e) => {
            if (e.target.id === 'checkout-billing-same') {
                this.handleBillingAddressToggle(e.target.value === 'false');
            }
        });

        // Handle purchase button click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'checkout-purchase-btn') {
                this.handlePurchaseSubmit();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.successVisible) {
                    this.hideSuccess();
                } else if (this.checkoutVisible) {
                    this.hideCheckout();
                } else if (this.isVisible) {
                    this.hideCart();
                }
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
            const newItem = {
                itemId,
                plantName,
                speciesKey,
                quantity,
                // Store the COMPLETE inventory data for perfect 1:1 mapping
                inventoryData: inventoryItem ? { ...inventoryItem } : null,
                // Also store the product instance for consistent access to methods
                product: product
            };

            this.cart.push(newItem);
        }

        this.updateCartDisplay();
    }

    /**
     * Remove item from cart by item ID
     */
    removeFromCartById(itemId) {
        if (!itemId) {
            console.error('Cannot remove item: itemId is null or undefined');
            return;
        }


        const initialLength = this.cart.length;
        this.cart = this.cart.filter(item => item.itemId !== itemId);

        if (this.cart.length === initialLength) {
            console.warn(`[CartManager] Item with ID "${itemId}" not found in cart`);
            return;
        }

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
     * Get item description for Stripe
     */
    getItemDescription(item) {
        if (item.product) {
            const containerInfo = item.product.getContainerInfo();
            return `${containerInfo} ${item.plantName}`;
        } else if (item.inventoryData) {
            const containerInfo = `${item.inventoryData.container_size || ''} ${item.inventoryData.container_type || ''}`.trim();
            return `${containerInfo} ${item.plantName}`;
        }
        return item.plantName;
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
            cartItems.querySelectorAll('.cart-checkout-container').forEach(container => container.remove());
        } else {
            cartEmpty.style.display = 'none';

            // Clear existing items, summary, and checkout containers
            cartItems.querySelectorAll('.cart-item').forEach(item => item.remove());
            cartItems.querySelectorAll('.cart-summary').forEach(summary => summary.remove());
            cartItems.querySelectorAll('.cart-checkout-container').forEach(container => container.remove());

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

            // Add checkout button
            const checkoutHTML = `
                <div class="cart-checkout-container">
                    <button class="cart-checkout-btn" id="cart-checkout-btn">
                        Continue to Checkout
                    </button>
                </div>
            `;
            cartItems.insertAdjacentHTML('beforeend', checkoutHTML);

            // Attach remove event listeners
            cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const itemId = e.target.dataset.itemId;
                    if (!itemId) {
                        console.error('No itemId found for cart item removal');
                        return;
                    }

                    this.removeFromCartById(itemId);
                });
            });

            // Attach checkout button listener
            const checkoutBtn = document.getElementById('cart-checkout-btn');
            if (checkoutBtn) {
                checkoutBtn.addEventListener('click', () => {
                    this.openCheckout();
                });
            }
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

    /**
     * Open checkout popup and populate with cart data
     */
    openCheckout() {
        if (this.cart.length === 0) return;

        this.updateCheckoutOrderSummary();
        this.initializeCheckoutDefaults();
        this.hideCart();
        this.showCheckout();

        // Mount Stripe Element after checkout form is displayed
        setTimeout(() => {
            this.mountStripeElement();
            this.setupPhoneNumberFormatting();
        }, 100);
    }

    /**
     * Mount Stripe Card Element to the checkout form
     */
    mountStripeElement() {
        if (!this.stripeReady || !this.cardElement) {
            setTimeout(() => this.mountStripeElement(), 500);
            return;
        }

        const cardElementContainer = document.getElementById('stripe-card-element');
        if (!cardElementContainer) {
            setTimeout(() => this.mountStripeElement(), 100);
            return;
        }

        try {
            // Clear the container completely first
            cardElementContainer.innerHTML = '';

            this.cardElement.mount(cardElementContainer);


        } catch (error) {
            console.error('Failed to mount Stripe Element:', error);

            // If mounting fails, try unmounting first then retry
            try {
                this.cardElement.unmount();
            } catch (unmountError) {
            }

            // Show a user-friendly message if mounting completely fails
            cardElementContainer.innerHTML = '<div style="color: #999; font-style: italic; padding: 10px;">Card input loading...</div>';
        }
    }

    /**
     * Set up phone number auto-formatting
     */
    setupPhoneNumberFormatting() {
        const phoneInput = document.getElementById('checkout-phone');
        if (!phoneInput) return;

        // Track if this is an autofill event
        let isAutofill = false;

        // Delay formatting to allow autofill to complete
        phoneInput.addEventListener('input', (e) => {
            // Check if this looks like autofill (large value change)
            const inputType = e.inputType;
            if (inputType === 'insertReplacementText' || e.data === null) {
                isAutofill = true;
                // Give autofill time to complete, then format
                setTimeout(() => {
                    this.formatPhoneNumber(e.target);
                    isAutofill = false;
                }, 50);
            } else if (!isAutofill) {
                // Normal typing - format immediately
                this.formatPhoneNumber(e.target);
            }
        });

        // Be less restrictive with keydown validation to allow autofill
        phoneInput.addEventListener('keydown', (e) => {
            // Allow backspace, delete, tab, escape, enter, and all navigation keys
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true) ||
                (e.keyCode === 90 && e.ctrlKey === true) ||
                // Allow home, end, left, right, up, down arrows
                (e.keyCode >= 35 && e.keyCode <= 40)) {
                return;
            }
            // Only restrict non-numeric keys during manual typing (not during autofill)
            if (!isAutofill && (e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });

        // Listen for autofill events specifically
        phoneInput.addEventListener('change', (e) => {
            // Format after autofill completes
            this.formatPhoneNumber(e.target);
        });
    }

    /**
     * Format phone number as user types with smart US formatting
     * Handles: (XXX) XXX-XXXX or 1 (XXX) XXX-XXXX
     */
    formatPhoneNumber(input) {
        const originalValue = input.value;

        // Check if the value is already well-formatted (common with autofill)
        const alreadyFormatted = /^(\d{10}|1\d{10}|\(\d{3}\)\s\d{3}-\d{4}|1\s\(\d{3}\)\s\d{3}-\d{4}|\d{3}-\d{3}-\d{4}|1-\d{3}-\d{3}-\d{4})$/.test(originalValue);

        if (alreadyFormatted && originalValue.length >= 10) {
            // Value is already formatted well, don't interfere
            return;
        }

        // Get the input value and remove all non-digits
        let value = originalValue.replace(/\D/g, '');

        // Handle US country code (1) intelligently
        let hasCountryCode = false;
        if (value.charAt(0) === '1' && value.length > 1) {
            // If starts with '1' and has more digits, treat as country code
            hasCountryCode = true;
            // Limit to 11 digits (1 + 10 digit US number)
            if (value.length > 11) {
                value = value.substring(0, 11);
            }
        } else if (value.length === 1 && value === '1') {
            // Just "1" typed - could be country code, show as is for now
            hasCountryCode = true;
        } else {
            // Standard US format - limit to 10 digits
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
        }

        // Format based on whether we have country code
        let formattedValue = '';

        if (hasCountryCode) {
            // Format as: 1 (XXX) XXX-XXXX
            const phoneDigits = value.substring(1); // Remove the '1'
            if (phoneDigits.length >= 6) {
                formattedValue = `1 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)}-${phoneDigits.substring(6)}`;
            } else if (phoneDigits.length >= 3) {
                formattedValue = `1 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3)}`;
            } else if (phoneDigits.length > 0) {
                formattedValue = `1 (${phoneDigits}`;
            } else {
                formattedValue = '1';
            }
        } else {
            // Format as: (XXX) XXX-XXXX
            if (value.length >= 6) {
                formattedValue = `(${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
            } else if (value.length >= 3) {
                formattedValue = `(${value.substring(0, 3)}) ${value.substring(3)}`;
            } else if (value.length > 0) {
                formattedValue = value;
            }
        }

        input.value = formattedValue;
    }

    /**
     * Get clean phone number (digits only) from formatted input
     */
    getCleanPhoneNumber(formattedPhone) {
        return formattedPhone.replace(/\D/g, '');
    }

    /**
     * Initialize checkout form with default values
     */
    initializeCheckoutDefaults() {
        // Calculate 3 business days from today
        const today = new Date();
        let businessDays = 0;
        let currentDate = new Date(today);

        while (businessDays < 3) {
            currentDate.setDate(currentDate.getDate() + 1);
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                businessDays++;
            }
        }

        // Format date for input (YYYY-MM-DD)
        const defaultDate = currentDate.toISOString().split('T')[0];

        // Set date input
        const dateInput = document.getElementById('checkout-date');
        if (dateInput) {
            dateInput.value = defaultDate;
            dateInput.min = defaultDate; // Set minimum selectable date
        }

        // Time is already pre-selected as 10:00 AM in HTML
    }

    /**
     * Handle billing address visibility toggle
     */
    handleBillingAddressToggle(showBillingAddress) {
        const billingSection = document.getElementById('checkout-billing-address-section');
        if (billingSection) {
            if (showBillingAddress) {
                billingSection.style.display = 'block';
            } else {
                billingSection.style.display = 'none';
            }
        }
    }

    /**
     * Show checkout popup
     */
    showCheckout() {
        this.checkoutOverlay.classList.add('visible');
        this.checkoutPopup.classList.add('visible');
        this.checkoutVisible = true;
    }

    /**
     * Hide checkout popup
     */
    hideCheckout() {
        this.checkoutOverlay.classList.remove('visible');
        this.checkoutPopup.classList.remove('visible');
        this.checkoutVisible = false;
    }

    /**
     * Update checkout order summary with cart items and pricing
     */
    updateCheckoutOrderSummary() {
        const orderSummary = document.getElementById('checkout-order-summary');

        // Clear existing content
        orderSummary.innerHTML = '';

        // Add cart items
        this.cart.forEach(item => {
            let inventoryInfo = '';
            if (item.product) {
                const containerInfo = item.product.getContainerInfo();
                const dimensions = item.product.getDimensions();
                const nursery = item.product.getNurseryDisplayName();
                inventoryInfo = `${containerInfo}${dimensions ? ' - ' + dimensions : ''} - ${nursery}`;
            } else if (item.inventoryData) {
                const containerInfo = `${item.inventoryData.container_size || ''} ${item.inventoryData.container_type || ''}`.trim();
                const dimensions = item.inventoryData.published_height && item.inventoryData.published_spread ?
                    `${item.inventoryData.published_height} x ${item.inventoryData.published_spread} ft` : '';
                const nursery = item.inventoryData.nursery || '';
                inventoryInfo = `${containerInfo}${dimensions ? ' - ' + dimensions : ''} - ${nursery}`;
            }

            const unitPrice = this.getItemUnitPrice(item);
            const itemTotal = unitPrice * item.quantity;

            const itemHTML = `
                <div class="checkout-order-item">
                    <div class="checkout-order-item-info">
                        <div class="checkout-order-item-name">${item.plantName}</div>
                        <div class="checkout-order-item-details">${inventoryInfo}</div>
                        <div class="checkout-order-item-quantity">Quantity: ${item.quantity} × $${unitPrice.toFixed(2)}</div>
                    </div>
                    <div class="checkout-order-item-total">$${itemTotal.toFixed(2)}</div>
                </div>
            `;
            orderSummary.insertAdjacentHTML('beforeend', itemHTML);
        });

        // Add pricing summary
        const subtotal = this.getSubtotal();
        const shipping = this.getShippingCost();
        const totalCost = this.getTotalCost();

        const summaryHTML = `
            <div class="checkout-pricing-summary">
                <div class="checkout-pricing-line">
                    <span>Subtotal:</span>
                    <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div class="checkout-pricing-line">
                    <span>Shipping:</span>
                    <span>$${shipping.toFixed(2)}</span>
                </div>
                <div class="checkout-pricing-line">
                    <span>Tax (6%):</span>
                    <span>$${((subtotal + shipping) * 0.06).toFixed(2)}</span>
                </div>
                <div class="checkout-pricing-line checkout-total">
                    <span>Total:</span>
                    <span>$${totalCost.toFixed(2)}</span>
                </div>
            </div>
        `;
        orderSummary.insertAdjacentHTML('beforeend', summaryHTML);
    }

    /**
     * Handle purchase form submission
     */
    handlePurchaseSubmit() {
        // Clear any existing errors
        this.clearValidationErrors();

        // Validate all fields
        const validationErrors = this.validateCheckoutForm();

        if (validationErrors.length > 0) {
            // Determine error message type
            const hasFormatErrors = validationErrors.some(error =>
                error.message.includes('Invalid') || error.message.includes('format')
            );
            const hasMissingFields = validationErrors.some(error =>
                error.message.includes('required') || error.message.includes('is required')
            );

            // Show appropriate general error message
            let generalMessage;
            if (hasFormatErrors) {
                generalMessage = 'Please correct all errors before submitting';
            } else if (hasMissingFields) {
                generalMessage = 'Please fill out all required fields';
            } else {
                generalMessage = 'Please correct the errors below before submitting';
            }

            this.showGeneralError(generalMessage);

            // Show specific field errors
            validationErrors.forEach(error => {
                this.showFieldError(error.field, error.message);
            });
        } else {
            // Process Stripe payment
            this.processStripePayment();
        }
    }

    /**
     * Validate checkout form
     */
    validateCheckoutForm() {
        const errors = [];

        // Required delivery fields
        const firstName = document.getElementById('checkout-first-name').value.trim();
        const lastName = document.getElementById('checkout-last-name').value.trim();
        const address = document.getElementById('checkout-address').value.trim();
        const city = document.getElementById('checkout-city').value.trim();
        const state = document.getElementById('checkout-state').value;
        const zip = document.getElementById('checkout-zip').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const email = document.getElementById('checkout-email').value.trim();

        // Shipping fields
        const date = document.getElementById('checkout-date').value;
        const time = document.getElementById('checkout-time').value;

        // Required field validation
        if (!firstName) errors.push({ field: 'checkout-first-name', message: 'First name is required' });
        if (!lastName) errors.push({ field: 'checkout-last-name', message: 'Last name is required' });
        if (!address) errors.push({ field: 'checkout-address', message: 'Address is required' });
        if (!city) errors.push({ field: 'checkout-city', message: 'City is required' });
        if (!state) errors.push({ field: 'checkout-state', message: 'State is required' });
        if (!zip) errors.push({ field: 'checkout-zip', message: 'ZIP code is required' });

        // Contact validation - at least one required
        if (!phone && !email) {
            errors.push({ field: 'checkout-phone', message: 'Phone number or email is required' });
            errors.push({ field: 'checkout-email', message: 'Phone number or email is required' });
        }

        // Shipping validation
        if (!date) errors.push({ field: 'checkout-date', message: 'Delivery date is required' });
        if (!time) errors.push({ field: 'checkout-time', message: 'Delivery time is required' });


        // Billing address validation (if different from delivery address)
        const useDifferentBilling = document.getElementById('checkout-billing-same').value === 'false';
        if (useDifferentBilling) {
            const billingFirstName = document.getElementById('checkout-billing-first-name').value.trim();
            const billingLastName = document.getElementById('checkout-billing-last-name').value.trim();
            const billingAddress = document.getElementById('checkout-billing-address').value.trim();
            const billingCity = document.getElementById('checkout-billing-city').value.trim();
            const billingState = document.getElementById('checkout-billing-state').value;
            const billingZip = document.getElementById('checkout-billing-zip').value.trim();

            if (!billingFirstName) errors.push({ field: 'checkout-billing-first-name', message: 'First name is required' });
            if (!billingLastName) errors.push({ field: 'checkout-billing-last-name', message: 'Last name is required' });
            if (!billingAddress) errors.push({ field: 'checkout-billing-address', message: 'Address is required' });
            if (!billingCity) errors.push({ field: 'checkout-billing-city', message: 'City is required' });
            if (!billingState) errors.push({ field: 'checkout-billing-state', message: 'State is required' });
            if (!billingZip) errors.push({ field: 'checkout-billing-zip', message: 'ZIP code is required' });

            // Billing ZIP format validation
            if (billingZip && !this.validateZipCode(billingZip)) {
                errors.push({ field: 'checkout-billing-zip', message: 'Invalid ZIP code format' });
            }
        }

        // Format validation
        if (zip && !this.validateZipCode(zip)) {
            errors.push({ field: 'checkout-zip', message: 'Invalid ZIP code format' });
        }
        if (phone && !this.validatePhoneNumber(phone)) {
            errors.push({ field: 'checkout-phone', message: 'Invalid phone number format' });
        }
        if (email && !this.validateEmail(email)) {
            errors.push({ field: 'checkout-email', message: 'Invalid email format' });
        }

        // Stripe Elements handles all card format validation automatically

        return errors;
    }

    /**
     * Validate ZIP code format
     */
    validateZipCode(zip) {
        const zipPattern = /^\d{5}(-\d{4})?$/;
        return zipPattern.test(zip);
    }

    /**
     * Validate phone number format (US format: 10 digits or 11 with country code)
     */
    validatePhoneNumber(phone) {
        const cleanPhone = this.getCleanPhoneNumber(phone);

        if (cleanPhone.length === 10) {
            // Standard US format: 10 digits
            return true;
        } else if (cleanPhone.length === 11 && cleanPhone.charAt(0) === '1') {
            // US format with country code: 1 + 10 digits
            return true;
        }

        return false;
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email);
    }


    /**
     * Process Stripe payment
     */
    async processStripePayment() {
        try {
            // Disable purchase button to prevent double submission
            const purchaseBtn = document.getElementById('checkout-purchase-btn');
            purchaseBtn.disabled = true;
            purchaseBtn.textContent = 'Processing...';

            // Clear any existing errors
            this.clearValidationErrors();

            // Get billing address based on user selection
            let billingAddress;
            try {
                billingAddress = this.getBillingAddress();
            } catch (error) {
                // Handle billing address field errors
                if (error.message.includes('Missing billing address fields')) {
                    this.showGeneralError('Please fill out the billing address information.');
                    return;
                } else if (error.message.includes('Missing delivery address fields')) {
                    this.showGeneralError('Please complete the delivery address before processing payment.');
                    return;
                } else {
                    this.showGeneralError('There was a problem with the address information. Please check your entries.');
                    return;
                }
            }

            // Check if Stripe is ready
            if (!this.stripeReady || !this.stripe || !this.cardElement) {
                this.showGeneralError('Payment system is not ready. Please try again in a moment.');
                return;
            }

            // Create PaymentMethod using Stripe Elements
            const {error, paymentMethod} = await this.stripe.createPaymentMethod({
                type: 'card',
                card: this.cardElement,
                billing_details: {
                    name: `${billingAddress.firstName} ${billingAddress.lastName}`,
                    address: {
                        line1: billingAddress.street,
                        city: billingAddress.city,
                        state: billingAddress.state,
                        postal_code: billingAddress.zip,
                        country: 'US'
                    }
                }
            });

            if (error) {
                this.showGeneralError(error.message);
                return;
            }

            // Prepare payment data with PaymentMethod ID (PCI compliant)
            const paymentData = {
                amount: this.calculateTotalAmount(),
                currency: 'usd',
                payment_method_id: paymentMethod.id,
                billingAddress: billingAddress
            };

            // Process with Stripe Payment Intent using PaymentMethod ID
            const paymentResult = await this.processStripePaymentIntent(paymentData);

            if (paymentResult.success) {
                this.processSuccessfulPurchase();
            } else {
                this.handleStripeError(paymentResult.error);
            }

        } catch (error) {
            console.error('Payment processing error:', error);

            // Convert technical errors to user-friendly messages
            if (error.message && error.message.includes('fetch')) {
                this.showGeneralError('Unable to connect to payment processor. Please check your internet connection and try again.');
            } else if (error.message && error.message.includes('network')) {
                this.showGeneralError('Network error. Please try again.');
            } else {
                this.showGeneralError('Payment processing failed. Please try again.');
            }
        } finally {
            // Re-enable purchase button
            const purchaseBtn = document.getElementById('checkout-purchase-btn');
            purchaseBtn.disabled = false;
            purchaseBtn.textContent = 'Complete Purchase';
        }
    }

    /**
     * Get billing address based on user selection
     */
    getBillingAddress() {
        const billingDropdown = document.getElementById('checkout-billing-same');
        if (!billingDropdown) {
            throw new Error('Billing address dropdown not found');
        }

        const useSameAddress = billingDropdown.value === 'true';

        if (useSameAddress) {
            // Use delivery address as billing address
            return this.getFieldValue('delivery', {
                firstName: 'checkout-first-name',
                lastName: 'checkout-last-name',
                address: 'checkout-address',
                city: 'checkout-city',
                state: 'checkout-state',
                zip: 'checkout-zip'
            });
        } else {
            // Use separate billing address
            return this.getFieldValue('billing', {
                firstName: 'checkout-billing-first-name',
                lastName: 'checkout-billing-last-name',
                address: 'checkout-billing-address',
                city: 'checkout-billing-city',
                state: 'checkout-billing-state',
                zip: 'checkout-billing-zip'
            });
        }
    }

    /**
     * Helper to safely get form field values with error handling
     */
    getFieldValue(addressType, fieldMap) {
        const result = {};
        const missingFields = [];

        for (const [key, fieldId] of Object.entries(fieldMap)) {
            const element = document.getElementById(fieldId);
            if (!element) {
                missingFields.push(fieldId);
                continue;
            }
            result[key] = element.value ? element.value.trim() : '';
        }

        if (missingFields.length > 0) {
            throw new Error(`Missing ${addressType} address fields: ${missingFields.join(', ')}`);
        }

        return result;
    }

    /**
     * Calculate total amount in cents for Stripe
     */
    calculateTotalAmount() {
        return this.getTotalCost() * 100; // Convert to cents
    }


    /**
     * Process Stripe payment using digitaltwin sandbox backend
     */
    async processStripePaymentIntent(paymentData) {
        try {
            // Prepare cart data for backend
            const cartItems = this.cart.map(item => ({
                name: this.getItemDescription(item),
                quantity: item.quantity,
                unit_amount: Math.round(this.getItemUnitPrice(item) * 100) // Convert to cents
            }));

            const paymentRequestData = {
                amount: paymentData.amount,
                currency: paymentData.currency,
                cart_items: cartItems,
                payment_method_id: paymentData.payment_method_id,
                customer_data: {
                    name: `${paymentData.billingAddress.firstName} ${paymentData.billingAddress.lastName}`,
                    email: document.getElementById('checkout-email').value.trim(),
                    phone: document.getElementById('checkout-phone').value.trim(),
                    billing_address: paymentData.billingAddress
                }
            };

            // Process payment through backend
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentRequestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: 'payment_failed',
                    message: errorData.message || 'Payment processing failed. Please try again.'
                };
            }

            const result = await response.json();

            if (result.success && result.payment_intent) {
                return { success: true, payment_intent: result.payment_intent };
            } else {
                return {
                    success: false,
                    error: 'payment_failed',
                    message: result.message || 'Payment processing failed. Please try again.'
                };
            }

        } catch (error) {
            console.error('Payment processing failed:', error);

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return {
                    success: false,
                    error: 'network_error',
                    message: 'Unable to connect to payment processor. Please check your internet connection and try again.'
                };
            }

            return {
                success: false,
                error: 'payment_processing_error',
                message: 'Payment processing failed. Please try again.'
            };
        }
    }

    /**
     * Handle Stripe payment errors
     */
    handleStripeError(error) {
        const errorMappings = {
            'card_declined': 'Your card was declined. Please try a different payment method.',
            'expired_card': 'Your card has expired.',
            'incorrect_cvc': 'Your card\'s security code is incorrect.',
            'invalid_number': 'Your card number is invalid.',
            'invalid_expiry_month': 'Your card\'s expiration month is invalid.',
            'invalid_expiry_year': 'Your card\'s expiration year is invalid.',
            'processing_error': 'An error occurred while processing your card. Please try again.',
            'payment_method_required': 'Please enter your card information.',
            'payment_failed': 'Payment failed. Please try again.'
        };

        const message = errorMappings[error] || 'Payment failed. Please check your information and try again.';

        // Show error in the Stripe card element area
        const displayError = document.getElementById('stripe-card-errors');
        if (displayError) {
            displayError.textContent = message;
            displayError.style.display = 'block';
        }

        // Also show general error message
        this.showGeneralError(message);
    }

    /**
     * Show general error message
     */
    showGeneralError(message) {
        // Remove existing general error
        const existingError = document.getElementById('checkout-general-error');
        if (existingError) {
            existingError.remove();
        }

        const purchaseBtn = document.getElementById('checkout-purchase-btn');
        const errorHTML = `<div class="checkout-error-message" id="checkout-general-error">${message}</div>`;
        purchaseBtn.insertAdjacentHTML('beforebegin', errorHTML);
    }

    /**
     * Show field-specific error message
     */
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Add error styling to field
        field.classList.add('checkout-input-error');

        // Remove existing error message for this field
        const existingError = document.getElementById(`${fieldId}-error`);
        if (existingError) {
            existingError.remove();
        }

        // Check if field is already wrapped in a container
        let container = field.parentElement;
        if (!container.classList.contains('checkout-field-container')) {
            // Create a wrapper container for the field
            const wrapper = document.createElement('div');
            wrapper.className = 'checkout-field-container';
            wrapper.style.flex = field.style.flex || '1';

            // Move field into wrapper
            field.parentElement.insertBefore(wrapper, field);
            wrapper.appendChild(field);
            container = wrapper;
        }

        // Create and add error message to the container
        const errorDiv = document.createElement('div');
        errorDiv.className = 'checkout-field-error';
        errorDiv.id = `${fieldId}-error`;
        errorDiv.textContent = message;

        container.appendChild(errorDiv);
    }

    /**
     * Clear all validation errors
     */
    clearValidationErrors() {
        // Remove general error
        const generalError = document.getElementById('checkout-general-error');
        if (generalError) {
            generalError.remove();
        }

        // Remove field errors
        document.querySelectorAll('.checkout-field-error').forEach(error => error.remove());
        document.querySelectorAll('.checkout-input-error').forEach(field => {
            field.classList.remove('checkout-input-error');
        });
    }

    /**
     * Process successful purchase
     */
    processSuccessfulPurchase() {
        // Capture delivery details before hiding checkout
        const deliveryDate = document.getElementById('checkout-date').value;
        const deliveryTime = document.getElementById('checkout-time').value;

        this.hideCheckout();
        this.clearCart();
        this.updateCartDisplay();
        this.showSuccess(deliveryDate, deliveryTime);
    }

    /**
     * Show success popup with delivery details
     */
    showSuccess(deliveryDate, deliveryTime) {
        // Update the success message with specific delivery details
        const successMessage = document.querySelector('.success-message');
        if (successMessage && deliveryDate && deliveryTime) {
            const formattedDate = this.formatDeliveryDate(deliveryDate);
            const formattedTime = this.formatDeliveryTime(deliveryTime);
            successMessage.textContent = `Thank you for your order! Your plants will be delivered on ${formattedDate} at ${formattedTime}.`;
        }

        this.successOverlay.classList.add('visible');
        this.successPopup.classList.add('visible');
        this.successVisible = true;
    }

    /**
     * Hide success popup
     */
    hideSuccess() {
        this.successOverlay.classList.remove('visible');
        this.successPopup.classList.remove('visible');
        this.successVisible = false;
    }

    /**
     * Format delivery date for display (e.g., "Friday, December 15, 2023")
     */
    formatDeliveryDate(dateString) {
        if (!dateString) return 'the selected date';

        try {
            const date = new Date(dateString);
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            return date.toLocaleDateString('en-US', options);
        } catch (error) {
            return dateString; // Fallback to original string if parsing fails
        }
    }

    /**
     * Format delivery time for display (e.g., "10:00 AM")
     */
    formatDeliveryTime(timeString) {
        if (!timeString) return 'the selected time';

        try {
            // Convert 24-hour format to 12-hour format with AM/PM
            const [hours, minutes] = timeString.split(':');
            const hour12 = hours % 12 || 12;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            return `${hour12}:${minutes} ${ampm}`;
        } catch (error) {
            return timeString; // Fallback to original string if parsing fails
        }
    }

    /**
     * Open standalone plant recommendations panel
     */
    openStandalonePlantRecommendations() {
        // Emit custom event for plant recommendations request
        const event = new CustomEvent('cart:openPlantRecommendations', {
            detail: { standalone: true }
        });
        window.dispatchEvent(event);
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