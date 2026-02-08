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

    async listSessions(options = {}) {
        return this.sendRequest({
            type: 'req',
            method: 'sessions.list',
            id: this.generateId(),
            params: {
                limit: options.limit || 50,
                includeDerivedTitles: true,
                includeLastMessage: false,
                ...options
            }
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
        this.sessions = []; // Session list from gateway
        this.settings = {
            gatewayUrl: 'ws://localhost:18789',  // Default, will be overridden by server config
            token: '',                           // Will be set from server config  
            sessionKey: 'main',
            autoScroll: true,
            soundEnabled: true,
            notificationsEnabled: false,         // System notifications
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
        this.initPWA();
        this.checkHTTPS();
    }
    
    checkHTTPS() {
        // Warn if not using HTTPS in production
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        const isHTTPS = window.location.protocol === 'https:';
        
        if (!isLocalhost && !isHTTPS) {
            console.warn('⚠️ Warning: Not using HTTPS! Password transmission may not be secure.');
            this.showToast('⚠️ Warning: Not using HTTPS. Please enable HTTPS for secure access.', 'warning');
        }
    }

    async toggleNotifications() {
        const enabled = this.elements.notificationsEnabled.checked;
        
        if (enabled) {
            // Request notification permission
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    this.settings.notificationsEnabled = true;
                    this.saveSettings();
                    this.showToast('System notifications enabled', 'success');
                    
                    // Show a test notification
                    this.showSystemNotification('OpenGloves', 'Notifications are now enabled!');
                } else {
                    this.elements.notificationsEnabled.checked = false;
                    this.settings.notificationsEnabled = false;
                    this.showToast('Notification permission denied', 'error');
                }
            } else {
                this.elements.notificationsEnabled.checked = false;
                this.showToast('Notifications not supported in this browser', 'error');
            }
        } else {
            this.settings.notificationsEnabled = false;
            this.saveSettings();
            this.showToast('System notifications disabled', 'info');
        }
    }

    extractMessageText(message) {
        // Extract text from message content
        if (Array.isArray(message.content)) {
            return message.content
                .filter(block => block.type === 'text' && block.text)
                .map(block => block.text)
                .join('\n');
        } else if (typeof message.content === 'string') {
            return message.content;
        }
        return '';
    }

    showSystemNotification(title, body, icon = '🧤') {
        // Check if notifications are enabled and permission granted
        if (!this.settings.notificationsEnabled || !('Notification' in window)) {
            return;
        }
        
        if (Notification.permission !== 'granted') {
            return;
        }
        
        // Don't show notification if page is visible
        if (!document.hidden) {
            return;
        }
        
        try {
            const notification = new Notification(title, {
                body: body,
                icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${icon}</text></svg>`,
                badge: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧤</text></svg>`,
                tag: 'opengloves-message',
                renotify: true,
                requireInteraction: false,
                silent: false,
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }
    
    async hashPassword(password, nonce) {
        // Use Web Crypto API to hash password with nonce
        const encoder = new TextEncoder();
        const data = encoder.encode(password + nonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
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
            // Mobile elements
            mobileAccessPassword: document.getElementById('mobileAccessPassword'),
            mobileSessionKey: document.getElementById('mobileSessionKey'),
            mobileConnectButton: document.getElementById('mobileConnectButton'),
            mobileDisconnectButton: document.getElementById('mobileDisconnectButton'),
            mobileDropdownToggle: document.getElementById('mobileDropdownToggle'),
            mobileDropdownContent: document.getElementById('mobileDropdownContent'),
            mobileStatusDot: document.getElementById('mobileStatusDot'),
            mobileStatusText: document.getElementById('mobileStatusText'),
            mobileHeaderToggle: document.getElementById('mobileHeaderToggle'),
            mobileHeaderArrow: document.getElementById('mobileHeaderArrow'),
            mobileAutoScroll: document.getElementById('mobileAutoScroll'),
            mobileSoundEnabled: document.getElementById('mobileSoundEnabled'),
            mobileNotificationsEnabled: document.getElementById('mobileNotificationsEnabled'),
            // Desktop session dropdown
            sessionDropdownToggle: document.getElementById('sessionDropdownToggle'),
            sessionDropdown: document.getElementById('sessionDropdown'),
            sessionList: document.getElementById('sessionList'),
            refreshSessionsBtn: document.getElementById('refreshSessionsBtn'),
            // Mobile session dropdown
            mobileSessionDropdownToggle: document.getElementById('mobileSessionDropdownToggle'),
            mobileSessionDropdown: document.getElementById('mobileSessionDropdown'),
            mobileSessionList: document.getElementById('mobileSessionList'),
            mobileRefreshSessionsBtn: document.getElementById('mobileRefreshSessionsBtn'),
            // Other elements
            autoScroll: document.getElementById('autoScroll'),
            soundEnabled: document.getElementById('soundEnabled'),
            notificationsEnabled: document.getElementById('notificationsEnabled'),
            toast: document.getElementById('toast'),
            fileButton: document.getElementById('fileButton'),
            fileInput: document.getElementById('fileInput'),
            filePreviews: document.getElementById('filePreviews'),
            // PWA elements
            pwaInstall: document.getElementById('pwaInstall'),
            installPWAButton: document.getElementById('installPWAButton'),
        };

        // Set initial values from settings
        this.elements.sessionKey.value = this.settings.sessionKey;
        this.elements.mobileSessionKey.value = this.settings.sessionKey;
        this.elements.autoScroll.checked = this.settings.autoScroll;
        this.elements.soundEnabled.checked = this.settings.soundEnabled;
        this.elements.notificationsEnabled.checked = this.settings.notificationsEnabled;
        
        // Sync mobile settings
        this.elements.mobileAutoScroll.checked = this.settings.autoScroll;
        this.elements.mobileSoundEnabled.checked = this.settings.soundEnabled;
        this.elements.mobileNotificationsEnabled.checked = this.settings.notificationsEnabled;
    }

    bindEvents() {
        // Desktop connection buttons
        this.elements.connectButton.addEventListener('click', () => this.connect());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnect());
        
        // Mobile connection buttons
        this.elements.mobileConnectButton.addEventListener('click', () => this.connect(true));
        this.elements.mobileDisconnectButton.addEventListener('click', () => this.disconnect());
        
        // Mobile header toggle (click anywhere on header)
        if (this.elements.mobileHeaderToggle) {
            this.elements.mobileHeaderToggle.addEventListener('click', (e) => {
                // Prevent toggle when clicking on input elements
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                    return;
                }
                this.toggleMobileDropdown();
            });
        }
        
        // Mobile settings sync
        this.elements.mobileAutoScroll.addEventListener('change', () => {
            this.settings.autoScroll = this.elements.mobileAutoScroll.checked;
            this.elements.autoScroll.checked = this.settings.autoScroll;
            this.saveSettings();
        });
        this.elements.mobileSoundEnabled.addEventListener('change', () => {
            this.settings.soundEnabled = this.elements.mobileSoundEnabled.checked;
            this.elements.soundEnabled.checked = this.settings.soundEnabled;
            this.saveSettings();
        });
        this.elements.mobileNotificationsEnabled.addEventListener('change', () => {
            this.elements.notificationsEnabled.checked = this.elements.mobileNotificationsEnabled.checked;
            this.toggleNotifications();
        });
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
        this.elements.mobileSessionKey.addEventListener('change', () => this.updateMobileSetting('sessionKey'));
        this.elements.autoScroll.addEventListener('change', () => this.updateSetting('autoScroll'));
        this.elements.soundEnabled.addEventListener('change', () => this.updateSetting('soundEnabled'));
        this.elements.notificationsEnabled.addEventListener('change', () => this.toggleNotifications());
        
        // Session dropdown events
        if (this.elements.sessionDropdownToggle) {
            this.elements.sessionDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSessionDropdown();
            });
        }
        
        if (this.elements.refreshSessionsBtn) {
            this.elements.refreshSessionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadSessions();
            });
        }
        
        if (this.elements.mobileSessionDropdownToggle) {
            this.elements.mobileSessionDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMobileSessionDropdown();
            });
        }
        
        if (this.elements.mobileRefreshSessionsBtn) {
            this.elements.mobileRefreshSessionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadSessions();
            });
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (this.elements.sessionDropdown && !this.elements.sessionDropdown.contains(e.target) && 
                this.elements.sessionDropdownToggle && !this.elements.sessionDropdownToggle.contains(e.target)) {
                this.toggleSessionDropdown(false);
            }
            if (this.elements.mobileSessionDropdown && !this.elements.mobileSessionDropdown.contains(e.target) && 
                this.elements.mobileSessionDropdownToggle && !this.elements.mobileSessionDropdownToggle.contains(e.target)) {
                this.toggleMobileSessionDropdown(false);
            }
        });
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
            // Sync to mobile input
            this.elements.mobileSessionKey.value = this.settings.sessionKey;
        } else if (key === 'autoScroll') {
            this.settings.autoScroll = this.elements.autoScroll.checked;
        } else if (key === 'soundEnabled') {
            this.settings.soundEnabled = this.elements.soundEnabled.checked;
        } else if (key === 'notificationsEnabled') {
            this.settings.notificationsEnabled = this.elements.notificationsEnabled.checked;
        }
        this.saveSettings();
    }

    updateMobileSetting(key) {
        if (key === 'sessionKey') {
            this.settings.sessionKey = this.elements.mobileSessionKey.value;
            // Sync to desktop input
            this.elements.sessionKey.value = this.settings.sessionKey;
        }
        this.saveSettings();
    }

    toggleMobileDropdown() {
        const content = this.elements.mobileDropdownContent;
        const arrow = this.elements.mobileHeaderArrow;
        
        if (content) {
            content.classList.toggle('expanded');
        }
        if (arrow) {
            arrow.classList.toggle('expanded');
        }
    }

    // Session dropdown methods
    async loadSessions() {
        if (!this.gatewayClient || !this.gatewayClient.connected) {
            this.showToast('Please connect to gateway first', 'warning');
            return;
        }
        
        try {
            const result = await this.gatewayClient.listSessions();
            this.sessions = result.sessions || [];
            this.renderSessionList();
            this.renderMobileSessionList();
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.showToast('Failed to load sessions', 'error');
        }
    }

    getSessionIcon(key) {
        if (key.includes(':group:')) return '👥';
        if (key.includes(':channel:')) return '📢';
        if (key.startsWith('cron:')) return '⏰';
        if (key.startsWith('hook:')) return '🔗';
        if (key.startsWith('node-')) return '🖥️';
        if (key.endsWith(':main') || key === 'main') return '🏠';
        return '💬';
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    renderSessionList() {
        const listEl = this.elements.sessionList;
        const currentKey = this.settings.sessionKey;
        
        if (!listEl) return;
        
        if (!this.sessions || this.sessions.length === 0) {
            listEl.innerHTML = '';
            return;
        }
        
        listEl.innerHTML = this.sessions.map(session => {
            const icon = this.getSessionIcon(session.key);
            const timeAgo = this.formatTimeAgo(session.updatedAt);
            const isActive = session.key === currentKey;
            const displayName = session.displayName || session.key;
            
            return `
                <div class="session-item ${isActive ? 'active' : ''}" data-key="${session.key}">
                    <div class="session-info">
                        <span class="session-icon">${icon}</span>
                        <span class="session-name">${displayName}</span>
                    </div>
                    <span class="session-time">${timeAgo}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        listEl.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => this.selectSession(item.dataset.key));
        });
    }

    renderMobileSessionList() {
        const listEl = this.elements.mobileSessionList;
        const currentKey = this.settings.sessionKey;
        
        if (!listEl) return;
        
        if (!this.sessions || this.sessions.length === 0) {
            listEl.innerHTML = '';
            return;
        }
        
        listEl.innerHTML = this.sessions.map(session => {
            const icon = this.getSessionIcon(session.key);
            const timeAgo = this.formatTimeAgo(session.updatedAt);
            const isActive = session.key === currentKey;
            const displayName = session.displayName || session.key;
            
            return `
                <div class="session-item ${isActive ? 'active' : ''}" data-key="${session.key}">
                    <div class="session-info">
                        <span class="session-icon">${icon}</span>
                        <span class="session-name">${displayName}</span>
                    </div>
                    <span class="session-time">${timeAgo}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        listEl.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => this.selectSession(item.dataset.key));
        });
    }

    async selectSession(key) {
        if (key === this.settings.sessionKey) {
            this.toggleSessionDropdown(false);
            this.toggleMobileSessionDropdown(false);
            return;
        }
        
        this.settings.sessionKey = key;
        this.elements.sessionKey.value = key;
        this.elements.mobileSessionKey.value = key;
        this.saveSettings();
        
        this.toggleSessionDropdown(false);
        this.toggleMobileSessionDropdown(false);
        
        // Re-render to update active state
        this.renderSessionList();
        this.renderMobileSessionList();
        
        // If connected, reload chat history for new session
        if (this.gatewayClient && this.gatewayClient.connected) {
            this.showToast(`Session switched to: ${key}`, 'info');
            this.clearMessages();
            await this.loadChatHistory();
        }
    }

    toggleSessionDropdown(show) {
        const dropdown = this.elements.sessionDropdown;
        const btn = this.elements.sessionDropdownToggle;
        
        if (!dropdown || !btn) return;
        
        if (show === undefined) {
            show = dropdown.classList.contains('hidden');
        }
        
        if (show) {
            dropdown.classList.remove('hidden');
            btn.classList.add('active');
            // Auto load if empty
            if (!this.sessions || this.sessions.length === 0) {
                this.loadSessions();
            }
        } else {
            dropdown.classList.add('hidden');
            btn.classList.remove('active');
        }
    }

    toggleMobileSessionDropdown(show) {
        const dropdown = this.elements.mobileSessionDropdown;
        const btn = this.elements.mobileSessionDropdownToggle;
        
        if (!dropdown || !btn) return;
        
        if (show === undefined) {
            show = dropdown.classList.contains('hidden');
        }
        
        if (show) {
            dropdown.classList.remove('hidden');
            btn.classList.add('active');
            // Auto load if empty
            if (!this.sessions || this.sessions.length === 0) {
                this.loadSessions();
            }
        } else {
            dropdown.classList.add('hidden');
            btn.classList.remove('active');
        }
    }

    async connect(fromMobile = false) {
        // Get access password from appropriate input
        const accessPassword = fromMobile 
            ? this.elements.mobileAccessPassword.value.trim()
            : this.elements.accessPassword.value.trim();
            
        if (!accessPassword) {
            this.showToast('Please enter the access password', 'error');
            return;
        }

        // Authenticate with server using challenge-response
        try {
            // Step 1: Get challenge (nonce) from server
            const challengeResponse = await fetch('/api/auth/challenge');
            if (!challengeResponse.ok) {
                throw new Error('Failed to get authentication challenge');
            }
            const { nonce } = await challengeResponse.json();
            
            // Step 2: Hash password with nonce using SHA-256
            const hash = await this.hashPassword(accessPassword, nonce);
            
            // Step 3: Send hash to server for verification
            const authResponse = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ hash, nonce })
            });
            
            const result = await authResponse.json();
            if (!result.success) {
                this.showToast(result.message || 'Invalid access password', 'error');
                return;
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.showToast('Authentication failed. Please try again.', 'error');
            return;
        }

        // Update session key from mobile input if connecting from mobile
        if (fromMobile) {
            this.updateMobileSetting('sessionKey');
        } else {
            this.updateSetting('sessionKey');
        }

        this.setStatus('connecting', 'Connecting...');

        // Disable connection controls (handled by setStatus now)
        this.elements.accessPassword.disabled = true;
        this.elements.mobileAccessPassword.disabled = true;
        this.elements.sessionKey.disabled = true;

        this.gatewayClient = new GatewayClient({
            url: this.settings.gatewayUrl,
            token: this.settings.token || undefined,
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

        // Re-enable connection controls (buttons handled by setStatus)
        this.elements.accessPassword.disabled = false;
        this.elements.mobileAccessPassword.disabled = false;
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
        
        // Load available sessions
        this.loadSessions();
    }

    onGatewayDisconnect(event) {
        console.log('Gateway disconnected:', event?.code, event?.reason);
        this.setStatus('disconnected', 'Disconnected');
        this.disableChat();
        this.showToast('Disconnected from gateway', 'info');
        
        // Re-enable connection controls (buttons handled by setStatus)
        this.elements.accessPassword.disabled = false;
        this.elements.mobileAccessPassword.disabled = false;
        this.elements.sessionKey.disabled = false;
    }

    onGatewayError(error) {
        console.error('Gateway connection error:', error);
        this.setStatus('disconnected', 'Connection Error');
        this.showToast('Connection error: ' + (error.message || 'Unknown error'), 'error');
        
        // Re-enable connection controls (buttons handled by setStatus)
        this.elements.accessPassword.disabled = false;
        this.elements.mobileAccessPassword.disabled = false;
        this.elements.sessionKey.disabled = false;
    }

    onGatewayMessage(message) {
        // Messages are handled through event listeners (chat.delta, chat.final, etc.)
        console.log('Gateway message:', message);
    }

    setStatus(status, text) {
        // Update desktop status
        const dot = this.elements.statusDot;
        const statusText = this.elements.statusText;
        if (dot) dot.className = 'status-dot ' + status;
        if (statusText) statusText.textContent = text;

        // Update mobile status bar
        const mobileDot = this.elements.mobileStatusDot;
        const mobileStatusText = this.elements.mobileStatusText;
        if (mobileDot) mobileDot.className = 'mobile-status-dot ' + status;
        if (mobileStatusText) mobileStatusText.textContent = text;

        // Update disconnect buttons
        const isConnected = status === 'connected';
        if (this.elements.disconnectButton) this.elements.disconnectButton.disabled = !isConnected;
        if (this.elements.mobileDisconnectButton) this.elements.mobileDisconnectButton.disabled = !isConnected;
        
        // Update connect buttons
        const isConnecting = status === 'connecting';
        if (this.elements.connectButton) this.elements.connectButton.disabled = isConnecting || isConnected;
        if (this.elements.mobileConnectButton) this.elements.mobileConnectButton.disabled = isConnecting || isConnected;
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
            
            // Show system notification if enabled
            if (this.settings.notificationsEnabled && payload.message.role === 'assistant') {
                const messageText = this.extractMessageText(payload.message);
                const preview = messageText.substring(0, 100) + (messageText.length > 100 ? '...' : '');
                this.showSystemNotification('OpenGloves - New Message', preview, '🤖');
            }
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

    initPWA() {
        let deferredPrompt;
        
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show the PWA install button
            this.elements.pwaInstall.style.display = 'block';
        });

        // Handle install button click
        this.elements.installPWAButton.addEventListener('click', async () => {
            if (deferredPrompt) {
                // Show the install prompt
                deferredPrompt.prompt();
                
                // Wait for user response
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('PWA installation accepted');
                    this.showToast('App installed successfully!', 'success');
                } else {
                    console.log('PWA installation declined');
                }
                
                // Reset the prompt
                deferredPrompt = null;
                this.elements.pwaInstall.style.display = 'none';
            }
        });

        // Handle app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.elements.pwaInstall.style.display = 'none';
            this.showToast('App installed successfully!', 'success');
        });

        // Check if app is already installed
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            console.log('Running as installed PWA');
            this.elements.pwaInstall.style.display = 'none';
            
            // Check if this is first run in PWA mode (iOS PWA has isolated storage)
            const pwaFirstRun = !localStorage.getItem('opengloves-pwa-initialized');
            if (pwaFirstRun) {
                console.log('First run in PWA mode - storage is isolated from browser');
                localStorage.setItem('opengloves-pwa-initialized', 'true');
                
                // Show info toast about PWA mode
                setTimeout(() => {
                    this.showToast('📱 Running in PWA mode. Please enter your password to connect.', 'info', 5000);
                }, 1000);
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