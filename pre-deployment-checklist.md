# Pre-Deployment Checklist for Terrain-3D

Before running the deployment, ensure the following:

## 1. Code Preparation
- [ ] Copy entire terrain-3d directory to `/var/www/ecodash/private/terrain-3d/`
  ```bash
  sudo cp -r /home/photon/terrain-3d /var/www/ecodash/private/
  ```

## 2. System Requirements
- [ ] Python 3.8+ is installed
  ```bash
  python3 --version
  ```

- [ ] nginx is installed
  ```bash
  nginx -v
  ```

- [ ] pip is installed
  ```bash
  python3 -m pip --version
  ```

## 3. Backup Current Setup
- [ ] Document current testing.ecodash.ai configuration
  ```bash
  sudo systemctl status testing.service > testing-service-backup.txt
  sudo cp /etc/nginx/sites-available/testing.ecodash.ai testing-nginx-backup.conf
  ```

## 4. SSL Certificate
- [ ] Verify SSL certificate exists for testing.ecodash.ai
  ```bash
  sudo ls -la /etc/letsencrypt/live/testing.ecodash.ai/
  ```

If not, create one:
  ```bash
  sudo certbot --nginx -d testing.ecodash.ai
  ```

## 5. Port Availability
- [ ] Ensure port 5001 is available
  ```bash
  sudo lsof -i :5001
  ```

## 6. File Permissions
- [ ] www-data user exists
  ```bash
  id www-data
  ```

## 7. Review Configuration Files
- [ ] Review `terrain3d.service` - ensure paths are correct
- [ ] Review `nginx-testing.conf` - ensure SSL paths match your system
- [ ] Adjust port in `terrain3d.service` if 5001 is not available

## After Verification
Run the deployment:
```bash
cd /home/photon/terrain-3d
sudo bash deploy-to-testing.sh
```