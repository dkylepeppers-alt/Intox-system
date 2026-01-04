# Copilot Instructions for Intox-system

## Repository Overview

**Project Name**: Intoxication & Arousal System  
**Type**: SillyTavern Browser Extension (Client-side JavaScript)  
**Size**: ~4 files, 620 lines total, 220KB  
**Languages**: JavaScript (ES6 modules), CSS, JSON  
**Runtime**: Browser JavaScript environment (embedded in SillyTavern application)  
**Version**: 1.0.0

### What This Repository Does

This is a SillyTavern extension that tracks character intoxication and arousal levels through regex pattern matching on chat messages. It automatically detects drinks, food, time passage, and arousal triggers in narrative text, then injects state information into prompts to influence AI character behavior. Features include progressive intoxication tiers (Sober → Tipsy → Buzzed → Drunk → Wasted), speech slurring generation, and manual controls via a settings panel.

## Repository Structure

```
/
├── Index.js          (530 lines) - Main extension logic, pattern matching, state management
├── Style.css         (54 lines)  - Extension UI styling for settings panel
├── Manifest.json     (12 lines)  - Extension metadata and configuration
└── Readme            (24 lines)  - Installation and usage documentation
```

### Key File Purposes

- **Index.js**: Contains ALL extension logic including:
  - ES6 module imports from SillyTavern core (`extensions.js`, `script.js`)
  - Pattern matching regexes for drinks, food, arousal, and time triggers
  - State management (drinks count, arousal level, food buffer, timestamps)
  - 5-tier intoxication system with behavioral descriptions
  - Speech slurring generator (`slurSpeech()` function)
  - Laughter generation based on intoxication level
  - Settings panel UI creation and event handlers (jQuery-based)
  - Event listeners for MESSAGE_RECEIVED, MESSAGE_SENT, CHAT_CHANGED
  - Window API exposure (`window.IntoxSystem`) for console commands
  
- **Style.css**: CSS styling for the extension's settings panel using SillyTavern's CSS variables (`var(--SmartThemeBlurTintColor)`)

- **Manifest.json**: Extension metadata (display_name, version, loading_order: 100, file references)

- **Readme**: User-facing documentation with features, installation steps, and console command reference

## Build & Validation Process

### Important: No Build Process Required

This is a **client-side browser extension** with NO build, compile, test, or bundling steps. The files are loaded directly by SillyTavern at runtime.

### Validation Steps

**ALWAYS perform these validations before finalizing changes:**

1. **JavaScript Syntax Validation**:
   ```bash
   node -c Index.js
   ```
   - Must exit with code 0 (no output means success)
   - This is the ONLY validation command available
   - Run this EVERY time you modify Index.js

2. **Manual Code Review**:
   - Verify ES6 module imports remain unchanged (lines 1-2 of Index.js)
   - Check that regex patterns have proper escape sequences
   - Ensure jQuery selectors match HTML structure in `createSettingsPanel()`
   - Verify CSS uses existing SillyTavern CSS variables

### No Testing Infrastructure

- **No test files exist** - this is normal for browser extensions
- **No automated tests** - validation is manual and runtime-based
- **No package.json** - no npm dependencies
- **No linting config** - no ESLint, Prettier, or other linters configured
- **No CI/CD validation** - CodeQL workflow exists but doesn't validate functionality

### Runtime Environment

- **Target Browser**: Modern browsers (Chrome, Firefox, Edge) running SillyTavern
- **Dependencies**: jQuery (provided by SillyTavern), SillyTavern core APIs
- **Installation Path**: `scripts/extensions/third_party/intox-system/` (within SillyTavern)
- **Node Version** (for validation only): v20.19.6
- **NPM Version** (for validation only): 10.8.2

## Architecture & Code Organization

### Extension Entry Point

The extension initializes via `jQuery(async () => { ... })` at line 461, which:
1. Creates settings panel UI
2. Registers event listeners for message events
3. Logs successful load to console

### State Management

State is stored in `extension_settings[extensionName]` object (SillyTavern's persistence layer):
- `enabled` (boolean) - toggle tracking on/off
- `drinks` (number) - current drink count (0-10+)
- `arousal` (number) - arousal level (0-10)
- `hasEaten` (boolean) - food buffer flag
- `lastDrinkTimestamp` (timestamp) - for time-based decay

Changes are persisted via `saveSettingsDebounced()` from SillyTavern core.

### Pattern Matching System

Lines 21-60 define comprehensive regex patterns for:
- **Drinks**: strong (1.75x), standard (1x), multiple (2-6x), with quick/slow modifiers
- **Food**: eating actions that apply 0.75x drink absorption modifier
- **Arousal**: exposure, wardrobe malfunctions, attention, touch, embarrassment, aroused state
- **Time**: hour passage for sobering calculations

**CRITICAL**: All regexes use `/gi` flags (global, case-insensitive). The `resetPatterns()` function (line 119) must be called to reset `lastIndex` before reusing regexes.

### Intoxication Tiers

Lines 62-108 define 5 tiers (levels 0-4) with:
- Drink ranges: [0, 0.9], [1, 2.9], [3, 4.9], [5, 6.9], [7, ∞]
- Behavior, clothing state, speech pattern, and laughter descriptions
- Used for prompt injection and UI display

### Core Processing Flow

`processMessage(text, isUserMessage)` (line 130):
1. Reset all regex patterns
2. Check for food consumption (sets `hasEaten` flag)
3. Check for time passage (reduces drinks/arousal)
4. Detect drink modifiers (quick 1.5x, slow 0.75x)
5. Count drinks (multiple → strong → standard priority)
6. Apply food buffer if active (0.75x drinks)
7. Calculate arousal with intoxication multiplier
8. Save state and update UI

### UI Components

`createSettingsPanel()` (line 340) generates jQuery-based HTML with:
- Enable/disable checkbox
- Drink/arousal sliders (0-10, step 0.5)
- Current tier display
- Manual control buttons (+1 Drink, +1 Strong, -1 Hour, Reset All)
- Food buffer checkbox
- Collapsible drawer using `.inline-drawer` classes

### Public API

`window.IntoxSystem` object (line 489) exposes console commands:
- `getState()`, `getTier()`, `getInjection()`
- `slur(text)`, `laugh()`
- `addDrinks(n)`, `setArousal(n)`, `reset()`, `setEaten(val)`

## Common Pitfalls & Workarounds

### Issue: Regex Pattern Reuse
**Problem**: Global regexes maintain `lastIndex` state between matches, causing missed patterns  
**Solution**: ALWAYS call `resetPatterns()` before using patterns (see lines 133, 155, 176)

### Issue: Arithmetic Operators with Multiplication
**Problem**: Lines with multiplication operators like `hoursElapsed * 1` may look suspicious  
**Context**: These are intentional for clarity (line 158, 161, 181, etc.)

### Issue: Filename Case Mismatch
**Problem**: Manifest.json references `index.js` and `style.css` (lowercase) but actual files are `Index.js` and `Style.css` (capitalized)  
**Impact**: Works on case-insensitive filesystems (Windows, macOS) but may fail on Linux  
**Solution**: This is a pre-existing condition - maintain current casing when editing files

### Issue: Extension Not Loading
**Problem**: Extension fails to load in SillyTavern  
**Check**: 
- Verify `extensionFolderPath` matches actual install location (line 5)
- Note: Manifest.json references `index.js`/`style.css` but files are `Index.js`/`Style.css`
- Check browser console for import errors from lines 1-2

### Issue: Settings Not Persisting
**Problem**: State resets on page reload  
**Check**: Ensure `saveSettingsDebounced()` is called after state changes (appears 10+ times)

## GitHub Workflows

### CodeQL Security Scanning
- **Workflow**: `github-code-scanning/codeql` (dynamic path)
- **Purpose**: Security vulnerability analysis for JavaScript
- **Runs on**: Push and pull requests
- **Action**: Review CodeQL alerts in Security tab if triggered

### Copilot Coding Agent
- **Workflow**: `copilot-swe-agent/copilot` (dynamic path)  
- **Purpose**: Automated code review and suggestions
- **No action required**: Runs automatically on PRs

## Making Code Changes

### Before You Start
1. Read the Readme file to understand user-facing features
2. Examine Index.js structure (imports → constants → patterns → functions → initialization)
3. Identify which section to modify based on the issue

### Typical Change Patterns

**Adding a new drink pattern**:
- Add to `patterns.drinks.strong`, `.standard`, or `.multiple` arrays (lines 22-40)
- Include regex, value, and test with real chat messages

**Adding arousal triggers**:
- Add to `patterns.arousal` object (lines 47-54)
- Set appropriate base value in `processMessage()` arousal calculation (line 221)

**Modifying intoxication behavior**:
- Edit tier descriptions in `tiers` array (lines 62-108)
- Update speech slurring logic in `slurSpeech()` (lines 236-293)

**UI changes**:
- Modify HTML in `createSettingsPanel()` (lines 340-448)
- Update CSS in Style.css with matching selectors
- Use existing SillyTavern CSS variables for consistency

### After Making Changes
1. **ALWAYS** run: `node -c Index.js` to verify syntax
2. Manually review regex patterns for proper escaping
3. Check that all jQuery selectors match HTML structure
4. Verify state persistence calls (`saveSettingsDebounced()`) are present
5. Test manually by installing in SillyTavern (if possible)

## Critical Guidelines

1. **DO NOT** add build tools (Webpack, Babel, npm scripts) - this is a runtime-only extension
2. **DO NOT** add test frameworks - no testing infrastructure exists or is needed
3. **DO NOT** modify ES6 imports (lines 1-2) - these are SillyTavern core dependencies
4. **DO NOT** change `extensionFolderPath` (line 5) - hardcoded to SillyTavern's structure
5. **DO NOT** remove `resetPatterns()` calls - critical for regex reuse
6. **ALWAYS** validate JavaScript syntax with `node -c Index.js`
7. **ALWAYS** preserve existing jQuery patterns and SillyTavern API calls
8. **ALWAYS** maintain regex `/gi` flags for case-insensitive global matching
9. **TRUST** these instructions - only search for additional info if something is unclear or incorrect

## Quick Reference

**Validation**: `node -c Index.js` (must exit 0)  
**File Count**: 4 files  
**Main Logic**: Index.js (530 lines)  
**No Build**: Files run directly in browser  
**Dependencies**: jQuery, SillyTavern core APIs (external)  
**Testing**: Manual only, no automated tests  
**Architecture**: Event-driven, regex-based pattern matching  
**State**: Persisted via SillyTavern's `extension_settings`
