"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@measured/puck/puck.css';

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
  const router = useRouter();

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
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Navigation button to switch to chat view */}
      {config && !error && (
        <button
          onClick={handleBackToChat}
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 1000,
            padding: '8px 16px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4338CA'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
        >
          Publish
        </button>
      )}

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
  );
}
