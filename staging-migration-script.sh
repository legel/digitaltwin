#!/bin/bash
# Staging Environment Migration Script
# Zero-downtime migration for digitaltwin.ecodash.ai

set -e  # Exit on error

echo "========================================="
echo "Staging Environment Migration"
echo "========================================="
echo ""

# Step 1: Create prod directory without stopping service
echo "[1/10] Creating prod directory structure..."
cd /var/www/ecodash/private/digitaltwin
mkdir -p prod staging

# Step 2: Move files to prod (excluding prod and staging dirs themselves)
echo "[2/10] Moving current deployment to prod/..."
find . -maxdepth 1 ! -name '.' ! -name '..' ! -name 'prod' ! -name 'staging' -exec mv -n {} prod/ \; 2>/dev/null || true

# Step 3: Set ownership
echo "[3/10] Setting permissions..."
sudo chown -R photon:www-data prod/
sudo chmod -R 750 prod/

# Step 4: Create production systemd service
echo "[4/10] Creating digitaltwin-prod service..."
sudo tee /etc/systemd/system/digitaltwin-prod.service > /dev/null << 'EOL'
[Unit]
Description=Digital Twin 3D Viewer (Production)
After=network.target

[Service]
Type=simple
User=photon
Group=www-data
WorkingDirectory=/var/www/ecodash/private/digitaltwin/prod
Environment=PATH=/var/www/ecodash/private/digitaltwin/prod/venv/bin
Environment=FLASK_ENV=production
Environment=PORT=5002
ExecStart=/var/www/ecodash/private/digitaltwin/prod/venv/bin/gunicorn \
    --workers 2 \
    --bind 127.0.0.1:5002 \
    --timeout 120 \
    --preload \
    server:app \
    --access-logfile /var/www/ecodash/private/logs/digitaltwin-prod-access.log \
    --error-logfile /var/www/ecodash/private/logs/digitaltwin-prod-error.log
Restart=always
RestartSec=10
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOL

# Step 5: Reload systemd and enable new service
echo "[5/10] Enabling digitaltwin-prod service..."
sudo systemctl daemon-reload
sudo systemctl enable digitaltwin-prod

# Step 6: Start production service (runs alongside old service temporarily)
echo "[6/10] Starting digitaltwin-prod service..."
sudo systemctl start digitaltwin-prod

# Wait for service to be fully up
sleep 3

# Step 7: Verify production service is running
echo "[7/10] Verifying digitaltwin-prod is running..."
if sudo systemctl is-active --quiet digitaltwin-prod; then
    echo "✓ Production service is active"
else
    echo "✗ Production service failed to start!"
    sudo systemctl status digitaltwin-prod
    exit 1
fi

# Step 8: Stop and disable old service (ZERO DOWNTIME - new service already running)
echo "[8/10] Stopping old digitaltwin service..."
sudo systemctl stop digitaltwin
sudo systemctl disable digitaltwin

# Step 9: Clone staging from production
echo "[9/10] Creating staging environment..."
cp -r prod/* staging/
cp -r prod/.git staging/ 2>/dev/null || true
cp -r prod/.gitignore staging/ 2>/dev/null || true
cp -r prod/.gitattributes staging/ 2>/dev/null || true

sudo chown -R photon:www-data staging/
sudo chmod -R 750 staging/

# Step 10: Create staging systemd service
echo "[10/10] Creating digitaltwin-staging service..."
sudo tee /etc/systemd/system/digitaltwin-staging.service > /dev/null << 'EOL'
[Unit]
Description=Digital Twin 3D Viewer (Staging)
After=network.target

[Service]
Type=simple
User=photon
Group=www-data
WorkingDirectory=/var/www/ecodash/private/digitaltwin/staging
Environment=PATH=/var/www/ecodash/private/digitaltwin/staging/venv/bin
Environment=FLASK_ENV=staging
Environment=PORT=5004
ExecStart=/var/www/ecodash/private/digitaltwin/staging/venv/bin/gunicorn \
    --workers 2 \
    --bind 127.0.0.1:5004 \
    --timeout 120 \
    --preload \
    server:app \
    --access-logfile /var/www/ecodash/private/logs/digitaltwin-staging-access.log \
    --error-logfile /var/www/ecodash/private/logs/digitaltwin-staging-error.log
Restart=always
RestartSec=10
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOL

sudo systemctl daemon-reload
sudo systemctl enable digitaltwin-staging
sudo systemctl start digitaltwin-staging

# Wait for staging service
sleep 3

# Verify staging service
if sudo systemctl is-active --quiet digitaltwin-staging; then
    echo "✓ Staging service is active"
else
    echo "✗ Staging service failed to start!"
    sudo systemctl status digitaltwin-staging
fi

echo ""
echo "========================================="
echo "Migration Complete!"
echo "========================================="
echo ""
echo "Service Status:"
sudo systemctl status digitaltwin-prod --no-pager | head -5
sudo systemctl status digitaltwin-staging --no-pager | head -5
echo ""
echo "Next Steps:"
echo "1. Update Apache configuration for staging.ecodash.ai"
echo "2. Setup SSL certificate for staging.ecodash.ai"
echo "3. Test both endpoints"
echo ""
