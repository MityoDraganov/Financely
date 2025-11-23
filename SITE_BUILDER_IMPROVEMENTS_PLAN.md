# Site Builder Improvements Plan

## Immediate Fixes (Issues 1-5)

### 1. Navigation Structure
- **Problem**: Navigation doesn't have clear structure
- **Solution**: 
  - Improve navigation markup with better semantic HTML
  - Add proper ARIA labels
  - Better mobile menu structure
  - Consistent spacing and alignment

### 2. Color Pairing & Contrast
- **Problem**: Poor color contrast and pairing
- **Solution**:
  - Add explicit contrast ratio requirements (WCAG AA minimum)
  - Calculate proper text colors based on background
  - Use design tokens for consistent color usage
  - Add color validation in prompt

### 3. Brand Color Usage
- **Problem**: Some elements don't use brand colors
- **Solution**:
  - Enforce brand color usage in all interactive elements
  - Use CSS custom properties for brand colors
  - Add explicit instructions to use brand colors for buttons, links, accents

### 4. Element Positioning
- **Problem**: Weird positioning of elements
- **Solution**:
  - Add explicit layout guidelines (grid/flexbox)
  - Consistent spacing system
  - Better responsive breakpoints
  - Clear positioning rules

### 5. Prevent AI Hallucination
- **Problem**: AI creates fake data/content
- **Solution**:
  - Add strict "NO HALLUCINATION" rules to prompt
  - Only use provided data
  - If data is missing, use placeholders or ask user
  - Add validation checks

## Major Rework: Chat-Based AI Builder (Issue 6)

### Architecture Overview
- **Frontend**: Chat interface component
- **Backend**: Chat-based generation function
- **State Management**: Conversation history, context, attachments
- **Editing**: Incremental HTML editing (not full regeneration)

### Components Needed

#### 1. Chat Interface (`app/src/components/site-builder/ai-chat-builder.tsx`)
- Chat message list
- Input with photo attachments
- AI typing indicators
- Message history
- Context panel (showing current site state)

#### 2. Backend Chat Function (`functions/src/functions/chat-generate-site.ts`)
- Handles multi-turn conversations
- Maintains conversation context
- Processes incremental edits
- Handles photo attachments
- Can ask clarification questions

#### 3. Incremental Editing System
- Parse existing HTML
- Identify sections to edit
- Apply edits without regenerating entire page
- Preserve unchanged sections

#### 4. Photo Attachment System
- Upload multiple photos
- Store in Firebase Storage
- Pass URLs to AI with context
- Support drag-and-drop

### Flow
1. User opens chat interface
2. AI greets and asks initial questions
3. User provides context/photos
4. AI generates initial site
5. User requests changes via chat
6. AI asks clarifying questions if needed
7. AI applies incremental edits
8. User reviews and continues conversation

### Data Structure
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[]; // Photo URLs
  timestamp: string;
  metadata?: {
    editType?: 'full' | 'section' | 'style' | 'content';
    affectedSections?: string[];
  };
}

interface ChatContext {
  brandSiteId: string;
  currentHtml: string;
  conversationHistory: ChatMessage[];
  attachments: string[];
  organizationId: string;
}
```

