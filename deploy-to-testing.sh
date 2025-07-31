#!/bin/bash

# Deployment script for Terrain-3D to testing.ecodash.ai
# Run with: sudo bash deploy-to-testing.sh

set -e  # Exit on error

echo "=== Terrain-3D Deployment to testing.ecodash.ai ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Variables
TERRAIN_DIR="/var/www/ecodash/private/terrain-3d"
CURRENT_DIR="$(pwd)"

# Step 1: Verify terrain-3d directory exists
echo "Step 1: Checking terrain-3d directory..."
if [ ! -d "$TERRAIN_DIR" ]; then
    echo "ERROR: Directory $TERRAIN_DIR does not exist!"
    echo "Please copy the terrain-3d code to this location first."
    exit 1
fi

# Step 2: Stop current testing service
echo "Step 2: Stopping current testing service..."
systemctl stop testing.service || true
systemctl disable testing.service || true

# Step 3: Set up Python environment
echo "Step 3: Setting up Python virtual environment..."
cd "$TERRAIN_DIR"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
chown -R www-data:www-data venv
sudo -u www-data venv/bin/pip install -r requirements.txt
sudo -u www-data venv/bin/pip install gunicorn

# Step 4: Install systemd service
echo "Step 4: Installing systemd service..."
cp "$CURRENT_DIR/terrain3d.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable terrain3d.service
systemctl start terrain3d.service

# Step 5: Check service status
echo "Step 5: Checking service status..."
sleep 2
if systemctl is-active --quiet terrain3d.service; then
    echo "✓ terrain3d.service is running"
else
    echo "✗ terrain3d.service failed to start"
    journalctl -u terrain3d.service --no-pager -n 20
    exit 1
fi

# Step 6: Update nginx
echo "Step 6: Updating nginx configuration..."
NGINX_SITE="/etc/nginx/sites-available/testing.ecodash.ai"
if [ -f "$NGINX_SITE" ]; then
    cp "$NGINX_SITE" "${NGINX_SITE}.backup"
    echo "Backed up existing nginx config to ${NGINX_SITE}.backup"
fi

cp "$CURRENT_DIR/nginx-testing.conf" "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/

# Test nginx configuration
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✓ Nginx configuration is valid"
    systemctl reload nginx
else
    echo "✗ Nginx configuration test failed"
    exit 1
fi

# Step 7: Set permissions
echo "Step 7: Setting proper permissions..."
chown -R www-data:www-data "$TERRAIN_DIR"
chmod -R 755 "$TERRAIN_DIR"

# Step 8: Test deployment
echo "Step 8: Testing deployment..."
sleep 2
if curl -f -s http://127.0.0.1:5002/api/health > /dev/null; then
    echo "✓ Local health check passed"
else
    echo "✗ Local health check failed"
    exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo "Terrain-3D is now running at https://testing.ecodash.ai"
echo ""
echo "To check logs:"
echo "  sudo journalctl -u terrain3d.service -f"
echo ""
echo "To rollback:"
echo "  sudo systemctl stop terrain3d.service"
echo "  sudo systemctl disable terrain3d.service"
echo "  sudo mv ${NGINX_SITE}.backup $NGINX_SITE"
echo "  sudo systemctl reload nginx"
echo "  sudo systemctl enable testing.service"
echo "  sudo systemctl start testing.service"