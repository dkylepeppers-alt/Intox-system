# Intoxication & Arousal System

A SillyTavern extension that tracks intoxication and arousal levels through regex pattern matching on chat messages.

## Features

- Automatic drink detection from narrative text
- Progressive intoxication tiers (Sober -> Tipsy -> Buzzed -> Drunk -> Wasted)
- Arousal tracking based on exposure, touch, and embarrassment triggers
- Speech slurring generator
- Food consumption slows intoxication
- Time-based sobering
- Manual controls via settings panel

## Installation

1. In SillyTavern, go to Extensions
2. Click "Install Extension"
3. Paste: `https://github.com/YOUR_USERNAME/intox-system`
4. Reload

## Console Commands

Access via browser console:

```javascript
// Get current state
window.IntoxSystem.getState();

// Get current intoxication tier
window.IntoxSystem.getTier();

// Get prompt injection text
window.IntoxSystem.getInjection();

// Slur text based on current intoxication level
window.IntoxSystem.slur("Hello, how are you?");

// Generate laughter based on current level
window.IntoxSystem.laugh();

// Add drinks manually
window.IntoxSystem.addDrinks(2);

// Set arousal level (0-10)
window.IntoxSystem.setArousal(5);

// Set food buffer status
window.IntoxSystem.setEaten(true);

// Reset all values to zero
window.IntoxSystem.reset();
```
