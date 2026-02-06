// OpenClaw Standalone Chat
// Gateway WebSocket client

class GatewayClient {
    constructor(options) {
        this.url = options.url;
        this.token = options.token;
        this.password = options.password;
        this.clientName = options.clientName || 'webchat';
        this.clientVersion = options.clientVersion || '1.0.0';
        this.platform = options.platform || 'web';
        this.mode = options.mode || 'webchat';
        this.instanceId = options.instanceId || 'standalone-chat';
        this.sessionKey = options.sessionKey || 'main';

        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.pendingRequests = new Map();
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;

        this.onConnect = options.onConnect;
        this.onDisconnect = options.onDisconnect;
        this.onMessage = options.onMessage;
        this.onError = options.onError;
    }

    connect() {
        // Prevent multiple simultaneous connection attempts
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('Already connected or connecting, reusing existing connection');
            return;
        }

        // Clean up existing connection if any
        if (this.ws) {
            console.log('Closing existing WebSocket connection');
            try {
                this.ws.close();
            } catch (e) {
                console.warn('Error closing existing WebSocket:', e);
            }
            this.ws = null;
        }

        // Reset state
        this.connected = false;
        this.authenticated = false;
        this.pendingRequests.clear();

        console.log(`Connecting to ${this.url}`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected, sending handshake...');
            this.sendHandshake();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse message:', error, event.data);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket closed: ${event.code} ${event.reason}`);
            this.connected = false;
            this.authenticated = false;
            this.ws = null;

            // Reject all pending requests
            for (const [id, { reject }] of this.pendingRequests) {
                reject(new Error(`Connection closed: ${event.reason}`));
            }
            this.pendingRequests.clear();

            if (this.onDisconnect) {
                this.onDisconnect(event);
            }

            // Attempt reconnection if not closed intentionally
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                setTimeout(() => this.connect(), delay);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.onError) {
                this.onError(error);
            }
        };
    }

    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
        if (this.ws) {
            this.ws.close(1000, 'User disconnected');
        }
    }

    sendHandshake() {
        // Handler is already registered in the ChatApp.connect() method
        console.log('Waiting for connect.challenge event...');
    }

    async sendConnect(challengeNonce) {
        const connectPayload = {
            type: 'req',
            method: 'connect',
            id: this.generateId(),
            params: {
                minProtocol: 1,
                maxProtocol: 3,
                client: {
                    id: this.clientName,
                    version: this.clientVersion,
                    platform: this.platform,
                    mode: this.mode,
                    instanceId: this.instanceId,
                },
                scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
                role: 'operator',
            },
        };

        // Add authentication if provided
        if (this.token) {
            connectPayload.params.auth = { token: this.token };
        } else if (this.password) {
            connectPayload.params.auth = { password: this.password };
        }

        this.sendRequest(connectPayload).then((response) => {
            console.log('Connect response:', response);
            if (response.ok) {
                this.authenticated = true;
                this.connected = true;
                this.reconnectAttempts = 0;
                if (this.onConnect) {
                    this.onConnect(response);
                }
                console.log('Successfully authenticated with gateway');
            } else {
                console.error('Authentication failed:', response.error);
                this.ws.close(4008, 'Authentication failed');
            }
        }).catch((error) => {
            console.error('Connect request failed:', error);
        });
    }

    sendRequest(frame) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            console.log('Sending request frame:', JSON.stringify(frame, null, 2));
            this.pendingRequests.set(frame.id, { resolve, reject });
            this.ws.send(JSON.stringify(frame));
        });
    }

    handleMessage(data) {
        // Handle response frames
        if (data.type === 'res') {
            const pending = this.pendingRequests.get(data.id);
            if (pending) {
                this.pendingRequests.delete(data.id);
                if (data.ok) {
                    pending.resolve(data);
                } else {
                    pending.reject(new Error(data.error?.message || 'Request failed'));
                }
            }
            return;
        }

        // Handle event frames
        if (data.type === 'event') {
            console.log('Received event:', data.event, data.payload);
            console.log('Event handlers for', data.event + ':', this.eventHandlers.get(data.event));
            this.emit(data.event, data.payload);
            return;
        }

        // Handle hello-ok frames
        if (data.type === 'hello-ok') {
            this.emit('hello', data);
            return;
        }

        console.warn('Unhandled message type:', data.type);
    }

    on(event, handler) {
        console.log('GatewayClient.on called for:', event, 'handler:', handler);
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        console.log('After on, handlers for', event + ':', this.eventHandlers.get(event));
    }

    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, payload) {
        const handlers = this.eventHandlers.get(event);
        console.log('emit called for:', event, 'handlers:', handlers);
        if (handlers) {
            handlers.forEach(handler => handler(payload));
        }
    }

    generateId() {
        return 'req_' + Math.random().toString(36).substr(2, 9);
    }

    // Chat-specific methods
    async sendChatMessage(message, attachments = []) {
        const params = {
            sessionKey: this.sessionKey,
            message,
            deliver: false,
            idempotencyKey: this.generateId(),
        };

        if (attachments.length > 0) {
            params.attachments = attachments;
        }

        return this.sendRequest({
            type: 'req',
            method: 'chat.send',
            id: this.generateId(),
            params,
        });
    }

    async getChatHistory(limit = 50) {
        return this.sendRequest({
            type: 'req',
            method: 'chat.history',
            id: this.generateId(),
            params: {
                sessionKey: this.sessionKey,
                limit,
            },
        });
    }

    async abortCurrentChat() {
        return this.sendRequest({
            type: 'req',
            method: 'chat.abort',
            id: this.generateId(),
            params: {
                sessionKey: this.sessionKey,
            },
        });
    }
}

// UI Manager
class ChatUI {
    constructor() {
        this.gatewayClient = null;
        this.messages = [];
        this.pendingFiles = [];
        this.serverConfig = null; // Will be loaded from server
        this.settings = {
            gatewayUrl: '',  // Will be set from server config
            token: '',       // Will be set from server config  
            sessionKey: 'main',
            autoScroll: true,
            soundEnabled: true,
        };

        // Initialize command system
        this.commands = this.initializeCommands();

        this.init();
    }

    async init() {
        await this.loadServerConfig();
        this.loadSettings();
        this.initElements();
        this.bindEvents();
        this.initServiceWorker();
    }

    async loadServerConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.serverConfig = await response.json();
                console.log('✅ Loaded server configuration');
                
                // Apply server config to settings
                if (this.serverConfig.gateway) {
                    this.settings.gatewayUrl = this.serverConfig.gateway.url;
                    this.settings.token = this.serverConfig.gateway.token;
                    
                    // Auto-detect URL if enabled
                    if (this.serverConfig.gateway.autoDetectUrl) {
                        const currentHost = window.location.hostname;
                        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                        
                        if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
                            // Try to construct gateway URL with current host
                            const gatewayUrl = new URL(this.settings.gatewayUrl);
                            this.settings.gatewayUrl = `${protocol}//${currentHost}:${gatewayUrl.port}`;
                            console.log('🔍 Auto-detected gateway URL:', this.settings.gatewayUrl);
                        }
                    }
                }
                
                if (this.serverConfig.ui) {
                    this.settings.sessionKey = this.serverConfig.ui.sessionKey || 'main';
                }
            } else {
                console.warn('⚠️ Could not load server config, using defaults');
            }
        } catch (error) {
            console.error('❌ Failed to load server config:', error);
            console.log('Using default configuration');
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('openclaw-chat-settings');
        if (saved) {
            try {
                const savedSettings = JSON.parse(saved);
                // Merge saved settings but preserve server-provided token and gateway URL
                const { token, gatewayUrl, ...otherSaved } = savedSettings;
                this.settings = { ...this.settings, ...otherSaved };
            } catch (e) {
                console.error('Failed to load saved settings:', e);
            }
        }
    }

    saveSettings() {
        localStorage.setItem('openclaw-chat-settings', JSON.stringify(this.settings));
    }

    initElements() {
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            statusDot: document.querySelector('.status-dot'),
            statusText: document.querySelector('.status-text'),
            messages: document.getElementById('messages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            accessPassword: document.getElementById('accessPassword'),
            sessionKey: document.getElementById('sessionKey'),
            connectButton: document.getElementById('connectButton'),
            disconnectButton: document.getElementById('disconnectButton'),
            autoScroll: document.getElementById('autoScroll'),
            soundEnabled: document.getElementById('soundEnabled'),
            toast: document.getElementById('toast'),
            fileButton: document.getElementById('fileButton'),
            fileInput: document.getElementById('fileInput'),
            filePreviews: document.getElementById('filePreviews'),
        };

        // Set initial values from settings
        this.elements.sessionKey.value = this.settings.sessionKey;
        this.elements.autoScroll.checked = this.settings.autoScroll;
        this.elements.soundEnabled.checked = this.settings.soundEnabled;
    }

    bindEvents() {
        this.elements.connectButton.addEventListener('click', () => this.connect());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnect());
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = this.elements.messageInput.scrollHeight + 'px';
        });

        // File handling
        this.elements.fileButton.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Save settings on change  
        this.elements.sessionKey.addEventListener('change', () => this.updateSetting('sessionKey'));
        this.elements.autoScroll.addEventListener('change', () => this.updateSetting('autoScroll'));
        this.elements.soundEnabled.addEventListener('change', () => this.updateSetting('soundEnabled'));
    }

    // File handling methods
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            this.addFilePreview(file);
            this.pendingFiles.push(file);
        });

        // Reset file input to allow selecting same file again
        event.target.value = '';
    }

    addFilePreview(file) {
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.dataset.fileName = file.name;

        const icon = document.createElement('div');
        icon.className = 'file-preview-icon';
        icon.textContent = this.getFileIcon(file.type);

        const info = document.createElement('div');
        info.className = 'file-preview-info';

        const name = document.createElement('div');
        name.className = 'file-preview-name';
        name.textContent = file.name;

        const size = document.createElement('div');
        size.className = 'file-preview-size';
        size.textContent = this.formatFileSize(file.size);

        info.appendChild(name);
        info.appendChild(size);

        const remove = document.createElement('button');
        remove.className = 'file-preview-remove';
        remove.innerHTML = '×';
        remove.addEventListener('click', () => this.removeFilePreview(file.name));

        preview.appendChild(icon);
        preview.appendChild(info);
        preview.appendChild(remove);

        this.elements.filePreviews.appendChild(preview);
        this.elements.filePreviews.classList.remove('hidden');
    }

    removeFilePreview(fileName) {
        // Remove from DOM
        const preview = this.elements.filePreviews.querySelector(`[data-file-name="${fileName}"]`);
        if (preview) preview.remove();

        // Remove from pending files
        this.pendingFiles = this.pendingFiles.filter(f => f.name !== fileName);

        // Hide previews container if empty
        if (this.pendingFiles.length === 0) {
            this.elements.filePreviews.classList.add('hidden');
        }
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
        return '📎';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async prepareAttachments() {
        if (this.pendingFiles.length === 0) return [];

        const attachments = [];
        for (const file of this.pendingFiles) {
            try {
                const base64 = await this.fileToBase64(file);
                attachments.push({
                    type: this.getAttachmentType(file.type),
                    mimeType: file.type,
                    fileName: file.name,
                    size: file.size,
                    content: base64.split(',')[1], // Remove data URL prefix
                });
            } catch (error) {
                console.error('Failed to process file:', file.name, error);
                this.showToast(`Failed to process ${file.name}`, 'error');
            }
        }
        return attachments;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    getAttachmentType(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        return 'file';
    }

    clearPendingFiles() {
        this.pendingFiles = [];
        this.elements.filePreviews.innerHTML = '';
        this.elements.filePreviews.classList.add('hidden');
    }

    updateSetting(key) {
        if (key === 'sessionKey') {
            this.settings.sessionKey = this.elements.sessionKey.value;
        } else if (key === 'autoScroll') {
            this.settings.autoScroll = this.elements.autoScroll.checked;
        } else if (key === 'soundEnabled') {
            this.settings.soundEnabled = this.elements.soundEnabled.checked;
        }
        this.saveSettings();
    }

    async connect() {
        // Validate access password first
        const accessPassword = this.elements.accessPassword.value.trim();
        if (!accessPassword) {
            this.showToast('Please enter the access password', 'error');
            return;
        }

        // Authenticate with server
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: accessPassword })
            });
            
            const result = await response.json();
            if (!result.success) {
                this.showToast(result.message || 'Invalid access password', 'error');
                return;
            }
        } catch (error) {
            this.showToast('Authentication failed. Please try again.', 'error');
            return;
        }

        this.updateSetting('sessionKey');

        this.setStatus('connecting', 'Connecting...');

        // Disable connection controls
        this.elements.connectButton.disabled = true;
        this.elements.accessPassword.disabled = true;
        this.elements.sessionKey.disabled = true;

        this.gatewayClient = new GatewayClient({
            url: this.settings.gatewayUrl,
            token: this.settings.token || undefined,
            password: this.settings.password || undefined,
            sessionKey: this.settings.sessionKey,
            onConnect: () => this.onGatewayConnect(),
            onDisconnect: () => this.onGatewayDisconnect(),
            onMessage: (message) => this.onGatewayMessage(message),
            onError: (error) => this.onGatewayError(error),
        });

        // Listen for connect challenge BEFORE connecting (critical!)
        this.gatewayClient.on('connect.challenge', (payload) => {
            console.log('Received connect challenge, sending connect request...');
            this.gatewayClient.sendConnect(payload.nonce);
        });

        // Listen for chat events (gateway sends 'chat' with state property)
        this.gatewayClient.on('chat', (payload) => {
            console.log('chat event received, state:', payload.state);
            if (payload.state === 'delta') {
                this.handleChatDelta(payload);
            } else if (payload.state === 'final') {
                this.handleChatFinal(payload);
            } else if (payload.state === 'error') {
                this.handleChatError(payload);
            } else if (payload.state === 'aborted') {
                this.handleChatAborted();
            }
        });

        this.gatewayClient.connect();
    }

    disconnect() {
        if (this.gatewayClient) {
            this.gatewayClient.disconnect();
            this.gatewayClient = null;
        }

        this.setStatus('disconnected', 'Disconnected');
        this.disableChat();

        // Re-enable connection controls
        this.elements.connectButton.disabled = false;
        this.elements.accessPassword.disabled = false;
        this.elements.sessionKey.disabled = false;

        this.showToast('Disconnected', 'info');
    }

    // Gateway client callbacks
    onGatewayConnect() {
        console.log('Gateway connection established');
        this.setStatus('connected', 'Connected');
        this.enableChat();
        this.showToast('Connected to gateway', 'success');
        
        // Load chat history
        this.loadHistory();
    }

    onGatewayDisconnect(event) {
        console.log('Gateway disconnected:', event?.code, event?.reason);
        this.setStatus('disconnected', 'Disconnected');
        this.disableChat();
        this.showToast('Disconnected from gateway', 'info');
        
        // Re-enable connection controls
        this.elements.connectButton.disabled = false;
        this.elements.accessPassword.disabled = false;
        this.elements.sessionKey.disabled = false;
    }

    onGatewayError(error) {
        console.error('Gateway connection error:', error);
        this.setStatus('disconnected', 'Connection Error');
        this.showToast('Connection error: ' + (error.message || 'Unknown error'), 'error');
        
        // Re-enable connection controls
        this.elements.connectButton.disabled = false;
        this.elements.accessPassword.disabled = false;
        this.elements.sessionKey.disabled = false;
    }

    onGatewayMessage(message) {
        // Messages are handled through event listeners (chat.delta, chat.final, etc.)
        console.log('Gateway message:', message);
    }

    setStatus(status, text) {
        const dot = this.elements.statusDot;
        const statusText = this.elements.statusText;

        dot.className = 'status-dot ' + status;
        statusText.textContent = text;

        // Update disconnect button
        this.elements.disconnectButton.disabled = status !== 'connected';
    }

    enableChat() {
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.disconnectButton.disabled = false;
    }

    disableChat() {
        this.elements.messageInput.disabled = true;
        this.elements.sendButton.disabled = true;
        this.elements.disconnectButton.disabled = false;
    }

    async loadHistory() {
        if (!this.gatewayClient || !this.gatewayClient.authenticated) {
            return;
        }

        try {
            const response = await this.gatewayClient.getChatHistory(50);
            if (response.ok && response.payload.messages) {
                this.messages = response.payload.messages;
                this.renderMessages();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }

    async sendMessage() {
        const input = this.elements.messageInput;
        const message = input.value.trim();

        if (!message && this.pendingFiles.length === 0) {
            return;
        }

        // Check if this is a command
        if (message.startsWith('/') && this.pendingFiles.length === 0) {
            const commandData = this.parseCommand(message);
            if (commandData) {
                // Clear input first
                input.value = '';
                input.style.height = 'auto';
                
                // Execute command
                await this.executeCommand(commandData);
                return;
            }
        }

        // Regular message - need gateway connection
        if (!this.gatewayClient || !this.gatewayClient.authenticated) {
            this.showToast('Please connect to the gateway first', 'error');
            return;
        }

        // Prepare attachments
        const attachments = await this.prepareAttachments();

        // Build content for UI display
        const content = [];
        if (message) {
            content.push({ type: 'text', text: message });
        } else if (attachments.length > 0) {
            content.push({ type: 'text', text: '(file attached)' });
        }
        
        // Add image blocks for image attachments
        for (const att of attachments) {
            if (att.type === 'image' && att.content) {
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        data: att.content,
                        media_type: att.mimeType || 'image/jpeg',
                    },
                });
            } else {
                // Non-image file block
                content.push({
                    type: 'file',
                    fileName: att.fileName,
                    fileSize: att.size,
                    mimeType: att.mimeType,
                });
            }
        }

        // Add user message to UI immediately
        this.addMessage({
            role: 'user',
            content,
            timestamp: Date.now(),
        });

        // Clear input and pending files
        input.value = '';
        input.style.height = 'auto';
        this.clearPendingFiles();

        try {
            await this.gatewayClient.sendChatMessage(message || '', attachments);
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('Failed to send message', 'error');
        }
    }

    handleChatDelta(payload) {
        console.log('handleChatDelta:', { payloadSessionKey: payload.sessionKey, settingsSessionKey: this.settings.sessionKey });
        if (payload.sessionKey !== this.settings.sessionKey) {
            console.log('Skipping - sessionKey mismatch');
            return;
        }

        // Find or create streaming message
        let streamingMsg = this.messages.find(m => 
            m.role === 'assistant' && m.streaming === true
        );

        if (!streamingMsg) {
            streamingMsg = {
                role: 'assistant',
                content: [{ type: 'text', text: '' }],
                timestamp: Date.now(),
                streaming: true,
                id: payload.runId,
            };
            this.messages.push(streamingMsg);
        }

        // Append delta text (payload.message contains the delta for state='delta')
        const deltaContent = payload.message?.content || payload.delta?.content;
        if (deltaContent) {
            for (const block of deltaContent) {
                if (block.type === 'text' && block.text) {
                    const textBlock = streamingMsg.content.find(b => b.type === 'text');
                    if (textBlock) {
                        textBlock.text += block.text;
                    } else {
                        streamingMsg.content.push(block);
                    }
                }
            }
        }

        this.renderMessages();
    }

    handleChatFinal(payload) {
        console.log('handleChatFinal:', { payloadSessionKey: payload.sessionKey, settingsSessionKey: this.settings.sessionKey });
        if (payload.sessionKey !== this.settings.sessionKey) {
            console.log('Skipping - sessionKey mismatch');
            return;
        }

        // Remove streaming message
        this.messages = this.messages.filter(m => !(m.role === 'assistant' && m.streaming === true));

        // Add final message
        if (payload.message) {
            this.addMessage(payload.message);
        }

        // Play notification sound if enabled
        if (this.settings.soundEnabled) {
            this.playNotificationSound();
        }
    }

    handleChatError(payload) {
        console.error('Chat error:', payload);
        this.showToast(`Chat error: ${payload.errorMessage || 'Unknown error'}`, 'error');

        // Remove any streaming message
        this.messages = this.messages.filter(m => !(m.role === 'assistant' && m.streaming === true));
        this.renderMessages();
    }

    handleChatAborted() {
        // Remove streaming message
        this.messages = this.messages.filter(m => !(m.role === 'assistant' && m.streaming === true));
        this.renderMessages();
        this.showToast('Chat aborted', 'warning');
    }

    addMessage(message) {
        console.log('addMessage called:', message);
        this.messages.push(message);
        console.log('Messages array now has', this.messages.length, 'messages');
        this.renderMessages();
    }

    renderMessages() {
        console.log('renderMessages called, messages count:', this.messages.length);
        const container = this.elements.messages;
        container.innerHTML = '';

        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="message welcome">
                    <div class="message-content">No messages yet. Start a conversation!</div>
                </div>
            `;
            return;
        }

        this.messages.forEach(msg => {
            const messageEl = this.createMessageElement(msg);
            container.appendChild(messageEl);
        });

        if (this.settings.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        div.className = `message ${message.role} ${message.streaming ? 'streaming' : ''}`;

         let contentHtml = '';
        if (message.content && Array.isArray(message.content)) {
            for (const block of message.content) {
                if (block.type === 'text' && block.text) {
                    // Simple markdown-like formatting
                    let text = this.escapeHtml(block.text);
                    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
                    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
                    text = text.replace(/\n/g, '<br>');
                    contentHtml += `<div class="text-block">${text}</div>`;
                } else if (block.type === 'image' && block.source) {
                    if (block.source.type === 'base64' && block.source.data) {
                        const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
                        contentHtml += `<img src="${dataUrl}" class="message-image" alt="Attached image">`;
                    }
                } else if (block.type === 'file') {
                    const icon = this.getFileIcon(block.mimeType || '');
                    const size = this.formatFileSize(block.fileSize || 0);
                    contentHtml += `
                        <div class="file-block">
                            <span class="file-icon">${icon}</span>
                            <div class="file-info">
                                <div class="file-name">${this.escapeHtml(block.fileName || 'Unnamed file')}</div>
                                <div class="file-meta">${size} • ${block.mimeType || 'Unknown type'}</div>
                            </div>
                        </div>`;
                }
            }
        } else if (typeof message.content === 'string') {
            contentHtml = `<div class="text-block">${this.escapeHtml(message.content)}</div>`;
        }

        div.innerHTML = `<div class="message-content">${contentHtml}</div>`;
        return div;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    playNotificationSound() {
        // Create a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./service-worker.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }

    // Command System Implementation
    initializeCommands() {
        return {
            'help': {
                description: 'Show available commands',
                usage: '/help [command]',
                handler: (args) => this.cmdHelp(args)
            },
            'clear': {
                description: 'Clear chat history',
                usage: '/clear',
                handler: (args) => this.cmdClear(args)
            },
            'status': {
                description: 'Show connection status and statistics',
                usage: '/status',
                handler: (args) => this.cmdStatus(args)
            },
            'export': {
                description: 'Export chat history',
                usage: '/export [json|md|txt]',
                handler: (args) => this.cmdExport(args)
            },
            'theme': {
                description: 'Switch theme',
                usage: '/theme [dark|light|auto]',
                handler: (args) => this.cmdTheme(args)
            },
            'reconnect': {
                description: 'Reconnect to gateway',
                usage: '/reconnect',
                handler: (args) => this.cmdReconnect(args)
            }
        };
    }

    parseCommand(input) {
        // Remove leading slash and split by spaces
        const trimmed = input.trim();
        if (!trimmed.startsWith('/')) {
            return null;
        }

        const parts = trimmed.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        return {
            command,
            args,
            raw: input
        };
    }

    async executeCommand(commandData) {
        const { command, args } = commandData;
        
        if (!this.commands[command]) {
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: `❌ Unknown command: /${command}. Type /help to see available commands.` }],
                timestamp: Date.now()
            });
            return true; // Command was processed (even if invalid)
        }

        try {
            await this.commands[command].handler(args);
        } catch (error) {
            console.error(`Error executing command /${command}:`, error);
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: `❌ Error executing command /${command}: ${error.message}` }],
                timestamp: Date.now()
            });
        }

        return true; // Command was processed
    }

    // Command handlers
    cmdHelp(args) {
        const commandName = args[0]?.toLowerCase();
        
        if (commandName && this.commands[commandName]) {
            // Show specific command help
            const cmd = this.commands[commandName];
            const helpText = `**/${commandName}** - ${cmd.description}\n\n**Usage:** ${cmd.usage}`;
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: helpText }],
                timestamp: Date.now()
            });
        } else {
            // Show all commands
            const helpText = [
                '**Available Commands:**',
                '',
                ...Object.entries(this.commands).map(([name, cmd]) => 
                    `**/${name}** - ${cmd.description}`
                ),
                '',
                'Type `/help <command>` for detailed usage information.'
            ].join('\n');
            
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: helpText }],
                timestamp: Date.now()
            });
        }
    }

    cmdClear(args) {
        // Clear all messages except welcome message
        this.messages = [];
        this.elements.messages.innerHTML = `
            <div class="message welcome">
                <div class="message-content">Welcome! Connect to your OpenClaw gateway to start chatting.</div>
            </div>
        `;
        
        this.addMessage({
            role: 'system',
            content: [{ type: 'text', text: '✅ Chat history cleared.' }],
            timestamp: Date.now()
        });
    }

    cmdStatus(args) {
        const status = this.gatewayClient ? (this.gatewayClient.connected ? 'Connected' : 'Disconnected') : 'No gateway client';
        const authenticated = this.gatewayClient?.authenticated ? 'Yes' : 'No';
        const messageCount = this.messages.length;
        const gatewayUrl = this.settings.gatewayUrl || 'Not set';
        const sessionKey = this.settings.sessionKey || 'Not set';
        
        const statusText = [
            '**Connection Status**',
            `• Gateway: ${status}`,
            `• Authenticated: ${authenticated}`,
            `• Gateway URL: ${gatewayUrl}`,
            `• Session Key: ${sessionKey}`,
            `• Messages: ${messageCount}`,
            `• Auto-scroll: ${this.settings.autoScroll ? 'On' : 'Off'}`,
            `• Sound: ${this.settings.soundEnabled ? 'On' : 'Off'}`
        ].join('\n');

        this.addMessage({
            role: 'system',
            content: [{ type: 'text', text: statusText }],
            timestamp: Date.now()
        });
    }

    cmdExport(args) {
        const format = args[0]?.toLowerCase() || 'json';
        
        if (!['json', 'md', 'txt'].includes(format)) {
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: '❌ Invalid format. Use: json, md, or txt' }],
                timestamp: Date.now()
            });
            return;
        }

        let content = '';
        let filename = '';
        let mimeType = '';

        switch (format) {
            case 'json':
                content = JSON.stringify(this.messages, null, 2);
                filename = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
                break;
            
            case 'md':
                content = this.messages.map(msg => {
                    const timestamp = new Date(msg.timestamp).toLocaleString();
                    const role = msg.role === 'user' ? '👤 User' : 
                                msg.role === 'assistant' ? '🤖 Assistant' : '⚙️ System';
                    let text = '';
                    
                    if (Array.isArray(msg.content)) {
                        text = msg.content.map(block => block.text || '(file)').join('\n');
                    } else {
                        text = msg.content || '';
                    }
                    
                    return `## ${role}\n**${timestamp}**\n\n${text}\n\n---\n`;
                }).join('\n');
                filename = `chat-export-${new Date().toISOString().split('T')[0]}.md`;
                mimeType = 'text/markdown';
                break;
            
            case 'txt':
                content = this.messages.map(msg => {
                    const timestamp = new Date(msg.timestamp).toLocaleString();
                    const role = msg.role.toUpperCase();
                    let text = '';
                    
                    if (Array.isArray(msg.content)) {
                        text = msg.content.map(block => block.text || '(file)').join('\n');
                    } else {
                        text = msg.content || '';
                    }
                    
                    return `[${timestamp}] ${role}: ${text}`;
                }).join('\n\n');
                filename = `chat-export-${new Date().toISOString().split('T')[0]}.txt`;
                mimeType = 'text/plain';
                break;
        }

        // Create download link
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.addMessage({
            role: 'system',
            content: [{ type: 'text', text: `✅ Chat history exported as ${filename}` }],
            timestamp: Date.now()
        });
    }

    cmdTheme(args) {
        const theme = args[0]?.toLowerCase();
        
        if (!theme || !['dark', 'light', 'auto'].includes(theme)) {
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: '❌ Invalid theme. Use: dark, light, or auto' }],
                timestamp: Date.now()
            });
            return;
        }

        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save to settings
        this.settings.theme = theme;
        this.saveSettings();

        this.addMessage({
            role: 'system',
            content: [{ type: 'text', text: `✅ Theme switched to ${theme}` }],
            timestamp: Date.now()
        });
    }

    cmdReconnect(args) {
        if (this.gatewayClient) {
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: '🔄 Reconnecting to gateway...' }],
                timestamp: Date.now()
            });
            
            this.disconnect();
            
            // Wait a moment then reconnect
            setTimeout(() => {
                this.connect();
            }, 1000);
        } else {
            this.addMessage({
                role: 'system',
                content: [{ type: 'text', text: '❌ No gateway connection to reconnect. Use the Connect button first.' }],
                timestamp: Date.now()
            });
        }
    }
}

// Initialize the chat UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const chatUI = new ChatUI();
    window.chatUI = chatUI; // Expose for debugging

    // Add install prompt for PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button (you could add a button to your UI)
        const installButton = document.createElement('button');
        installButton.textContent = 'Install App';
        installButton.className = 'install-button';
        installButton.style.position = 'fixed';
        installButton.style.top = '10px';
        installButton.style.right = '10px';
        installButton.style.zIndex = '1000';
        installButton.onclick = () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    console.log('User choice:', choiceResult.outcome);
                    deferredPrompt = null;
                });
            }
        };
        document.body.appendChild(installButton);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            installButton.style.display = 'none';
        }, 10000);
    });
});