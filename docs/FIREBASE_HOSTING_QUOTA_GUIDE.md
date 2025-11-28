# Firebase Hosting API Quota Troubleshooting Guide

## 🔍 Where to Check Quotas

### 1. Google Cloud Console - Quotas Page
**Direct Link:** https://console.cloud.google.com/iam-admin/quotas

**Steps:**
1. Select your Firebase project (dropdown at top)
2. Filter by service: `Firebase Hosting API` or `firebasehosting.googleapis.com`
3. Look for quotas with status "Exceeded" or high usage

**Key Quotas to Check:**
- **Sites per project**: Default is 36 sites per Firebase project
- **API requests per minute**: Rate limits for create/update/delete operations
- **Deployments per day**: Limits on how many deployments you can make

### 2. Firebase Console - Usage & Billing
**Direct Link:** https://console.firebase.google.com/project/YOUR_PROJECT_ID/usage

**Steps:**
1. Go to your Firebase project
2. Click "Usage and billing" in the left sidebar
3. Review "Hosting" section for current usage

### 3. Google Cloud Console - API & Services
**Direct Link:** https://console.cloud.google.com/apis/dashboard?project=YOUR_PROJECT_ID

**Steps:**
1. Select your project
2. Search for "Firebase Hosting API"
3. Click on it to see:
   - Requests per day/hour/minute
   - Error rates
   - Quota usage graphs

## 📊 What to Look For

### Common Quota Limits:

1. **Sites Per Project**
   - **Default**: 36 sites per Firebase project
   - **Check**: Count your existing sites
   - **Solution**: Delete unused sites or create a new Firebase project

2. **API Requests Per Minute**
   - **Default**: Varies by operation type
   - **Check**: Look for "Requests per minute" quota
   - **Solution**: Implement rate limiting or request quota increase

3. **Deployments Per Day**
   - **Default**: Usually 100-200 deployments per day
   - **Check**: Count deployments in last 24 hours
   - **Solution**: Batch deployments or request increase

## 🛠️ How to Fix

### Option 1: Wait and Retry (Temporary)
- Quota limits are often **per-minute** or **per-hour**
- Wait 5-10 minutes and try again
- The system automatically retries with exponential backoff

### Option 2: Delete Unused Sites
```bash
# List all Firebase Hosting sites
firebase hosting:sites:list

# Delete unused sites via Firebase Console
# Go to: https://console.firebase.google.com/project/YOUR_PROJECT/hosting
```

### Option 3: Request Quota Increase
1. Go to: https://console.cloud.google.com/iam-admin/quotas
2. Select your project
3. Filter by: `firebasehosting.googleapis.com`
4. Find the quota you need (e.g., "Sites per project")
5. Click "Edit Quotas" button
6. Fill out the request form:
   - **Requested quota**: Enter new limit (e.g., 100 sites)
   - **Justification**: Explain your use case
   - **Contact email**: Your email
7. Submit and wait for approval (usually 24-48 hours)

### Option 4: Create New Firebase Project
If you've hit the site limit:
1. Create a new Firebase project
2. Update `FIREBASE_PROJECT_ID` secret
3. Migrate sites gradually

## 🔍 Quick Diagnostic Commands

```bash
# Check your current project
gcloud config get-value project

# List all Firebase Hosting sites
firebase hosting:sites:list

# Check API quota usage (requires gcloud)
gcloud services list --enabled | grep firebasehosting

# View recent Firebase Hosting API errors
gcloud logging read "resource.type=cloud_function AND textPayload=~'Firebase Hosting API'" --limit=50
```

## 📈 Monitoring Quota Usage

### Set Up Alerts:
1. Go to: https://console.cloud.google.com/monitoring/alerting
2. Create alert policy for:
   - Metric: `serviceruntime.googleapis.com/api/request_count`
   - Filter: `service_name="firebasehosting.googleapis.com"`
   - Condition: Quota usage > 80%

## 🚨 Immediate Actions

If you're getting quota errors right now:

1. **Check site count:**
   ```bash
   firebase hosting:sites:list | wc -l
   ```
   If > 36, you've hit the limit.

2. **Check recent deployments:**
   - Go to Firebase Console → Hosting
   - Count deployments in last hour
   - If > 50-100, you may be hitting rate limits

3. **Wait 10 minutes** and retry (quota resets periodically)

4. **Delete unused sites** if you're at the limit

## 📞 Support

If quota issues persist:
- **Firebase Support**: https://firebase.google.com/support
- **Google Cloud Support**: https://cloud.google.com/support
- **Quota Increase Request**: https://console.cloud.google.com/iam-admin/quotas

## 💡 Prevention Tips

1. **Clean up unused sites regularly**
2. **Batch operations** instead of many small requests
3. **Implement exponential backoff** (already done in code)
4. **Monitor quota usage** with alerts
5. **Request quota increases proactively** before hitting limits

