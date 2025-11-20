# Lottie Animations Setup Guide

## Overview

The site builder uses Lottie animations to show visual feedback during different processing steps. Currently, fallback icons are used, but you can add custom Lottie animations from [lottiefiles.com](https://lottiefiles.com).

## How to Add Lottie Animations

### Step 1: Find Animations on LottieFiles

1. Go to [lottiefiles.com](https://lottiefiles.com)
2. Search for animations that match each processing step:
   - **Initializing**: Loading, setup, or initialization animations
   - **Analyzing**: Thinking, processing, or analysis animations
   - **Generating**: Creation, building, or generation animations
   - **Deploying**: Upload, publish, or deployment animations
   - **Finalizing**: Completion, finishing touches animations
   - **Complete**: Success, checkmark, or celebration animations

### Step 2: Get the Animation URL

1. Click on an animation you like
2. Click "Use" or "Download"
3. Choose "Lottie JSON URL" or "Hosted URL"
4. Copy the URL (e.g., `https://lottie.host/embed/xxxxx.json`)

### Step 3: Add to ProcessingStepAnimation Component

Edit `app/src/components/site-builder/processing-step-animation.tsx`:

```typescript
const stepConfig: Record<ProcessingStep, {...}> = {
  initializing: {
    label: "Initializing",
    description: "Setting up your website...",
    lottieUrl: "https://lottie.host/embed/YOUR_ANIMATION_ID.json", // Add your URL here
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  // ... repeat for other steps
};
```

## Recommended Animation Types

- **Initializing**: Spinner, loading circle, or setup animations
- **Analyzing**: Brain, search, or analysis icons
- **Generating**: Magic wand, sparkles, or creation animations
- **Deploying**: Rocket, upload, or publishing animations
- **Finalizing**: Checkmark, polish, or finishing animations
- **Complete**: Success checkmark, celebration, or done animations

## Example Animation URLs

You can use these free animations from LottieFiles:

- **Loading/Spinner**: Search "loading" or "spinner"
- **Success**: Search "success" or "checkmark"
- **Processing**: Search "processing" or "thinking"
- **Deploy**: Search "upload" or "rocket"

## Testing

After adding animations:
1. Create a new website
2. Watch the processing steps
3. Verify animations play correctly
4. Check that fallback icons still work if animation fails to load

