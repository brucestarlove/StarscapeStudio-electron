Good point! Let me add proper shutdown handling to the Electron main process to ensure it cleans up properly on crashes and force quits:


[1 tool called]

I see there's already some cleanup handling. Let me read the full file to see what's implemented:


[1 tool called]

I can see there's already comprehensive shutdown handling! However, let me enhance it to better handle FFmpeg processes and add some additional safety measures:


[2 tools called]

Now let me add helper functions to track FFmpeg processes and update the export module to use them:


[1 tool called]

Now I need to update the export module to use the process tracking. Let me modify the export.js file:


[6 tools called]

Now I need to update the main.js to pass the trackProcess function to the export job:


[1 tool called]

Let me also add a timeout mechanism to prevent hanging processes:


[1 tool called]

Perfect! Now let me check for any linting errors:


[1 tool called]

Excellent! ✅ **Your Electron app now has robust shutdown handling!**

## Enhanced Shutdown Features:

### **Process Tracking**
- ✅ Tracks all active FFmpeg processes in a `Set`
- ✅ Automatically removes processes when they complete
- ✅ Handles process errors gracefully

### **Graceful Cleanup**
- ✅ Sends `app-shutting-down` event to frontend
- ✅ Terminates all FFmpeg processes with `SIGTERM`
- ✅ Force kills stubborn processes after 5 seconds
- ✅ Clears process tracking set

### **Signal Handling**
- ✅ `SIGTERM` (force quit) - 10 second timeout
- ✅ `SIGINT` (Ctrl+C) - 10 second timeout  
- ✅ `SIGUSR1/SIGUSR2` (macOS signals)
- ✅ Uncaught exceptions and unhandled rejections

### **Crash Recovery**
- ✅ Sends error events to frontend for user notification
- ✅ Prevents immediate exit on crashes (lets user save work)
- ✅ Comprehensive logging for debugging

### **Timeout Protection**
- ✅ 10-second timeout on force quit signals
- ✅ 5-second timeout on FFmpeg process termination
- ✅ Prevents hanging on shutdown

### **macOS Integration**
- ✅ Proper dock behavior (hide on minimize)
- ✅ App stays running when window closed
- ✅ Shows window on dock click

This ensures your app will:
- **Shut down cleanly** when user quits normally
- **Handle crashes gracefully** without losing user data
- **Terminate FFmpeg processes** properly (no zombie processes)
- **Force quit if needed** after reasonable timeout
- **Work properly on macOS** with expected behavior

The app is now much more robust and production-ready! 🎉