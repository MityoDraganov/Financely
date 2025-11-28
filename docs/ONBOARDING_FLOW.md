# User Onboarding Flow

## Overview

The onboarding flow provides a welcoming, trust-building experience for new users who don't have an organization yet. It guides them through creating their first workspace with a beautiful, multi-step wizard interface.

## User Experience Flow

### Step 1: Welcome Screen
- **Purpose**: Welcome the user and build initial trust
- **Content**:
  - Personalized greeting with user's first name
  - Three key value propositions with icons:
    - Lightning Fast: Create invoices in seconds
    - Secure & Compliant: Bank-grade security
    - Team Collaboration: Work together seamlessly
  - Clean, professional design with brand colors
- **Action**: "Get Started" button to proceed

### Step 2: Benefits Showcase
- **Purpose**: Educate users about platform capabilities and build confidence
- **Content**:
  - Three main benefits with detailed descriptions:
    1. Professional Invoices (drag-and-drop designer)
    2. Smart Approvals (automated workflow routing)
    3. Never Miss a Renewal (automated reminders)
  - Security trust badge emphasizing data protection
- **Actions**: "Back" button or "Create Your Workspace" to continue

### Step 3: Organization Creation
- **Purpose**: Collect organization details
- **Form Fields**:
  - **Organization Name** (required) - e.g., "Acme Corporation"
  - **Description** (optional) - What the organization does
  - **Website** (optional) - Organization website URL
- **Features**:
  - Form validation (name is required)
  - Pro tip about inviting team members later
  - Loading state during creation
- **Backend Actions**:
  1. Creates user in database (if first time)
  2. Creates organization
  3. Adds user as member
  4. Sets user role as "owner"

### Step 4: Success Screen
- **Purpose**: Celebrate completion and guide next steps
- **Content**:
  - Large success icon with animation
  - Confirmation message with organization name
  - Three checkmarks showing what was accomplished:
    - Organization created (user is owner)
    - Ready to create invoices
    - Can invite team members
- **Action**: "Go to Dashboard" button

## Technical Implementation

### Components

#### `OnboardingFlow` (Main Component)
Location: `/app/src/components/onboarding/onboarding-flow.tsx`

**State Management**:
- `currentStep`: Tracks which step user is on (0-3)
- `formData`: Stores organization creation form data
- Progress bar updates based on current step

**Hooks Used**:
- `useUser()` from Clerk - Get authenticated user info
- `useUserByClerkId()` - Check if user exists in database
- `useCreateUser()` - Create user document if needed
- `useCreateOrganization()` - Create new organization
- `useAddOrganizationMember()` - Add user to organization
- `useUpdateUserRole()` - Set user as owner

**Process Flow**:
```typescript
1. Check if user exists in database
   ├─ If no: Create user document with Clerk data
   └─ If yes: Use existing user ID

2. Create organization with form data
   ├─ name (required)
   ├─ description (optional)
   └─ website (optional)

3. Add user to organization's memberIds array

4. Update user's organizationRoles map
   └─ Set role as "owner" for this organization

5. Show success screen and redirect to dashboard
```

### Integration Points

#### `AppLayout` Component
Location: `/app/src/components/layout.tsx`

**Onboarding Check**:
```typescript
const { needsOnboarding, isLoading } = useOnboardingStatus();
const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

// Show onboarding if user has no organizations
if (!isLoading && needsOnboarding && !hasCompletedOnboarding) {
  return <OnboardingFlow onComplete={() => setHasCompletedOnboarding(true)} />;
}
```

**States**:
- **Loading**: Shows spinner while checking user/organization status
- **Onboarding**: Shows full-screen onboarding flow
- **Normal**: Shows standard app layout with sidebar

#### `useOnboardingStatus` Hook
Location: `/app/src/hooks/use-onboarding.ts`

**Purpose**: Determines if user needs onboarding

**Logic**:
```typescript
1. Get Clerk user (authentication)
2. Find user in database by Clerk ID
3. Check if user has any organizations
4. Return needsOnboarding = true if no organizations exist
```

**Returns**:
- `needsOnboarding`: Boolean - true if user has no organizations
- `isLoading`: Boolean - true while checking status
- `user`: User object from database
- `organizations`: Array of user's organizations

## Design Principles

### Visual Design
- **Colors**: Green gradient theme (#166534 to #0e4424) matching landing page
- **Effects**: 
  - Backdrop blur for glassmorphic cards
  - Subtle animations (fade in/out, scale, slide)
  - Background decorations (blurred circles)
- **Typography**: Clear hierarchy with large, bold headings
- **Icons**: Lucide icons for consistency

### UX Principles
1. **Trust Building**:
   - Emphasize security and data protection
   - Show clear value propositions upfront
   - Professional, polished design

2. **Progressive Disclosure**:
   - One step at a time to avoid overwhelm
   - Progress bar shows completion status
   - Can go back to previous steps

3. **Minimal Friction**:
   - Only one required field (organization name)
   - Optional fields for later
   - Clear call-to-action buttons

4. **Positive Reinforcement**:
   - Success celebration screen
   - Checkmarks showing accomplishments
   - Encouraging copy throughout

5. **Clear Next Steps**:
   - Explicit button to dashboard
   - Hints about future features (invite team, etc.)

## Data Flow

### User Creation
```typescript
{
  clerkId: string,           // From Clerk authentication
  email: string,             // Primary email
  name: string,              // Full name or first name
  avatarUrl?: string,        // Profile picture
  organizationRoles: {       // Initially empty
    [orgId]: "owner"         // Added after org creation
  },
  defaultOrganizationId?: string,  // Set to new org
  status: "active",
  preferences: {
    theme: "system",
    language: "en",
    timezone: "UTC"
  }
}
```

### Organization Creation
```typescript
{
  name: string,              // Required
  description?: string,
  website?: string,
  memberIds: [userId],       // Creator added as first member
  status: "active",
  subscription: {
    plan: "free",            // Default plan
    status: "active"
  },
  settings: {
    // Default settings applied
    brandColors: {...},
    defaultCurrency: "USD",
    features: {...}
  },
  usage: {
    // All counters start at 0
  }
}
```

## Error Handling

### User-Facing Errors
- **Missing organization name**: "Please enter an organization name"
- **Not authenticated**: "User not authenticated"
- **Creation failed**: "Failed to create organization. Please try again."

### Console Logging
All errors are logged to console for debugging while showing user-friendly messages

## Testing Scenarios

1. **New User Flow**:
   - Sign up with Clerk
   - No database user exists
   - No organizations exist
   - Should see onboarding flow

2. **Existing User, No Org**:
   - User document exists
   - No organizations
   - Should see onboarding flow

3. **User with Organization**:
   - User has at least one organization
   - Should skip onboarding
   - Go directly to dashboard

4. **Session Persistence**:
   - Complete onboarding
   - Stay on same session
   - Should not see onboarding again
   - (Refresh would show dashboard if org exists)

## Future Enhancements

1. **Email Integration**:
   - Send welcome email after org creation
   - Include getting started guide

2. **Onboarding Checklist**:
   - Show tasks on dashboard for new users
   - Create first template
   - Invite first team member
   - Create first invoice

3. **Role Selection**:
   - Let user choose their role/use case
   - Customize experience based on role

4. **Team Invites in Onboarding**:
   - Optional step to invite team members immediately
   - Send invitation emails during onboarding

5. **Sample Data**:
   - Option to create sample invoice/template
   - Help users understand features faster

6. **Video Tutorial**:
   - Embedded video walkthrough
   - Skip option for experienced users

## Accessibility

- Keyboard navigation supported
- Focus states on all interactive elements
- Loading states announced
- Error messages clearly visible
- Color contrast meets WCAG standards
- Animation respects prefers-reduced-motion

## Performance

- Lazy loading of onboarding component
- Optimistic UI updates
- Minimal re-renders with proper state management
- Efficient query invalidation
- Debounced form validation

## Analytics (Recommended)

Track these events for optimization:
- `onboarding_started`
- `onboarding_step_completed` (with step number)
- `onboarding_completed`
- `onboarding_abandoned` (with last step)
- `organization_created`

