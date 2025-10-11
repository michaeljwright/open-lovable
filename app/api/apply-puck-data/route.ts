import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export async function POST(request: NextRequest) {
  try {
    const { puckData, puckConfig, sandboxId } = await request.json();

    if (!puckData || !puckConfig) {
      return NextResponse.json({
        error: 'puckData and puckConfig are required'
      }, { status: 400 });
    }

    console.log('[apply-puck-data] Received Puck data to apply');
    console.log('[apply-puck-data] Content items:', puckData.content?.length || 0);
    console.log('[apply-puck-data] sandboxId:', sandboxId);

    // Debug: Log the config structure to identify issues
    console.log('[apply-puck-data] Config preview:', typeof puckConfig === 'string' ? puckConfig.substring(0, 500) : JSON.stringify(puckConfig).substring(0, 500));

    // Parse the config to validate structure
    if (typeof puckConfig === 'string') {
      try {
        // Extract the config object from the export statement
        const configMatch = puckConfig.match(/export\s+const\s+config\s*=\s*(\{[\s\S]*\});?\s*$/);
        if (configMatch) {
          console.log('[apply-puck-data] Found config export, validating structure...');
        } else {
          console.warn('[apply-puck-data] Could not find config export pattern in string');
        }
      } catch (e) {
        console.error('[apply-puck-data] Error parsing config string:', e);
      }
    }

    // Get or create sandbox provider
    let provider = sandboxId ? sandboxManager.getProvider(sandboxId) : sandboxManager.getActiveProvider();

    if (!provider && sandboxId) {
      console.log(`[apply-puck-data] No provider found, attempting to get or create for ${sandboxId}`);
      provider = await sandboxManager.getOrCreateProvider(sandboxId);

      if (!provider.getSandboxInfo()) {
        console.log(`[apply-puck-data] Creating new sandbox since reconnection failed`);
        await provider.createSandbox();
        await provider.setupViteApp();
        sandboxManager.registerSandbox(sandboxId, provider);
      }
    }

    if (!provider) {
      console.log(`[apply-puck-data] No active provider, creating new sandbox...`);
      const { SandboxFactory } = await import('@/lib/sandbox/factory');
      provider = SandboxFactory.create();
      const sandboxInfo = await provider.createSandbox();
      await provider.setupViteApp();
      sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);
    }

    // No need to install @measured/puck anymore - we're rendering directly
    console.log('[apply-puck-data] Skipping Puck installation - using direct rendering');

    // Generate the main App that renders Puck data
    // Pass the config string directly instead of parsing it
    const appContent = generatePuckRenderApp(puckData, puckConfig);

    console.log('[apply-puck-data] Generated App.jsx length:', appContent.length);
    console.log('[apply-puck-data] App.jsx preview (first 500 chars):');
    console.log(appContent.substring(0, 500));

    await provider.writeFile('src/App.jsx', appContent);
    console.log('[apply-puck-data] Written src/App.jsx with Puck preview renderer');

    // Verify the file was written by reading it back
    try {
      const readBack = await provider.readFile('src/App.jsx');
      console.log('[apply-puck-data] Verified file write - length:', readBack?.length || 0);
      if (!readBack || readBack.length === 0) {
        console.error('[apply-puck-data] ERROR: File appears to be empty!');
      }
    } catch (readError) {
      console.error('[apply-puck-data] Failed to verify file write:', readError);
    }

    const sandboxInfo = provider.getSandboxInfo();

    return NextResponse.json({
      success: true,
      sandboxId: sandboxInfo?.sandboxId,
      url: sandboxInfo?.url,
      filesCreated: ['src/App.jsx']
    });

  } catch (error) {
    console.error('[apply-puck-data] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply Puck data' },
      { status: 500 }
    );
  }
}

function generatePuckRenderApp(puckData: any, puckConfigJs: string): string {
  // Serialize the data as JSON
  const dataStr = JSON.stringify(puckData, null, 2);

  // Use the config string directly, just clean it up
  const cleanedConfig = puckConfigJs.replace(/^export\s+(const|let|var)\s+config\s*=\s*/, '');

  // Log the cleaned config for debugging
  console.log('[apply-puck-data] Cleaned config preview (first 1000 chars):');
  console.log(cleanedConfig.substring(0, 1000));

  // Instead of running Puck editor in sandbox, just render the preview
  // Using a simple approach that doesn't rely on Puck at all
  return `import React from 'react';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Puck App] Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>Something went wrong</h1>
          <details style={{ whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
            <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '8px' }}>
              {this.state.error && this.state.error.toString()}
            </p>
            {this.state.errorInfo && (
              <pre style={{ fontSize: '12px', background: '#fef2f2', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#805cf5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Puck configuration - evaluate the config string properly
let config;
try {
  console.log('[Preview App] Evaluating config...');
  const configCode = ${JSON.stringify(cleanedConfig)};
  const fn = new Function('React', \`return \${configCode}\`);
  config = fn(React);
  console.log('[Preview App] ✓ Config evaluated successfully');
  console.log('[Preview App] Components:', Object.keys(config.components));
} catch (e) {
  console.error('[Preview App] Failed to evaluate config:', e);
  throw e;
}

// Initial Puck data
const data = ${dataStr};

console.log('[Preview App] Rendering site with', data.content.length, 'sections');

// Render components directly without Puck
function App() {
  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        {data.content.map((item, index) => {
          const Component = config.components[item.type];
          if (!Component) {
            console.error(\`Component \${item.type} not found in config\`);
            return React.createElement('div', { key: index, style: { padding: '20px', color: 'red' } }, \`Error: Component \${item.type} not found\`);
          }

          // Render the component using its render function
          try {
            return React.createElement('div', { key: index }, Component.render(item.props));
          } catch (e) {
            console.error(\`Error rendering \${item.type}:\`, e);
            return React.createElement('div', { key: index, style: { padding: '20px', color: 'red' } }, \`Error rendering \${item.type}: \${e.message}\`);
          }
        })}
      </div>
    </ErrorBoundary>
  );
}

export default App;
`;
}
