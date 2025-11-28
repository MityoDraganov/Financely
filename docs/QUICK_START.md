# Quick Start Guide - Real-time Collaborative Designer

## ⚠️ IMPORTANT: Prerequisites

### 1. Enable Firebase Realtime Database
**This is REQUIRED before anything will work!**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Realtime Database" in the left sidebar
4. Click "Create Database"
5. Choose a location (e.g., `us-central1`)
6. Start in **test mode** (we'll deploy proper rules next)

### 2. Deploy Database Rules
**REQUIRED - The app won't work without this step!**

```bash
# Make sure you're in the project root directory
firebase deploy --only database
```

You should see:
```
✔  Deploy complete!
✔  Database rules for YOUR_PROJECT published successfully
```

### 3. Verify Database is Working

Open your browser's developer console and look for these logs:
```
[RTDB] Subscribing to collection: templates with options: {orderBy: "orgId", equalTo: "demo-org"}
[RTDB] Collection update received: templates items: 0
```

If you see errors like `PERMISSION_DENIED`, go back to step 2 and deploy the rules again.

### 4. Start the Development Server
```bash
cd app
npm run dev
```

### 5. Test Collaborative Editing

#### Single Window Test:
1. Open http://localhost:5173 (or your dev server URL)
2. Navigate to the designer
3. Click "New" to create a template
4. Drag elements from the palette onto the canvas
5. Verify the green "Live" indicator appears

#### Multi-Window Test (Real Collaboration):
1. Open the designer in **two separate browser windows** (side by side)
2. In Window 1: Select or create a template
3. In Window 2: Select the **same template**
4. In Window 1: Drag an element - watch it appear in Window 2
5. In Window 2: Move the element - watch it update in Window 1
6. Test the snapping alignment - it works across both windows!

## Expected Behavior

### ✅ Working Features:
- ✅ Real-time element synchronization
- ✅ Live indicator shows connection status
- ✅ Snapping alignment (horizontal & vertical)
- ✅ All element types (text, image, table, box, line, input)
- ✅ Element properties update in real-time
- ✅ No authentication required (for development)

### 🔧 Known Limitations:
- ⚠️ Last-write-wins conflict resolution
- ⚠️ No user presence indicators (yet)
- ⚠️ No element locking (yet)

## Troubleshooting

### Problem: "Live" indicator doesn't appear
**Check these in order:**

1. **Is Realtime Database enabled?**
   - Go to Firebase Console → Realtime Database
   - If you see "Create Database", click it and create one

2. **Are the rules deployed?**
   ```bash
   firebase deploy --only database
   ```

3. **Check console logs:**
   - Open browser developer console
   - Look for: `[RTDB] Subscribing to collection: templates`
   - If you see `PERMISSION_DENIED`, the rules aren't deployed

4. **Verify database URL:**
   - Check `config.json` has correct database URL
   - Should look like: `https://YOUR-PROJECT.firebaseio.com`

### Problem: Changes don't sync between windows
**Check:**
1. Both windows are viewing the **same template** (check template name in dropdown)
2. Firebase Realtime Database is enabled
3. No errors in browser console
4. Internet connection is working

### Problem: Can't create templates
**Debugging steps:**

1. **Open browser console and watch for logs when you click "New":**
   - Expected logs:
     ```
     [CREATE] creating new template...
     [RTDB] Creating document at path: templates
     [RTDB] Pushing data with key: -XXXXX
     [RTDB] Document created successfully
     [CREATE] template created with id: -XXXXX
     [RTDB] Collection update received: templates items: 1
     ```

2. **If you see `PERMISSION_DENIED`:**
   - Deploy rules: `firebase deploy --only database`
   - Refresh the page

3. **If you see `[CREATE] failed to create template`:**
   - Check if Realtime Database is enabled in Firebase Console
   - Verify your `config.json` has the correct project configuration

4. **If templates create but don't appear:**
   - Check the console for `[RTDB] Collection update received`
   - Verify orgId matches (should be "demo-org")

### Problem: Authentication warnings in console
**This is normal!**
```
[AUTH] anonymous sign-in failed, continuing without auth
```
This warning is expected and won't affect functionality. The app continues without auth for development.

## Next Steps

### For Production:
1. **Enable Authentication:**
   - Go to Firebase Console → Authentication
   - Enable Anonymous Authentication
   - Update `database.rules.json` to require auth (see REALTIME_DESIGNER_MIGRATION.md)

2. **Migrate Existing Data:**
   - If you have templates in Firestore, run migration script
   - See REALTIME_DESIGNER_MIGRATION.md for details

3. **Security:**
   - Review and harden database rules
   - Add proper access controls
   - Consider adding rate limiting

### Future Enhancements:
- [ ] User presence (show who's editing)
- [ ] Element locking (prevent conflicts)
- [ ] Collaborative cursors
- [ ] Undo/redo with operational transforms
- [ ] Change history / audit log

## Support

For detailed information, see:
- `REALTIME_DESIGNER_MIGRATION.md` - Full migration guide
- Firebase Console - Monitor connections and data

## Demo Video Script

Want to show off the collaborative editing? Try this:

1. **Open two windows side by side**
2. **Window 1:** "Let me create a new template..."
3. **Window 2:** "...and open the same template here"
4. **Window 1:** "Watch as I add a text element..." (drag text)
5. **Window 2:** "It appears instantly in real-time!"
6. **Window 2:** "Now I'll move it..." (drag element)
7. **Window 1:** "And I see the change immediately!"
8. **Window 1:** "The snapping guides even work across windows..."
9. Both windows: "Notice the green 'Live' indicator showing we're connected"

Enjoy your new collaborative designer! 🎨✨

