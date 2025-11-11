from flask import Flask, send_from_directory, jsonify, redirect
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# Serve the main HTML file
@app.route('/')
def index():
    return send_from_directory('.', 'app.html')


# Proxy splat.ply files from DeepEarth bucket with proper CORS headers
# DeepEarth bucket doesn't have CORS configured, so we proxy through our server
@app.route('/data/<site_id>/splat.ply')
def proxy_splat_ply(site_id):
    import requests
    from flask import Response

    deepearth_url = f'https://storage.googleapis.com/deepearth/datasets/terrain3d/{site_id}/splat.ply'

    try:
        # Stream the file from DeepEarth bucket
        response = requests.get(deepearth_url, stream=True)
        response.raise_for_status()

        # Create a Flask response with proper CORS headers
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk

        flask_response = Response(generate(), content_type='application/octet-stream')
        flask_response.headers['Access-Control-Allow-Origin'] = '*'
        flask_response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD'
        flask_response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        flask_response.headers['Content-Length'] = response.headers.get('content-length', '')

        return flask_response

    except requests.exceptions.RequestException as e:
        return f"Error fetching splat file: {str(e)}", 500

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