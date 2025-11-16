# Custom Domain Implementation Guide

## How Custom Domains Currently Work

### Current Flow:
1. User enters domain (e.g., `example.com`)
2. Backend adds domain to Firebase Hosting
3. Backend tries to create DNS record in Cloudflare (assumes domain is managed by Cloudflare)
4. Domain is stored in `brandSite.customDomain`

### Limitations:
- ❌ Assumes all domains are managed by Cloudflare
- ❌ No domain validation
- ❌ No DNS instructions for external DNS providers
- ❌ No domain status tracking
- ❌ No SSL certificate status checking
- ❌ Basic UI without instructions

## How It Should Work

### Improved Flow:
1. **User enters domain** → Validate format
2. **Check if domain is Cloudflare-managed** → If yes, create DNS record automatically
3. **If external DNS** → Provide DNS instructions to user
4. **Add to Firebase Hosting** → Firebase will provision SSL (24-48 hours)
5. **Track status** → Monitor domain verification and SSL provisioning
6. **Show status in UI** → Display current status and next steps

## Implementation Options

### Option 1: Cloudflare-Only (Current - Limited)
- Only works for domains managed by your Cloudflare account
- Automatic DNS configuration
- Simple but limited

### Option 2: Universal Support (Recommended)
- Works for any domain provider
- Provides DNS instructions for users
- More flexible but requires user to configure DNS manually

### Option 3: Hybrid Approach (Best)
- Automatically configure if domain is in Cloudflare
- Provide instructions if domain is external
- Best user experience

## Firebase Hosting Requirements

Firebase Hosting needs:
- **Apex domains** (`example.com`): A records pointing to Firebase IPs
- **Subdomains** (`www.example.com`): CNAME pointing to Firebase Hosting URL

Firebase automatically:
- Provisions SSL certificates (24-48 hours)
- Verifies domain ownership
- Provides domain status via API

## Recommended Implementation

I'll implement Option 3 (Hybrid Approach) with:
1. Domain validation
2. Cloudflare auto-configuration (if domain is in Cloudflare)
3. DNS instructions for external domains
4. Domain status tracking
5. Improved UI with status and instructions

