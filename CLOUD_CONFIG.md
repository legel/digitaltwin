# Cloud Configuration Guide

This document provides instructions for setting up Google Cloud Platform resources required for the digital twin platform.

## Overview

The digital twin platform uses Google Cloud Storage to serve large Gaussian splat files via progressive chunk loading. You'll need:
1. A Google Cloud Platform account
2. A Google Cloud Storage bucket
3. CORS configuration for browser access
4. Environment variables for local development

## Google Cloud Platform Setup

### 1. Create a Google Cloud Project

If you don't already have a GCP project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "digital-twin-production")
4. Note your **Project ID** (you'll need this later)

### 2. Enable Cloud Storage API

```bash
gcloud services enable storage-api.googleapis.com
```

### 3. Create a Storage Bucket

Choose a globally unique bucket name:

```bash
# Set your bucket name (must be globally unique)
export GCS_BUCKET="your-unique-bucket-name"

# Create the bucket
gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l US gs://${GCS_BUCKET}
```

**Bucket naming guidelines:**
- Use lowercase letters, numbers, hyphens, and underscores
- Must be globally unique across all of Google Cloud
- Example: `digital-twin-mycompany-prod`

### 4. Configure CORS for Browser Access

Create a CORS configuration file:

```bash
cat > cors.json <<'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
EOF
```

Apply CORS to your bucket:

```bash
gsutil cors set cors.json gs://${GCS_BUCKET}
```

Verify CORS configuration:

```bash
gsutil cors get gs://${GCS_BUCKET}
```

**Production security note:** For production, replace `"origin": ["*"]` with your specific domain:
```json
"origin": ["https://yourdomain.com"]
```

### 5. Set Bucket Permissions

Make objects publicly readable:

```bash
gsutil iam ch allUsers:objectViewer gs://${GCS_BUCKET}
```

Or for more granular control, set permissions per object during upload.

## Environment Variables

The digital twin platform uses environment variables to keep sensitive configuration out of the repository.

### Required Variables

Create a `.envrc` file in your project root (this file is gitignored):

```bash
# Google Cloud Storage Configuration
export GCS_BUCKET="your-bucket-name"
export GCS_PROJECT="your-project-id"

# Deployment Configuration
export DEPLOY_SERVER_IP="your.server.ip.address"
export DEPLOY_SSH_KEY="~/.ssh/your_key"
export DEPLOY_USER="your-username"
export DEPLOY_PATH="/path/to/deployment"
```

### Using direnv (Recommended)

[direnv](https://direnv.net/) automatically loads environment variables when you enter the project directory:

1. Install direnv:
   ```bash
   # macOS
   brew install direnv

   # Ubuntu/Debian
   sudo apt install direnv
   ```

2. Add to your shell config (`~/.bashrc`, `~/.zshrc`, etc.):
   ```bash
   eval "$(direnv hook bash)"  # or zsh, fish, etc.
   ```

3. Allow the `.envrc` file:
   ```bash
   cd /path/to/digitaltwin
   direnv allow
   ```

Now environment variables load automatically when you `cd` into the project.

### Manual Environment Setup

If not using direnv, source the file manually:

```bash
source .envrc
```

Or add to your shell profile for permanent configuration.

## Testing Your Configuration

### Test Bucket Access

```bash
# List bucket contents
gsutil ls gs://${GCS_BUCKET}

# Test upload
echo "test" > test.txt
gsutil cp test.txt gs://${GCS_BUCKET}/test.txt
rm test.txt

# Test public access
curl -I https://storage.googleapis.com/${GCS_BUCKET}/test.txt

# Clean up
gsutil rm gs://${GCS_BUCKET}/test.txt
```

### Expected Response

```
HTTP/2 200
content-type: text/plain
access-control-allow-origin: *
content-length: 5
```

If you see `403 Forbidden`, check your bucket permissions.
If you see `CORS error` in browser, verify your CORS configuration.

## Deployment Workflows

### Development

For local development, use localhost and test data:

```bash
# .envrc
export GCS_BUCKET="your-dev-bucket"
export GCS_PROJECT="your-dev-project"
```

Run the development server:
```bash
python server.py
# Server runs on http://localhost:5001
```

### Staging

For staging environments, use a separate bucket:

```bash
# .envrc.staging
export GCS_BUCKET="your-staging-bucket"
export GCS_PROJECT="your-project-id"
export DEPLOY_SERVER_IP="staging.yourdomain.com"
```

### Production

For production, use production bucket and server:

```bash
# .envrc.production
export GCS_BUCKET="your-production-bucket"
export GCS_PROJECT="your-project-id"
export DEPLOY_SERVER_IP="yourdomain.com"
```

## Cost Optimization

### Storage Costs

Google Cloud Storage pricing (approximate):
- **Storage**: $0.020 per GB/month (Standard class, US)
- **Data retrieval**: $0.01 per GB
- **Network egress**: $0.12 per GB (first 1TB per month)

Example cost for 10 sites with 120MB splats each:
- Storage: 1.2 GB × $0.020 = $0.024/month
- Bandwidth (1000 loads): 120 GB × $0.12 = $14.40/month

### Optimization Strategies

1. **Use Cloud CDN**: Reduce egress costs with caching
   ```bash
   gsutil web set -m index.html gs://${GCS_BUCKET}
   ```

2. **Lifecycle Management**: Delete old chunks after deployment updates
   ```bash
   gsutil lifecycle set lifecycle.json gs://${GCS_BUCKET}
   ```

3. **Compression**: Enable gzip compression for chunks
   ```bash
   gsutil -h "Content-Encoding:gzip" cp file.bin gs://${GCS_BUCKET}/
   ```

## Security Best Practices

### 1. Use Service Accounts

For server deployments, use service accounts instead of personal credentials:

```bash
# Create service account
gcloud iam service-accounts create digitaltwin-uploader \
    --display-name="Digital Twin Splat Uploader"

# Grant storage permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:digitaltwin-uploader@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

# Create key
gcloud iam service-accounts keys create key.json \
    --iam-account=digitaltwin-uploader@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. Restrict CORS Origins

In production, limit CORS to your domain:

```json
{
  "origin": ["https://yourdomain.com", "https://staging.yourdomain.com"],
  "method": ["GET", "HEAD"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}
```

### 3. Use Signed URLs

For private splats, use signed URLs instead of public access:

```python
from google.cloud import storage
import datetime

def generate_signed_url(bucket_name, blob_name):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=1),
        method="GET"
    )
    return url
```

## Troubleshooting

### CORS Errors

**Symptom**: Browser console shows CORS policy errors

**Solution**:
```bash
# Verify CORS configuration
gsutil cors get gs://${GCS_BUCKET}

# Re-apply CORS
gsutil cors set cors.json gs://${GCS_BUCKET}
```

### 403 Forbidden

**Symptom**: Cannot access bucket objects

**Solution**:
```bash
# Check bucket permissions
gsutil iam get gs://${GCS_BUCKET}

# Make publicly readable
gsutil iam ch allUsers:objectViewer gs://${GCS_BUCKET}
```

### Authentication Errors

**Symptom**: `gcloud` commands fail with auth errors

**Solution**:
```bash
# Re-authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list
```

## Additional Resources

- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [CORS Configuration](https://cloud.google.com/storage/docs/cross-origin)
- [Storage Pricing](https://cloud.google.com/storage/pricing)
- [Best Practices](https://cloud.google.com/storage/docs/best-practices)

## Support

For digital twin platform specific issues:
- See PLY_DEPLOYMENT_GUIDE.md for splat deployment
- See README.md for general setup
- Check GitHub Issues for known problems
