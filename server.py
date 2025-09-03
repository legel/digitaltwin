from flask import Flask, send_from_directory, jsonify, redirect
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# Serve the main HTML file
@app.route('/')
def index():
    return send_from_directory('.', 'app.html')

# Redirect large Gaussian splat content.glb files to Google Cloud Storage CDN
# This solves CORS issues and provides faster download speeds for 44MB+ files
# Maintains Cesium compatibility by keeping tileset.json local with relative URIs
@app.route('/data/<site_id>/content.glb')
def redirect_content_glb(site_id):
    gcs_url = f'https://storage.googleapis.com/terrain-3d-assets/{site_id}/content.glb'
    return redirect(gcs_url, code=301)  # Permanent redirect for browser caching

# Serve static files (CSS, JS, images)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Health check endpoint
@app.route('/api/health')
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Server is running'})

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)