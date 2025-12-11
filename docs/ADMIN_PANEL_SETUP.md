# Admin Panel Setup Guide

## Overview

The Financely Admin Panel provides internal administrators with comprehensive tools to manage organizations, users, billing, usage, and system settings.

## Admin Roles

The admin panel uses a role-based access control (RBAC) system with the following roles:

- **superadmin**: Full access to all admin features
- **billing_admin**: Access to billing and subscription management
- **support_admin**: Access to user/org management and logs
- **read_only_admin**: Read-only access to all admin features

## Setting Up Admin Users

### Method 1: Via Clerk Dashboard (Recommended)

1. Go to Clerk Dashboard → Users
2. Select the user you want to make an admin
3. Navigate to "Metadata" tab
4. Add to "Public metadata":
   ```json
   {
     "adminRole": "superadmin"
   }
   ```
5. Save changes

### Method 2: Via Firestore (Alternative)

If Clerk metadata sync is not set up, you can set admin role directly in Firestore:

1. Open Firestore Console
2. Navigate to `users/{userId}`
3. Add field: `adminRole: "superadmin"`
4. Save

**Note**: Method 1 is preferred as it syncs with Clerk's user management system.

## Accessing the Admin Panel

1. Sign in to Financely with an admin user account
2. Navigate to `/admin` in your browser
3. You should see the admin dashboard

If you don't have admin privileges, you'll be redirected to the regular dashboard.

## Admin Panel Features

### Dashboard
- Platform-wide KPIs (organizations, subscriptions, MRR)
- Usage summaries
- System health metrics

### Organizations
- View all organizations
- Search and filter organizations
- View organization details
- Manage organization settings

### Users
- View all platform users
- Search users by email/userId
- View user activity and org memberships
- Manage user roles

### Billing
- View all subscriptions
- Modify Stripe subscriptions
- Apply discounts and coupons
- Manage pricing

### Usage
- View aggregated usage data
- Override usage counts
- Manage usage limits

### System Settings
- Configure pricing plans
- Enable/disable features
- Set global limits
- Manage pay-as-you-go tiers

### Logs & Monitoring
- View system logs
- Monitor errors
- Track admin actions
- View audit logs

## Security

### Backend Verification
All admin operations are verified on the backend. The frontend role check is for UX only - backend always validates admin role.

### Audit Logging
Every admin action is logged with:
- Admin user ID
- Timestamp
- Action type
- Target resource
- Old and new values
- IP address

### Firestore Rules
Admin users have special access rules that allow cross-org data access. See `firestore.rules` for details.

## Development

### Adding New Admin Features

1. Create the admin page component in `app/src/pages/admin/`
2. Add route in `app/src/App.tsx` with `AdminProtectedRoute` wrapper
3. Create Cloud Function in `functions/src/functions/admin/`
4. Use `verifyAdminAuth()` in the Cloud Function
5. Add audit logging for write operations

### Testing Admin Features

1. Set your test user as admin (see "Setting Up Admin Users" above)
2. Sign in and navigate to `/admin`
3. Test the feature
4. Verify audit logs are created

## Troubleshooting

### "User does not have admin privileges"
- Verify admin role is set in Clerk publicMetadata or Firestore
- Check that the role value matches one of: `superadmin`, `billing_admin`, `support_admin`, `read_only_admin`
- Ensure user is signed in

### Admin panel not loading
- Check browser console for errors
- Verify Cloud Functions are deployed
- Check that admin routes are properly configured in `App.tsx`

### Backend errors
- Check Cloud Functions logs
- Verify `verifyAdminAuth()` is being called
- Ensure admin role is accessible from backend (check customClaims sync)

## Future Enhancements

- [ ] Admin impersonation feature
- [ ] Bulk operations for organizations/users
- [ ] Advanced analytics and reporting
- [ ] Automated alerting for system issues
- [ ] Admin activity dashboard
- [ ] Export capabilities for data analysis

