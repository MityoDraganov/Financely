# Custom Domain Implementation Guide

## How Custom Domains Work

Custom domains allow users to access their generated sites using their own domain (e.g., `example.com`) instead of the default subdomain (e.g., `brand-name.financely.app`).

### Architecture Overview

1. **User provides domain** → User enters their domain (e.g., `example.com` or `www.example.com`)
2. **Domain validation** → Validate domain format and check availability
3. **DNS configuration** → User configures DNS records to point to Firebase Hosting
4. **Domain verification** → Verify user owns the domain (optional but recommended)
5. **Firebase Hosting setup** → Add domain to Firebase Hosting site
6. **SSL certificate** → Firebase automatically provisions SSL certificate (can take 24-48 hours)
7. **Status monitoring** → Track domain status (pending, verified, active, failed)

### Current Implementation Status

✅ **What's already implemented:**
- Basic `addCustomDomain` function
- Firebase Hosting domain addition
- Cloudflare DNS record creation (for Cloudflare-managed domains)
- Basic UI component

❌ **What's missing/needs improvement:**
- Domain validation
- Support for external DNS providers (not just Cloudflare)
- Domain verification
- SSL certificate status checking
- Better UI with status, instructions, and verification steps
- Domain removal functionality
- Error handling and user guidance

## Implementation Steps

### 1. Backend Improvements

#### A. Enhanced Domain Validation
- Validate domain format
- Check for common issues (trailing slashes, protocols, etc.)
- Support both apex domains (`example.com`) and subdomains (`www.example.com`)

#### B. Support External DNS Providers
- Generate DNS instructions for users who manage their own DNS
- Provide CNAME or A record instructions based on Firebase Hosting requirements
- Don't assume all domains are managed by Cloudflare

#### C. Domain Verification (Optional but Recommended)
- Generate a verification token
- Ask user to add a TXT record
- Verify ownership before proceeding

#### D. SSL Certificate Status
- Check SSL certificate provisioning status
- Poll Firebase Hosting API for certificate status
- Notify user when SSL is ready

#### E. Domain Status Tracking
- Track domain status: `pending`, `verifying`, `active`, `failed`
- Store verification token and DNS instructions
- Store SSL certificate status

### 2. Frontend Improvements

#### A. Enhanced UI Component
- Show domain status with visual indicators
- Display DNS configuration instructions
- Show SSL certificate status
- Provide verification steps
- Show errors and troubleshooting tips

#### B. Domain Management
- List all custom domains
- Remove/delete custom domains
- View domain history and status changes

### 3. Firebase Hosting Requirements

Firebase Hosting requires:
- **For apex domains** (`example.com`): A record pointing to Firebase IPs
- **For subdomains** (`www.example.com`): CNAME record pointing to Firebase Hosting URL

Firebase automatically:
- Provisions SSL certificates (can take 24-48 hours)
- Handles domain verification
- Provides domain status

## Recommended Implementation Approach

### Phase 1: Basic Support (Current)
- ✅ Add domain to Firebase Hosting
- ✅ Create DNS record (if Cloudflare-managed)

### Phase 2: Enhanced Support (Recommended)
- Add domain validation
- Support external DNS providers with instructions
- Add domain status tracking
- Improve UI with status and instructions

### Phase 3: Advanced Features (Optional)
- Domain verification
- SSL certificate status polling
- Domain removal
- Multiple domains per site
- Domain history and audit logs

## DNS Configuration Instructions

### For Apex Domains (example.com)
```
Type: A
Name: @ (or example.com)
Value: [Firebase Hosting IP addresses]
TTL: 3600
```

### For Subdomains (www.example.com)
```
Type: CNAME
Name: www
Value: [Firebase Hosting site URL]
TTL: 3600
```

Note: Firebase Hosting provides specific IP addresses and URLs that should be used.

## Security Considerations

1. **Domain Ownership Verification**: Verify user owns the domain before adding it
2. **Rate Limiting**: Limit how many domains can be added per organization
3. **Validation**: Validate domain format and prevent malicious domains
4. **Access Control**: Ensure only authorized users can add/remove domains

## Error Handling

Common errors and solutions:
- **DNS not configured**: Provide clear instructions
- **SSL certificate pending**: Inform user it can take 24-48 hours
- **Domain already in use**: Check if domain is already added to another site
- **Invalid domain format**: Validate and provide helpful error messages

