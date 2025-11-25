from flask import Flask, send_from_directory, jsonify, redirect, request
from flask_cors import CORS
import os
import json
import stripe
from pathlib import Path

def load_envrc():
    """Load environment variables from .envrc file (Windows compatible)"""
    envrc_path = '.envrc'
    if os.path.exists(envrc_path):
        try:
            with open(envrc_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('export ') and '=' in line:
                        # Remove 'export ' prefix and parse key=value
                        line = line[7:]  # Remove 'export '
                        if '=' in line:
                            key, value = line.split('=', 1)
                            # Remove quotes if present
                            value = value.strip('"\'')
                            os.environ[key] = value
                            print(f"Loaded environment variable: {key}")
        except Exception as e:
            print(f"Warning: Could not load .envrc: {e}")
    else:
        print("No .envrc file found")

# Load environment variables before Flask app initialization
load_envrc()

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# Serve the main HTML file
@app.route('/')
def index():
    return send_from_directory('.', 'app.html')


# Serve splat manifests for progressive loading
@app.route('/api/splat-manifest/<site_id>')
def get_splat_manifest(site_id):
    """
    Return the manifest for a site's partitioned splat files.
    The manifest contains URLs for all PLY parts that should be loaded from GCS CDN.
    """
    # Try new sites/ directory structure first
    manifest_dir = Path(f'./data/sites/{site_id}')
    manifest_path = manifest_dir / f"{site_id}_manifest.json"

    # Fall back to legacy directory structure
    if not manifest_path.exists():
        manifest_dir = Path(f'./data/{site_id}')
        manifest_path = manifest_dir / f"{site_id}_manifest.json"

    if not manifest_path.exists():
        # Fallback: return single-file manifest for legacy sites
        return jsonify({
            'site_id': site_id,
            'total_parts': 1,
            'base_url': f'https://storage.googleapis.com/deepearth/datasets/terrain3d/{site_id}',
            'parts': [{
                'index': 0,
                'filename': 'splat.ply',
                'url': f'https://storage.googleapis.com/deepearth/datasets/terrain3d/{site_id}/splat.ply',
                'original_name': 'splat.ply'
            }],
            'legacy': True
        })

    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        return jsonify(manifest)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Serve static files (CSS, JS, images)
# Flask automatically separates query parameters from the path
@app.route('/<path:path>')
def serve_static(path):
    # The path parameter already has query strings stripped by Flask
    # Query parameters are available via request.args if needed
    try:
        return send_from_directory('.', path)
    except Exception as e:
        # Log the error for debugging
        print(f"Error serving {path}: {e}")
        return f"File not found: {path}", 404

# Health check endpoint
@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Server is running',
        'version': '2.0-progressive-loading'
    })

# Stripe configuration endpoint
@app.route('/api/stripe-config')
def get_stripe_config():
    """
    Provide Stripe publishable key for frontend initialization
    """
    return jsonify({
        'publishable_key': os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_PLACEHOLDER_KEY')
    })

# Example API endpoint for future expansion
@app.route('/api/locations')
def get_locations():
    # This is a placeholder for future location data
    locations = [
        {
            'id': 1,
            'name': 'Vizcaya Museum and Gardens',
            'latitude': 25.7443,
            'longitude': -80.2104,
            'description': 'Historic estate in Miami, Florida'
        },
        {
            'id': 2,
            'name': 'Dix.Hite Community Center',
            'latitude': 28.3994,
            'longitude': -81.4223,
            'description': 'Community center in Orlando, Florida'
        }
    ]
    return jsonify(locations)

# Stripe Payment Intent endpoint for digitaltwin sandbox
@app.route('/api/create-payment-intent', methods=['POST'])
def create_payment_intent():
    """
    Create a Stripe Payment Intent using digitaltwin sandbox
    Uses dynamic pricing without pre-configured products
    """
    try:
        data = request.get_json()

        # Digitaltwin sandbox secret key from environment
        STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_PLACEHOLDER_KEY')

        # Configure Stripe with the sandbox key
        stripe.api_key = STRIPE_SECRET_KEY

        # Validate required fields
        if not data.get('amount') or not data.get('currency'):
            return jsonify({'error': 'Amount and currency are required'}), 400

        # Prepare metadata from cart items
        cart_items_summary = []
        for item in data.get('cart_items', []):
            cart_items_summary.append(f"{item['name']}: {item['quantity']}x ${item['unit_amount']/100:.2f}")

        # Get PaymentMethod ID from client (created securely via Stripe Elements)
        payment_method_id = data.get('payment_method_id')
        if not payment_method_id:
            return jsonify({
                'error': 'payment_method_required',
                'message': 'Payment method is required'
            }), 400

        # Determine return URL based on environment
        origin = request.headers.get('Origin', 'http://localhost:5001')
        if not origin or origin == 'null':
            # Fallback for direct server access or missing Origin header
            host = request.headers.get('Host', 'localhost:5001')
            if 'localhost' in host or '127.0.0.1' in host:
                origin = f"http://{host}"
            else:
                origin = f"https://{host}"

        # Create real Stripe Payment Intent with the payment method
        payment_intent = stripe.PaymentIntent.create(
            amount=int(data['amount']),  # Amount in cents
            currency=data['currency'],
            payment_method=payment_method_id,
            confirmation_method='manual',
            confirm=True,
            return_url=origin,  # Required for 3D Secure and redirect-based payment methods
            description=f"Digital Twin Plant Purchase - {len(data.get('cart_items', []))} items",
            metadata={
                'digitaltwin_platform': 'true',
                'customer_name': data.get('customer_data', {}).get('name', ''),
                'customer_email': data.get('customer_data', {}).get('email', ''),
                'cart_items_count': str(len(data.get('cart_items', []))),
                'cart_summary': '; '.join(cart_items_summary[:3])  # First 3 items to avoid metadata limit
            }
        )

        # Check if payment requires additional action or failed
        if payment_intent.status == 'requires_action' or payment_intent.status == 'requires_source_action':
            return jsonify({
                'error': 'requires_action',
                'message': 'Payment requires additional authentication. Please try again.',
                'requires_action': True,
                'payment_intent': {
                    'client_secret': payment_intent.client_secret
                }
            }), 200

        elif payment_intent.status == 'requires_payment_method':
            return jsonify({
                'error': 'payment_method_required',
                'message': 'Payment method was declined. Please try a different card.'
            }), 400

        elif payment_intent.status != 'succeeded':
            return jsonify({
                'error': 'payment_failed',
                'message': f'Payment failed with status: {payment_intent.status}'
            }), 400


        return jsonify({
            'payment_intent': {
                'id': payment_intent.id,
                'amount': payment_intent.amount,
                'currency': payment_intent.currency,
                'status': payment_intent.status,
                'client_secret': payment_intent.client_secret,
                'metadata': payment_intent.metadata
            },
            'success': True
        })

    except stripe.error.CardError as e:
        print(f"Card error: {e}")
        return jsonify({
            'error': 'card_error',
            'message': e.user_message
        }), 400
    except stripe.error.RateLimitError as e:
        print(f"Rate limit error: {e}")
        return jsonify({
            'error': 'rate_limit_error',
            'message': 'Too many requests. Please try again later.'
        }), 429
    except stripe.error.InvalidRequestError as e:
        print(f"Invalid request error: {e}")
        return jsonify({
            'error': 'invalid_request',
            'message': str(e)
        }), 400
    except stripe.error.AuthenticationError as e:
        print(f"Authentication error: {e}")
        return jsonify({
            'error': 'authentication_error',
            'message': 'Authentication failed. Please contact support.'
        }), 500
    except stripe.error.APIConnectionError as e:
        print(f"API connection error: {e}")
        return jsonify({
            'error': 'api_connection_error',
            'message': 'Network error. Please try again.'
        }), 502
    except stripe.error.StripeError as e:
        print(f"Stripe error: {e}")
        return jsonify({
            'error': 'stripe_error',
            'message': 'Payment processing failed. Please try again.'
        }), 500
    except Exception as e:
        print(f"Payment Intent error: {e}")
        return jsonify({
            'error': 'Payment processing failed',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)