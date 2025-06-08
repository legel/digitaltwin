# Server Technical Documentation

## Overview
The server is a minimal Flask application serving static files for development. It's intentionally simple but has significant security vulnerabilities that prevent production use.

## Implementation

### Core Server Code
```python
from flask import Flask, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # WARNING: Allows ALL origins

@app.route('/<path:path>')
def serve_file(path):
    # SECURITY ISSUE: No path validation
    return send_from_directory('.', path)

@app.route('/')
def index():
    return send_from_directory('.', 'app.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)  # DEBUG MODE ON
```

### What It Does
1. Serves any file from project root (security risk)
2. CORS enabled for all origins (allows any site to access)
3. Runs on port 8000 by default (configurable via PORT env)
4. Debug mode exposes stack traces and enables code reload

## Routes and Files Served

```
/                         → app.html
/js/*.js                  → JavaScript modules
/css/*.css                → Stylesheets
/images/*                 → UI assets (PNG, WebP)
/data/*.geojson           → Survey data files
/any/path/to/any/file     → Served without validation
```

### GeoJSON Data Files
```
/data/4.18.2025-layers.geojson              → Dix.Hite HQ (Legacy format)
/data/Boyd_Residence_Aerial_and_Ground.geojson → Scott Boyd (M1-M10 format)
```

## Security Vulnerabilities

### 1. Directory Traversal
```bash
# This would work:
curl http://localhost:8000/../../../etc/passwd
```
**Fix**: Validate paths, restrict to specific directories

### 2. Open CORS
Any website can request your data and APIs.
**Fix**: `CORS(app, origins=['https://yourdomain.com'])`

### 3. Debug Mode
Exposes source code paths, variables, and stack traces.
**Fix**: Set `debug=False` for production

### 4. No Authentication
All GeoJSON data is publicly accessible.
**Fix**: Add auth middleware for sensitive routes

### 5. API Key Exposure
The server should proxy external API calls instead of exposing keys in client code.

## Production Requirements

### Proper Server Setup
```python
# Use Gunicorn instead of Flask dev server
gunicorn -w 4 -b 0.0.0.0:8000 server:app
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Serve static files directly
    location /static {
        alias /path/to/terrain-3d;
        expires 1y;
    }
    
    # Cache GeoJSON
    location /data {
        alias /path/to/terrain-3d/data;
        expires 1h;
        gzip_static on;
    }
    
    # Proxy API requests
    location /api {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

### Recommended API Endpoints
Instead of exposing external API keys, the server should provide:

```python
@app.route('/api/geolocation')
def get_geolocation():
    # Use server-side API key
    client_ip = request.remote_addr
    response = requests.get(f'https://api.ipgeolocation.io/ipgeo',
                          params={'apiKey': os.environ['IP_API_KEY'], 
                                 'ip': client_ip})
    return jsonify(response.json())

@app.route('/api/sites')
def list_sites():
    # Return available sites with metadata
    sites = []
    for file in os.listdir('data'):
        if file.endswith('.geojson'):
            # Could add bounds, format type, etc.
            sites.append({'filename': file, 
                         'name': file.replace('.geojson', '')})
    return jsonify(sites)

@app.route('/api/cesium-token')
def get_cesium_token():
    # Generate temporary token or proxy requests
    return jsonify({'token': os.environ['CESIUM_TOKEN']})
```

## Environment Variables
```bash
# .env file (don't commit!)
PORT=8000
FLASK_ENV=production
IP_API_KEY=your_key_here
CESIUM_TOKEN=your_token_here
GOOGLE_MAPS_KEY=your_key_here
```

## Running the Server

### Development
```bash
pip install -r requirements.txt
python server.py
# Visit http://localhost:8000
```

### Production (Don't use current server!)
```bash
# Install production server
pip install gunicorn

# Run with workers
gunicorn -w 4 server:app

# Or use Docker
docker build -t terrain3d .
docker run -p 8000:8000 terrain3d
```

## Future Enhancements
1. **Database**: PostgreSQL + PostGIS for spatial queries
2. **API Layer**: RESTful endpoints for CRUD operations
3. **WebSockets**: Real-time collaboration features
4. **Processing**: Background jobs for GeoJSON optimization
5. **Caching**: Redis for API responses and processed data