"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@measured/puck/puck.css';

// Custom styles to integrate chat button into Puck's toolbar
const customStyles = `
  /* Add chat button to Puck's left toolbar */
  [class*="leftSideBar"] {
    position: relative;
  }

  .custom-chat-button {
    position: absolute;
    top: 15px;
    left: 12px;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000000;
    z-index: 1;
    transition: background-color 0.15s ease, color 0.15s ease;
    padding: 2px;
  }

  .custom-chat-button:hover {
    /* background-color: rgba(0, 0, 0, 0.05); */
  }

  .custom-chat-button svg {
    width: 24px;
    height: 24px;
  }

  /* Remove active state styling - keep it the same */
  .custom-chat-button.active {
    background-color: transparent;
    color: #000000;
  }

  .custom-chat-button.active:hover {
    /* background-color: rgba(0, 0, 0, 0.05); */
  }

  /* Push Puck's panel buttons down to make room for chat button */
  [class*="leftSideBar"] > button:nth-child(2) {
    margin-top: 52px;
  }

  /* Add margin to header inner to accommodate chat button */
  [class*="PuckLayout-headerInner"] {
    margin-left: 40px;
  }

  /* Adjust header title to align properly */
  [class*="PuckLayout-headerTitle"] {
    margin-left: -40px;
  }

  /* Make Publish button match header background color */
  [class*="Button"][class*="primary"] {
    background-color: #6366f1 !important;
    border-color: #6366f1 !important;
  }

  [class*="Button"][class*="primary"]:hover {
    background-color: #4f46e5 !important;
    border-color: #4f46e5 !important;
  }
`;

// Lazy load Puck to avoid SSR issues
const PuckEditor: any = dynamic(
  () => import('@measured/puck').then((mod) => mod.Puck),
  {
    ssr: false,
    loading: () => <div style={{padding:24}}>Loading Puck editor...</div>
  }
);

interface ChatMessage {
  content: string;
  type: 'user' | 'ai' | 'system' | 'error';
  timestamp: Date;
}

export default function EditPage() {
  const [data, setData] = useState<any>({ content: [], root: { props: { title: 'My Site', theme: 'light' } }, zones: {} });
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [puckKey, setPuckKey] = useState(0); // Key to force Puck re-render
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messagesEndRef, setMessagesEndRef] = useState<HTMLDivElement | null>(null);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const router = useRouter();

  // Inject custom styles and chat button into Puck's DOM
  useEffect(() => {
    if (!config) return;

    // Add custom styles
    const styleEl = document.createElement('style');
    styleEl.textContent = customStyles;
    document.head.appendChild(styleEl);

    // Wait for Puck to render, then inject chat button
    const injectChatButton = () => {
      const leftSidebar = document.querySelector('[class*="leftSideBar"]');
      console.log('[ChatButton] Looking for leftSidebar:', !!leftSidebar);

      if (leftSidebar) {
        // Remove existing button first
        const existingButton = document.querySelector('.custom-chat-button');
        if (existingButton) {
          existingButton.remove();
        }

        const chatButton = document.createElement('button');
        chatButton.className = `custom-chat-button ${chatOpen ? 'active' : ''}`;
        chatButton.title = 'AI Assistant';
        chatButton.innerHTML = `
          <img src="/penultimate-small.png" alt="Logo" style="width: 32px; height: auto;" />
        `;
        chatButton.onclick = () => setChatOpen(!chatOpen);
        leftSidebar.insertBefore(chatButton, leftSidebar.firstChild);
        console.log('[ChatButton] Button injected successfully');
      }
    };

    // Try multiple times with increasing delays
    const timers = [
      setTimeout(injectChatButton, 100),
      setTimeout(injectChatButton, 500),
      setTimeout(injectChatButton, 1000),
      setTimeout(injectChatButton, 2000)
    ];

    return () => {
      timers.forEach(clearTimeout);
      const styleToRemove = document.querySelector('style');
      if (styleToRemove && styleToRemove.textContent === customStyles) {
        document.head.removeChild(styleToRemove);
      }
    };
  }, [config, chatOpen]);

  // Load chat history from sessionStorage
  useEffect(() => {
    if (chatHistoryLoaded) return;

    const storedChatHistory = sessionStorage.getItem('editPageChatHistory');
    if (storedChatHistory) {
      try {
        const parsedHistory = JSON.parse(storedChatHistory);
        console.log('[EditPage] Loaded chat history:', parsedHistory.length, 'messages');
        setChatMessages(parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (e) {
        console.error('[EditPage] Failed to parse chat history:', e);
        // Start with default message
        setChatMessages([{
          content: 'Hi! I can help you edit your site. Just tell me what you want to change.',
          type: 'ai',
          timestamp: new Date()
        }]);
      }
    } else {
      // Start with default message
      setChatMessages([{
        content: 'Hi! I can help you edit your site. Just tell me what you want to change.',
        type: 'ai',
        timestamp: new Date()
      }]);
    }
    setChatHistoryLoaded(true);
  }, [chatHistoryLoaded]);

  useEffect(() => {
    console.log('[EditPage] Loading site data from sessionStorage...');

    // Load site data from sessionStorage (set by home page)
    const storedData = sessionStorage.getItem('siteData');
    const storedConfig = sessionStorage.getItem('siteConfig');

    console.log('[EditPage] storedData exists:', !!storedData);
    console.log('[EditPage] storedConfig exists:', !!storedConfig);

    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        console.log('[EditPage] Parsed site data:', parsedData);
        setData(parsedData);
      } catch (e) {
        console.error('[EditPage] Failed to parse site data:', e);
        setError('Failed to parse site data');
      }
    } else {
      console.warn('[EditPage] No site data found in sessionStorage');
      setError('No site data found. Please go back and create a site first.');
    }

    if (storedConfig) {
      try {
        console.log('[EditPage] Raw config string length:', storedConfig.length);
        console.log('[EditPage] Config preview:', storedConfig.substring(0, 200) + '...');

        // Evaluate config string without bundler
        // Remove 'export' keyword if present
        const configCode = storedConfig.replace(/^export\s+(const|let|var)\s+config\s*=\s*/, '');
        console.log('[EditPage] Cleaned config code length:', configCode.length);

        const fn = new Function('React', `return ${configCode}`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const React = require('react');
        const evaluatedConfig = fn(React);

        console.log('[EditPage] Evaluated config:', evaluatedConfig);
        console.log('[EditPage] Config components:', Object.keys(evaluatedConfig.components || {}));

        // Convert render function strings to actual functions
        const processedConfig = { ...evaluatedConfig };
        if (processedConfig.components) {
          Object.keys(processedConfig.components).forEach(componentName => {
            const component = processedConfig.components[componentName];
            if (component.render && typeof component.render === 'string') {
              try {
                console.log(`[EditPage] Converting render function for ${componentName}...`);
                const renderFn = new Function('React', `return ${component.render}`);
                component.render = renderFn(React);
                console.log(`[EditPage] ✓ Converted render function for ${componentName}`);
              } catch (e: any) {
                console.error(`[EditPage] Failed to convert render for ${componentName}:`, e.message);
              }
            }
          });
        }

        setConfig(processedConfig);
      } catch (e: any) {
        console.error('[EditPage] Failed to load config:', e);
        console.error('[EditPage] Error message:', e.message);
        console.error('[EditPage] Error stack:', e.stack);
        setError(`Failed to load config: ${e.message}`);
      }
    } else {
      console.warn('[EditPage] No config found in sessionStorage');
      setError('No site configuration found. Please go back and create a site first.');
    }
  }, []);

  const handlePublish = (publishedData: any) => {
    console.log('[EditPage] Publishing site data...');
    console.log('[EditPage] Published data:', publishedData);

    // Update local state
    setData(publishedData);

    // Save to sessionStorage
    const dataStr = JSON.stringify(publishedData);
    console.log('[EditPage] Saving to sessionStorage, length:', dataStr.length);
    sessionStorage.setItem('siteData', dataStr);

    // Mark that we're returning from editor with updates
    sessionStorage.setItem('returningFromEditor', 'true');

    // Update chat history with publish event
    try {
      const existingChat = sessionStorage.getItem('chatHistory');
      const chatHistory = existingChat ? JSON.parse(existingChat) : [];
      chatHistory.push({
        content: 'Published changes from the visual editor',
        type: 'user',
        timestamp: new Date().toISOString()
      });
      sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    } catch (e) {
      console.error('[EditPage] Failed to update chat history:', e);
    }

    console.log('[EditPage] Site published successfully, navigating to generation page...');

    // Navigate to generation/chat page
    router.push('/generation');
  };

  const handleBackToChat = () => {
    console.log('[EditPage] Returning to chat without publishing...');

    // Mark that we're returning from editor (but without updates)
    sessionStorage.setItem('returningFromEditor', 'false');

    // Navigate to generation/chat page
    router.push('/generation');
  };

  const addChatMessage = (content: string, type: ChatMessage['type']) => {
    setChatMessages(prev => {
      const newMessages = [...prev, {
        content,
        type,
        timestamp: new Date()
      }];
      // Save to sessionStorage
      sessionStorage.setItem('editPageChatHistory', JSON.stringify(newMessages));
      return newMessages;
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, messagesEndRef]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Add user message
    addChatMessage(userMessage, 'user');
    setIsProcessing(true);

    try {
      // Show progressive status updates
      addChatMessage('Analyzing your request...', 'system');

      // Short delay to show first status
      await new Promise(resolve => setTimeout(resolve, 300));
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Analyzing your request...'));
      addChatMessage('Updating site structure...', 'system');

      // Call the update-puck-site API
      const response = await fetch('/api/update-puck-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          currentData: data,
          currentConfig: config
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.puck) {
        throw new Error(result.error || 'Failed to update site');
      }

      // Update the Puck data
      console.log('[EditPage] Updating Puck data from AI response');
      setChatMessages(prev => {
        const filtered = prev.filter(msg => msg.content !== 'Analyzing your request...' && msg.content !== 'Updating site structure...');
        sessionStorage.setItem('editPageChatHistory', JSON.stringify(filtered));
        return filtered;
      });
      addChatMessage('Applying changes to editor...', 'system');

      // Force Puck to re-render by updating the key
      setPuckKey(prev => prev + 1);
      setData(result.puck.data);

      // Save to sessionStorage
      sessionStorage.setItem('siteData', JSON.stringify(result.puck.data));

      // Update config if needed
      if (result.puck.configJs) {
        sessionStorage.setItem('siteConfig', result.puck.configJs);

        // Re-evaluate config
        const React = require('react');
        const configCode = result.puck.configJs.replace(/^export\s+(const|let|var)\s+config\s*=\s*/, '');
        const fn = new Function('React', `return ${configCode}`);
        const evaluatedConfig = fn(React);

        // Convert render functions
        const processedConfig = { ...evaluatedConfig };
        if (processedConfig.components) {
          Object.keys(processedConfig.components).forEach(componentName => {
            const component = processedConfig.components[componentName];
            if (component.render && typeof component.render === 'string') {
              try {
                const renderFn = new Function('React', `return ${component.render}`);
                component.render = renderFn(React);
              } catch (e: any) {
                console.error(`Failed to convert render for ${componentName}:`, e.message);
              }
            }
          });
        }

        // Force Puck to re-render with new config by incrementing key again
        setPuckKey(prev => prev + 1);
        setConfig(processedConfig);
      }

      // Remove all processing messages and show success
      setChatMessages(prev => {
        const filtered = prev.filter(msg =>
          msg.content !== 'Analyzing your request...' &&
          msg.content !== 'Updating site structure...' &&
          msg.content !== 'Applying changes to editor...'
        );
        sessionStorage.setItem('editPageChatHistory', JSON.stringify(filtered));
        return filtered;
      });

      // Generate a friendly summary message
      const updatedSections = result.puck.data.content?.length || 0;
      const componentTypes = result.puck.data.content?.map((item: any) => item.type).join(', ') || 'components';
      addChatMessage(
        `✓ Successfully updated your site!\n\n` +
        `Your site now has ${updatedSections} section${updatedSections !== 1 ? 's' : ''}: ${componentTypes}`,
        'system'
      );

    } catch (err: any) {
      console.error('[EditPage] Chat error:', err);
      // Remove all processing messages
      setChatMessages(prev => {
        const filtered = prev.filter(msg =>
          msg.content !== 'Analyzing your request...' &&
          msg.content !== 'Updating site structure...' &&
          msg.content !== 'Applying changes to editor...'
        );
        sessionStorage.setItem('editPageChatHistory', JSON.stringify(filtered));
        return filtered;
      });
      addChatMessage(`Error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex' }}>
      {/* Chat Panel - Puck-styled sidebar */}
      {config && !error && chatOpen && (
        <div style={{
          width: '320px',
          height: '100vh',
          backgroundColor: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Chat Panel Header */}
          <div style={{
            padding: '21px 16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#111827',
              }}>Edit by chatting with AI</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: '#6b7280',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Chat Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: msg.type === 'user' ? '#f3f4f6' : 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  border: msg.type === 'user' ? 'none' : '1px solid #e5e7eb',
                  fontSize: '13px',
                  color: msg.type === 'error' ? '#dc2626' : '#374151',
                  marginLeft: msg.type === 'user' ? 'auto' : '0',
                  maxWidth: msg.type === 'user' ? '80%' : '100%',
                }}
              >
                <div style={{
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: msg.type === 'user' ? '#111827' : '#6366f1'
                }}>
                  {msg.type === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            ))}
            {/* Invisible element at the end for auto-scrolling */}
            <div ref={setMessagesEndRef} />
          </div>

          {/* Chat Input Area */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: 'white',
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end',
            }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask AI to edit your site..."
                disabled={isProcessing}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '13px',
                  resize: 'none',
                  fontFamily: 'inherit',
                  minHeight: '40px',
                  maxHeight: '120px',
                  opacity: isProcessing ? 0.6 : 1,
                }}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || !chatInput.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isProcessing || !chatInput.trim() ? '#9ca3af' : '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isProcessing || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  height: '40px',
                }}
              >
                {isProcessing ? 'Processing...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Chat button is injected into Puck's leftSideBar via useEffect */}

        {/* Publish Button - Using Puck's internal publish instead */}
        {/* The Puck editor has its own publish button in the header */}

        {error ? (
          <div style={{padding:24, color: 'red'}}>
            <h2>Error Loading Site</h2>
            <p>{error}</p>
            <a href="/" style={{color: 'blue', textDecoration: 'underline'}}>Go back to home</a>
          </div>
        ) : config ? (
          <PuckEditor key={puckKey} config={config} data={data} onPublish={handlePublish} />
        ) : (
          <div style={{padding:24}}>Loading editor…</div>
        )}
      </div>
    </div>
  );
}
