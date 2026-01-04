import { getContext, extension_settings, saveSettingsDebounced } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "intox-system";
const extensionFolderPath = `scripts/extensions/third_party/${extensionName}`;

const defaultSettings = {
 enabled: true,
 drinks: 0,
 arousal: 0,
 hasEaten: false,
 lastDrinkTimestamp: null
};

if (!extension_settings[extensionName]) {
 extension_settings[extensionName] = structuredClone(defaultSettings);
}

const settings = extension_settings[extensionName];

const patterns = {
 drinks: {
 strong: [
 { regex: /\b(downs?|drinks?|throws?\s+back|shoots?)\s+(a\s+)?(double|triple)\b/gi, value: 2 },
 { regex: /\b(downs?|drinks?|sips?)\s+(a\s+)?(whiskey|bourbon|vodka|tequila|rum|scotch|gin|brandy|absinthe|everclear)\b/gi, value: 1.75 },
 { regex: /\b(straight|neat)\s+(whiskey|vodka|bourbon|scotch|tequila|rum|gin)\b/gi, value: 1.75 }
 ],
 standard: [
 { regex: /\b(drinks?|sips?|finishes?|downs?|enjoys?)\s+(a\s+|another\s+|her\s+|his\s+|the\s+)?(beer|wine|cocktail|shot|martini|margarita|mojito|daiquiri|cosmopolitan|sangria|mimosa|bellini)\b/gi, value: 1 },
 { regex: /\b(glass|glasses)\s+of\s+(wine|champagne|prosecco|cava)\b/gi, value: 1 },
 { regex: /\b(orders?|gets?|grabs?)\s+(a\s+|another\s+|her\s+|his\s+)?(drink|round|refill)\b/gi, value: 1 },
 { regex: /\b(bottle\s+of\s+beer|pint|lager|ale|stout|pilsner)\b/gi, value: 1 }
 ],
 multiple: [
 { regex: /\b(two|2)\s+(shots?|drinks?|beers?|glasses?|rounds?)\b/gi, value: 2 },
 { regex: /\b(three|3)\s+(shots?|drinks?|beers?|glasses?|rounds?)\b/gi, value: 3 },
 { regex: /\b(four|4)\s+(shots?|drinks?|beers?|glasses?|rounds?)\b/gi, value: 4 },
 { regex: /\b(five|5)\s+(shots?|drinks?|beers?|glasses?|rounds?)\b/gi, value: 5 },
 { regex: /\b(six|6)\s+(shots?|drinks?|beers?|glasses?|rounds?)\b/gi, value: 6 }
 ],
 modifiers: {
 quick: /\b(chugs?|slams?|pounds?|throws?\s+back|knocks?\s+back|shoots?|guzzles?)\b/gi,
 slow: /\b(sips?|nurses?|savors?|tastes?)\b/gi
 }
 },
 food: /\b(eats?|munches?|nibbles?|chews?|swallows?|has\s+(some\s+)?food|grabs?\s+(a\s+)?bite|orders?\s+(some\s+)?(food|appetizer|meal|snack)|snacks?\s+on|dinner|lunch|breakfast)\b/gi,
 arousal: {
 exposure: /\b(exposes?|reveals?|flashes?|shows?\s+off?|bares?|unveils?|displays?)\s*(her|his)?\s*(breasts?|chest|underwear|panties|bra|skin|cleavage|thighs?|ass|nipples?|body|pussy|cock|dick)\b/gi,
 wardrobe: /\b(slips?\s+down|falls?\s+open|pops?\s+open|rides?\s+up|comes?\s+undone|strap\s+falls?|button\s+pops?|slides?\s+off|drops?\s+away|bunches?\s+up)\b/gi,
 attention: /\b(stares?\s+at|watches?|ogles?|eyes?\s+roam|gazes?\s+at|checks?\s+out|admires?|leers?\s+at|eyes\s+linger)\s*(her|his)?\s*(body|breasts?|chest|legs?|ass|curves?|figure|cleavage|thighs?)\b/gi,
 touch: /\b(touches?|strokes?|caresses?|gropes?|grabs?|squeezes?|fondles?|rubs?|kneads?|massages?)\s*(her|his)?\s*(breasts?|thighs?|ass|body|skin|chest|hips?|waist|back|neck|pussy|cock|dick)\b/gi,
 embarrassment: /\b(blushes?|flushes?|turns?\s+red|embarrassed|flustered|mortified|humiliated|cheeks?\s+(burn|redden|flush))\b/gi,
 aroused: /\b(aroused|turned\s+on|excited|wet|hard|throbbing|aching|needy|horny|lustful|wanting)\b/gi
 },
 time: {
 hourPass: /\b(an?\s+hour|one\s+hour|1\s+hour)\s+(passes?|later|goes?\s+by|elapses?)\b/gi,
 hoursPass: /\b(two|three|four|2|3|4)\s+hours?\s+(pass|later|go\s+by|elapse)\b/gi,
 longTime: /\b(several\s+hours|many\s+hours|much\s+later|next\s+(morning|day)|hours?\s+later)\b/gi
 }
};

const tiers = [
 {
 level: 0,
 name: "Sober",
 range: [0, 0.9],
 behavior: "Composed, articulate, modest. Laughs only at genuine humor.",
 clothing: "Clothing immaculate and properly arranged.",
 speech: "Clear and precise speech.",
 laughter: ""
 },
 {
 level: 1,
 name: "Tipsy",
 range: [1, 2.9],
 behavior: "Looser posture and speech. Chattier, makes riskier jokes. Giggles too easily.",
 clothing: "Minor clothing shifts: strap slipping, hem riding up, button undone. Notices and fixes with embarrassment.",
 speech: "Slight softening of consonants, occasional word mixing.",
 laughter: "Giggles frequently, sometimes at nothing funny."
 },
 {
 level: 2,
 name: "Buzzed",
 range: [3, 4.9],
 behavior: "Stumbles occasionally, slurring creeps in. Flirty, overshares personal details.",
 clothing: "Neckline drooping, skirt twisted, bra strap showing. Slow to notice, clumsy fixes make it worse.",
 speech: "Noticeable slurring, drops word endings, mixes up words.",
 laughter: "Laughs at anything, snorts occasionally, hiccups between giggles."
 },
 {
 level: 3,
 name: "Drunk",
 range: [5, 6.9],
 behavior: "Poor balance, heavy slurring. Uncontrollable giggle fits. Shameless and oblivious.",
 clothing: "Buttons popped, skirt hiked high, breast nearly escaping, underwear visible. Doesn't notice or care, flashes while gesturing.",
 speech: "Heavy slurring, words blend together, repeats herself.",
 laughter: "Uncontrollable giggle fits, snorting, hiccupping, tears from laughing."
 },
 {
 level: 4,
 name: "Wasted",
 range: [7, Infinity],
 behavior: "Barely functional, incoherent. Zero inhibition. Either cackling uncontrollably or weepy.",
 clothing: "Top removed or pulled down, skirt bunched at waist, underwear missing or fully displayed. Giggles through exposure, actively undresses claiming she's too hot.",
 speech: "Barely coherent, words scrambled, trails off mid-sentence.",
 laughter: "Breathless cackling, wheezing, tears streaming, cannot stop laughing."
 }
];

function getTier(drinkCount) {
 for (const tier of tiers) {
 if (drinkCount >= tier.range[0] && drinkCount <= tier.range[1]) {
 return tier;
 }
 }
 return tiers[tiers.length - 1];
}

function resetPatterns() {
 patterns.drinks.strong.forEach(p => p.regex.lastIndex = 0);
 patterns.drinks.standard.forEach(p => p.regex.lastIndex = 0);
 patterns.drinks.multiple.forEach(p => p.regex.lastIndex = 0);
 patterns.drinks.modifiers.quick.lastIndex = 0;
 patterns.drinks.modifiers.slow.lastIndex = 0;
 patterns.food.lastIndex = 0;
 Object.values(patterns.arousal).forEach(p => p.lastIndex = 0);
 Object.values(patterns.time).forEach(p => p.lastIndex = 0);
}

function processMessage(text, isUserMessage) {
 if (!settings.enabled || !text) return;

 resetPatterns();

 let drinksAdded = 0;
 let arousalAdded = 0;
 let hoursElapsed = 0;

 if (patterns.food.test(text)) {
 settings.hasEaten = true;
 console.log("[Intox] Food detected - slower intoxication");
 }
 patterns.food.lastIndex = 0;

 if (patterns.time.hourPass.test(text)) hoursElapsed += 1;
 if (patterns.time.hoursPass.test(text)) {
 const match = text.match(/\b(two|three|four|2|3|4)\s+hours?/i);
 if (match) {
 const numMap = { two: 2, three: 3, four: 4, "2": 2, "3": 3, "4": 4 };
 hoursElapsed += numMap[match[1].toLowerCase()] || 2;
 }
 }
 if (patterns.time.longTime.test(text)) hoursElapsed += 4;

 resetPatterns();

 if (hoursElapsed > 0) {
 const reduction = hoursElapsed* 1;*
 const oldDrinks = settings.drinks;
 settings.drinks = Math.max(0, settings.drinks - reduction);
 settings.arousal = Math.max(0, settings.arousal - (hoursElapsed *0.5));*
 if (hoursElapsed >= 2) settings.hasEaten = false;
 console.log(`[Intox] ${hoursElapsed}h passed. Drinks: ${oldDrinks.toFixed(1)} -> ${settings.drinks.toFixed(1)}`);
 }

 let drinkModifier = 1;
 if (patterns.drinks.modifiers.quick.test(text)) {
 drinkModifier = 1.5;
 console.log("[Intox] Quick drinking detected - amplified effect");
 }
 if (patterns.drinks.modifiers.slow.test(text)) {
 drinkModifier = 0.75;
 console.log("[Intox] Slow drinking detected - reduced effect");
 }

 resetPatterns();

 for (const pattern of patterns.drinks.multiple) {
 const matches = text.match(pattern.regex);
 if (matches) {
 drinksAdded += matches.length* pattern.value;*
 console.log(`[Intox] Multiple drinks detected: +${matches.length *pattern.value}`);*
 }
 }

 if (drinksAdded === 0) {
 for (const pattern of patterns.drinks.strong) {
 const matches = text.match(pattern.regex);
 if (matches) {
 drinksAdded += matches.length* pattern.value;*
 console.log(`[Intox] Strong drink detected: +${matches.length *pattern.value}`);*
 }
 }

 for (const pattern of patterns.drinks.standard) {
 const matches = text.match(pattern.regex);
 if (matches) {
 drinksAdded += matches.length* pattern.value;*
 console.log(`[Intox] Standard drink detected: +${matches.length *pattern.value}`);*
 }
 }
 }

 if (drinksAdded > 0) {
 drinksAdded*= drinkModifier;*
 if (settings.hasEaten) {
 drinksAdded *= 0.75;*
 console.log("[Intox] Food buffer applied");
 }
 settings.drinks += drinksAdded;
 settings.lastDrinkTimestamp = Date.now();
 console.log(`[Intox] Total drinks now: ${settings.drinks.toFixed(2)}`);
 }

 const currentTier = getTier(settings.drinks);
 const arousalMultiplier = 1 + (currentTier.level* 0.3);*

 for (const [type, pattern] of Object.entries(patterns.arousal)) {
 const matches = text.match(pattern);
 if (matches) {
 const baseArousal = matches.length *0.5;*
 arousalAdded += baseArousal* arousalMultiplier;*
 console.log(`[Intox] Arousal trigger (${type}): +${(baseArousal *arousalMultiplier).toFixed(2)}`);*
 }
 }

 if (arousalAdded > 0) {
 settings.arousal = Math.min(10, settings.arousal + arousalAdded);
 console.log(`[Intox] Total arousal now: ${settings.arousal.toFixed(2)}`);
 }

 saveSettingsDebounced();
 updateDisplay();
}

function slurSpeech(text, tierLevel) {
 if (tierLevel === 0 || !text) return text;

 let result = text;

 if (tierLevel >= 1) {
 result = result.replace(/\bthe\b/gi, "da");
 result = result.replace(/\bth(\w)/gi, "d$1");
 result = result.replace(/\bto\b/gi, "ta");
 }

 if (tierLevel >= 2) {
 result = result.replace(/ing\b/gi, "in'");
 result = result.replace(/\bwhat\b/gi, "whas");
 result = result.replace(/\byou\b/gi, "ya");
 result = result.replace(/\byour\b/gi, "yer");
 result = result.replace(/s\b/g, "sh");
 result = result.replace(/\bmy\b/gi, "mah");
 }

 if (tierLevel >= 3) {
 result = result.replace(/\bis\b/gi, "ish");
 result = result.replace(/\bthis\b/gi, "thish");
 result = result.replace(/\bthat\b/gi, "dat");
 result = result.replace(/\bwas\b/gi, "wash");
 result = result.replace(/ly\b/gi, "lyy");
 result = result.replace(/([bdfglmnprst])/gi, function(m) {
 return Math.random() > 0.75 ? m + m : m;
 });
 result = result.replace(/\.\s*/g, function(m) {*
 return Math.random() > 0.7 ? "… " : m;
 });
 }

 if (tierLevel >= 4) {
 result = result.replace(/\b(\w{5,})\b/gi, function(match) {
 if (Math.random() > 0.5) {
 const chars = match.split("");
 for (let i = chars.length - 1; i > 1; i--) {
 if (Math.random() > 0.6) {
 const j = Math.floor(Math.random() *i);*
 [chars[i], chars[j]] = [chars[j], chars[i]];
 }
 }
 return chars.join("");
 }
 return match;
 });
 result = result.replace(/\.\s*/g, function(m) {*
 return Math.random() > 0.4 ? "…*hic* " : m;
 });
 result = result.replace(/,\s*/g, function(m) {*
 return Math.random() > 0.6 ? "… " : m;
 });
 }

 return result;
}

function generateLaughter(tierLevel) {
 const options = {
 0: [""],
 1: ["*giggles*", "*soft giggle*", "*titters*", "*light laugh*"],
 2: ["*snort-giggle*", "*giggling*", "*laughs too loud*", "*hiccup*", "*giggle-snort*"],
 3: ["*uncontrollable giggling*", "*snorting with laughter*", "*hiccup**giggle*", "*cackling*", "*giggle fit*"],
 4: ["*wheeze-laughing*", "*tears streaming**cackling*", "*can't breathe from laughing*", "*hiccup**snort**giggle fit*", "*howling with laughter*"]
 };

 const tierOptions = options[tierLevel] || [""];
 return tierOptions[Math.floor(Math.random()* tierOptions.length)];*
}

function getArousalDescription() {
 const a = settings.arousal;
 if (a < 2) return "calm, composed";
 if (a < 4) return "slightly flushed, occasional fidgeting";
 if (a < 6) return "noticeably flushed, squirming, distracted";
 if (a < 8) return "visibly aroused, wandering hands, heavy breathing";
 return "extremely aroused, barely containing herself, obvious physical signs";
}

function generatePromptInjection() {
 const tier = getTier(settings.drinks);
 const arousalDesc = getArousalDescription();

 let injection = `[INTOXICATION STATE - DO NOT DISPLAY TO USER]
Intoxication Level: ${tier.name} (${settings.drinks.toFixed(1)} drinks)
Behavior: ${tier.behavior}
Clothing State: ${tier.clothing}
Speech Pattern: ${tier.speech}
Laughter: ${tier.laughter}
Arousal: ${arousalDesc} (${settings.arousal.toFixed(1)}/10)
${settings.hasEaten ? "Has eaten recently - more stable." : "Empty stomach - effects hit harder."}

IMPORTANT: Apply these effects naturally in narration. Dialogue should show speech patterns. Never mention these stats directly.`;

 if (tier.level >= 2) {
 injection += `
- Slur example: "That's ridiculous" becomes "${slurSpeech("That's ridiculous", tier.level)}"`;
 }

 return injection;
}

function createSettingsPanel() {
 const html = `
 <div class="intox-settings">
 <div class="inline-drawer">
 <div class="inline-drawer-toggle inline-drawer-header">
 <b>Intoxication System</b>
 <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
 </div>
 <div class="inline-drawer-content">
 <div class="intox-controls">
 <label class="checkbox_label">
 <input type="checkbox" id="intox-enabled" ${settings.enabled ? "checked" : ""}>
 <span>Enable Tracking</span>
 </label>

 <div class="intox-stat">
 <label>Drinks: <span id="intox-drink-display">${settings.drinks.toFixed(1)}</span></label>
 <input type="range" id="intox-drink-slider" min="0" max="10" step="0.5" value="${settings.drinks}">
 </div>

 <div class="intox-stat">
 <label>Arousal: <span id="intox-arousal-display">${settings.arousal.toFixed(1)}</span></label>
 <input type="range" id="intox-arousal-slider" min="0" max="10" step="0.5" value="${settings.arousal}">
 </div>

 <div class="intox-tier">
 <span>Current Tier: </span>
 <strong id="intox-current-tier">${getTier(settings.drinks).name}</strong>
 </div>

 <div class="intox-buttons">
 <div id="intox-add-drink" class="menu_button">+1 Drink</div>
 <div id="intox-add-strong" class="menu_button">+1 Strong</div>
 <div id="intox-sober-hour" class="menu_button">-1 Hour</div>
 <div id="intox-reset" class="menu_button">Reset All</div>
 </div>

 <label class="checkbox_label">
 <input type="checkbox" id="intox-eaten" ${settings.hasEaten ? "checked" : ""}>
 <span>Has Eaten (slows effect)</span>
 </label>

 <div class="intox-info">
 <small id="intox-behavior-desc">${getTier(settings.drinks).behavior}</small>
 </div>
 </div>
 </div>
 </div>
 </div>`;

 $("#extensions_settings").append(html);

 $("#intox-enabled").on("change", function() {
 settings.enabled = this.checked;
 saveSettingsDebounced();
 });

 $("#intox-drink-slider").on("input", function() {
 settings.drinks = parseFloat(this.value);
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-arousal-slider").on("input", function() {
 settings.arousal = parseFloat(this.value);
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-add-drink").on("click", function() {
 settings.drinks += 1;
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-add-strong").on("click", function() {
 settings.drinks += 1.75;
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-sober-hour").on("click", function() {
 settings.drinks = Math.max(0, settings.drinks - 1);
 settings.arousal = Math.max(0, settings.arousal - 0.5);
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-reset").on("click", function() {
 settings.drinks = 0;
 settings.arousal = 0;
 settings.hasEaten = false;
 $("#intox-eaten").prop("checked", false);
 updateDisplay();
 saveSettingsDebounced();
 });

 $("#intox-eaten").on("change", function() {
 settings.hasEaten = this.checked;
 saveSettingsDebounced();
 });

 $(".inline-drawer-toggle").on("click", function() {
 const icon = $(this).find(".inline-drawer-icon");
 const content = $(this).next(".inline-drawer-content");
 icon.toggleClass("down up");
 content.slideToggle(200);
 });
}

function updateDisplay() {
 const tier = getTier(settings.drinks);
 $("#intox-drink-display").text(settings.drinks.toFixed(1));
 $("#intox-arousal-display").text(settings.arousal.toFixed(1));
 $("#intox-drink-slider").val(settings.drinks);
 $("#intox-arousal-slider").val(settings.arousal);
 $("#intox-current-tier").text(tier.name);
 $("#intox-behavior-desc").text(tier.behavior);
 $("#intox-eaten").prop("checked", settings.hasEaten);
}

jQuery(async () => {
 createSettingsPanel();

 eventSource.on(event_types.MESSAGE_RECEIVED, (messageIndex) => {
 if (!settings.enabled) return;
 const context = getContext();
 const message = context.chat[messageIndex];
 if (message && message.mes) {
 processMessage(message.mes, false);
 }
 });

 eventSource.on(event_types.MESSAGE_SENT, (messageIndex) => {
 if (!settings.enabled) return;
 const context = getContext();
 const message = context.chat[messageIndex];
 if (message && message.mes) {
 processMessage(message.mes, true);
 }
 });

 eventSource.on(event_types.CHAT_CHANGED, () => {
 updateDisplay();
 });

 console.log("[Intox System] Extension loaded successfully");
});

window.IntoxSystem = {
 getState: function() {
 return {
 drinks: settings.drinks,
 arousal: settings.arousal,
 tier: getTier(settings.drinks),
 hasEaten: settings.hasEaten
 };
 },
 getTier: function() {
 return getTier(settings.drinks);
 },
 getInjection: generatePromptInjection,
 slur: function(text) {
 return slurSpeech(text, getTier(settings.drinks).level);
 },
 laugh: function() {
 return generateLaughter(getTier(settings.drinks).level);
 },
 addDrinks: function(n) {
 settings.drinks += n;
 updateDisplay();
 saveSettingsDebounced();
 },
 setArousal: function(n) {
 settings.arousal = Math.min(10, Math.max(0, n));
 updateDisplay();
 saveSettingsDebounced();
 },
 reset: function() {
 settings.drinks = 0;
 settings.arousal = 0;
 settings.hasEaten = false;
 updateDisplay();
 saveSettingsDebounced();
 },
 setEaten: function(val) {
 settings.hasEaten = !!val;
 $("#intox-eaten").prop("checked", settings.hasEaten);
 saveSettingsDebounced();
 }
};
