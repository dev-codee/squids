# n8n Automated Coupon & Deal Research Setup

This guide explains how to set up the automated coupon research pipeline in your **n8n** instance running on your VPS.

---

## 1. How the Pipeline Works

1. **Trigger**:
   - You click **"Research Deals (AI / n8n)"** on your Admin Coupons page, OR
   - An n8n Cron schedule triggers it periodically for top stores.
2. **AI Web Search**:
   - Queries live web search via Perplexity Sonar across **RetailMeNot**, **CouponCabin**, **Slickdeals**, and merchant sites.
   - Extracts real promo codes, discounts (`20% OFF`), expiration dates, and descriptions.
3. **Clean & Deduplicate**:
   - Codes are normalized (uppercase, trimmed) and deduplicated.
4. **App Staging Queue**:
   - Posts candidate coupons to your Next.js app (`POST /api/admin/deals/discovered`).
   - The app verifies whether the coupon already exists in MongoDB, binds **your own affiliate tracking link** for that store, and adds it to the review inbox.
5. **Admin Approval**:
   - In `/dashboard/coupons`, click **"Discovered Codes"** to view, edit, and 1-click **Approve & Publish** to your live website!

---

## 2. Connecting n8n to Affiliate App in Docker

In your VPS (`srv1843600`), both `n8n-n8n-1` and `affiliate-app` are running as Docker containers:
- `affiliate-app` (listening inside the container on port `3000`, published to port `3001` on VPS)
- `n8n-n8n-1` (running on port `5678`)

### Option A: Shared Docker Network (Recommended)
Connect `n8n-n8n-1` to the affiliate app's network so they can resolve each other by container name:
```bash
# Check the network name created for affiliate-app
docker inspect affiliate-app --format '{{json .NetworkSettings.Networks}}'

# Connect n8n to that network (e.g. affliateproject_default or root_default)
docker network connect <NETWORK_NAME> n8n-n8n-1
```
Now in n8n, the URL is simply:
`http://affiliate-app:3000/api/admin/deals/discovered`

### Option B: Docker Host Gateway
If you do not connect them to the same network, in n8n use the Docker gateway IP:
`http://172.17.0.1:3001/api/admin/deals/discovered`
or
`http://host.docker.internal:3001/api/admin/deals/discovered`

---

## 3. Importing the Workflow into n8n

1. Open your n8n web dashboard (`http://YOUR_VPS_IP:5678` or domain).
2. In the left navigation, click **Workflows** -> **Add Workflow**.
3. In the top-right menu (three dots `⋮`), click **Import from File**.
4. Upload `scripts/n8n/coupon-research-workflow.json`.

---

## 4. Configure Secrets in n8n

Open the imported workflow in the n8n canvas:

1. **"Search Coupon Sites (AI)" Node**:
   - Under **Headers**, update `Authorization`:
     Replace `YOUR_PERPLEXITY_API_KEY` with your actual Perplexity API key (e.g. `Bearer pplx-...`).
2. **"Save to App Discovered Queue" Node**:
   - Under **Headers**, update `Authorization`:
     Replace `YOUR_CRON_SECRET` with the `CRON_SECRET` from your `.env.local` file (e.g. `Bearer <CRON_SECRET>`).
   - Check the **URL**: verify `http://affiliate-app:3000/api/admin/deals/discovered` (or port `3001` if using host gateway).
3. Click **Save** in n8n.
4. Toggle the workflow to **Active** (in the top right).

---

## 5. Copy the Webhook URL to Your App

1. In the **"Webhook Trigger"** node in n8n:
   - Click on the node and copy the **Production URL** (e.g. `http://YOUR_VPS_IP:5678/webhook/research-coupons`).
2. In your app's `.env.local` (or Docker environment), add:
   ```env
   N8N_RESEARCH_WEBHOOK_URL=http://n8n-n8n-1:5678/webhook/research-coupons
   ```
   *(Or the external URL `http://YOUR_VPS_IP:5678/webhook/research-coupons`)*.

---

## 6. How to Test

### Test from Admin Dashboard:
1. Go to `https://www.foxzil.com/dashboard/coupons` (or `http://localhost:3000/dashboard/coupons`).
2. Click **"Research Deals (AI / n8n)"**.
3. Select a store (e.g. "Nike" or "Adidas") or type in the store name.
4. Click **"Find Deals Now"**.
5. Once completed, click **"Discovered Codes"** to review the found coupons and click **"Approve & Add"**!
