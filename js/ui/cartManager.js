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

        this.init();
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
                                <option value="10:00">10:00 AM</option>
                                <option value="08:00">8:00 AM</option>
                                <option value="08:30">8:30 AM</option>
                                <option value="09:00">9:00 AM</option>
                                <option value="09:30">9:30 AM</option>
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
                            <input type="text" class="checkout-input full-width" id="checkout-card-number"
                                   placeholder="Card Number" autocomplete="cc-number">
                        </div>
                        <div class="checkout-form-row">
                            <input type="text" class="checkout-input" id="checkout-expiry"
                                   placeholder="MM/YY" autocomplete="cc-exp">
                            <input type="text" class="checkout-input" id="checkout-cvv"
                                   placeholder="CVV" autocomplete="cc-csc">
                        </div>
                        <div class="checkout-form-row">
                            <input type="text" class="checkout-input full-width" id="checkout-cardholder-name"
                                   placeholder="Cardholder Name" autocomplete="cc-name">
                        </div>
                        <div class="checkout-form-row">
                            <select class="checkout-input full-width" id="checkout-billing-same">
                                <option value="true">Billing address same as delivery address</option>
                                <option value="false">Use different billing address</option>
                            </select>
                        </div>

                        <!-- Billing Address Section (hidden by default) -->
                        <div class="checkout-billing-address" id="checkout-billing-address" style="display: none;">
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
                                <input type="text" class="checkout-input" id="checkout-billing-state"
                                       placeholder="State" autocomplete="billing address-level1">
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
                    const itemId = e.target.dataset.itemId;
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
        const billingSection = document.getElementById('checkout-billing-address');
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
            // Process payment (placeholder)
            const paymentValid = this.validatePayment();

            if (paymentValid) {
                // Success flow
                this.processSuccessfulPurchase();
            } else {
                this.showGeneralError('Payment processing failed. Please try again.');
            }
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
     * Validate phone number format
     */
    validatePhoneNumber(phone) {
        const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
        return phonePattern.test(cleanPhone) && cleanPhone.length >= 10;
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email);
    }

    /**
     * Placeholder payment validation
     */
    validatePayment() {
        return true; // Always return true for now
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
        this.hideCheckout();
        this.clearCart();
        this.updateCartDisplay();
        this.showSuccess();
    }

    /**
     * Show success popup
     */
    showSuccess() {
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
}

// Initialize cart manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cartManager = new CartManager();
    });
} else {
    window.cartManager = new CartManager();
}