// MCP Test Frontend JavaScript - Complete refactored version

// Validation Utilities
class ValidationUtils {
    static validateURL(url) {
        if (!url || typeof url !== 'string') {
            return { isValid: false, error: 'URL is required and must be a string' };
        }
        const urlPattern = /^(https?):\/\/[^\s/$.?#].[^\s]*$/i;
        if (!urlPattern.test(url)) {
            return { isValid: false, error: 'Invalid URL format. Must start with http:// or https://' };
        }
        try {
            new URL(url);
            return { isValid: true, error: null };
        } catch (error) {
            return { isValid: false, error: 'Invalid URL: ' + error.message };
        }
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
    }

    static validateJSON(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            return { isValid: false, data: null, error: 'JSON string is required' };
        }
        try {
            const data = JSON.parse(jsonString.trim());
            return { isValid: true, data: data, error: null };
        } catch (error) {
            return { isValid: false, data: null, error: `Invalid JSON: ${error.message}` };
        }
    }
}

// History Manager
class HistoryManager {
    constructor(maxHistorySize = 1000) {
        this.history = [];
        this.maxHistorySize = maxHistorySize;
        this.listeners = [];
        this.storageKey = 'mcp-test-frontend-history';
        this._loadFromStorage();
    }

    addInteraction(request, response, timestamp = new Date(), metadata = {}) {
        const interaction = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: timestamp,
            type: this._determineInteractionType(request),
            request: JSON.parse(JSON.stringify(request || {})),
            response: JSON.parse(JSON.stringify(response || {})),
            duration: metadata.duration || 0,
            status: response?.error ? 'error' : 'success',
            metadata: { ...metadata, userAgent: navigator.userAgent }
        };

        this.history.unshift(interaction);
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(this.history));
        this._notifyListeners('add', interaction);
        return interaction;
    }

    getHistory(filter = {}) {
        let filtered = [...this.history];
        if (filter.searchTerm) {
            const term = filter.searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                JSON.stringify(item).toLowerCase().includes(term)
            );
        }
        return filtered;
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem(this.storageKey);
        this._notifyListeners('clear', []);
    }

    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    _determineInteractionType(request) {
        if (!request?.method) return 'unknown';
        const method = request.method.toLowerCase();
        if (method.includes('tools/list')) return 'tools/list';
        if (method.includes('tools/call')) return 'tools/call';
        if (method.includes('initialize')) return 'initialize';
        return method;
    }

    _notifyListeners(action, data) {
        this.listeners.forEach(callback => {
            try { callback(action, data); } catch (error) {
                console.error('Error in history listener:', error);
            }
        });
    }

    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) this.history = JSON.parse(stored);
        } catch (error) {
            console.warn('Failed to load history:', error);
            this.history = [];
        }
    }
}

// MCP Client
class MCPClient {
    constructor(config = {}) {
        this.config = {
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            ...config
        };

        this.connectionState = {
            status: 'disconnected',
            serverUrl: null,
            serverInfo: null,
            error: null,
            lastConnected: null
        };

        this.messageId = 0;
        this.eventListeners = {
            message: [], error: [], connect: [], disconnect: [], statusChange: []
        };
        this.abortController = null;
    }

    async connect(serverUrl, options = {}) {
        const urlValidation = ValidationUtils.validateURL(serverUrl);
        if (!urlValidation.isValid) {
            throw new Error(`Invalid server URL: ${urlValidation.error}`);
        }

        this._updateConnectionState('connecting', serverUrl);
        
        try {
            this.abortController = new AbortController();
            
            const initRequest = this._createJsonRpcRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: { roots: { listChanged: false }, sampling: {} },
                clientInfo: { name: 'MCP Test Frontend', version: '1.0.0' }
            });

            const response = await this._sendRequest(initRequest, serverUrl);
            const serverInfo = response.result;

            this._updateConnectionState('connected', serverUrl, serverInfo);
            this.connectionState.lastConnected = new Date();

            return { success: true, serverInfo };

        } catch (error) {
            this._updateConnectionState('error', serverUrl, null, error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this._updateConnectionState('disconnected');
    }

    async listTools() {
        if (this.connectionState.status !== 'connected') {
            throw new Error('Not connected to MCP server');
        }

        const request = this._createJsonRpcRequest('tools/list', {});
        const response = await this._sendRequest(request);
        return response.result?.tools || [];
    }

    async callTool(name, args = {}) {
        if (this.connectionState.status !== 'connected') {
            throw new Error('Not connected to MCP server');
        }

        const request = this._createJsonRpcRequest('tools/call', { name, arguments: args });
        const response = await this._sendRequest(request);
        return response.result;
    }

    getConnectionStatus() {
        return { ...this.connectionState };
    }

    addEventListener(event, callback) {
        if (typeof callback === 'function' && this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }

    _createJsonRpcRequest(method, params = {}) {
        return {
            jsonrpc: '2.0',
            id: ++this.messageId,
            method: method,
            params: params
        };
    }

    async _sendRequest(request, serverUrl = null) {
        const url = serverUrl || this.connectionState.serverUrl;
        if (!url) throw new Error('No server URL available');

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(request),
            signal: this.abortController?.signal
        };

        const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const jsonResponse = await response.json();
        if (jsonResponse.error) throw new Error(jsonResponse.error.message);
        
        return jsonResponse;
    }

    _updateConnectionState(status, serverUrl = null, serverInfo = null, error = null) {
        const oldStatus = this.connectionState.status;
        this.connectionState.status = status;
        if (serverUrl !== null) this.connectionState.serverUrl = serverUrl;
        if (serverInfo !== null) this.connectionState.serverInfo = serverInfo;
        if (error !== null) this.connectionState.error = error;

        if (oldStatus !== status) {
            this.eventListeners.statusChange.forEach(callback => {
                try { callback({ oldStatus, newStatus: status }); } catch (e) {}
            });
        }
    }
}

// Tools Manager
class ToolsManager {
    constructor() {
        this.tools = [];
        this.filteredTools = [];
        this.searchTerm = '';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.categories = new Set();
        this.listeners = [];
    }

    processTools(toolsData) {
        if (!Array.isArray(toolsData)) {
            throw new Error('Tools data must be an array');
        }

        this.tools = [];
        this.categories.clear();

        const results = { total: toolsData.length, processed: 0, errors: [] };

        toolsData.forEach((toolData, index) => {
            try {
                const processedTool = this._processSingleTool(toolData, index);
                if (processedTool) {
                    this.tools.push(processedTool);
                    this.categories.add(processedTool.category);
                    results.processed++;
                }
            } catch (error) {
                results.errors.push({ tool: toolData?.name || 'Unknown', error: error.message });
            }
        });

        this._applyFiltersAndSort();
        this._notifyListeners('tools_processed', { tools: this.tools, results });
        return results;
    }

    _processSingleTool(toolData, index) {
        if (!toolData?.name) {
            throw new Error(`Tool at index ${index} missing required 'name' field`);
        }

        const inputSchema = toolData.inputSchema || {};
        const category = this._determineToolCategory(toolData);
        const parameters = this._extractParameterInfo(inputSchema);
        const complexity = this._calculateToolComplexity(parameters);

        return {
            name: toolData.name,
            description: toolData.description || 'No description provided',
            inputSchema: inputSchema,
            category: category,
            parameters: parameters,
            complexity: complexity,
            metadata: {
                hasRequiredParams: parameters.some(p => p.required),
                parameterCount: parameters.length
            }
        };
    }

    _determineToolCategory(toolData) {
        const name = (toolData.name || '').toLowerCase();
        const description = (toolData.description || '').toLowerCase();
        const combined = `${name} ${description}`;

        const patterns = {
            'File System': ['file', 'directory', 'path', 'read', 'write'],
            'Network': ['http', 'api', 'request', 'fetch', 'url'],
            'Data Processing': ['parse', 'transform', 'process', 'analyze'],
            'System': ['system', 'command', 'execute', 'process'],
            'Text': ['text', 'string', 'format', 'content']
        };

        for (const [category, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => combined.includes(keyword))) {
                return category;
            }
        }
        return 'Other';
    }

    _extractParameterInfo(schema) {
        if (!schema?.properties) return [];

        const required = schema.required || [];
        const parameters = [];

        for (const [name, paramSchema] of Object.entries(schema.properties)) {
            parameters.push({
                name: name,
                type: paramSchema.type || 'string',
                description: paramSchema.description || '',
                required: required.includes(name),
                default: paramSchema.default,
                enum: paramSchema.enum,
                validationHints: this._generateValidationHints(paramSchema)
            });
        }

        return parameters.sort((a, b) => {
            if (a.required && !b.required) return -1;
            if (!a.required && b.required) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    _generateValidationHints(schema) {
        const hints = [];
        if (schema.type) hints.push(`Type: ${schema.type}`);
        if (schema.format) hints.push(`Format: ${schema.format}`);
        if (schema.enum) hints.push(`Options: ${schema.enum.join(', ')}`);
        if (schema.minimum !== undefined || schema.maximum !== undefined) {
            hints.push(`Range: ${schema.minimum ?? '-∞'}-${schema.maximum ?? '∞'}`);
        }
        return hints;
    }

    _calculateToolComplexity(parameters) {
        let score = parameters.length;
        score += parameters.filter(p => p.required).length * 2;
        score += parameters.filter(p => ['object', 'array'].includes(p.type)).length * 3;

        let level = 'Simple';
        if (score > 15) level = 'Complex';
        else if (score > 8) level = 'Moderate';

        return { score, level };
    }

    _applyFiltersAndSort() {
        let filtered = [...this.tools];

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(tool => 
                tool.name.toLowerCase().includes(term) ||
                tool.description.toLowerCase().includes(term) ||
                tool.category.toLowerCase().includes(term)
            );
        }

        filtered.sort((a, b) => {
            let comparison = 0;
            switch (this.sortBy) {
                case 'name': comparison = a.name.localeCompare(b.name); break;
                case 'category': comparison = a.category.localeCompare(b.category); break;
                case 'complexity': comparison = a.complexity.score - b.complexity.score; break;
                case 'parameters': comparison = a.parameters.length - b.parameters.length; break;
                default: comparison = a.name.localeCompare(b.name);
            }
            return this.sortOrder === 'desc' ? -comparison : comparison;
        });

        this.filteredTools = filtered;
    }

    setSearchTerm(searchTerm) {
        this.searchTerm = (searchTerm || '').trim();
        this._applyFiltersAndSort();
        this._notifyListeners('search_changed', { searchTerm: this.searchTerm, resultCount: this.filteredTools.length });
    }

    setSorting(sortBy, sortOrder = 'asc') {
        this.sortBy = sortBy;
        this.sortOrder = sortOrder;
        this._applyFiltersAndSort();
        this._notifyListeners('sort_changed', { sortBy: this.sortBy, sortOrder: this.sortOrder });
    }

    getTools() {
        return [...this.filteredTools];
    }

    getTool(name) {
        return this.tools.find(tool => tool.name === name) || null;
    }

    getCategories() {
        return Array.from(this.categories).sort();
    }

    clearTools() {
        this.tools = [];
        this.filteredTools = [];
        this.categories.clear();
        this._notifyListeners('tools_cleared', {});
    }

    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    _notifyListeners(action, data) {
        this.listeners.forEach(callback => {
            try {
                callback(action, data);
            } catch (error) {
                console.error('Error in tools listener:', error);
            }
        });
    }
}

// UI Functions
function updateStatusIndicator(status, message = '') {
    const indicator = document.querySelector('.status-indicator');
    if (!indicator) return;

    indicator.className = `status-indicator status-${status}`;
    indicator.textContent = message || status;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: var(--radius-md);
        color: white;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        z-index: 1000;
        max-width: 300px;
        box-shadow: var(--shadow-lg);
        transition: all 0.3s ease;
    `;

    const colors = {
        success: 'var(--success-color)',
        error: 'var(--error-color)',
        warning: 'var(--warning-color)',
        info: 'var(--primary-color)'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function renderToolsList(tools) {
    const toolsList = document.querySelector('.tools-list');
    if (!toolsList) return;

    if (!tools || tools.length === 0) {
        toolsList.innerHTML = '<p class="text-muted text-center">No tools available</p>';
        return;
    }

    const toolsHTML = `
        <div class="tools-header mb-md">
            <div class="flex justify-between items-center mb-sm">
                <span class="text-sm text-muted">${tools.length} tool${tools.length !== 1 ? 's' : ''} available</span>
                <div class="tools-controls flex gap-sm">
                    <input type="text" id="tools-search" class="form-input" placeholder="Search tools..." style="width: 200px;">
                    <select id="tools-sort" class="form-input form-select" style="width: 150px;">
                        <option value="name">Sort by Name</option>
                        <option value="category">Sort by Category</option>
                        <option value="complexity">Sort by Complexity</option>
                        <option value="parameters">Sort by Parameters</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="tools-grid">
            ${tools.map(tool => renderToolCard(tool)).join('')}
        </div>
    `;

    toolsList.innerHTML = toolsHTML;

    const searchInput = document.getElementById('tools-search');
    const sortSelect = document.getElementById('tools-sort');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            window.toolsManager.setSearchTerm(e.target.value);
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            window.toolsManager.setSorting(e.target.value);
        });
    }

    document.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
            const toolName = card.dataset.toolName;
            selectTool(toolName);
        });
    });
}

function renderToolCard(tool) {
    const complexityClass = {
        'Simple': 'text-success',
        'Moderate': 'text-warning',
        'Complex': 'text-error'
    }[tool.complexity.level] || 'text-muted';

    return `
        <div class="tool-card card" data-tool-name="${tool.name}" style="cursor: pointer;">
            <div class="card-header">
                <div class="flex justify-between items-center">
                    <h3 class="card-title">${ValidationUtils.sanitizeInput(tool.name)}</h3>
                    <span class="status-indicator" style="background: var(--surface-color); padding: 2px 6px; font-size: 0.75rem;">
                        ${ValidationUtils.sanitizeInput(tool.category)}
                    </span>
                </div>
            </div>
            <div class="tool-description mb-sm">
                <p class="text-sm text-secondary">${ValidationUtils.sanitizeInput(tool.description)}</p>
            </div>
            <div class="tool-metadata">
                <div class="flex justify-between items-center text-sm text-muted">
                    <span>${tool.parameters.length} parameter${tool.parameters.length !== 1 ? 's' : ''}</span>
                    <span class="${complexityClass}">${tool.complexity.level}</span>
                </div>
                ${tool.metadata.hasRequiredParams ? '<div class="text-sm text-warning mt-xs">Has required parameters</div>' : ''}
            </div>
        </div>
    `;
}

function selectTool(toolName) {
    const tool = window.toolsManager.getTool(toolName);
    if (!tool) {
        showNotification(`Tool '${toolName}' not found`, 'error');
        return;
    }

    document.querySelectorAll('.tool-card').forEach(card => {
        card.style.borderColor = card.dataset.toolName === toolName ? 'var(--primary-color)' : 'var(--border-color)';
        card.style.boxShadow = card.dataset.toolName === toolName ? 'var(--shadow-md)' : 'var(--shadow-sm)';
    });

    console.log('Tool selected:', tool);
    showNotification(`Selected tool: ${toolName}`, 'info');
}

// Application Initialization
document.addEventListener('DOMContentLoaded', function() {
    window.historyManager = new HistoryManager();
    window.mcpClient = new MCPClient();
    window.toolsManager = new ToolsManager();

    const connectionForm = document.querySelector('.connection-form');
    const refreshToolsBtn = document.getElementById('refresh-tools');
    const disconnectButton = document.getElementById('disconnect-btn');

    if (connectionForm) {
        connectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const serverUrlInput = document.getElementById('server-url');
            const serverUrl = serverUrlInput?.value.trim();
            
            if (!serverUrl) {
                showNotification('Please enter a server URL', 'error');
                return;
            }
            
            try {
                const connectButton = connectionForm.querySelector('button[type="submit"]');
                connectButton.disabled = true;
                connectButton.textContent = 'Connecting...';
                
                const result = await mcpClient.connect(serverUrl);
                
                showNotification(`Connected to ${result.serverInfo.name}`, 'success');
                updateStatusIndicator('connected', result.serverInfo.name);
                
                connectButton.classList.add('hidden');
                if (disconnectButton) disconnectButton.classList.remove('hidden');
                
                const serverInfoDiv = document.querySelector('.server-info');
                if (serverInfoDiv) serverInfoDiv.classList.remove('hidden');
                
                const tools = await mcpClient.listTools();
                toolsManager.processTools(tools);
                
            } catch (error) {
                console.error('Connection failed:', error);
                showNotification(`Connection failed: ${error.message}`, 'error');
                updateStatusIndicator('error', 'Connection Failed');
            } finally {
                const connectButton = connectionForm.querySelector('button[type="submit"]');
                if (connectButton) {
                    connectButton.disabled = false;
                    connectButton.textContent = 'Connect';
                }
            }
        });
    }

    if (disconnectButton) {
        disconnectButton.addEventListener('click', async function() {
            try {
                await mcpClient.disconnect();
                showNotification('Disconnected from server', 'info');
                updateStatusIndicator('disconnected', 'Disconnected');
                
                disconnectButton.classList.add('hidden');
                const connectButton = connectionForm.querySelector('button[type="submit"]');
                if (connectButton) connectButton.classList.remove('hidden');
                
                const serverInfoDiv = document.querySelector('.server-info');
                if (serverInfoDiv) serverInfoDiv.classList.add('hidden');
                
                toolsManager.clearTools();
                
            } catch (error) {
                console.error('Disconnect failed:', error);
                showNotification(`Disconnect failed: ${error.message}`, 'error');
            }
        });
    }

    if (refreshToolsBtn) {
        refreshToolsBtn.addEventListener('click', async function() {
            if (mcpClient.getConnectionStatus().status !== 'connected') {
                showNotification('Please connect to a server first', 'error');
                return;
            }

            try {
                refreshToolsBtn.disabled = true;
                refreshToolsBtn.textContent = 'Loading...';

                const tools = await mcpClient.listTools();
                const result = toolsManager.processTools(tools);
                
                showNotification(`Loaded ${result.processed} tools successfully`, 'success');

            } catch (error) {
                console.error('Failed to refresh tools:', error);
                showNotification(`Failed to refresh tools: ${error.message}`, 'error');
            } finally {
                refreshToolsBtn.disabled = false;
                refreshToolsBtn.textContent = 'Refresh';
            }
        });
    }

    toolsManager.addListener((action, data) => {
        if (action === 'tools_processed') {
            renderToolsList(toolsManager.getTools());
        }
    });

    console.log('MCP Test Frontend loaded successfully');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ValidationUtils, HistoryManager, MCPClient, ToolsManager };
}
