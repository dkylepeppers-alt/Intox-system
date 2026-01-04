// Intox-system extension
// Tracks intoxication/arousal per character in the current chat and injects a single
// SYSTEM extension prompt via setExtensionPrompt(extension_prompt_types.IN_CHAT).
//
// Note: manifest.json intentionally unchanged.

/* global SillyTavern */

(() => {
  'use strict';

  // -----------------------------
  // Imports / API access helpers
  // -----------------------------
  const ST = (typeof window !== 'undefined' ? window.SillyTavern : undefined);

  // SillyTavern exposes these in the extension context in recent builds.
  // We guard access to avoid hard failures if the host changes.
  const extension_prompt_types = (ST && ST.extension_prompt_types) || (window.extension_prompt_types ?? {
    IN_CHAT: 'in_chat',
  });

  // setExtensionPrompt is how extensions inject prompts.
  const setExtensionPrompt = (ST && ST.setExtensionPrompt) || window.setExtensionPrompt;

  // A small storage namespace to avoid collisions.
  const STORAGE_KEY = 'intox_system_v2_state';

  // One prompt key so we always overwrite the same injected prompt (ensures single SYSTEM prompt).
  const PROMPT_KEY = 'intox-system:state';

  // -----------------------------
  // State model
  // -----------------------------
  /**
   * state = {
   *   chats: {
   *     [chatId]: {
   *       characters: {
   *         [characterKey]: { name, intoxication, arousal, updatedAt }
   *       }
   *     }
   *   },
   *   ui: { lastKnownChatId }
   * }
   */
  let state = loadState();

  function now() {
    return Date.now();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { chats: {}, ui: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { chats: {}, ui: {} };
      parsed.chats ||= {};
      parsed.ui ||= {};
      return parsed;
    } catch {
      return { chats: {}, ui: {} };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // Chat + character discovery
  // -----------------------------
  function getCurrentChatId() {
    // SillyTavern has multiple internal getters across versions.
    // We try a few common ones.
    try {
      if (ST?.getCurrentChatId) return ST.getCurrentChatId();
      if (ST?.chat?.id) return ST.chat.id;
      if (window?.chat_metadata?.chat_id) return window.chat_metadata.chat_id;
      if (window?.currentChatId) return window.currentChatId;
    } catch {
      // ignore
    }
    // Fallback to a single global bucket.
    return 'default';
  }

  function normalizeCharacterKey(name) {
    // stable key from name; keep readable.
    return String(name || 'Unknown').trim().toLowerCase();
  }

  function discoverCharactersInChat() {
    // Goal: return array of { key, name } for all characters present.
    // We attempt to read ST chat context; otherwise we parse the visible chat DOM.
    const out = new Map();

    // 1) ST exposed chat messages (common)
    try {
      const messages = ST?.chat?.messages || window?.chat || window?.chat_messages;
      if (Array.isArray(messages)) {
        for (const m of messages) {
          const name = m?.name || m?.character_name || m?.author || m?.from;
          if (!name) continue;
          const key = normalizeCharacterKey(name);
          out.set(key, { key, name: String(name) });
        }
      }
    } catch {
      // ignore
    }

    // 2) ST exposed character list (party / group)
    try {
      const char = ST?.getCurrentCharacter?.() || ST?.character;
      if (char?.name) {
        const key = normalizeCharacterKey(char.name);
        out.set(key, { key, name: String(char.name) });
      }

      const group = ST?.getGroupMembers?.() || ST?.group?.members;
      if (Array.isArray(group)) {
        for (const c of group) {
          const name = c?.name;
          if (!name) continue;
          const key = normalizeCharacterKey(name);
          out.set(key, { key, name: String(name) });
        }
      }
    } catch {
      // ignore
    }

    // 3) DOM parse as last resort
    try {
      const nodes = document.querySelectorAll('[data-author], .mes .name, .message .name, .mes .ch_name');
      nodes.forEach((n) => {
        const name = n.getAttribute('data-author') || n.textContent;
        if (!name) return;
        const key = normalizeCharacterKey(name);
        out.set(key, { key, name: String(name).trim() });
      });
    } catch {
      // ignore
    }

    // Ensure at least a fallback for the "character" and "user" if nothing detected.
    if (out.size === 0) {
      out.set('character', { key: 'character', name: 'Character' });
    }

    return [...out.values()];
  }

  function getChatBucket(chatId) {
    state.chats[chatId] ||= { characters: {} };
    state.chats[chatId].characters ||= {};
    return state.chats[chatId];
  }

  function ensureCharacterEntry(chatId, character) {
    const bucket = getChatBucket(chatId);
    const existing = bucket.characters[character.key];
    if (existing) {
      // keep the latest display name
      existing.name = character.name;
      return existing;
    }
    bucket.characters[character.key] = {
      name: character.name,
      intoxication: 0,
      arousal: 0,
      updatedAt: now(),
    };
    return bucket.characters[character.key];
  }

  // -----------------------------
  // Prompt composition + injection
  // -----------------------------
  function clamp01(x) {
    const n = Number(x);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function buildSystemPrompt(chatId) {
    const bucket = getChatBucket(chatId);
    const chars = Object.entries(bucket.characters)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const lines = [];
    lines.push('EXTENSION: Intox-system');
    lines.push('The following per-character states apply for this chat. Treat them as an always-on condition.');
    lines.push('Interpretation guidelines:');
    lines.push('- intoxication: 0-100 (0 sober, 100 extremely intoxicated).');
    lines.push('- arousal: 0-100 (0 none, 100 extremely aroused).');
    lines.push('- These are descriptive constraints; reflect them in behavior, dialogue, and narration appropriately.');
    lines.push('');

    for (const c of chars) {
      const intox = clamp01(c.intoxication);
      const ar = clamp01(c.arousal);
      lines.push(`${c.name}: intoxication=${intox}, arousal=${ar}`);
    }

    return lines.join('\n');
  }

  function injectPromptForChat(chatId) {
    if (typeof setExtensionPrompt !== 'function') return;

    const prompt = buildSystemPrompt(chatId);

    // Ensure we always inject exactly one prompt by using a stable key.
    // The host API typically supports: setExtensionPrompt(key, prompt, type, role)
    // but signatures vary. We'll try common variants.
    try {
      // Newer: setExtensionPrompt(key, prompt, { type, role })
      setExtensionPrompt(PROMPT_KEY, prompt, {
        type: extension_prompt_types.IN_CHAT,
        role: 'system',
      });
      return;
    } catch {
      // ignore and try older signatures
    }

    try {
      // Older: setExtensionPrompt(key, prompt, type, role)
      setExtensionPrompt(PROMPT_KEY, prompt, extension_prompt_types.IN_CHAT, 'system');
      return;
    } catch {
      // ignore
    }

    try {
      // Fallback: setExtensionPrompt(prompt, type)
      setExtensionPrompt(prompt, extension_prompt_types.IN_CHAT);
    } catch {
      // ignore
    }
  }

  // -----------------------------
  // Settings UI
  // -----------------------------
  const UI_ID = 'intox-system-settings';

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of Array.isArray(children) ? children : [children]) {
      if (c == null) continue;
      if (c instanceof Node) e.appendChild(c);
      else e.appendChild(document.createTextNode(String(c)));
    }
    return e;
  }

  function findSettingsContainer() {
    // Common ST containers for extension settings.
    return (
      document.querySelector('#extensions_settings') ||
      document.querySelector('#extensions-settings') ||
      document.querySelector('#extension_settings') ||
      document.querySelector('#settings_extensions') ||
      document.querySelector('#settings') ||
      document.body
    );
  }

  function renderUI() {
    const chatId = getCurrentChatId();
    const chars = discoverCharactersInChat();
    const bucket = getChatBucket(chatId);

    // Ensure entries exist.
    for (const c of chars) ensureCharacterEntry(chatId, c);
    saveState();

    const container = findSettingsContainer();
    if (!container) return;

    let root = document.getElementById(UI_ID);
    if (!root) {
      root = el('div', { id: UI_ID, class: 'intox-system-extension' });
      root.appendChild(el('hr'));
      root.appendChild(el('h3', {}, 'Intox-system (per character)'));
      root.appendChild(
        el(
          'div',
          { class: 'note', style: 'opacity:0.85;font-size:0.9em;line-height:1.3;margin-bottom:8px;' },
          'Tracks intoxication/arousal per character in this chat and injects a single SYSTEM prompt (IN_CHAT).'
        )
      );
      container.appendChild(root);
    }

    // Rebuild table content each render.
    root.querySelectorAll('.intox-system-body').forEach((n) => n.remove());

    const body = el('div', { class: 'intox-system-body' });

    const controls = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px 0;' });
    controls.appendChild(
      el('button', {
        type: 'button',
        onclick: () => {
          // Re-scan characters and re-render.
          renderUI();
          injectPromptForChat(getCurrentChatId());
        },
      }, 'Refresh characters')
    );
    controls.appendChild(
      el('button', {
        type: 'button',
        onclick: () => {
          const b = getChatBucket(getCurrentChatId());
          for (const k of Object.keys(b.characters)) {
            b.characters[k].intoxication = 0;
            b.characters[k].arousal = 0;
            b.characters[k].updatedAt = now();
          }
          saveState();
          renderUI();
          injectPromptForChat(getCurrentChatId());
        },
      }, 'Reset all to 0')
    );
    body.appendChild(controls);

    const table = el('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

    const sorted = Object.entries(bucket.characters)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    for (const c of sorted) {
      const row = el('div', {
        style: 'border:1px solid rgba(255,255,255,0.12);padding:10px;border-radius:8px;'
      });

      row.appendChild(el('div', { style: 'font-weight:600;margin-bottom:8px;' }, c.name));

      const grid = el('div', { style: 'display:grid;grid-template-columns: 120px 1fr 60px;gap:8px;align-items:center;' });

      function makeSlider(label, field) {
        const value = clamp01(c[field]);

        const labelEl = el('div', { style: 'opacity:0.9;' }, label);
        const input = el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(value) });
        const num = el('input', { type: 'number', min: '0', max: '100', step: '1', value: String(value), style: 'width:64px;' });

        function setVal(v) {
          const vv = clamp01(v);
          input.value = String(vv);
          num.value = String(vv);
          const chatId = getCurrentChatId();
          const b = getChatBucket(chatId);
          if (!b.characters[c.key]) b.characters[c.key] = { name: c.name, intoxication: 0, arousal: 0, updatedAt: now() };
          b.characters[c.key][field] = vv;
          b.characters[c.key].name = c.name;
          b.characters[c.key].updatedAt = now();
          saveState();
          injectPromptForChat(chatId);
        }

        input.addEventListener('input', () => setVal(input.value));
        num.addEventListener('change', () => setVal(num.value));

        grid.appendChild(labelEl);
        grid.appendChild(input);
        grid.appendChild(num);
      }

      makeSlider('Intoxication', 'intoxication');
      makeSlider('Arousal', 'arousal');

      row.appendChild(grid);

      const rowControls = el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;' });
      rowControls.appendChild(
        el('button', {
          type: 'button',
          onclick: () => {
            const chatId = getCurrentChatId();
            const b = getChatBucket(chatId);
            if (b.characters[c.key]) {
              b.characters[c.key].intoxication = 0;
              b.characters[c.key].arousal = 0;
              b.characters[c.key].updatedAt = now();
              saveState();
              renderUI();
              injectPromptForChat(chatId);
            }
          },
        }, 'Reset')
      );
      rowControls.appendChild(
        el('button', {
          type: 'button',
          onclick: () => {
            const chatId = getCurrentChatId();
            const b = getChatBucket(chatId);
            delete b.characters[c.key];
            saveState();
            renderUI();
            injectPromptForChat(chatId);
          },
        }, 'Forget')
      );
      row.appendChild(rowControls);

      table.appendChild(row);
    }

    body.appendChild(table);

    const promptPreview = el('details', { style: 'margin-top:10px;' }, [
      el('summary', {}, 'Injected SYSTEM prompt preview'),
      el('pre', { style: 'white-space:pre-wrap;opacity:0.9;border:1px dashed rgba(255,255,255,0.2);padding:10px;border-radius:8px;max-height:260px;overflow:auto;' }, buildSystemPrompt(chatId)),
    ]);

    body.appendChild(promptPreview);

    root.appendChild(body);
  }

  // -----------------------------
  // Lifecycle hooks
  // -----------------------------
  function reconcileAndInject() {
    const chatId = getCurrentChatId();
    state.ui.lastKnownChatId = chatId;

    const chars = discoverCharactersInChat();
    for (const c of chars) ensureCharacterEntry(chatId, c);
    saveState();

    injectPromptForChat(chatId);
    renderUI();
  }

  function installObservers() {
    // Re-render/inject on chat changes. Different ST versions emit different events;
    // we listen to a few, plus a MutationObserver as a fallback.
    const events = [
      'chat_changed',
      'CHAT_CHANGED',
      'character_selected',
      'CHARACTER_SELECTED',
      'group_updated',
      'GROUP_UPDATED',
      'message_added',
      'MESSAGE_ADDED',
      'settings_opened',
      'SETTINGS_OPENED',
    ];

    const bus = ST?.eventSource || ST?.events || window;
    if (bus?.addEventListener) {
      for (const evt of events) {
        try {
          bus.addEventListener(evt, () => reconcileAndInject());
        } catch {
          // ignore
        }
      }
    } else if (bus?.on) {
      for (const evt of events) {
        try {
          bus.on(evt, () => reconcileAndInject());
        } catch {
          // ignore
        }
      }
    }

    // Fallback DOM observer to detect chat swaps.
    try {
      const target = document.querySelector('#chat') || document.body;
      const mo = new MutationObserver(() => {
        const chatId = getCurrentChatId();
        if (chatId !== state.ui.lastKnownChatId) {
          reconcileAndInject();
        }
      });
      mo.observe(target, { childList: true, subtree: true });
    } catch {
      // ignore
    }
  }

  function init() {
    reconcileAndInject();
    installObservers();

    // Periodic safety re-injection (keeps single prompt up to date even if host resets prompts).
    setInterval(() => {
      try {
        injectPromptForChat(getCurrentChatId());
      } catch {
        // ignore
      }
    }, 5000);
  }

  // Startup after DOM ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
