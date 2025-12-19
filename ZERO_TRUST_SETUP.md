# Cloudflare Zero Trust Setup Instructions

This guide will help you configure Cloudflare Access to protect the main dashboard while keeping the blog public.

## Architecture

- **Public (no auth)**: `/blog.html` - Blog and History viewing
- **Protected (auth required)**: `/` (index.html) - Dashboard with data entry, AI chat, photos, expenses

## Setup Steps

### 1. Enable Cloudflare Access

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to **Zero Trust** in the sidebar
4. Navigate to **Access** → **Applications**

### 2. Create Access Policy for Dashboard

Click **Add an application** and configure:

**Application Configuration:**
- Name: `Chicken Dashboard - Protected`
- Session Duration: `24 hours` (or your preference)
- Application type: `Self-hosted`

**Application Domain:**
- Subdomain: (leave blank if using root domain)
- Domain: `your-site.pages.dev` (or your custom domain)
- Path: `/`

**Policy Configuration:**
Create a policy with:
- Policy name: `Allow Admin Access`
- Action: `Allow`
- Include: `Emails` → Add your email address(es)

### 3. Bypass Authentication for Public Blog

Click **Add an application** and configure:

**Application Configuration:**
- Name: `Chicken Dashboard - Public Blog`
- Application type: `Self-hosted`

**Application Domain:**
- Domain: `your-site.pages.dev`
- Path: `/blog.html`

**Policy Configuration:**
- Policy name: `Public Access`
- Action: `Bypass`
- Include: `Everyone`

### 4. Important: Policy Order

Make sure the policies are in this order:
1. Public Blog (Bypass) - `/blog.html`
2. Protected Dashboard (Allow) - `/`

The more specific path (`/blog.html`) should come before the catch-all (`/`).

### 5. Also Keep API Endpoints Public

Since the blog page needs to fetch data from `/api/blog` and `/api/activity`, you may need to add bypass rules for:
- Path: `/api/blog`
- Path: `/api/activity`

Set these as **Bypass** with **Everyone** included.

## Testing

1. **Test Public Access**: Open `/blog.html` in an incognito window - should load without auth
2. **Test Protected Access**: Open `/` in an incognito window - should prompt for authentication
3. **Test After Login**: After authenticating, you should be able to access all dashboard features

## Alternative: API-Level Protection

If you prefer to protect at the API level instead of page level, you can:

1. Keep all pages public
2. Protect only write operations:
   - `/api/eggs` (POST)
   - `/api/feeding` (POST)
   - `/api/free-range` (POST)
   - `/api/health` (POST)
   - `/api/photos` (POST)
   - `/api/chat` (POST)
   - `/api/blog` (POST)

This approach requires more granular policies but allows the frontend to load for everyone.
