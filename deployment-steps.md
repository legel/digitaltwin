# Deployment Steps for Terrain-3D to testing.ecodash.ai

## Prerequisites
- Ensure Python 3.8+ is installed
- Ensure nginx and gunicorn are installed
- Ensure the terrain-3d code is copied to `/var/www/ecodash/private/terrain-3d/`

## Step 1: Stop the current testing service
```bash
sudo systemctl stop testing.service
sudo systemctl disable testing.service
```

## Step 2: Set up the Python virtual environment
```bash
cd /var/www/ecodash/private/terrain-3d/
sudo python3 -m venv venv
sudo chown -R www-data:www-data venv
sudo -u www-data venv/bin/pip install -r requirements.txt
sudo -u www-data venv/bin/pip install gunicorn
```

## Step 3: Copy and install the systemd service
```bash
sudo cp terrain3d.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable terrain3d.service
sudo systemctl start terrain3d.service
```

## Step 4: Check service status
```bash
sudo systemctl status terrain3d.service
```

## Step 5: Update nginx configuration
```bash
# Backup existing configuration
sudo cp /etc/nginx/sites-available/testing.ecodash.ai /etc/nginx/sites-available/testing.ecodash.ai.backup

# Copy new configuration
sudo cp nginx-testing.conf /etc/nginx/sites-available/testing.ecodash.ai

# Create symlink if it doesn't exist
sudo ln -sf /etc/nginx/sites-available/testing.ecodash.ai /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Step 6: Ensure proper permissions
```bash
sudo chown -R www-data:www-data /var/www/ecodash/private/terrain-3d/
sudo chmod -R 755 /var/www/ecodash/private/terrain-3d/
```

## Step 7: Test the deployment
```bash
# Check if the service is running
curl -I http://127.0.0.1:5001/api/health

# Check from external
curl -I https://testing.ecodash.ai/api/health
```

## Troubleshooting

### Check logs
```bash
# Service logs
sudo journalctl -u terrain3d.service -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### If SSL certificate doesn't exist
```bash
sudo certbot --nginx -d testing.ecodash.ai
```

### To rollback
```bash
# Stop terrain-3d service
sudo systemctl stop terrain3d.service
sudo systemctl disable terrain3d.service

# Restore original nginx config
sudo mv /etc/nginx/sites-available/testing.ecodash.ai.backup /etc/nginx/sites-available/testing.ecodash.ai
sudo systemctl reload nginx

# Re-enable original testing service
sudo systemctl enable testing.service
sudo systemctl start testing.service
```