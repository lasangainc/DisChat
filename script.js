document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const messageInput = document.getElementById('message-input');
    const sendButton = document.querySelector('.send-btn');
    const messagesContainer = document.getElementById('messages');
    const newChatButton = document.querySelector('.new-chat-btn');
    const chatList = document.getElementById('chat-list');
    const loginButton = document.querySelector('.login-btn');
    const apiKeyModal = document.getElementById('api-key-modal');
    const closeModal = document.querySelector('.close-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const webSearchButton = document.getElementById('web-search-btn');
    const settingsButton = document.querySelector('.settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const colorSchemeButtons = document.querySelectorAll('.color-scheme-btn');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const sidebarToggleButton = document.getElementById('sidebar-toggle-btn');
    
    // Chat data
    let chats = JSON.parse(localStorage.getItem('chats')) || [];
    let currentChatId = parseInt(localStorage.getItem('currentChatId')) || null;
    let apiKey = localStorage.getItem('apiKey') || localStorage.getItem('groqApiKey') || ''; // Migrate from old key
    let apiProvider = localStorage.getItem('apiProvider') || 'groq';
    let isNewChat = false; // Track if we're in a new chat that hasn't been saved yet
    let currentUser = null; // Track current authenticated user
    
    // Migrate legacy API key if needed
    if (!localStorage.getItem('apiKey') && localStorage.getItem('groqApiKey')) {
        localStorage.setItem('apiKey', localStorage.getItem('groqApiKey'));
        localStorage.setItem('apiProvider', 'groq');
        localStorage.removeItem('groqApiKey');
    }
    
    // API Provider configurations
    const apiProviders = {
        groq: {
            name: 'Groq',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            models: [
                { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (Vision)', category: 'vision' },
                { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', category: 'reasoning' },
                { id: 'llama3-70b-8192', name: 'Llama 3 70B', category: 'general' },
                { id: 'llama3-8b-8192', name: 'Llama 3 8B', category: 'general' },
                { id: 'gemma2-9b-it', name: 'Gemma 2 9B', category: 'general' }
            ]
        },
        openrouter: {
            name: 'OpenRouter',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            models: [
                { id: 'openai/gpt-4o', name: 'GPT-4o', category: 'vision' },
                { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', category: 'reasoning' },
                { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', category: 'general' },
                { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'general' },
                { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', category: 'general' },
                { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', category: 'general' },
                { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', category: 'general' },
                { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', category: 'general' }
            ]
        }
    };
    
    // Initialize color scheme
    const currentTheme = localStorage.getItem('color-theme') || 'default';
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.querySelector(`[data-theme="${currentTheme}"]`)?.classList.add('active');
    
    // Function to populate model selector based on API provider
    function populateModelSelector() {
        const modelSelect = document.getElementById('model-select');
        const currentProvider = apiProviders[apiProvider];
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Add models for current provider
        currentProvider.models.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            if (index === 0) option.selected = true; // Select first model by default
            modelSelect.appendChild(option);
        });
    }
    
    // Authentication functions
    function initializeAuth() {
        if (typeof window.firebaseAuth === 'undefined') {
            console.log('Firebase not loaded, using guest mode');
            return;
        }
        
        console.log('🔥 Initializing Firebase Auth...');
        console.log('🔥 Firebase Auth:', window.firebaseAuth);
        console.log('🔥 Firebase DB:', window.firebaseDB);
        
        // Listen for authentication state changes
        window.onAuthStateChanged(window.firebaseAuth, (user) => {
            if (user) {
                currentUser = user;
                updateUIForLoggedInUser(user);
                console.log('✅ User signed in:', user.displayName || user.email);
                
                // Enable chat sync with a small delay to ensure everything is ready
                setTimeout(() => {
                    enableChatSync();
                }, 500);
            } else {
                currentUser = null;
                updateUIForLoggedOutUser();
                disableChatSync();
                console.log('❌ User signed out');
            }
        });
    }
    
    function handleGoogleLogin() {
        const provider = new window.GoogleAuthProvider();
        window.signInWithPopup(window.firebaseAuth, provider)
            .then((result) => {
                console.log('Google login successful');
                proceedToApiStep();
            })
            .catch((error) => {
                console.error('Google login error:', error);
                alert('Login failed. Please try again.');
            });
    }
    
    function handleGithubLogin() {
        const provider = new window.GithubAuthProvider();
        window.signInWithPopup(window.firebaseAuth, provider)
            .then((result) => {
                console.log('GitHub login successful');
                proceedToApiStep();
            })
            .catch((error) => {
                console.error('GitHub login error:', error);
                alert('Login failed. Please try again.');
            });
    }
    
    function handleGuestLogin() {
        console.log('Continuing as guest');
        proceedToApiStep();
    }
    
    function handleLogout() {
        if (window.firebaseAuth && currentUser) {
            window.signOut(window.firebaseAuth)
                .then(() => {
                    console.log('User signed out successfully');
                })
                .catch((error) => {
                    console.error('Logout error:', error);
                });
        }
        hideUserMenu();
    }
    
    function updateUIForLoggedInUser(user) {
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerHTML = `
            <img src="${user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'}" 
                 alt="User Avatar" 
                 style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;">
            ${user.displayName || user.email}
        `;
        loginBtn.onclick = showUserMenu;
    }
    
    function updateUIForLoggedOutUser() {
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerHTML = '🔑 Login';
        loginBtn.onclick = showSetupModal;
    }
    
    function showSetupModal() {
        document.getElementById('setup-modal').style.display = 'block';
        showStep('auth-step');
    }
    
    function hideSetupModal() {
        document.getElementById('setup-modal').style.display = 'none';
    }
    
    function showStep(stepId) {
        // Hide all steps
        document.querySelectorAll('.setup-step').forEach(step => {
            step.style.display = 'none';
        });
        
        // Show the requested step
        document.getElementById(stepId).style.display = 'block';
    }
    
    function proceedToApiStep() {
        showStep('api-step');
    }
    
    function showSuccessStep() {
        showStep('success-step');
    }
    
    function showUserMenu() {
        // Remove existing menu if present
        const existingOverlay = document.querySelector('.user-menu-overlay');
        if (existingOverlay) {
            hideUserMenu();
            return;
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'user-menu-overlay';
        
        // Create menu
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        
        menu.innerHTML = `
            <div class="user-menu-header">
                <button class="user-menu-close">×</button>
            </div>
            <div class="user-info">
                <img src="${currentUser.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'}" 
                     alt="User Avatar" 
                     class="user-avatar">
                <div class="user-name">${currentUser.displayName || 'User'}</div>
                <div class="user-email">${currentUser.email}</div>
            </div>
            <div class="user-menu-content">
                <div class="user-menu-item api-settings-btn">
                    <span class="menu-icon">⚙️</span>
                    API Settings
                </div>
                <div class="user-menu-item" style="cursor: default;">
                    <span class="menu-icon">☁️</span>
                    Chat Sync
                    <span class="sync-status ${chatSyncEnabled ? '' : 'off'}">${chatSyncEnabled ? 'On' : 'Off'}</span>
                </div>
                <div class="user-menu-item danger logout-btn">
                    <span class="menu-icon">🚪</span>
                    Sign Out
                </div>
            </div>
        `;
        
        // Add event listeners
        const closeBtn = menu.querySelector('.user-menu-close');
        const apiSettingsBtn = menu.querySelector('.api-settings-btn');
        const logoutBtn = menu.querySelector('.logout-btn');
        
        closeBtn.addEventListener('click', hideUserMenu);
        apiSettingsBtn.addEventListener('click', () => {
            showSetupModal(); 
            proceedToApiStep(); 
            hideUserMenu();
        });
        logoutBtn.addEventListener('click', () => {
            handleLogout(); 
            hideUserMenu();
        });
        
        overlay.appendChild(menu);
        document.body.appendChild(overlay);
        
        // Close menu when clicking overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideUserMenu();
            }
        });
        
        // Close menu with Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                hideUserMenu();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    window.hideUserMenu = function() {
        const overlay = document.querySelector('.user-menu-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOutOverlay 0.2s ease forwards';
            const menu = overlay.querySelector('.user-menu');
            if (menu) {
                menu.style.animation = 'slideOutModal 0.2s ease forwards';
            }
            setTimeout(() => {
                overlay.remove();
            }, 200);
        }
    }
    
    function checkApiKeyAndShow() {
        if (!apiKey) {
            showApiKeyModal();
        }
    }

    // Firestore Chat Sync Functions
    let chatSyncEnabled = false;
    let unsubscribeChats = null;
    
    function enableChatSync() {
        if (!window.firebaseDB) {
            console.log('Firestore not available, using local storage');
            return;
        }
        
        if (!currentUser) {
            console.log('User not authenticated, using local storage');
            return;
        }
        
        chatSyncEnabled = true;
        console.log('🔥 Chat sync enabled for user:', currentUser.uid);
        console.log('🔥 Firestore instance:', window.firebaseDB);
        
        // Load chats from Firestore
        loadChatsFromFirestore();
        
        // Set up real-time listener
        setupChatListener();
    }
    
    function disableChatSync() {
        chatSyncEnabled = false;
        if (unsubscribeChats) {
            unsubscribeChats();
            unsubscribeChats = null;
        }
        console.log('Chat sync disabled, using local storage');
    }
    
    async function loadChatsFromFirestore() {
        try {
            console.log('🔥 Loading chats from Firestore for user:', currentUser.uid);
            const chatsRef = window.firestoreCollection(window.firebaseDB, 'users', currentUser.uid, 'chats');
            console.log('🔥 Chats reference created:', chatsRef);
            
            const querySnapshot = await window.firestoreGetDocs(chatsRef);
            console.log('🔥 Query snapshot received:', querySnapshot);
            
            const firestoreChats = [];
            querySnapshot.forEach((doc) => {
                const chatData = doc.data();
                console.log('🔥 Found chat:', doc.id, chatData);
                firestoreChats.push({
                    id: parseInt(doc.id),
                    ...chatData
                });
            });
            
            // Sort by creation date
            firestoreChats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Merge with local chats (prioritize Firestore)
            const localChats = JSON.parse(localStorage.getItem('chats')) || [];
            const mergedChats = mergeChats(firestoreChats, localChats);
            
            chats = mergedChats;
            updateChatList();
            
            console.log(`✅ Loaded ${firestoreChats.length} chats from Firestore`);
        } catch (error) {
            console.error('❌ Error loading chats from Firestore:', error);
            console.error('❌ Error details:', error.message, error.code);
            // Fallback to local storage
            chats = JSON.parse(localStorage.getItem('chats')) || [];
        }
    }
    
    function mergeChats(firestoreChats, localChats) {
        const merged = [...firestoreChats];
        
        // Add local chats that don't exist in Firestore
        localChats.forEach(localChat => {
            const existsInFirestore = firestoreChats.some(fsChat => fsChat.id === localChat.id);
            if (!existsInFirestore) {
                // Ensure local chat has required fields
                if (!localChat.createdAt) {
                    localChat.createdAt = new Date().toISOString();
                }
                if (!localChat.title) {
                    localChat.title = 'Untitled Chat';
                }
                if (!localChat.messages) {
                    localChat.messages = [];
                }
                
                merged.push(localChat);
                // Save to Firestore
                saveChatToFirestore(localChat);
            }
        });
        
        return merged.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate - aDate;
        });
    }
    
    function setupChatListener() {
        if (!currentUser || unsubscribeChats) return;
        
        const chatsRef = window.firestoreCollection(window.firebaseDB, 'users', currentUser.uid, 'chats');
        
        unsubscribeChats = window.firestoreOnSnapshot(chatsRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const chatData = { id: parseInt(change.doc.id), ...change.doc.data() };
                
                if (change.type === 'added' || change.type === 'modified') {
                    // Update local chats array
                    const existingIndex = chats.findIndex(chat => chat.id === chatData.id);
                    if (existingIndex >= 0) {
                        chats[existingIndex] = chatData;
                    } else {
                        chats.unshift(chatData);
                    }
                } else if (change.type === 'removed') {
                    chats = chats.filter(chat => chat.id !== chatData.id);
                }
            });
            
            // Update UI
            updateChatList();
            
            // If current chat was updated, refresh it (but avoid re-rendering during active conversation)
            if (currentChatId && chats.find(chat => chat.id === currentChatId)) {
                const currentChat = chats.find(chat => chat.id === currentChatId);
                if (currentChat) {
                    // Only refresh if the message count is different (to avoid overriding animations)
                    const currentMessageCount = messagesContainer.children.length;
                    const actualMessageCount = currentChat.messages.length;
                    
                    // Only re-render if there's a significant difference (e.g., messages were deleted or chat was switched)
                    if (Math.abs(currentMessageCount - actualMessageCount) > 1) {
                        displayChatMessages(currentChat.messages);
                    }
                }
            }
        });
    }
    
    async function saveChatToFirestore(chat) {
        if (!chatSyncEnabled || !currentUser) {
            console.log('❌ Cannot save chat - sync disabled or user not authenticated');
            return;
        }
        
        try {
            console.log('🔥 Saving chat to Firestore:', chat.id);
            console.log('🔥 Chat data:', chat);
            
            // Ensure createdAt exists and is valid
            const createdAt = chat.createdAt || new Date().toISOString();
            
            const chatRef = window.firestoreDoc(window.firebaseDB, 'users', currentUser.uid, 'chats', chat.id.toString());
            await window.firestoreSetDoc(chatRef, {
                title: chat.title || 'Untitled Chat',
                messages: chat.messages || [],
                createdAt: createdAt,
                updatedAt: new Date().toISOString()
            });
            
            console.log('✅ Chat saved to Firestore:', chat.id);
        } catch (error) {
            console.error('❌ Error saving chat to Firestore:', error);
            console.error('❌ Error details:', error.message, error.code);
        }
    }
    
    async function deleteChatFromFirestore(chatId) {
        if (!chatSyncEnabled || !currentUser) {
            return;
        }
        
        try {
            const chatRef = window.firestoreDoc(window.firebaseDB, 'users', currentUser.uid, 'chats', chatId.toString());
            await window.firestoreDeleteDoc(chatRef);
            
            console.log('Chat deleted from Firestore:', chatId);
        } catch (error) {
            console.error('Error deleting chat from Firestore:', error);
        }
    }
    
    function displayChatMessages(messages) {
        messagesContainer.innerHTML = '';
        messages.forEach(message => {
            addMessageToUI(message.sender, message.text, message.searchResults, message.attachedFiles);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Initialize the UI
    function initializeUI() {
        // Populate model selector based on current API provider
        populateModelSelector();
        
        // Setup API provider change listener
        const providerRadios = document.querySelectorAll('input[name="api-provider"]');
        providerRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    apiProvider = this.value;
                    populateModelSelector();
                    // Update placeholder text
                    const apiKeyInput = document.getElementById('api-key-input');
                    apiKeyInput.placeholder = `Enter your ${apiProviders[apiProvider].name} API key`;
                }
            });
        });
        
        // Set initial provider selection
        document.querySelector(`input[name="api-provider"][value="${apiProvider}"]`).checked = true;
        
        // Initialize authentication
        initializeAuth();
        
        // Clear example questions and suggestions when messages exist
        if (messagesContainer.children.length > 0) {
            document.querySelector('.example-questions').style.display = 'none';
            document.querySelector('.suggestions').style.display = 'none';
        }
        
        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            
            // Fade out welcome content when user starts typing
            handleWelcomeContentVisibility();
        });
        
        // Setup drag and drop functionality
        setupDragAndDrop();
        
        // Setup file upload button
        setupFileUploadButton();
        
        // Show setup modal if needed
        const hasSeenLogin = localStorage.getItem('hasSeenLogin');
        if (!hasSeenLogin) {
            showSetupModal();
            localStorage.setItem('hasSeenLogin', 'true');
        } else if (!apiKey) {
            showSetupModal();
            proceedToApiStep();
        }
        
        // If no chats exist or no current chat, start with a new chat interface
        if (chats.length === 0 || !currentChatId || !chats.find(chat => chat.id === currentChatId)) {
            startNewChat();
        } else {
            switchChat(currentChatId);
        }
    }
    
    // Start a new chat (UI only, not saved until first message)
    function startNewChat() {
        isNewChat = true;
        currentChatId = null;
        
        // Clear messages container
        messagesContainer.innerHTML = '';
        
        // Show welcome content
        const welcomeContent = document.getElementById('welcome-content');
        if (welcomeContent) {
            welcomeContent.style.display = 'block';
            welcomeContent.classList.remove('fade-out');
        }
        
        // Show example questions and suggestions
        document.querySelector('.welcome-header').style.display = 'block';
        document.querySelector('.example-questions').style.display = 'flex';
        document.querySelector('.suggestion-tabs').style.display = 'flex';
        
        // Clear message input
        document.getElementById('message-input').value = '';
        
        // Update chat list to show no active chat
        updateChatList();
    }
    
    // Generate chat title using AI
    async function generateChatTitle(firstMessage) {
        try {
            // Use appropriate model for title generation based on provider
            let titleModel;
            if (apiProvider === 'groq') {
                titleModel = 'llama3-8b-8192';
            } else if (apiProvider === 'openrouter') {
                titleModel = 'meta-llama/llama-3.1-8b-instruct';
            }
            
            const systemMessage = {
                role: 'system',
                content: 'You are DisChat. Generate a short, descriptive title (3-5 words max) for a chat that starts with this message. Only respond with the title, nothing else.'
            };
            
            const requestBody = {
                model: titleModel,
                messages: [
                    systemMessage,
                    { role: 'user', content: firstMessage }
                ],
                temperature: 0.3,
                max_tokens: 20
            };
            
            // Prepare headers based on API provider
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            
            // Add OpenRouter specific headers
            if (apiProvider === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'DisChat';
            }
            
            const response = await fetch(apiProviders[apiProvider].endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.choices[0].message.content.trim().replace(/['"]/g, '');
            }
        } catch (error) {
            console.error('Error generating chat title:', error);
        }
        
        // Fallback to first few words if AI naming fails
        const words = firstMessage.split(' ');
        return words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
    }
    
    // Create and save a new chat with the first message
    async function createNewChatWithMessage(userMessage, aiResponse, searchResults = null, attachedFiles = []) {
        const newChatId = chats.length > 0 ? Math.max(...chats.map(chat => chat.id)) + 1 : 1;
        
        // Generate AI title for the chat
        const chatTitle = await generateChatTitle(userMessage);
        
        const newChat = {
            id: newChatId,
            title: chatTitle,
            messages: []
        };
        
        // Add user message
        const userMsg = {
            sender: 'user',
            text: userMessage,
            timestamp: new Date().toISOString()
        };
        
        // Add attached files if they exist
        if (attachedFiles && attachedFiles.length > 0) {
            userMsg.attachedFiles = attachedFiles;
        }
        
        newChat.messages.push(userMsg);
            
            // Add AI response
        const aiMsg = {
                sender: 'ai',
            text: aiResponse,
                timestamp: new Date().toISOString()
        };
        if (searchResults && searchResults.length > 0) {
            aiMsg.searchResults = searchResults;
        }
        newChat.messages.push(aiMsg);
        
        // Add to chats array and set as current
        chats.push(newChat);
        currentChatId = newChatId;
        isNewChat = false;
        
        // Save to localStorage
            localStorage.setItem('chats', JSON.stringify(chats));
            localStorage.setItem('currentChatId', currentChatId);
            
            // Save to Firestore if sync enabled
            if (chatSyncEnabled) {
                saveChatToFirestore(newChat);
            }
        
        // Update chat list
        updateChatList();
        
        return newChat;
    }
    
    // Save message to current chat with search results
    function saveMessageToChat(sender, text, searchResults = null, attachedFiles = []) {
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (!currentChat) return; // Don't save if no current chat exists
        
        const message = {
            sender: sender,
            text: text,
                timestamp: new Date().toISOString()
        };
        
        // Add search results if they exist
        if (searchResults && searchResults.length > 0) {
            message.searchResults = searchResults;
        }
        
        // Add attached files if they exist
        if (attachedFiles && attachedFiles.length > 0) {
            message.attachedFiles = attachedFiles;
        }
        
        currentChat.messages.push(message);
            
            // Save chats to localStorage
            localStorage.setItem('chats', JSON.stringify(chats));
            localStorage.setItem('currentChatId', currentChatId);
            
            // Save to Firestore if sync enabled
            if (chatSyncEnabled) {
                const currentChat = chats.find(chat => chat.id === currentChatId);
                if (currentChat) {
                    saveChatToFirestore(currentChat);
                }
            }
    }
    
    // Function to animate AI response lines
    function animateAIResponseLines(contentElement, htmlContent, shouldAnimate = true) {
        // Clear the content first
        contentElement.innerHTML = '';
        
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Function to process and animate elements
        function processElements(elements, container) {
            elements.forEach((element, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = shouldAnimate ? 'ai-response-line animating' : 'ai-response-line';
                
                // Clone the element to preserve its structure
                const clonedElement = element.cloneNode(true);
                wrapper.appendChild(clonedElement);
                
                container.appendChild(wrapper);
                
                if (shouldAnimate) {
                    // Set a dynamic delay based on index
                    const delay = (index + 1) * 0.15; // 150ms between each line
                    wrapper.style.animationDelay = `${delay}s`;
                    
                    // Remove the animating class after the animation completes
                    const animationDuration = 600 + (delay * 1000); // 600ms base + delay
                    setTimeout(() => {
                        wrapper.classList.remove('animating');
                    }, animationDuration);
                }
            });
        }
        
        // Get all direct children from the temp div
        const elements = Array.from(tempDiv.children);
        
        // If no direct children (just text), wrap in paragraphs
        if (elements.length === 0 && tempDiv.textContent.trim()) {
            const lines = tempDiv.innerHTML.split(/(<br\s*\/?>|\n)/);
            lines.forEach((line, index) => {
                if (line.trim() && !line.match(/<br\s*\/?>/)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = shouldAnimate ? 'ai-response-line animating' : 'ai-response-line';
                    wrapper.innerHTML = line;
                    contentElement.appendChild(wrapper);
                    
                    if (shouldAnimate) {
                        const delay = (index + 1) * 0.15;
                        wrapper.style.animationDelay = `${delay}s`;
                        
                        // Remove the animating class after the animation completes
                        const animationDuration = 600 + (delay * 1000);
                        setTimeout(() => {
                            wrapper.classList.remove('animating');
                        }, animationDuration);
                    }
                }
            });
        } else {
            processElements(elements, contentElement);
        }
    }

    // Update addMessageToUI to handle stored search results, markdown, and file attachments
    function addMessageToUI(sender, text, searchResults = null, attachedFiles = [], shouldAnimate = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (sender === 'user') {
            messageElement.classList.add('user-message');
        } else {
            messageElement.classList.add('ai-message');
        }
        
        const content = document.createElement('div');
        content.classList.add('message-content');
        
        // Render markdown for AI messages, plain text for user messages
        if (sender === 'ai' && typeof marked !== 'undefined') {
            // Configure marked for better paragraph handling
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            
            // Check for DeepSeek thinking sections
            const thinkingResult = processDeepSeekThinking(text);
            
            if (thinkingResult.hasThinking) {
                // Create thinking element
                const thinkingElement = createThinkingElement(thinkingResult.thinkingContent, thinkingResult.thinkingTime);
                content.appendChild(thinkingElement);
                
                // Parse and add main response with animation
                const mainContentDiv = document.createElement('div');
                const parsedContent = marked.parse(thinkingResult.mainResponse);
                animateAIResponseLines(mainContentDiv, parsedContent, shouldAnimate);
                content.appendChild(mainContentDiv);
                
                // Enhance code blocks in main content after animation
                setTimeout(() => {
                    enhanceCodeBlocks(mainContentDiv);
                }, shouldAnimate ? 100 : 0);
            } else {
                // Regular AI response without thinking - animate the content
                const parsedContent = marked.parse(text);
                animateAIResponseLines(content, parsedContent, shouldAnimate);
                
                // Enhance code blocks after animation starts
                setTimeout(() => {
                    enhanceCodeBlocks(content);
                }, shouldAnimate ? 100 : 0);
                
                // Add search results
                if (searchResults && searchResults.length > 0) {
                    setTimeout(() => {
                        addSearchResultsToContent(content, searchResults);
                    }, shouldAnimate ? 200 : 0);
                }
            }
        } else {
            // For user messages, convert line breaks to paragraphs
            const paragraphs = text.split('\n\n').filter(p => p.trim());
            if (paragraphs.length > 1) {
                content.innerHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
            } else {
                content.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
            }
        }

        // Add file attachments if any
        if (attachedFiles && attachedFiles.length > 0) {
            const filesContainer = document.createElement('div');
            filesContainer.className = 'message-files';
            
            attachedFiles.forEach(file => {
                const fileElement = document.createElement('div');
                fileElement.className = 'message-file';
                
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = file.data;
                    img.alt = file.name;
                    img.className = 'message-image';
                    fileElement.appendChild(img);
                } else if (file.type === 'application/pdf') {
                    const pdfIcon = document.createElement('div');
                    pdfIcon.className = 'message-pdf';
                    pdfIcon.innerHTML = `📄 ${file.name}`;
                    fileElement.appendChild(pdfIcon);
                }
                
                filesContainer.appendChild(fileElement);
            });
            
            content.appendChild(filesContainer);
        }


        
        messageElement.appendChild(content);
        
        // Add regenerate button for AI messages
        if (sender === 'ai') {
            const regenerateBtn = createRegenerateButton(messageElement);
            messageElement.appendChild(regenerateBtn);
        }
        
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageElement;
    }

    // Create regenerate button for AI messages
    function createRegenerateButton(messageElement) {
        const regenerateBtn = document.createElement('button');
        regenerateBtn.className = 'regenerate-btn';
        regenerateBtn.innerHTML = '🔄 Regenerate';
        regenerateBtn.title = 'Regenerate this response';
        regenerateBtn.onclick = () => regenerateResponse(messageElement);
        return regenerateBtn;
    }
    

    
    // Regenerate AI response
    async function regenerateResponse(messageElement) {
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (!currentChat) return;
        
        const allMessages = messagesContainer.querySelectorAll('.message');
        const messageIndex = Array.from(allMessages).indexOf(messageElement);
        
        // Find the last user message before this AI response
        let lastUserMessage = null;
        let userMessageIndex = -1;
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (currentChat.messages[i].sender === 'user') {
                lastUserMessage = currentChat.messages[i];
                userMessageIndex = i;
                break;
            }
        }
        
        if (!lastUserMessage) {
            alert('Cannot regenerate: No user message found before this response.');
            return;
        }
        
        // Show loading in current message
        const contentElement = messageElement.querySelector('.message-content');
        const originalContent = contentElement.innerHTML;
        contentElement.innerHTML = '<div class="loading-indicator">🔄 Regenerating...</div>';
        
        try {
            // Get chat history up to the user message
            const chatHistory = currentChat.messages.slice(0, userMessageIndex);
            
            const response = await fetchAPIResponse(
                lastUserMessage.text, 
                chatHistory, 
                lastUserMessage.attachedFiles || []
            );
            
            // Update the message content
            if (typeof marked !== 'undefined') {
                contentElement.innerHTML = marked.parse(response);
                enhanceCodeBlocks(contentElement);
            } else {
                contentElement.innerHTML = `<p>${response.replace(/\n/g, '<br>')}</p>`;
            }
            
            // Update chat data
            currentChat.messages[messageIndex].text = response;
            currentChat.messages[messageIndex].timestamp = new Date().toISOString();
            
            // Save changes
            localStorage.setItem('chats', JSON.stringify(chats));
            
            // Sync to Firestore if enabled
            if (chatSyncEnabled) {
                saveChatToFirestore(currentChat);
            }
            
        } catch (error) {
            console.error('Error regenerating response:', error);
            contentElement.innerHTML = originalContent;
            alert('Failed to regenerate response. Please try again.');
        }
    }

    // Helper function to add search results to content
    function addSearchResultsToContent(content, searchResults) {
        // Check if search results already exist to prevent duplicates
        if (content.querySelector('.message-sources') || content.querySelector('.web-search-icon')) {
            return; // Search results already exist, don't add duplicates
        }
        
        // Add globe icon
        const globeIcon = document.createElement('img');
        globeIcon.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0xIDE3LjkzYy0zLjk1LS40OS03LTMuODUtNy03LjkzIDAtLjYyLjA4LTEuMjEuMjEtMS43OUw5IDEzdjFjMCAxLjEuOSAyIDIgMnYzLjkzek0xNy45IDEyYy0uMTUgMS45Ni0xLjA0IDMuNy0yLjQgNC45M1YxNGgtMmMtLjU1IDAtMS0uNDUtMS0xdi0ySDguMDdsLTIuODctMi44N2MuNDItLjY4LjkzLTEuMjkgMS41My0xLjgyTDguNCA4aDJWNmMwLTEuMS45LTIgMi0yaDJ2LS4yM2MuOTQuMDUgMS44My4yNyAyLjY3LjY0di4wM2MuMzEuMTIuNjEuMjcuODkuNDNsLjctLjdjLS4xOS0uMTYtLjM5LS4zMi0uNi0uNDV2LS4wM2MtLjg0LS4zNy0xLjczLS41OS0yLjY3LS42NEM5LjY1IDMuMjggNi4zOSA2LjE4IDYuMDQgOWwtLjkzLS45M0M2LjQ4IDUuNCA5LjAyIDMuMjggMTIgM2MxLjg5IDAgMy42My42NiA1IDEuNzZWNGgtMmMtLjU1IDAtMSAuNDUtMSAxdjJoMmMxLjEgMCAyIC45IDIgMnYyaDJ2MmgtMnoiLz48L3N2Zz4=';
        globeIcon.classList.add('web-search-icon');
        content.appendChild(globeIcon);
        
        // Add sources container
        const sourcesContainer = document.createElement('div');
        sourcesContainer.classList.add('message-sources');
        
        // Add source pills
        searchResults.forEach(result => {
            const sourceLink = document.createElement('a');
            sourceLink.href = result.url.startsWith('http') ? result.url : 'https://' + result.url;
            sourceLink.target = '_blank';
            sourceLink.classList.add('source-pill');
            sourceLink.textContent = result.title;
            sourceLink.title = result.title;
            sourcesContainer.appendChild(sourceLink);
        });
        
        content.appendChild(sourcesContainer);
    }

    // Function to enhance code blocks with filenames and preview buttons
    function enhanceCodeBlocks(contentElement) {
        const codeBlocks = contentElement.querySelectorAll('pre code');
        
        codeBlocks.forEach(codeBlock => {
            const pre = codeBlock.parentElement;
            const codeText = codeBlock.textContent;
            
            // Extract filename from code block if present
            const filenameMatch = codeText.match(/filename="([^"]+)"/);
            const filename = filenameMatch ? filenameMatch[1] : null;
            
            // Determine if code is web-runnable
            const language = codeBlock.className.match(/language-(\w+)/)?.[1] || '';
            const isWebRunnable = isWebRunnableCode(language, codeText);
            
            // Create container for the enhanced code block
            const container = document.createElement('div');
            container.className = 'code-block-container collapsed';
            
            // Create header with filename and actions
            const header = document.createElement('div');
            header.className = 'code-block-header';
            
            // Add expand/collapse button
            const expandBtn = document.createElement('button');
            expandBtn.className = 'expand-code-btn';
            expandBtn.innerHTML = '▶';
            expandBtn.onclick = () => toggleCodeBlock(container, expandBtn);
            
            const filenameSpan = document.createElement('span');
            filenameSpan.className = 'code-filename';
            filenameSpan.textContent = filename || `${language || 'code'} snippet`;
            
            const actions = document.createElement('div');
            actions.className = 'code-actions';
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.innerHTML = '📋 Copy';
            copyBtn.onclick = () => copyCodeToClipboard(codeText, copyBtn);
            
            actions.appendChild(copyBtn);
            
            // Preview button for web-runnable code
            if (isWebRunnable) {
                const previewBtn = document.createElement('button');
                previewBtn.className = 'preview-code-btn';
                previewBtn.innerHTML = '👁️ Preview';
                previewBtn.onclick = () => showCodePreview(codeText, filename || 'preview.html');
                actions.appendChild(previewBtn);
            }
            
            header.appendChild(expandBtn);
            header.appendChild(filenameSpan);
            header.appendChild(actions);
            
            // Create collapsible content wrapper
            const codeContent = document.createElement('div');
            codeContent.className = 'code-content';
            
            // Replace the original pre element
            pre.parentNode.insertBefore(container, pre);
            codeContent.appendChild(pre);
            container.appendChild(header);
            container.appendChild(codeContent);
            
            // Clean up the code text (remove filename attribute)
            if (filenameMatch) {
                codeBlock.textContent = codeText.replace(/filename="[^"]+"\s*/, '');
            }
        });
    }
    
    // Function to toggle code block expansion
    function toggleCodeBlock(container, expandBtn) {
        const isCollapsed = container.classList.contains('collapsed');
        
        if (isCollapsed) {
            container.classList.remove('collapsed');
            expandBtn.innerHTML = '▼';
        } else {
            container.classList.add('collapsed');
            expandBtn.innerHTML = '▶';
        }
    }
    
    // Function to process DeepSeek thinking sections
    function processDeepSeekThinking(text) {
        const thinkingMatch = text.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/);
        
        if (thinkingMatch) {
            const thinkingContent = thinkingMatch[1].trim();
            const mainResponse = thinkingMatch[2].trim();
            
            // Calculate rough thinking time (assume slower processing for thinking)
            const wordCount = thinkingContent.split(/\s+/).length;
            const thinkingTime = Math.max(1, Math.round(wordCount / 20)); // Slower processing for deep thinking
            
            return {
                hasThinking: true,
                thinkingContent: thinkingContent,
                mainResponse: mainResponse,
                thinkingTime: thinkingTime
            };
        }
        
        return {
            hasThinking: false,
            thinkingContent: '',
            mainResponse: text,
            thinkingTime: 0
        };
    }
    
    // Function to create thinking UI element
    function createThinkingElement(thinkingContent, thinkingTime) {
        const thinkingContainer = document.createElement('div');
        thinkingContainer.className = 'thinking-container collapsed';
        
        // Create thinking header
        const thinkingHeader = document.createElement('div');
        thinkingHeader.className = 'thinking-header';
        thinkingHeader.onclick = () => toggleThinking(thinkingContainer, thinkingHeader);
        
        const thinkingIcon = document.createElement('span');
        thinkingIcon.className = 'thinking-icon';
        thinkingIcon.textContent = '🧠';
        
        const thinkingLabel = document.createElement('span');
        thinkingLabel.className = 'thinking-label';
        thinkingLabel.textContent = `Thought for ${thinkingTime} seconds`;
        
        const expandIcon = document.createElement('span');
        expandIcon.className = 'thinking-expand-icon';
        expandIcon.textContent = '▶';
        
        thinkingHeader.appendChild(thinkingIcon);
        thinkingHeader.appendChild(thinkingLabel);
        thinkingHeader.appendChild(expandIcon);
        
        // Create thinking content
        const thinkingContentEl = document.createElement('div');
        thinkingContentEl.className = 'thinking-content';
        
        // Use marked to parse thinking content as markdown
        if (typeof marked !== 'undefined') {
            thinkingContentEl.innerHTML = marked.parse(thinkingContent);
        } else {
            thinkingContentEl.innerHTML = `<pre>${thinkingContent}</pre>`;
        }
        
        thinkingContainer.appendChild(thinkingHeader);
        thinkingContainer.appendChild(thinkingContentEl);
        
        return thinkingContainer;
    }
    
    // Function to toggle thinking section
    function toggleThinking(container, header) {
        const isCollapsed = container.classList.contains('collapsed');
        const expandIcon = header.querySelector('.thinking-expand-icon');
        
        if (isCollapsed) {
            container.classList.remove('collapsed');
            expandIcon.textContent = '▼';
        } else {
            container.classList.add('collapsed');
            expandIcon.textContent = '▶';
        }
    }

    // Setup drag and drop functionality
    function setupDragAndDrop() {
        const chatContainer = document.querySelector('.chat-container');
        const messageInputContainer = document.querySelector('.message-input-container');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop area when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            chatContainer.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        chatContainer.addEventListener('drop', handleDrop, false);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            chatContainer.classList.add('drag-over');
        }

        function unhighlight(e) {
            chatContainer.classList.remove('drag-over');
        }

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }
    }

    // Handle uploaded files
    function handleFiles(files) {
        [...files].forEach(uploadFile);
    }

    // Upload and process individual file
    function uploadFile(file) {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            alert('Only images (JPEG, PNG, GIF, WebP) and PDF files are supported.');
            return;
        }

        // Check file size - stricter limits for images due to base64 encoding
        let maxSize;
        if (file.type.startsWith('image/')) {
            // For images: 3MB limit (base64 encoding increases size ~33%, and Groq has 4MB limit)
            maxSize = 3 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('Image files must be less than 3MB due to API limitations. Please compress your image and try again.');
                return;
            }
        } else {
            // For PDFs: 5MB limit  
            maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('PDF files must be less than 5MB.');
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            if (file.type === 'application/pdf') {
                // For PDFs, we'll extract text content
                extractPDFText(file, e.target.result);
            } else {
                // For images, use base64 data directly
                const base64Data = e.target.result;
                addFileToInput(file, base64Data);
            }
        };
        
        if (file.type === 'application/pdf') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsDataURL(file);
        }
    }

    // Function to extract text from PDF using PDF.js
    async function extractPDFText(file, arrayBuffer) {
        try {
            // Load PDF.js library if not already loaded
            if (typeof pdfjsLib === 'undefined') {
                await loadPDFJS();
            }

            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            
            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `Page ${i}:\n${pageText}\n\n`;
            }

            // Create a file object with extracted text
            const pdfData = {
                name: file.name,
                type: file.type,
                size: file.size,
                extractedText: fullText,
                data: `data:text/plain;base64,${btoa(fullText)}`
            };

            addFileToInput(file, pdfData);
            
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            alert('Failed to extract text from PDF. The file might be corrupted or password-protected.');
        }
    }

    // Function to load PDF.js library dynamically
    function loadPDFJS() {
        return new Promise((resolve, reject) => {
            if (typeof pdfjsLib !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                // Set worker source
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Add file to input area with preview
    function addFileToInput(file, fileData) {
        const filePreview = document.getElementById('file-preview');
        const fileUploadBtn = document.getElementById('file-upload-btn');
        
        // Show file preview area
        filePreview.style.display = 'flex';
        fileUploadBtn.classList.add('has-files');
        
        // Create file item
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileName = file.name;
        fileItem.dataset.fileType = file.type;
        fileItem.dataset.fileSize = file.size;
        
        if (file.type.startsWith('image/')) {
            // Handle images
            fileItem.dataset.fileData = fileData;
            fileItem.innerHTML = `
                <div class="file-thumbnail">
                    <img src="${fileData}" alt="${file.name}">
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
                <button class="remove-file-btn" onclick="removeFile(this)">×</button>
            `;
        } else if (file.type === 'application/pdf') {
            // Handle PDFs with extracted text
            fileItem.dataset.fileData = fileData.data;
            fileItem.dataset.extractedText = fileData.extractedText;
            
            // Show preview of extracted text (first 200 characters)
            const textPreview = fileData.extractedText.substring(0, 200) + (fileData.extractedText.length > 200 ? '...' : '');
            
            fileItem.innerHTML = `
                <div class="file-thumbnail pdf-thumbnail">
                    <div class="pdf-icon">📄</div>
                    <div class="pdf-pages">${fileData.extractedText.split('Page ').length - 1} pages</div>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                    <div class="pdf-preview">${textPreview}</div>
                </div>
                <button class="remove-file-btn" onclick="removeFile(this)">×</button>
            `;
        }
        
        filePreview.appendChild(fileItem);
    }

    // Get attached files with proper data structure
    function getAttachedFiles() {
        const fileItems = document.querySelectorAll('.file-item');
        return Array.from(fileItems).map(item => {
            const fileData = {
                name: item.dataset.fileName,
                type: item.dataset.fileType,
                size: parseInt(item.dataset.fileSize),
                data: item.dataset.fileData
            };
            
            // Add extracted text for PDFs
            if (item.dataset.extractedText) {
                fileData.extractedText = item.dataset.extractedText;
            }
            
            return fileData;
        });
    }

    // Remove individual file
    function removeFile(button) {
        const fileItem = button.parentElement;
        fileItem.remove();
        
        // Update file upload button state
        updateFileUploadButtonState();
        
        // Hide file preview if no files left
        const filePreview = document.getElementById('file-preview');
        if (filePreview.children.length === 0) {
            filePreview.style.display = 'none';
            document.getElementById('file-upload-btn').classList.remove('has-files');
        }
    }

    // Make removeFile globally accessible
    window.removeFile = removeFile;

    // Clear all file previews
    function clearFilePreview() {
        const filePreview = document.getElementById('file-preview');
        filePreview.innerHTML = '';
        filePreview.style.display = 'none';
        document.getElementById('file-upload-btn').classList.remove('has-files');
    }

    // Setup file upload button functionality
    function setupFileUploadButton() {
        const fileUploadBtn = document.getElementById('file-upload-btn');
        const fileInput = document.getElementById('file-input');
        
        // Handle file upload button click
        fileUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleFiles(files);
                // Clear the input so the same file can be selected again
                fileInput.value = '';
            }
        });
    }

    // Update file upload button state based on attached files
    function updateFileUploadButtonState() {
        const fileUploadBtn = document.getElementById('file-upload-btn');
        const filePreviewContainer = document.querySelector('.file-preview-container');
        const hasFiles = filePreviewContainer && filePreviewContainer.children.length > 0;
        
        if (hasFiles) {
            fileUploadBtn.classList.add('has-files');
            fileUploadBtn.title = `${filePreviewContainer.children.length} file(s) attached`;
        } else {
            fileUploadBtn.classList.remove('has-files');
            fileUploadBtn.title = 'Upload files (images, PDFs)';
        }
    }



    // Function to determine if code is web-runnable
    function isWebRunnableCode(language, codeText) {
        if (language === 'html') return true;
        if (language === 'javascript' || language === 'js') {
            // Check if it's a complete HTML document with embedded JS
            return codeText.includes('<html') || codeText.includes('<!DOCTYPE');
        }
        if (language === 'css') {
            // CSS alone isn't runnable, but we could wrap it in HTML
            return false;
        }
        // Check for HTML-like content even without language specification
        return codeText.includes('<!DOCTYPE html') || 
               (codeText.includes('<html') && codeText.includes('</html>'));
    }

    // Function to copy code to clipboard
    async function copyCodeToClipboard(codeText, button) {
        try {
            await navigator.clipboard.writeText(codeText);
            const originalText = button.innerHTML;
            button.innerHTML = '✅ Copied!';
            button.style.color = '#28a745';
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.color = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
            button.innerHTML = '❌ Failed';
            setTimeout(() => {
                button.innerHTML = '📋 Copy';
            }, 2000);
        }
    }

    // Function to show code preview
    function showCodePreview(codeText, filename) {
        const previewPanel = document.getElementById('code-preview-panel');
        const chatContainer = document.querySelector('.chat-container');
        const iframe = document.getElementById('preview-iframe');
        
        // Show preview panel
        previewPanel.classList.add('active');
        chatContainer.classList.add('with-preview');
        
        // Update preview title
        const previewText = document.querySelector('.preview-text');
        previewText.textContent = `Live Preview - ${filename}`;
        
        // Create HTML content for iframe
        let htmlContent = codeText;
        
        // If it's not a complete HTML document, wrap it
        if (!codeText.includes('<!DOCTYPE html') && !codeText.includes('<html')) {
            htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Preview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    </style>
</head>
<body>
    ${codeText}
</body>
</html>`;
        }
        
        // Add base tag to prevent navigation and script to handle link clicks
        const baseTag = '<base target="_blank">';
        const linkScript = `
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Prevent navigation within iframe
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.href) {
            e.preventDefault();
            window.open(e.target.href, '_blank');
        }
    });
    
    // Prevent form submissions that could navigate
    document.addEventListener('submit', function(e) {
        if (e.target.tagName === 'FORM') {
            e.preventDefault();
            console.log('Form submission prevented in preview');
        }
    });
});
</script>`;
        
        // Insert base tag and script into the HTML
        if (htmlContent.includes('<head>')) {
            htmlContent = htmlContent.replace('<head>', '<head>' + baseTag);
            htmlContent = htmlContent.replace('</body>', linkScript + '</body>');
        } else {
            htmlContent = baseTag + htmlContent + linkScript;
        }
        
        // Set iframe content
        iframe.srcdoc = htmlContent;
    }

    // Function to close code preview
    function closeCodePreview() {
        const previewPanel = document.getElementById('code-preview-panel');
        const chatContainer = document.querySelector('.chat-container');
        
        previewPanel.classList.remove('active');
        chatContainer.classList.remove('with-preview');
    }
    
    // Update switchChat to restore search results
    function switchChat(chatId) {
        currentChatId = parseInt(chatId);
        isNewChat = false;
        
        // Save current chat ID to localStorage
        localStorage.setItem('currentChatId', currentChatId);
        
        // Update active chat in the list
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Clear messages container
        messagesContainer.innerHTML = '';
        
        // Load messages for the selected chat
        const currentChat = chats.find(chat => chat.id === currentChatId);
        
        const welcomeContent = document.getElementById('welcome-content');
        
        if (currentChat && currentChat.messages.length === 0) {
            // Show welcome content if no messages
            if (welcomeContent) {
                welcomeContent.style.display = 'block';
                welcomeContent.classList.remove('fade-out');
            }
            document.querySelector('.welcome-header').style.display = 'block';
            document.querySelector('.example-questions').style.display = 'flex';
            document.querySelector('.suggestion-tabs').style.display = 'flex';
        } else if (currentChat) {
            // Hide welcome content
            if (welcomeContent) {
                welcomeContent.style.display = 'none';
            }
            document.querySelector('.welcome-header').style.display = 'none';
            document.querySelector('.example-questions').style.display = 'none';
            document.querySelector('.suggestion-tabs').style.display = 'none';
            
            // Display messages with their search results
            currentChat.messages.forEach(message => {
                addMessageToUI(message.sender, message.text, message.searchResults || null, message.attachedFiles || []);
            });
        }
        
        // Update chat list to show active chat
        updateChatList();
    }
    
    // Function to get current chat history
    function getCurrentChatHistory() {
        if (isNewChat || !currentChatId) {
            return [];
        }
        const currentChat = chats.find(chat => chat.id === currentChatId);
        return currentChat ? currentChat.messages : [];
    }

    // Function to add message to current chat history
    function addToCurrentChatHistory(sender, text, searchResults = null) {
        if (isNewChat) {
            // For new chats, we'll handle this in createNewChatWithMessage
            return;
        }
        saveMessageToChat(sender, text, searchResults);
    }

    // Function to send message
    async function sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        // Get attached files
        const attachedFiles = getAttachedFiles();
        
        if (!message && attachedFiles.length === 0) return;
        
        // Check if API key is available
        if (!apiKey) {
            showApiKeyModal();
            return;
        }
        
        // Hide welcome content
        const welcomeContent = document.getElementById('welcome-content');
        if (welcomeContent) {
            welcomeContent.style.display = 'none';
        }
        document.querySelector('.welcome-header').style.display = 'none';
        document.querySelector('.example-questions').style.display = 'none';
        document.querySelector('.suggestion-tabs').style.display = 'none';
        
        // Add user message to UI (with files if any)
        addMessageToUI('user', message, null, attachedFiles);
        
        // Clear input and file previews
        messageInput.value = '';
        messageInput.style.height = 'auto';
        clearFilePreview();
        
        // Add loading message for AI with bouncing dots
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'message ai-message';
        loadingMessage.innerHTML = `
            <div class="message-content">
                <div class="bouncing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(loadingMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        try {
            // Get AI response (with potential search and files)
            const result = await fetchAPIResponseWithSearchIndicator(message, getCurrentChatHistory(), loadingMessage, attachedFiles);
            
            // Remove loading message
            messagesContainer.removeChild(loadingMessage);
            
            // Add AI response to UI
            addMessageToUI('ai', result.response, result.searchResults, [], true);
            
            // Handle chat creation/saving
            if (isNewChat) {
                // Create new chat with both messages
                await createNewChatWithMessage(message, result.response, result.searchResults, attachedFiles);
            } else {
                // Save messages to existing chat
                saveMessageToChat('user', message, null, attachedFiles);
                saveMessageToChat('ai', result.response, result.searchResults);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Remove loading message
            if (loadingMessage.parentNode) {
                messagesContainer.removeChild(loadingMessage);
            }
            
            // Add error message
            const errorMessage = 'Sorry, I encountered an error. Please try again.';
            addMessageToUI('ai', errorMessage, null, [], true);
            
            // Handle error message saving
            if (isNewChat) {
                await createNewChatWithMessage(message, errorMessage);
            } else {
                saveMessageToChat('user', message);
                saveMessageToChat('ai', errorMessage);
            }
        }
    }
    
    // Create new chat (just UI, not saved)
    function createNewChat() {
        startNewChat();
    }
    
    // Update chat list in sidebar
    function updateChatList() {
        chatList.innerHTML = '';
        
        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            if (chat.id === currentChatId) {
                chatItem.classList.add('active');
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = chat.title;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-chat-btn');
            deleteBtn.title = 'Delete chat';
            deleteBtn.textContent = '🗑️';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent chat selection when deleting
                deleteChat(chat.id);
            };
            
            chatItem.appendChild(titleSpan);
            chatItem.appendChild(deleteBtn);
            chatItem.addEventListener('click', () => switchChat(chat.id));
            
            chatList.appendChild(chatItem);
        });
    }
    
        // Tab-based suggestion data
    const suggestionData = {
        explore: [
            "What are the latest trends in artificial intelligence?",
            "How do black holes form and what happens inside them?",
            "What are some interesting facts about the ocean depths?",
            "Tell me about recent discoveries in space exploration"
        ],
        create: [
            "Help me create a business plan for a mobile app",
            "Design a workout routine for a beginner",
            "Create a recipe for a healthy breakfast smoothie",
            "Write a short story about a time traveler"
        ],
        code: [
            "Write a JavaScript function to validate email addresses",
            "Create a simple HTML form with CSS styling",
            "Build a Python script to analyze CSV data",
            "Show me how to create a responsive navigation bar"
        ],
        learn: [
            "Explain quantum computing in simple terms",
            "Teach me the basics of machine learning",
            "How does cryptocurrency and blockchain work?",
            "What are the fundamental principles of economics?"
        ]
    };

    // Function to update suggestions based on active tab
    function updateSuggestions(tabName) {
        const exampleQuestions = document.getElementById('example-questions');
        const suggestions = suggestionData[tabName] || suggestionData.explore;
        
        exampleQuestions.innerHTML = '';
        suggestions.forEach(suggestion => {
            const questionElement = document.createElement('div');
            questionElement.className = 'example-question';
            questionElement.textContent = suggestion;
            questionElement.addEventListener('click', handleExampleQuestionClick);
            exampleQuestions.appendChild(questionElement);
        });
    }

    // Handle suggestion tab click
    function handleSuggestionTabClick(event) {
        // Remove active class from all tabs
        document.querySelectorAll('.suggestion-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Add active class to clicked tab
        event.currentTarget.classList.add('active');
        
        // Update suggestions
        const tabName = event.currentTarget.getAttribute('data-tab');
        updateSuggestions(tabName);
    }

    // Handle example question click
    function handleExampleQuestionClick(event) {
        const questionText = event.target.textContent;
        messageInput.value = questionText;
        sendMessage();
    }
    
    // Event Listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    newChatButton.addEventListener('click', createNewChat);
    
    // Add event listeners for suggestion tabs
    document.querySelectorAll('.suggestion-tab').forEach(tab => {
        tab.addEventListener('click', handleSuggestionTabClick);
    });
    
    // Initialize with default suggestions
    updateSuggestions('explore');
    
    // Fetch response from selected API provider
    async function fetchAPIResponse(userMessage, chatHistory, attachedFiles = []) {
        // Check if we have attachments and determine the appropriate model
        let selectedModel;
        const modelSelect = document.getElementById('model-select');
        
        // Define file type variables at function level for proper scoping
        const hasImages = attachedFiles.some(file => file.type.startsWith('image/'));
        const hasPDFs = attachedFiles.some(file => file.type === 'application/pdf');
        
        if (attachedFiles.length > 0) {
            // Automatically switch to appropriate model for file attachments
            const hasImages = attachedFiles.some(file => file.type.startsWith('image/'));
            const hasPDFs = attachedFiles.some(file => file.type === 'application/pdf');
            
            if (hasImages || hasPDFs) {
                // Use best multimodal model for any file attachments
                if (apiProvider === 'groq') {
                    if (hasImages) {
                        selectedModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
                        console.log('Switched to vision model for image attachments:', selectedModel);
                    } else if (hasPDFs) {
                        selectedModel = 'deepseek-r1-distill-llama-70b';
                        console.log('Switched to text model for PDF attachments:', selectedModel);
                    }
                } else if (apiProvider === 'openrouter') {
                    // Use GPT-4o for both images and PDFs on OpenRouter
                    selectedModel = 'openai/gpt-4o';
                    if (hasImages && hasPDFs) {
                        console.log('Switched to GPT-4o for mixed image and PDF attachments:', selectedModel);
                    } else if (hasImages) {
                        console.log('Switched to GPT-4o for image attachments:', selectedModel);
                    } else if (hasPDFs) {
                        console.log('Switched to GPT-4o for PDF attachments:', selectedModel);
                    }
                }
            }
            
            // Update UI to show model being used
            const modelInfo = document.createElement('div');
            modelInfo.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--primary-color); color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; z-index: 1000;';
            modelInfo.textContent = hasImages ? '👁️ Using Vision Model' : '📄 Using PDF Model';
            document.body.appendChild(modelInfo);
            setTimeout(() => modelInfo.remove(), 3000);
        } else {
            selectedModel = modelSelect.value;
        }
        
        // Format chat history for Groq API
        const messages = chatHistory
            .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));
        
        // Keep only the last 10 messages to avoid token limits
        const recentMessages = messages.slice(-10);
        
        // Prepare the current user message with files
        let currentUserMessage;
        
        if (attachedFiles.length > 0) {
            const contentArray = [];
            
            // Add text content if there is any
            if (userMessage && userMessage.trim()) {
                contentArray.push({
                    type: "text",
                    text: userMessage
                });
            }
            
            // Add file content
            attachedFiles.forEach(file => {
                if (file.type.startsWith('image/')) {
                    // For images, use the image_url format for vision models
                    // Ensure the image data is in the correct format for the API provider
                    let imageUrl = file.data;
                    
                    // Debug logging for image data
                    console.log('Image data format:', imageUrl.substring(0, 50) + '...');
                    console.log('Image type:', file.type);
                    
                    contentArray.push({
                        type: "image_url",
                        image_url: {
                            url: imageUrl
                        }
                    });
                } else if (file.type === 'application/pdf' && file.extractedText) {
                    // For PDFs, add the extracted text content
                    contentArray.push({
                        type: "text",
                        text: `[PDF Document: ${file.name}]\n\nExtracted Content:\n${file.extractedText}`
                    });
                }
            });
            
            // For multimodal models, use the structured content format
            const isMultimodalModel = selectedModel.includes('scout') || 
                                    selectedModel.includes('vision') || 
                                    selectedModel.includes('gpt-4o') ||
                                    selectedModel.includes('claude') ||
                                    (apiProvider === 'openrouter' && hasImages);
            
            if (isMultimodalModel && hasImages) {
                // Debug logging for multimodal content
                console.log('Using multimodal format for model:', selectedModel);
                console.log('Content array:', contentArray);
                
                currentUserMessage = {
                    role: 'user',
                    content: contentArray
                };
            } else {
                // For text models or PDF-only, combine everything into a single text message
                console.log('Using text format for model:', selectedModel);
                const combinedText = contentArray
                    .map(item => item.text || `[Image: ${item.image_url?.url ? 'attached' : 'unavailable'}]`)
                    .join('\n\n');
                
                currentUserMessage = {
                    role: 'user',
                    content: combinedText
                };
            }
        } else {
            // Regular text-only message
            currentUserMessage = {
                role: 'user',
                content: userMessage
            };
        }
        
        // Make sure the latest user message is included
        if (recentMessages.length === 0 || recentMessages[recentMessages.length - 1].role !== 'user') {
            recentMessages.push(currentUserMessage);
        } else {
            // Update the last user message if it exists
            recentMessages[recentMessages.length - 1] = currentUserMessage;
        }
        
        // Create system message with model-specific instructions
        let systemContent;
        
        if (attachedFiles.length > 0) {
            if (hasImages) {
                // Vision model system message
                systemContent = `You are a helpful AI assistant with vision capabilities. You can analyze images, understand visual content, and answer questions about what you see.

VISION CAPABILITIES:
- Analyze images in detail, describing objects, people, text, scenes, and layouts
- Answer questions about visual content
- Identify and read text in images (OCR)
- Understand charts, graphs, diagrams, and documents
- Provide helpful insights based on visual analysis

IMPORTANT GUIDELINES:
- When viewing images, provide detailed and accurate descriptions
- If you see text in images, transcribe it accurately
- For coding screenshots, help debug issues and provide solutions
- Be specific about what you observe in images
- If images are unclear or low quality, mention this limitation

WEB SEARCH (use sparingly):
- Only search if the user's question requires current information not visible in the image
- Use [SEARCH]query[/SEARCH] format with brief acknowledgment

Format responses using markdown for clarity.`;
            } else if (hasPDFs) {
                // PDF processing system message
                systemContent = `You are a helpful AI assistant specialized in analyzing and understanding document content. You have been provided with extracted text from PDF documents.

PDF ANALYSIS CAPABILITIES:
- Analyze document structure and content
- Answer questions about the document content
- Summarize key points and findings
- Extract specific information from the text
- Identify patterns, themes, and important details
- Help with document comprehension and analysis

IMPORTANT GUIDELINES:
- When analyzing PDF content, be thorough and accurate
- Reference specific sections or pages when relevant
- If the extracted text seems incomplete or garbled, mention this limitation
- Provide structured responses when analyzing complex documents
- Help users understand and navigate the document content

WEB SEARCH (use sparingly):
- Only search if the user's question requires current information not in the document
- Use [SEARCH]query[/SEARCH] format with brief acknowledgment

Format responses using markdown for clarity.`;
            }
        } else {
            // Regular text-only system message  
            systemContent = `IMPORTANT GUIDELINES:
- Use web search if the user's question requires up-to-date, real-time, or recent information (such as current events, latest prices, live statistics, or anything that may have changed recently).
- For general knowledge, answer from your own knowledge and do NOT use web search.
- If you do need to search, use [SEARCH]query[/SEARCH] and provide a brief acknowledgment after the search tag.
- Be concise and helpful. Prefer not to search unless necessary for accuracy or recency.

Format responses using markdown:
- Use **bold** for key points
- Use bullet points for lists
- Use code blocks for code with proper language tags
- Write in clear, brief paragraphs

CODE FORMATTING RULES:
- When providing HTML, CSS, or JavaScript code that can run in a browser, ALWAYS include a filename comment at the top
- Use this format: \`\`\`html filename="example.html" or \`\`\`css filename="styles.css" or \`\`\`javascript filename="script.js"
- Make code complete and runnable when possible
- For HTML files, include full document structure with <!DOCTYPE html>
- For interactive examples, include CSS and JavaScript inline when appropriate

Examples of proper search format:
- "What's the weather like?" → [SEARCH]current weather[/SEARCH] Let me check the current weather conditions for you.
- "How much does X cost?" → [SEARCH]X price 2024[/SEARCH] I'll find the current pricing information.
- "What happened with Y?" → [SEARCH]Y latest news[/SEARCH] Let me get the latest updates on this topic.
- "When was Z invented?" → [SEARCH]Z invention date[/SEARCH] I'll look up the historical information about this invention.

Always include a brief acknowledgment after [SEARCH]query[/SEARCH]. Be concise but helpful.`;
        }

        // Add DeepSeek-specific thinking instructions and web search capability
        if (selectedModel.includes('deepseek')) {
            systemContent += `

DEEPSEEK THINKING FORMAT:
When you need to think through a problem step by step, use the thinking format:
- Start your thinking process with <think>
- End your thinking process with </think>
- Inside the thinking tags, work through the problem step by step
- After the thinking section, provide your final answer without the thinking tags
- The thinking section will be shown as collapsible to users

WEB SEARCH CAPABILITY:
- You CAN search the web when needed for current information
- Use [SEARCH]query[/SEARCH] format when you need up-to-date information
- This is especially useful for current events, latest prices, recent news, etc.

Example:
<think>
Let me think about this step by step...
1. First, I need to understand what the user is asking
2. Then I should consider the different approaches
3. Finally, I'll choose the best solution
</think>

Based on my analysis, here's the answer...`;
        }

        const systemMessage = {
            role: 'system',
            content: systemContent
        };
        
        // Prepare the request body
        const requestBody = {
            model: selectedModel,
            messages: [systemMessage, ...recentMessages],
            temperature: 0.7,
            max_tokens: 1024
        };
        
        // Debug logging for OpenRouter requests
        if (apiProvider === 'openrouter' && attachedFiles.length > 0) {
            console.log('OpenRouter request body:', JSON.stringify(requestBody, null, 2));
        }
        
        // Prepare headers based on API provider
        const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
        };
        
        // Add OpenRouter specific headers
        if (apiProvider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'DisChat';
        }
        
        // Call API
        const response = await fetch(apiProviders[apiProvider].endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error Response:', errorData);
            throw new Error(errorData.error?.message || `Failed to get response from ${apiProviders[apiProvider].name}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    // Function to handle AI responses with search indicator
    async function fetchAPIResponseWithSearchIndicator(userMessage, chatHistory, loadingElement, attachedFiles = []) {
        try {
            const response = await fetchAPIResponse(userMessage, chatHistory, attachedFiles);
            
            // Check if AI wants to perform a web search
            const searchMatch = response.match(/\[SEARCH\](.*?)\[\/SEARCH\](.*)/s);
            if (searchMatch) {
                const searchQuery = searchMatch[1].trim();
                
                // Update loading message to show search indicator
                loadingElement.innerHTML = `
                    <div class="message-content">
                        <div class="search-indicator">
                            <span class="search-text">Searching...</span>
                            <div class="search-pulse"></div>
                        </div>
                    </div>
                `;
                
                try {
                    // Perform the search
                    const searchResults = await performDuckDuckGoSearch(searchQuery);
                    
                    if (searchResults.length > 0) {
                        // Create context from search results for the AI
                        const searchContext = searchResults.map((result, index) => 
                            `[SOURCE ${index + 1}]
TITLE: ${result.title}
CONTENT: ${result.snippet}
URL: ${result.url}`
                        ).join('\n\n---\n\n');
                        
                        // Ask AI to answer based on search results
                        const contextualResponse = await getAIResponseWithContext(userMessage, searchContext);
                        
                        return {
                            response: contextualResponse,
                            searchResults: searchResults
                        };
                    } else {
                        return {
                            response: `I searched for "${searchQuery}" but couldn't find any relevant information. Please try rephrasing your question.`,
                            searchResults: []
                        };
                    }
                } catch (searchError) {
                    console.error('Search error:', searchError);
                    return {
                        response: `I tried to search for "${searchQuery}" but encountered an error. Please try again later.`,
                        searchResults: []
                    };
                }
            }
            
            return {
                response: response,
                searchResults: null
            };
        } catch (error) {
            console.error('AI response error:', error);
            throw error;
        }
    }

    // Separate function to handle AI responses with potential web search
    async function fetchAPIResponseWithSearch(userMessage, chatHistory) {
        try {
            const response = await fetchAPIResponse(userMessage, chatHistory);
            
            // Check if AI wants to perform a web search
            const searchMatch = response.match(/\[SEARCH\](.*?)\[\/SEARCH\](.*)/s);
            if (searchMatch) {
                const searchQuery = searchMatch[1].trim();
                
                try {
                    // Perform the search
                    const searchResults = await performDuckDuckGoSearch(searchQuery);
                    
                    if (searchResults.length > 0) {
                        // Create context from search results for the AI
                        const searchContext = searchResults.map((result, index) => 
                            `[SOURCE ${index + 1}]
TITLE: ${result.title}
CONTENT: ${result.snippet}
URL: ${result.url}`
                        ).join('\n\n---\n\n');
                        
                        // Ask AI to answer based on search results
                        const contextualResponse = await getAIResponseWithContext(userMessage, searchContext);
                        
                        return {
                            response: contextualResponse,
                            searchResults: searchResults
                        };
                    } else {
                        return {
                            response: `I searched for "${searchQuery}" but couldn't find any relevant information. Please try rephrasing your question.`,
                            searchResults: []
                        };
                    }
                } catch (searchError) {
                    console.error('Search error:', searchError);
                    return {
                        response: `I tried to search for "${searchQuery}" but encountered an error. Please try again later.`,
                        searchResults: []
                    };
                }
            }
            
            return {
                response: response,
                searchResults: null
            };
        } catch (error) {
            console.error('AI response error:', error);
            throw error;
        }
    }

    // New function to perform DuckDuckGo search
    async function performDuckDuckGoSearch(query) {
        try {
            // Use DuckDuckGo Instant Answer API
            const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            
            // Try the API first
            try {
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Check for instant answer
                    if (data.AbstractText) {
                        return [{
                            title: data.AbstractSource || 'DuckDuckGo',
                            url: data.AbstractURL || 'https://duckduckgo.com',
                            snippet: data.AbstractText
                        }];
                    }
                    
                    // Check for related topics
                    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                        return data.RelatedTopics.slice(0, 3).map(topic => ({
                            title: topic.Text ? topic.Text.split(' - ')[0] : 'Related Topic',
                            url: topic.FirstURL || 'https://duckduckgo.com',
                            snippet: topic.Text || ''
                        }));
                    }
                }
            } catch (apiError) {
                console.log('API search failed, trying web scraping:', apiError.message);
            }
            
            // Fallback to web scraping
            return await scrapeSearchResults(query);
            
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    // Fallback web scraping function
    async function scrapeSearchResults(query) {
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await fetch(proxyUrl + encodeURIComponent(searchUrl));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const results = [];
            const resultElements = doc.querySelectorAll('.result');
            
            for (let i = 0; i < Math.min(resultElements.length, 5); i++) {
                const element = resultElements[i];
                const titleEl = element.querySelector('.result__title a');
                const snippetEl = element.querySelector('.result__snippet');
                const urlEl = element.querySelector('.result__url');
                
                if (titleEl && snippetEl) {
                    results.push({
                        title: titleEl.textContent.trim(),
                        url: urlEl ? urlEl.textContent.trim() : titleEl.href || '#',
                        snippet: snippetEl.textContent.trim()
                    });
                }
            }
            
            return results;
        } catch (error) {
            console.error('Web scraping failed:', error);
            return [];
        }
    }

    // New function to get AI response with search context
    async function getAIResponseWithContext(originalQuestion, searchContext) {
        try {
            // Use appropriate model for search responses based on provider
            let searchModel;
            if (apiProvider === 'groq') {
                searchModel = 'llama3-70b-8192';
            } else if (apiProvider === 'openrouter') {
                searchModel = 'meta-llama/llama-3.1-70b-instruct';
            }
            
            const systemMessage = {
                role: 'system',
                content: `You are DisChat, a helpful AI assistant. I have performed a web search for the user and found relevant information. Your task is to answer the user's question using ONLY the information provided in the search results below.

CRITICAL INSTRUCTIONS:
- You MUST use the search results provided to answer the question
- Do NOT say "I don't have information" when search results are provided
- If the search results contain relevant information, use it to answer the question
- Be detailed and helpful using the information from the search results
- Use markdown formatting for clear presentation
- If the search results don't adequately answer the question, explain what information is available and what might be missing

You are answering based on current web search results, so you DO have access to this information.`
            };
            
            const contextMessage = {
                role: 'user',
                content: `User Question: "${originalQuestion}"

WEB SEARCH RESULTS (USE THIS INFORMATION TO ANSWER):
${searchContext}

Based on the search results above, please provide a comprehensive answer to the user's question. The search results contain current information from the web that you should use to respond.`
            };
            
            // Debug logging
            console.log('Search Context being sent to AI:', searchContext);
            
            const requestBody = {
                model: searchModel,
                messages: [systemMessage, contextMessage],
                temperature: 0.3,
                max_tokens: 512
            };
            
            // Prepare headers based on API provider
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            
            // Add OpenRouter specific headers
            if (apiProvider === 'openrouter') {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = 'DisChat';
            }
            
            const response = await fetch(apiProviders[apiProvider].endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
            
        } catch (error) {
            console.error('Error getting AI response with context:', error);
            return 'I found some search results but had trouble processing them. Please try asking your question differently.';
        }
    }

    // Remove the old getSearchResults function and replace with simplified version
    async function getSearchResults(query) {
        return await performDuckDuckGoSearch(query);
    }
    
    // Function for manual web search (when user types "search the web for:")
    async function performWebSearchOnly(query) {
        const searchResults = await getSearchResults(query);
            
            if (searchResults.length > 0) {
                // Create a more conversational AI response
            let aiResponse = `I searched for "${query}" and found some information that might help.\n\n`;
                
                // Extract key information from the results
                const topics = new Set();
                const keyPoints = [];
                
                searchResults.forEach(result => {
                    // Extract potential topics from the title
                    const titleWords = result.title.split(' ');
                    titleWords.forEach(word => {
                        if (word.length > 4 && !word.match(/^(http|www|com|org|net)$/i)) {
                            topics.add(word);
                        }
                    });
                    
                    // Extract key points from snippets
                    if (result.snippet) {
                        const sentences = result.snippet.split(/\.\s+/);
                        sentences.forEach(sentence => {
                            if (sentence.length > 30 && !keyPoints.some(point => 
                                point.toLowerCase().includes(sentence.toLowerCase().substring(0, 20)))) {
                                keyPoints.push(sentence);
                            }
                        });
                    }
                });
                
                // Add topics if found
                if (topics.size > 0) {
                    const topicsArray = Array.from(topics).slice(0, 3);
                    aiResponse += `Based on what I found, the main topics related to your search include ${topicsArray.join(', ')}.\n\n`;
                }
                
                // Add key points (limited to 3)
                const limitedPoints = keyPoints.slice(0, 3);
                if (limitedPoints.length > 0) {
                    aiResponse += "Here's what I learned:\n";
                    limitedPoints.forEach((point, index) => {
                        aiResponse += `- ${point}${point.endsWith('.') ? '' : '.'}\n`;
                    });
                    aiResponse += "\n";
                }
                
                // Add a conclusion
                aiResponse += "Would you like me to search for more specific information on this topic?";
            
            return aiResponse;
            } else {
            return `I searched for "${query}" but couldn't find any relevant information. Would you like to try a different search term?`;
        }
    }
    
    // API Key Modal Functions
    function showApiKeyModal() {
        apiKeyModal.classList.add('show');
    }
    
    function hideApiKeyModal() {
        apiKeyModal.classList.remove('show');
    }
    
    function saveApiKey() {
        const key = apiKeyInput.value.trim();
        const selectedProvider = document.querySelector('input[name="api-provider"]:checked').value;
        
        if (key) {
            // User provided a key
            apiKey = key;
            apiProvider = selectedProvider;
            
            // Save both API key and provider
            localStorage.setItem('apiKey', key);
            localStorage.setItem('apiProvider', selectedProvider);
            
            // Update model selector for the new provider
            populateModelSelector();
            
            // Show success step
            showSuccessStep();
            
            // If there was a pending message, send it now
            if (messageInput.value.trim()) {
                sendMessage();
            }
        } else {
            // No key provided - show error
            alert(`Please enter a valid API key from ${apiProviders[selectedProvider].name} to continue.`);
        }
    }
    
    function startChatting() {
        hideSetupModal();
    }
    
    // Add bouncing dots indicator styles
    const style = document.createElement('style');
    style.textContent = `
        .bouncing-dots {
            display: flex;
            gap: 4px;
            align-items: flex-end;
            height: 20px;
        }
        
        .bouncing-dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--text-secondary);
            animation: bounce-dot 1.4s infinite ease-in-out both;
        }
        
        .bouncing-dots span:nth-child(1) {
            animation-delay: 0s;
        }
        
        .bouncing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .bouncing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes bounce-dot {
            0%, 80%, 100% { 
                transform: translateY(0px);
                opacity: 0.7;
            }
            40% { 
                transform: translateY(-10px);
                opacity: 1;
            }
        }
        
        .search-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .search-text {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }
        
        .search-pulse {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: var(--primary-color, #8b5cf6);
            animation: search-pulse 1.5s infinite ease-in-out;
        }
        
        @keyframes search-pulse {
            0%, 100% { 
                transform: scale(0.8); 
                opacity: 0.6; 
            }
            50% { 
                transform: scale(1.2); 
                opacity: 1; 
            }
        }
    `;
    document.head.appendChild(style);
    
    // Web Search Functions
    async function handleWebSearch() {
        // Get the current message input text
        const currentText = messageInput.value.trim();
        
        if (!currentText) {
            // If no text, prompt user to enter search query
            messageInput.focus();
            messageInput.placeholder = "Enter your search query...";
            return;
        }
        
        // Check if API key is available
        if (!apiKey) {
            showApiKeyModal();
            return;
        }
        
        // Hide welcome header, example questions and suggestion tabs
        document.querySelector('.welcome-header').style.display = 'none';
        document.querySelector('.example-questions').style.display = 'none';
        document.querySelector('.suggestion-tabs').style.display = 'none';
        
        // Add user message to UI
        addMessageToUI('user', `Search the web for: ${currentText}`, null, []);
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.placeholder = "Type your message here...";
        
        // Add loading message for search
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'message ai-message';
        loadingMessage.innerHTML = `
            <div class="message-content">
                <div class="search-indicator">
                    <span class="search-text">Searching the web...</span>
                    <div class="search-pulse"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(loadingMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        try {
            // Perform the search directly
            const searchResults = await performDuckDuckGoSearch(currentText);
            
            // Remove loading message
            if (loadingMessage.parentNode) {
                messagesContainer.removeChild(loadingMessage);
            }
            
            if (searchResults.length > 0) {
                // Create context from search results for the AI
                const searchContext = searchResults.map((result, index) => 
                    `[SOURCE ${index + 1}]
TITLE: ${result.title}
CONTENT: ${result.snippet}
URL: ${result.url}`
                ).join('\n\n---\n\n');
                
                // Get AI response based on search results (using Llama 3 70B)
                const aiResponse = await getAIResponseWithContext(currentText, searchContext);
                
                // Add AI response to UI with typing effect and search results
                addMessageToUI('ai', aiResponse, searchResults, [], true);
                
                // Handle chat creation/saving
                if (isNewChat) {
                    // Create new chat with both messages
                    await createNewChatWithMessage(`Search the web for: ${currentText}`, aiResponse, searchResults, []);
                } else {
                    // Save messages to existing chat
                    saveMessageToChat('user', `Search the web for: ${currentText}`, null, []);
                    saveMessageToChat('ai', aiResponse, searchResults);
                }
            } else {
                const noResultsMessage = `I searched for "${currentText}" but couldn't find any relevant information. Please try rephrasing your search query.`;
                addMessageToUI('ai', noResultsMessage, [], [], true);
                
                // Handle chat creation/saving
                if (isNewChat) {
                    await createNewChatWithMessage(`Search the web for: ${currentText}`, noResultsMessage, [], []);
                } else {
                    saveMessageToChat('user', `Search the web for: ${currentText}`, null, []);
                    saveMessageToChat('ai', noResultsMessage, []);
                }
            }
            
        } catch (error) {
            console.error('Web search error:', error);
            
            // Remove loading message if it still exists
            if (loadingMessage.parentNode) {
                messagesContainer.removeChild(loadingMessage);
            }
            
            const errorMessage = `I encountered an error while searching for "${currentText}". Please try again later.`;
            addMessageToUI('ai', errorMessage, [], [], true);
            
            // Handle error message saving
            if (isNewChat) {
                await createNewChatWithMessage(`Search the web for: ${currentText}`, errorMessage, [], []);
            } else {
                saveMessageToChat('user', `Search the web for: ${currentText}`, null, []);
                saveMessageToChat('ai', errorMessage, []);
            }
        }
    }
    
    // Function to detect if a message is a web search request
    function isWebSearchRequest(message) {
        return message.toLowerCase().startsWith('search the web for:');
    }
    
    // Event Listeners for API Key Modal
    loginButton.addEventListener('click', showApiKeyModal);
    closeModal.addEventListener('click', hideApiKeyModal);
    saveApiKeyButton.addEventListener('click', saveApiKey);
    
    // Event Listener for Web Search Button
    webSearchButton.addEventListener('click', handleWebSearch);
    
    apiKeyInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });
    
    // Settings Modal Functions
    function showSettingsModal() {
        settingsModal.classList.add('show');
    }
    
    function hideSettingsModal() {
        settingsModal.classList.remove('show');
    }
    
    // Color Scheme Functions
    function setColorScheme(theme) {
        // Remove active class from all buttons
        colorSchemeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected button
        document.querySelector(`[data-theme="${theme}"]`)?.classList.add('active');
        
        // Set theme
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('color-theme', theme);
        
        // Update theme toggle button icon
        updateThemeToggleIcon(theme);
    }
    
    // Theme Toggle Functions
    function toggleDarkMode() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
        setColorScheme(newTheme);
    }
    
    function updateThemeToggleIcon(theme) {
        if (themeToggleButton) {
            themeToggleButton.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggleButton.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }
    }
    
    // Sidebar Toggle Functions
    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const appContainer = document.querySelector('.app-container');
        const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            // Expanding: Apply both classes immediately for smooth expansion
            sidebar.classList.remove('collapsed');
            appContainer.classList.remove('sidebar-collapsed');
        } else {
            // Collapsing: Apply sidebar collapse first, then main content positioning after a small delay
            sidebar.classList.add('collapsed');
            
            // Delay the main content positioning to allow sidebar to start sliding
            setTimeout(() => {
                appContainer.classList.add('sidebar-collapsed');
            }, 50); // Small delay to let sidebar animation start
        }
        
        // Save sidebar state to localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    }
    
    // Welcome Content Visibility Functions
    function handleWelcomeContentVisibility() {
        const welcomeContent = document.getElementById('welcome-content');
        const messageInput = document.getElementById('message-input');
        
        if (messageInput.value.trim().length > 0) {
            welcomeContent.classList.add('fade-out');
        } else {
            welcomeContent.classList.remove('fade-out');
        }
    }
    
    // Event Listeners for Settings
    settingsButton.addEventListener('click', showSettingsModal);
    
    settingsModal.querySelector('.close-modal').addEventListener('click', hideSettingsModal);
    
    colorSchemeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            setColorScheme(theme);
        });
    });
    
    // Event Listener for Theme Toggle Button
    themeToggleButton.addEventListener('click', toggleDarkMode);
    
    // Event Listener for Sidebar Toggle Button
    sidebarToggleButton.addEventListener('click', toggleSidebar);
    
    // Event Listeners for Setup Modal
    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('github-login-btn')?.addEventListener('click', handleGithubLogin);
    document.getElementById('guest-login-btn')?.addEventListener('click', handleGuestLogin);
    document.getElementById('close-setup-modal')?.addEventListener('click', hideSetupModal);
    document.getElementById('start-chatting')?.addEventListener('click', startChatting);
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === settingsModal) {
            hideSettingsModal();
        }
        if (event.target === document.getElementById('setup-modal')) {
            hideSetupModal();
        }
    });
    
    // Function to delete a chat
    function deleteChat(chatId) {
        // Remove chat from array
        chats = chats.filter(chat => chat.id !== chatId);
        
        // If deleted chat was current chat, switch to another chat or create new one
        if (chatId === currentChatId) {
            if (chats.length > 0) {
                switchChat(chats[0].id);
            } else {
                startNewChat();
            }
        }
        
        // Save updated chats to localStorage
        localStorage.setItem('chats', JSON.stringify(chats));
        
        // Delete from Firestore if sync enabled
        if (chatSyncEnabled) {
            deleteChatFromFirestore(chatId);
        }
        
        // Update chat list
        updateChatList();
    }
    
    // Event listener for close preview button
    document.getElementById('close-preview-btn').addEventListener('click', closeCodePreview);
    
    // Initialize
    initializeUI();
    updateChatList();
    
    // Initialize theme toggle button icon
    updateThemeToggleIcon(currentTheme);
    
    // Initialize sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (sidebarCollapsed) {
        document.querySelector('.sidebar').classList.add('collapsed');
        document.querySelector('.app-container').classList.add('sidebar-collapsed');
    }
    
    // Make functions globally accessible for onclick handlers
    window.handleLogout = handleLogout;
    window.showSetupModal = showSetupModal;
    window.proceedToApiStep = proceedToApiStep;
    
    // Check if API key exists and show modal if not
    if (!apiKey) {
        showApiKeyModal();
    }

    // Function to search and filter conversations
    function searchConversations(query) {
        if (!query) {
            updateChatList(); // Show all chats if query is empty
            return;
        }
        
        const searchResults = chats.filter(chat => {
            // Search in chat title
            const titleMatch = chat.title.toLowerCase().includes(query.toLowerCase());
            
            // Search in chat messages
            const messageMatch = chat.messages.some(message => 
                message.text.toLowerCase().includes(query.toLowerCase())
            );
            
            return titleMatch || messageMatch;
        });
        
        // Update chat list with filtered results
        updateChatListWithResults(searchResults);
    }

    // Function to highlight matching text
    function highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    // Update the updateChatListWithResults function
    function updateChatListWithResults(filteredChats) {
        chatList.innerHTML = '';
        
        if (filteredChats.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No conversations found';
            chatList.appendChild(noResults);
            return;
        }
        
        const searchQuery = document.querySelector('.search-input').value.trim();
        
        filteredChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            if (chat.id === currentChatId) {
                chatItem.classList.add('active');
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = highlightText(chat.title, searchQuery);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-chat-btn');
            deleteBtn.title = 'Delete chat';
            deleteBtn.textContent = '🗑️';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            };
            
            chatItem.appendChild(titleSpan);
            chatItem.appendChild(deleteBtn);
            chatItem.addEventListener('click', () => switchChat(chat.id));
            
            chatList.appendChild(chatItem);
        });
    }

    // Add event listener for search input
    document.querySelector('.search-input').addEventListener('input', (e) => {
        searchConversations(e.target.value.trim());
    });

    // Utility function to format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});