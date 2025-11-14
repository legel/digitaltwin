# Digital Twin Staging Environment - Implementation Plan

## Overview

This document outlines the complete implementation plan for setting up a staging environment for the Digital Twin application, separating production (`digitaltwin.ecodash.ai`) from staging (`staging.ecodash.ai`) deployments.

## Architecture

### Directory Structure

**Current:**
```
/var/www/ecodash/private/digitaltwin/  (serves both testing.ecodash.ai and digitaltwin.ecodash.ai)
```

**New:**
```
/var/www/ecodash/private/digitaltwin/
├── prod/                               # Production deployment (digitaltwin.ecodash.ai)
│   ├── server.py
│   ├── venv/
│   ├── data/
│   ├── js/
│   ├── css/
│   ├── supersplat/
│   ├── manifests/
│   └── ... (all application files)
└── staging/                            # Staging deployment (staging.ecodash.ai)
    ├── server.py
    ├── venv/
    ├── data/
    ├── js/
    ├── css/
    ├── supersplat/
    ├── manifests/
    └── ... (all application files)
```

### Port Assignments

| Environment | Domain | Port | Service Name |
|-------------|--------|------|--------------|
| Production | digitaltwin.ecodash.ai | 5002 | digitaltwin-prod |
| Staging | staging.ecodash.ai | 5004 | digitaltwin-staging |
| Legacy (disabled) | testing.ecodash.ai | - | (redirects to prod) |

### Git Branch Strategy

| Branch | Purpose | Deploys To | Merge Target |
|--------|---------|------------|--------------|
| `main` (or `prod`) | Production-ready code | `/var/www/ecodash/private/digitaltwin/prod/` | - |
| `staging` | Integration testing | `/var/www/ecodash/private/digitaltwin/staging/` | `main` |
| `feature/*` | Feature development | Local development only | `staging` |

## Implementation Steps

### Step 1: Directory Reorganization

```bash
# SSH into server
ssh -i ~/.ssh/ecodash_key photon@34.71.213.117

# Navigate to digitaltwin directory
cd /var/www/ecodash/private/digitaltwin

# Stop current service
sudo systemctl stop digitaltwin

# Create new directory structure
mkdir -p prod staging

# Move current deployment to prod
mv !(prod|staging) prod/ 2>/dev/null || true
# Handle hidden files separately
find . -maxdepth 1 -name ".*" ! -name "." ! -name ".." -exec mv {} prod/ \;

# Verify prod directory
ls -la prod/

# Clone staging from prod
cp -r prod/* staging/
cp -r prod/.* staging/ 2>/dev/null || true

# Set proper ownership
sudo chown -R photon:www-data prod/ staging/
sudo chmod -R 750 prod/ staging/
```

### Step 2: Create Production Systemd Service

```bash
# Create new production service file
sudo nano /etc/systemd/system/digitaltwin-prod.service
```

**Content:**
```ini
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
```

### Step 3: Create Staging Systemd Service

```bash
# Create staging service file
sudo nano /etc/systemd/system/digitaltwin-staging.service
```

**Content:**
```ini
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
```

### Step 4: Update Apache Configuration

```bash
# Backup current config
sudo cp /etc/apache2/sites-enabled/ecodash.ai-le-ssl.conf /etc/apache2/sites-enabled/ecodash.ai-le-ssl.conf.backup

# Edit Apache config
sudo nano /etc/apache2/sites-enabled/ecodash.ai-le-ssl.conf
```

**Update the ServerAlias section:**
```apache
<VirtualHost *:443>
    ServerName ecodash.ai
    ServerAlias www.ecodash.ai
    ServerAlias thenatives.ecodash.ai
    ServerAlias testing.ecodash.ai
    ServerAlias digitaltwin.ecodash.ai
    ServerAlias staging.ecodash.ai
    ServerAlias deepearth.ecodash.ai
    ServerAlias terrain.ecodash.ai
```

**Update the rewrite rules section (replace existing testing/digitaltwin rules):**
```apache
    # Staging Rules: Handle staging.ecodash.ai (NEW)
    RewriteCond %{HTTP_HOST} ^staging\.ecodash\.ai$ [NC]
    RewriteRule ^/$ http://127.0.0.1:5004/ [P,L]

    RewriteCond %{HTTP_HOST} ^staging\.ecodash\.ai$ [NC]
    RewriteRule ^/(.+)$ http://127.0.0.1:5004/$1 [P,L]

    # DigitalTwin Rules: Handle digitaltwin.ecodash.ai (Production)
    RewriteCond %{HTTP_HOST} ^digitaltwin\.ecodash\.ai$ [NC]
    RewriteRule ^/$ http://127.0.0.1:5002/ [P,L]

    RewriteCond %{HTTP_HOST} ^digitaltwin\.ecodash\.ai$ [NC]
    RewriteRule ^/(.+)$ http://127.0.0.1:5002/$1 [P,L]

    # Testing Rules: Redirect testing.ecodash.ai to production (Legacy Support)
    RewriteCond %{HTTP_HOST} ^testing\.ecodash\.ai$ [NC]
    RewriteRule ^/(.*)$ https://digitaltwin.ecodash.ai/$1 [R=301,L]
```

### Step 5: SSL Certificate Update

```bash
# Add staging.ecodash.ai to Let's Encrypt certificate
sudo certbot certonly --apache -d staging.ecodash.ai

# Or expand existing certificate
sudo certbot --apache -d ecodash.ai -d www.ecodash.ai -d digitaltwin.ecodash.ai -d staging.ecodash.ai -d terrain.ecodash.ai -d deepearth.ecodash.ai --expand
```

### Step 6: Enable and Start Services

```bash
# Disable old service
sudo systemctl stop digitaltwin
sudo systemctl disable digitaltwin

# Reload systemd
sudo systemctl daemon-reload

# Enable new services
sudo systemctl enable digitaltwin-prod
sudo systemctl enable digitaltwin-staging

# Start services
sudo systemctl start digitaltwin-prod
sudo systemctl start digitaltwin-staging

# Verify status
sudo systemctl status digitaltwin-prod
sudo systemctl status digitaltwin-staging
```

### Step 7: Verify Apache Configuration and Restart

```bash
# Test Apache configuration
sudo apache2ctl configtest

# If OK, reload Apache
sudo systemctl reload apache2

# Verify Apache is running
sudo systemctl status apache2
```

### Step 8: Setup Git Repositories

**In prod directory:**
```bash
cd /var/www/ecodash/private/digitaltwin/prod

# Initialize or verify git repo
git status

# Ensure on main branch
git checkout main

# Pull latest
git pull origin main
```

**In staging directory:**
```bash
cd /var/www/ecodash/private/digitaltwin/staging

# Clone fresh or setup branch
git checkout -b staging || git checkout staging

# If staging branch doesn't exist on remote yet
git push -u origin staging
```

### Step 9: Verification Tests

```bash
# Test production endpoint
curl -I https://digitaltwin.ecodash.ai

# Test staging endpoint
curl -I https://staging.ecodash.ai

# Test legacy redirect
curl -I https://testing.ecodash.ai

# Check service logs
sudo tail -f /var/www/ecodash/private/logs/digitaltwin-prod-access.log
sudo tail -f /var/www/ecodash/private/logs/digitaltwin-staging-access.log
```

## Development Workflow

### For Feature Development

1. **Local Development**
   ```bash
   # On local machine
   git checkout -b feature/my-feature
   # Make changes, test locally at localhost:5001
   git add .
   git commit -m "Add new feature"
   git push origin feature/my-feature
   ```

2. **Create PR to Staging**
   - Open PR: `feature/my-feature` → `staging`
   - Review code
   - Merge to staging

3. **Deploy to Staging Server**
   ```bash
   # SSH into server
   ssh -i ~/.ssh/ecodash_key photon@34.71.213.117

   # Navigate to staging
   cd /var/www/ecodash/private/digitaltwin/staging

   # Pull latest staging branch
   git pull origin staging

   # Restart staging service
   sudo systemctl restart digitaltwin-staging

   # Monitor logs
   tail -f /var/www/ecodash/private/logs/digitaltwin-staging-error.log
   ```

4. **Validate on Staging**
   - Test at `https://staging.ecodash.ai`
   - Verify all features work correctly
   - Check browser console for errors
   - Test 3D rendering, polygon loading, etc.

5. **Create PR to Production**
   - Once staging validation complete
   - Open PR: `staging` → `main`
   - Final review
   - Merge to main

6. **Deploy to Production**
   ```bash
   # SSH into server
   ssh -i ~/.ssh/ecodash_key photon@34.71.213.117

   # Navigate to production
   cd /var/www/ecodash/private/digitaltwin/prod

   # Pull latest main branch
   git pull origin main

   # Restart production service
   sudo systemctl restart digitaltwin-prod

   # Monitor logs
   tail -f /var/www/ecodash/private/logs/digitaltwin-prod-error.log
   ```

7. **Verify Production**
   - Test at `https://digitaltwin.ecodash.ai`
   - Confirm no regressions

### Quick Reference Commands

**Service Management:**
```bash
# Production
sudo systemctl restart digitaltwin-prod
sudo systemctl status digitaltwin-prod
sudo systemctl stop digitaltwin-prod
sudo systemctl start digitaltwin-prod

# Staging
sudo systemctl restart digitaltwin-staging
sudo systemctl status digitaltwin-staging
sudo systemctl stop digitaltwin-staging
sudo systemctl start digitaltwin-staging
```

**Log Monitoring:**
```bash
# Production logs
tail -f /var/www/ecodash/private/logs/digitaltwin-prod-access.log
tail -f /var/www/ecodash/private/logs/digitaltwin-prod-error.log

# Staging logs
tail -f /var/www/ecodash/private/logs/digitaltwin-staging-access.log
tail -f /var/www/ecodash/private/logs/digitaltwin-staging-error.log
```

**Deployment:**
```bash
# Production
cd /var/www/ecodash/private/digitaltwin/prod
git pull origin main
sudo systemctl restart digitaltwin-prod

# Staging
cd /var/www/ecodash/private/digitaltwin/staging
git pull origin staging
sudo systemctl restart digitaltwin-staging
```

## Rollback Procedures

### If Staging Breaks

```bash
# Revert to previous commit
cd /var/www/ecodash/private/digitaltwin/staging
git log --oneline -n 10
git checkout <previous-commit-hash>
sudo systemctl restart digitaltwin-staging
```

### If Production Breaks

```bash
# Quick rollback
cd /var/www/ecodash/private/digitaltwin/prod
git log --oneline -n 10
git checkout <previous-working-commit>
sudo systemctl restart digitaltwin-prod

# Or restore from staging if staging is known good
cd /var/www/ecodash/private/digitaltwin/prod
git checkout staging
sudo systemctl restart digitaltwin-prod
```

## Local Development Configuration

Update `js/core/config.js` to support three environments:

```javascript
const isLocal = window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.port === '5001';

const isStaging = window.location.hostname === 'staging.ecodash.ai';

const isProd = window.location.hostname === 'digitaltwin.ecodash.ai';

window.TerrainConfig = {
    environment: isLocal ? 'local' : (isStaging ? 'staging' : 'production'),
    isLocal: isLocal,
    isStaging: isStaging,
    isProd: isProd,

    getDataUrl: function(path) {
        // Use local data in local development
        if (isLocal) {
            return `/data/${path}`;
        }
        // Staging and production use their own data
        return `/data/${path}`;
    }
};
```

## Security Considerations

1. **Separate Virtual Environments**: Staging and production use isolated Python venvs
2. **Different Log Files**: Prevents log confusion
3. **Branch Protection**: Enable branch protection on `main` branch
4. **DNS Configuration**: A record for staging.ecodash.ai already created
5. **SSL Certificate**: Shared Let's Encrypt certificate covers both domains

## Monitoring

**Health Checks:**
```bash
# Production health
curl https://digitaltwin.ecodash.ai/api/health

# Staging health
curl https://staging.ecodash.ai/api/health
```

**Service Status:**
```bash
# All services
sudo systemctl status digitaltwin-prod digitaltwin-staging

# Check ports
sudo netstat -tlnp | grep -E "5002|5004"
```

## Troubleshooting

**Port Already in Use:**
```bash
sudo netstat -tlnp | grep :5004
sudo systemctl stop digitaltwin-staging
sudo systemctl start digitaltwin-staging
```

**Service Won't Start:**
```bash
sudo journalctl -u digitaltwin-staging -n 50
sudo systemctl status digitaltwin-staging -l
```

**Apache Configuration Issues:**
```bash
sudo apache2ctl configtest
sudo tail -f /var/log/apache2/app-error.log
```

## Next Steps

After implementation:

1. ✅ Test staging deployment thoroughly
2. ✅ Update SERVER_CONFIG.md with new architecture
3. ✅ Document in project README
4. ✅ Train team on new workflow
5. ✅ Setup automated testing for staging deployments
6. ✅ Consider CI/CD pipeline for automatic deployments

---

**Implementation Date**: 2025-11-14
**Maintained by**: EcoDash Development Team
