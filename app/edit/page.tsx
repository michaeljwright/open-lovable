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

export default function EditPage() {
  const [data, setData] = useState<any>({ content: [], root: { props: { title: 'My Site', theme: 'light' } }, zones: {} });
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
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
              }}>AI Assistant</span>
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
            {/* Sample Messages */}
            <div style={{
              backgroundColor: 'white',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '13px',
              color: '#374151',
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#6366f1' }}>AI Assistant</div>
              <div>How can I help you edit your site today?</div>
            </div>

            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#374151',
              marginLeft: 'auto',
              maxWidth: '80%',
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', color: '#111827' }}>You</div>
              <div>Change the hero title to "Welcome to My App"</div>
            </div>
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
                placeholder="Ask AI to edit your site..."
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
                }}
                rows={1}
              />
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                height: '40px',
              }}>
                Chat
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
          <PuckEditor config={config} data={data} onPublish={handlePublish} />
        ) : (
          <div style={{padding:24}}>Loading editor…</div>
        )}
      </div>
    </div>
  );
}
