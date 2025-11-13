from flask import Flask, send_from_directory, jsonify, redirect
from flask_cors import CORS
import os
import json
from pathlib import Path

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
    manifest_dir = Path('./manifests')
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