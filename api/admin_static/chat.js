// JavaScript Logic for Local Code CLI - Claude.ai Styled UI

// Configuration State
let config = {
  auth_token: 'freecc',
  active_model: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b',
};
let sessions = [];
let currentSessionId = null;
let isGenerating = false;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const showSidebarBtn = document.getElementById('showSidebar');
const chatList = document.getElementById('chatList');
const newChatBtn = document.getElementById('newChatButton');
const clearChatBtn = document.getElementById('clearChatHistory');
const messageContainer = document.getElementById('messageContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendButton');
const activeModelBadge = document.getElementById('activeModelBadge');
const modelNameText = document.getElementById('modelNameText');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadSessionsFromStorage();
  if (typeof hljs !== 'undefined') {
    hljs.configure({ ignoreUnescapedHTML: true });
  }
  fetchSystemConfig().catch(err => console.error('Error loading config:', err));
});

// 1. Fetch System Settings from Proxy
async function fetchSystemConfig() {
  try {
    const res = await fetch('/admin/api/config');
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi');
    const data = await res.json();
    
    // Find active model and API token
    const modelField = data.fields.find(f => f.key === 'MODEL');
    const tokenField = data.fields.find(f => f.key === 'ANTHROPIC_AUTH_TOKEN');
    
    if (modelField && modelField.value) {
      config.active_model = modelField.value;
    }
    // Note: If token is masked ('********'), we will fetch the raw status token
    if (tokenField && tokenField.value && tokenField.value !== '********') {
      config.auth_token = tokenField.value;
    } else {
      // Fallback: request settings or use default 'freecc'
      const statusRes = await fetch('/admin/api/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.model) config.active_model = statusData.model;
      }
    }
    
    // Update badge & footer label
    activeModelBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      ${config.active_model}
    `;
    modelNameText.textContent = config.active_model;
  } catch (err) {
    console.error('Error loading config:', err);
    activeModelBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-500"></span>
      Offline / Gagal Memuat Model
    `;
    modelNameText.textContent = 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b (default)';
  }
}

// 2. Load and Save Sessions (localStorage)
function loadSessionsFromStorage() {
  try {
    const stored = localStorage.getItem('lc_sessions');
    if (stored) {
      sessions = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading localStorage', e);
  }
  
  if (sessions.length === 0) {
    createNewSession();
  } else {
    currentSessionId = sessions[0].id;
    renderSidebar();
    renderActiveSession();
  }
}

function saveSessionsToStorage() {
  localStorage.setItem('lc_sessions', JSON.stringify(sessions));
}

function createNewSession() {
  const newSession = {
    id: 'session_' + Date.now(),
    title: 'Percakapan Baru',
    messages: [],
    createdAt: new Date().toISOString()
  };
  sessions.unshift(newSession);
  currentSessionId = newSession.id;
  saveSessionsToStorage();
  renderSidebar();
  renderActiveSession();
}

// 3. Render Views
function renderSidebar() {
  chatList.innerHTML = '';
  sessions.forEach(session => {
    const link = document.createElement('div');
    link.className = `group sidebar-link flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition ${
      session.id === currentSessionId 
        ? 'active text-white' 
        : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`;
    
    // Left click targets session selection
    link.addEventListener('click', () => {
      if (isGenerating) return;
      currentSessionId = session.id;
      renderSidebar();
      renderActiveSession();
    });

    const titleContainer = document.createElement('span');
    titleContainer.className = 'truncate pr-2';
    titleContainer.textContent = session.title;
    link.appendChild(titleContainer);

    // Trash Button for deleting
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-slate-500 hover:text-red-400 transition-opacity';
    deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isGenerating) return;
      deleteSession(session.id);
    });
    link.appendChild(deleteBtn);

    chatList.appendChild(link);
  });
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  saveSessionsToStorage();
  
  if (sessions.length === 0) {
    createNewSession();
  } else {
    if (currentSessionId === id) {
      currentSessionId = sessions[0].id;
    }
    renderSidebar();
    renderActiveSession();
  }
}

function renderActiveSession() {
  // Clear container but keep header/input
  const listItems = messageContainer.querySelectorAll('.message-bubble');
  listItems.forEach(el => el.remove());

  const activeSession = sessions.find(s => s.id === currentSessionId);
  if (!activeSession || activeSession.messages.length === 0) {
    welcomeScreen.style.display = 'block';
    messageContainer.classList.add('justify-center');
    return;
  }

  welcomeScreen.style.display = 'none';
  messageContainer.classList.remove('justify-center');

  activeSession.messages.forEach(msg => {
    appendMessageHTML(msg.role, msg.content, msg.thinking);
  });
  
  scrollToBottom();
}

function appendMessageHTML(role, content, thinking = '') {
  welcomeScreen.style.display = 'none';
  messageContainer.classList.remove('justify-center');

  const wrapper = document.createElement('div');
  wrapper.className = 'message-bubble flex flex-col gap-2 w-full max-w-3xl mx-auto';

  if (role === 'user') {
    wrapper.innerHTML = `
      <div class="user-msg-wrapper flex flex-col items-end gap-1 group self-end max-w-[80%]">
        <div class="user-msg">
          ${escapeHTML(content).replace(/\n/g, '<br/>')}
        </div>
        <div class="msg-actions flex items-center gap-3 opacity-0 group-hover:opacity-100 transition duration-150 text-[10px] text-slate-500 mr-1 mt-0.5">
          <button class="copy-msg-btn flex items-center gap-1 hover:text-white transition duration-150" title="Salin Pesan">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Salin
          </button>
          <button class="resend-msg-btn flex items-center gap-1 hover:text-white transition duration-150" title="Kirim Ulang">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            Kirim Ulang
          </button>
        </div>
      </div>
    `;
  } else {
    // Generate markup for assistant with markdown parsing
    const markedContent = content ? marked.parse(content) : '';
    const thinkingBlock = thinking ? `<div class="thinking-block">💭 <strong>Berpikir:</strong><br/>${escapeHTML(thinking).replace(/\n/g, '<br/>')}</div>` : '';
    
    wrapper.innerHTML = `
      <div class="assistant-msg-wrapper flex flex-col gap-1 group w-full">
        <div class="assistant-msg flex items-start gap-4">
          <div class="assistant-avatar shrink-0 mt-1">LC</div>
          <div class="flex-1 overflow-hidden">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Local Code CLI</div>
            ${thinkingBlock}
            <div class="prose-custom max-w-none text-[#f1f5f9]">${markedContent}</div>
          </div>
        </div>
        <div class="msg-actions flex items-center gap-2 opacity-0 group-hover:opacity-100 transition duration-150 text-[10px] text-slate-500 ml-12 mt-1">
          <button class="copy-msg-btn flex items-center gap-1 hover:text-white transition duration-150" title="Salin Jawaban">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Salin Jawaban
          </button>
        </div>
      </div>
    `;
    // Attach event listeners for syntax highlighting and copy buttons
    setupCodeBlockDecorations(wrapper);
  }

  // Register action button listeners
  const copyBtn = wrapper.querySelector('.copy-msg-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      navigator.clipboard.writeText(content).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="emerald" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-600 font-bold">Tersalin!</span>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      });
    });
  }

  const resendBtn = wrapper.querySelector('.resend-msg-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      // Put message into input and send
      chatInput.value = content;
      chatInput.dispatchEvent(new Event('input'));
      sendMessage();
    });
  }

  messageContainer.appendChild(wrapper);
}

// 4. Input Textarea Auto-growth
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = (chatInput.scrollHeight) + 'px';
  sendBtn.disabled = !chatInput.value.trim();
});

// Fill Suggestion Helper
window.fillSuggestion = (text) => {
  chatInput.value = text;
  chatInput.dispatchEvent(new Event('input'));
  chatInput.focus();
};

// 5. Setup Action Event Listeners
function setupEventListeners() {
  // Toggle Sidebar
  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    showSidebarBtn.classList.remove('hidden');
  });

  showSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    showSidebarBtn.classList.add('hidden');
  });

  // New Chat
  newChatBtn.addEventListener('click', () => {
    if (isGenerating) return;
    createNewSession();
  });

  // Clear Chat History
  clearChatBtn.addEventListener('click', () => {
    if (isGenerating) return;
    const activeSession = sessions.find(s => s.id === currentSessionId);
    if (activeSession) {
      activeSession.messages = [];
      activeSession.title = 'Percakapan Baru';
      saveSessionsToStorage();
      renderSidebar();
      renderActiveSession();
    }
  });

  // Textarea Send Triggers
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

// 6. Streaming Message Core Implementation
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isGenerating) return;

  isGenerating = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  // 1. Save User Message to state and DOM
  const activeSession = sessions.find(s => s.id === currentSessionId);
  if (!activeSession) return;
  
  if (activeSession.messages.length === 0) {
    // Set title based on first query
    activeSession.title = text.length > 25 ? text.substring(0, 25) + '...' : text;
  }
  
  activeSession.messages.push({ role: 'user', content: text });
  saveSessionsToStorage();
  renderSidebar();
  appendMessageHTML('user', text);
  scrollToBottom();

  // 2. Prepare Assistant DOM Placeholder
  const wrapper = document.createElement('div');
  wrapper.className = 'message-bubble flex flex-col gap-2 w-full max-w-3xl mx-auto';
  wrapper.innerHTML = `
    <div class="assistant-msg flex items-start gap-4">
      <div class="assistant-avatar shrink-0 mt-1">LC</div>
      <div class="flex-1 overflow-hidden">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Local Code CLI</div>
        <div class="thinking-container"></div>
        <div class="prose-custom max-w-none text-[#f1f5f9]"></div>
        <div class="initial-loader flex items-center gap-2 text-xs text-slate-500 font-semibold mt-2">
          <div class="flex gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 300ms"></span>
          </div>
          <span>Menghubungkan ke agen...</span>
        </div>
      </div>
    </div>
  `;
  messageContainer.appendChild(wrapper);
  scrollToBottom();

  const thinkingContainer = wrapper.querySelector('.thinking-container');
  const proseContainer = wrapper.querySelector('.prose-custom');

  // Streaming buffers
  let assistantText = '';
  let thinkingText = '';
  let inThinkingBlock = false;
  let hasStartedStreaming = false;

  const removeInitialLoader = () => {
    if (!hasStartedStreaming) {
      hasStartedStreaming = true;
      const loader = wrapper.querySelector('.initial-loader');
      if (loader) loader.remove();
    }
  };

  const languageSelector = document.getElementById('languageSelector');
  const lang = languageSelector ? languageSelector.value : '';
  
  const systemInstructions = `[Sistem Info: Anda berjalan secara lokal di laptop user menggunakan Claude Code CLI. Anda memiliki akses penuh ke sistem lokal via tool terminal/command execution untuk membaca/menulis file, menjalankan script, dan membuka aplikasi lokal (seperti Notepad, browser, VS Code, dll.) dengan perintah shell/terminal. Anda juga memiliki tool pencarian/akses web (web_search, web_fetch) untuk mengambil info dari internet secara langsung tanpa membuka jendela browser baru di layar. Jangan pernah menolak dengan alasan keterbatasan AI cloud; selalu gunakan tool terminal/web Anda secara langsung untuk memenuhi permintaan user]`;

  let finalPrompt = `${systemInstructions} ${text}`;
  if (lang === 'id') {
    finalPrompt = `${systemInstructions} [PENTING: Jawablah seluruh respon/penjelasan Anda dalam Bahasa Indonesia. Harap pertahankan penulisan blok kode pemrograman, nama variabel, dan perintah terminal dalam bentuk aslinya tanpa diterjemahkan] ${text}`;
  } else if (lang === 'ja') {
    finalPrompt = `${systemInstructions} [IMPORTANT: Please write your entire response/explanation in Japanese. Do not translate code blocks, variables, or terminal command structures—only translate conversational text and explanations.] ${text}`;
  } else if (lang === 'en') {
    finalPrompt = `${systemInstructions} [IMPORTANT: Write your entire response/explanation in English. Keep code blocks and markdown format intact.] ${text}`;
  }

  const isAgentMode = true;
  const requestUrl = '/admin/api/agent/run';
  const requestBody = {
    prompt: finalPrompt,
    session_id: activeSession.agent_session_id || null
  };

  try {
    // 3. Make HTTP request to local proxy API
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-auth-token': config.auth_token
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Gagal memproses request chat`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Hold onto incomplete lines

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.replace('data:', '').trim();
          if (jsonStr === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(jsonStr);
            
            if (isAgentMode) {
              // Parse CLI specific events
              if (parsed.type === 'session_info') {
                activeSession.agent_session_id = parsed.session_id;
                saveSessionsToStorage();
              } else if (parsed.type === 'text_delta' || parsed.type === 'text_chunk') {
                removeInitialLoader();
                assistantText += parsed.text;
                // Temporarily clear any blinking cursor element when rendering markdown
                proseContainer.innerHTML = marked.parse(assistantText);
                setupCodeBlockDecorations(wrapper);
              } else if (parsed.type === 'thinking_delta' || parsed.type === 'thinking_chunk') {
                removeInitialLoader();
                if (!inThinkingBlock) {
                  inThinkingBlock = true;
                  thinkingContainer.innerHTML = `<div class="thinking-block">💭 <strong>Berpikir:</strong><br/><span class="thinking-text-area"></span></div>`;
                }
                thinkingText += parsed.text;
                thinkingContainer.querySelector('.thinking-text-area').innerHTML = escapeHTML(thinkingText).replace(/\n/g, '<br/>');
              } else if (parsed.type === 'tool_use_start' || parsed.type === 'tool_use') {
                removeInitialLoader();
                const toolId = parsed.id || 'tool_' + Date.now();
                const toolName = parsed.name || 'tool';
                const toolInput = parsed.input ? JSON.stringify(parsed.input, null, 2) : '';
                
                const toolDiv = document.createElement('div');
                toolDiv.id = `tool-${toolId}`;
                toolDiv.className = 'tool-execution-card my-3 flex flex-col gap-1';
                toolDiv.innerHTML = `
                  <div class="flex items-center gap-2 text-indigo-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
                    <span><strong>Menjalankan Tool:</strong> <code class="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[11px]">${escapeHTML(toolName)}</code></span>
                    <span class="text-[10px] text-slate-500 font-medium">(ID: ${toolId})</span>
                  </div>
                  ${toolInput ? `<pre class="mt-2 text-[10px] text-slate-400 bg-black/40 p-2.5 rounded-lg border border-white/5 overflow-x-auto max-h-32 whitespace-pre-wrap font-mono">${escapeHTML(toolInput)}</pre>` : ''}
                `;
                proseContainer.appendChild(toolDiv);
              } else if (parsed.type === 'tool_result') {
                const toolId = parsed.tool_use_id;
                const isError = parsed.is_error;
                const content = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content, null, 2);
                
                const toolDiv = document.getElementById(`tool-${toolId}`);
                if (toolDiv) {
                  const resultDiv = document.createElement('details');
                  resultDiv.className = 'mt-2 border-t border-white/5 pt-2 cursor-pointer';
                  resultDiv.innerHTML = `
                    <summary class="text-[10px] ${isError ? 'text-rose-400' : 'text-slate-400'} font-bold uppercase tracking-wider hover:text-white select-none flex items-center gap-1.5">
                      <span>${isError ? '❌ Error Result' : '📤 Output Result'}</span>
                      <span class="text-[9px] text-slate-600 font-medium lowercase">(klik untuk membuka)</span>
                    </summary>
                    <pre class="mt-2 p-2.5 text-[10px] text-slate-400 bg-black/40 rounded-lg border border-white/5 overflow-x-auto max-h-40 whitespace-pre-wrap font-mono">${escapeHTML(content)}</pre>
                  `;
                  toolDiv.appendChild(resultDiv);
                }
              } else if (parsed.type === 'error') {
                removeInitialLoader();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'text-red-500 font-semibold text-xs my-2';
                errorDiv.textContent = `❌ Error: ${parsed.message}`;
                proseContainer.appendChild(errorDiv);
              }
            } else {
              // Process standard Anthropic chat event chunks
              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta;
                if (delta && delta.type === 'text_delta') {
                  removeInitialLoader();
                  assistantText += delta.text;
                  proseContainer.innerHTML = marked.parse(assistantText);
                  setupCodeBlockDecorations(wrapper);
                } else if (delta && delta.type === 'thinking_delta') {
                  removeInitialLoader();
                  if (!inThinkingBlock) {
                    inThinkingBlock = true;
                    thinkingContainer.innerHTML = `<div class="thinking-block">💭 <strong>Berpikir:</strong><br/><span class="thinking-text-area"></span></div>`;
                  }
                  thinkingText += delta.thinking;
                  thinkingContainer.querySelector('.thinking-text-area').innerHTML = escapeHTML(thinkingText).replace(/\n/g, '<br/>');
                }
              }
            }
          } catch (e) {
            // Safe to skip chunk parse errors
          }
        }
      }
      scrollToBottom();
    }

    // 4. Finalize & Save assistant response
    activeSession.messages.push({ 
      role: 'assistant', 
      content: assistantText, 
      thinking: thinkingText 
    });
    saveSessionsToStorage();
  } catch (err) {
    console.error('Chat error:', err);
    proseContainer.innerHTML = `<p class="text-red-500 font-medium">⚠️ Error: ${escapeHTML(err.message)}</p>`;
  } finally {
    isGenerating = false;
    sendBtn.disabled = !chatInput.value.trim();
    chatInput.focus();
  }
}

// 7. Decorations & Helpers
function setupCodeBlockDecorations(parentEl) {
  // Format code blocks using marked.js wrappers
  const preElements = parentEl.querySelectorAll('pre');
  preElements.forEach(pre => {
    // Prevent double wrapping
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const codeEl = pre.querySelector('code');
    const lang = codeEl ? Array.from(codeEl.classList).find(c => c.startsWith('language-'))?.replace('language-', '') || 'code' : 'code';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="copy-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        Salin Kode
      </button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    // Apply syntax highlighting
    if (codeEl && typeof hljs !== 'undefined') hljs.highlightElement(codeEl);

    // Attach click listener for copying
    header.querySelector('.copy-button').addEventListener('click', (e) => {
      const codeText = codeEl ? codeEl.textContent : '';
      navigator.clipboard.writeText(codeText).then(() => {
        const btn = e.currentTarget;
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="emerald" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-500">Tersalin!</span>
        `;
        setTimeout(() => {
          btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Salin Kode
          `;
        }, 2000);
      });
    });
  });
}

function scrollToBottom() {
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
