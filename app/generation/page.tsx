'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { appConfig } from '@/config/app.config';
import Link from 'next/link';
import { HeaderProvider } from '@/components/shared/header/HeaderContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import icons from centralized module to avoid Turbopack chunk issues
import {
  FiFile,
  FiChevronRight,
  FiChevronDown,
  BsFolderFill,
  BsFolder2Open,
  SiJavascript,
  SiReact,
  SiCss3,
  SiJson
} from '@/lib/icons';
import CodeApplicationProgress, { type CodeApplicationState } from '@/components/CodeApplicationProgress';

interface SandboxData {
  sandboxId: string;
  url: string;
  [key: string]: any;
}

// Helper function to generate descriptions for Puck components
function getComponentDescription(componentType: string, props: any): string {
  // Extract key information from props to show what was generated
  if (componentType === 'Hero' || componentType === 'HeroSection') {
    return props.title || props.heading || 'Landing section';
  } else if (componentType === 'Features' || componentType === 'FeatureSection') {
    return props.title || 'Features showcase';
  } else if (componentType === 'About' || componentType === 'AboutSection') {
    return props.title || 'About section';
  } else if (componentType === 'Testimonials' || componentType === 'TestimonialSection') {
    return props.title || 'Customer testimonials';
  } else if (componentType === 'Pricing' || componentType === 'PricingSection') {
    return props.title || 'Pricing tiers';
  } else if (componentType === 'CTA' || componentType === 'CallToAction') {
    return props.title || props.text || 'Call to action';
  } else if (componentType === 'Footer') {
    return 'Footer with links';
  } else if (componentType === 'Header' || componentType === 'Navigation') {
    return 'Navigation header';
  }

  // Generic fallback
  return props.title || props.heading || props.name || 'Section';
}

function AISandboxPage() {
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [promptInput, setPromptInput] = useState('');
  const [aiEnabled] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [aiModel, setAiModel] = useState(appConfig.ai.defaultModel);
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState<string[]>([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'src', 'src/components']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'generation' | 'preview'>('preview');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  const [isScreenshotLoaded, setIsScreenshotLoaded] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [sidebarScrolled, setSidebarScrolled] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'gathering' | 'planning' | 'generating' | null>(null);
  const [isStartingNewGeneration, setIsStartingNewGeneration] = useState(false);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string>>({});
  const [hasInitialSubmission, setHasInitialSubmission] = useState<boolean>(false);
  const [fileStructure, setFileStructure] = useState<string>('');
  
  const [conversationContext, setConversationContext] = useState<{
    scrapedWebsites: Array<{ url: string; content: any; timestamp: Date }>;
    generatedComponents: Array<{ name: string; path: string; content: string }>;
    appliedCode: Array<{ files: string[]; timestamp: Date }>;
    currentProject: string;
    lastGeneratedCode?: string;
  }>({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: '',
    lastGeneratedCode: undefined
  });
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  
  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({
    stage: null
  });
  
  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    status: string;
    components: Array<{ name: string; path: string; completed: boolean }>;
    currentComponent: number;
    streamedCode: string;
    isStreaming: boolean;
    isThinking: boolean;
    thinkingText?: string;
    thinkingDuration?: number;
    currentFile?: { path: string; content: string; type: string };
    files: Array<{ path: string; content: string; type: string; completed: boolean; edited?: boolean }>;
    lastProcessedPosition: number;
    isEdit?: boolean;
  }>({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0
  });

  // Store flag to trigger generation after component mounts
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  // Clear old conversation data on component mount and create/restore sandbox
  useEffect(() => {
    let isMounted = true;
    let sandboxCreated = false; // Track if sandbox was created in this effect

    const initializePage = async () => {
      // Prevent double execution in React StrictMode
      if (sandboxCreated) return;

      // Check if returning from Puck editor
      const returningFromEditor = sessionStorage.getItem('returningFromEditor');
      const storedPrompt = sessionStorage.getItem('originalPrompt');
      const siteData = sessionStorage.getItem('siteData');
      const siteConfig = sessionStorage.getItem('siteConfig');

      // Clear the returning flag if set
      if (returningFromEditor) {
        sessionStorage.removeItem('returningFromEditor');
      }

      // First check URL parameters (from home page navigation)
      const urlParam = searchParams.get('url');
      const templateParam = searchParams.get('template');
      const detailsParam = searchParams.get('details');

      // Then check session storage as fallback
      const storedUrl = urlParam || sessionStorage.getItem('targetUrl');
      const storedStyle = templateParam || sessionStorage.getItem('selectedStyle');
      const storedModel = sessionStorage.getItem('selectedModel');
      const storedInstructions = sessionStorage.getItem('additionalInstructions');
      
      if (storedUrl) {
        // Mark that we have an initial submission since we're loading with a URL
        setHasInitialSubmission(true);
        
        // Clear sessionStorage after reading  
        sessionStorage.removeItem('targetUrl');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');
        // Note: Don't clear siteMarkdown here, it will be cleared when used
        
        // Set the values in the component state
        setHomeUrlInput(storedUrl);
        setSelectedStyle(storedStyle || 'modern');
        
        // Add details to context if provided
        if (detailsParam) {
          setHomeContextInput(detailsParam);
        } else if (storedStyle && !urlParam) {
          // Only apply stored style if no screenshot URL is provided
          // This prevents unwanted style inheritance when using screenshot search
          const styleNames: Record<string, string> = {
            '1': 'Glassmorphism',
            '2': 'Neumorphism',
            '3': 'Brutalism',
            '4': 'Minimalist',
            '5': 'Dark Mode',
            '6': 'Gradient Rich',
            '7': '3D Depth',
            '8': 'Retro Wave',
            'modern': 'Modern clean and minimalist',
            'playful': 'Fun colorful and playful',
            'professional': 'Corporate professional and sleek',
            'artistic': 'Creative artistic and unique'
          };
          const styleName = styleNames[storedStyle] || storedStyle;
          let contextString = `${styleName} style design`;
          
          // Add additional instructions if provided
          if (storedInstructions) {
            contextString += `. ${storedInstructions}`;
          }
          
          setHomeContextInput(contextString);
        } else if (storedInstructions && !urlParam) {
          // Apply only instructions if no style but instructions are provided
          // and no screenshot URL is provided
          setHomeContextInput(storedInstructions);
        }
        
        if (storedModel) {
          setAiModel(storedModel);
        }
        
        // Skip the home screen and go directly to builder
        setShowHomeScreen(false);
        setHomeScreenFading(false);
        
        // Set flag to auto-trigger generation after component updates
        setShouldAutoGenerate(true);
        
        // Also set autoStart flag for the effect
        sessionStorage.setItem('autoStart', 'true');
      }
      
      // Clear old conversation
      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' })
        });
        console.log('[home] Cleared old conversation data on mount');
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
      }
      
      if (!isMounted) return;

      // Check if sandbox ID is in URL
      const sandboxIdParam = searchParams.get('sandbox');
      
      setLoading(true);
      try {
        let createdSandboxData = null;
        if (sandboxIdParam) {
          console.log('[home] Attempting to restore sandbox:', sandboxIdParam);
          // For now, just create a new sandbox - you could enhance this to actually restore
          // the specific sandbox if your backend supports it
          sandboxCreated = true;
          createdSandboxData = await createSandbox(true);
        } else {
          console.log('[home] No sandbox in URL, creating new sandbox automatically...');
          sandboxCreated = true;
          createdSandboxData = await createSandbox(true);
        }

        // Apply Puck data to sandbox if available (either from initial creation or returning from editor)
        if (siteData && siteConfig && createdSandboxData) {
          console.log('[generation] Applying Puck data to sandbox...');
          console.log('[generation] returningFromEditor:', returningFromEditor);

          try {
            const applyResponse = await fetch('/api/apply-puck-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                puckData: JSON.parse(siteData),
                puckConfig: siteConfig,
                sandboxId: createdSandboxData.sandboxId
              })
            });

            if (applyResponse.ok) {
              const result = await applyResponse.json();
              console.log('[generation] Puck data applied successfully:', result);

              // Update sandbox data state with the returned data
              if (result.sandboxId && result.url) {
                setSandboxData({
                  sandboxId: result.sandboxId,
                  url: result.url
                });
              }

              // Puck data applied successfully
              if (isMounted) {
                const message = returningFromEditor === 'true'
                  ? `Applied your published site changes! Your site is now live in the sandbox.`
                  : `Your site has been loaded into the editor sandbox. You can now view and edit it.`;
                console.log('[generation]', message);
              }

              // Refresh the iframe to show the updated content
              // Give the sandbox more time to install packages and compile
              setTimeout(() => {
                if (iframeRef.current && result.url) {
                  console.log('[generation] Refreshing iframe with URL:', result.url);
                  iframeRef.current.src = result.url;
                }
              }, 3000); // Increased from 1000ms to 3000ms
            } else {
              const errorText = await applyResponse.text();
              console.error('[generation] Failed to apply Puck data:', errorText);
            }
          } catch (applyError) {
            console.error('[generation] Error applying Puck data:', applyError);
          }

          // Clear the flag after processing
          if (returningFromEditor) {
            sessionStorage.removeItem('returningFromEditor');
          }
        }

        // If we have a URL from the home page, mark for automatic start
        if (storedUrl && isMounted) {
          // We'll trigger the generation after the component is fully mounted
          // and the startGeneration function is defined
          sessionStorage.setItem('autoStart', 'true');
        }
      } catch (error) {
        console.error('[ai-sandbox] Failed to create or restore sandbox:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    initializePage();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  useEffect(() => {
    // Handle Escape key for home screen
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen]);
  
  // Start capturing screenshot if URL is provided on mount (from home screen)
  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = 'https://' + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start generation if flagged
  useEffect(() => {
    const autoStart = sessionStorage.getItem('autoStart');
    if (autoStart === 'true' && !showHomeScreen && homeUrlInput) {
      sessionStorage.removeItem('autoStart');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        console.log('[generation] Auto-starting generation for URL:', homeUrlInput);
        startGeneration();
      }, 1000);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    // Only check sandbox status on mount if we don't already have sandboxData
    if (!sandboxData) {
      checkSandboxStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger generation when flag is set (from home page navigation)
  useEffect(() => {
    if (shouldAutoGenerate && homeUrlInput && !showHomeScreen) {
      // Reset the flag
      setShouldAutoGenerate(false);
      
      // Trigger generation after a short delay to ensure everything is set up
      const timer = setTimeout(() => {
        console.log('[generation] Auto-triggering generation from URL params');
        startGeneration();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, homeUrlInput, showHomeScreen]);

  const updateStatus = (text: string, active: boolean) => {
    setStatus({ text, active });
  };

  const log = (message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const checkAndInstallPackages = async () => {
    // This function is only called when user explicitly requests it
    // Don't show error if no sandbox - it's likely being created
    if (!sandboxData) {
      console.log('[checkAndInstallPackages] No sandbox data available yet');
      return;
    }

    // Vite error checking removed - handled by template setup
    console.log('Checking packages... Sandbox is ready with Vite configuration.');
  };
  
  const handleSurfaceError = (_errors: any[]) => {
    // Function kept for compatibility but Vite errors are now handled by template
    
    // Focus the input
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };
  
  const installPackages = async (packages: string[]) => {
    if (!sandboxData) {
      console.error('No active sandbox. Create a sandbox first!');
      return;
    }
    
    try {
      const response = await fetch('/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (!data.command.includes('npm install')) {
                    console.log('[command]', data.command);
                  }
                  break;
                case 'output':
                  console.log('[output]', data.message);
                  break;
                case 'error':
                  if (data.message && data.message !== 'undefined') {
                    console.error('[error]', data.message);
                  }
                  break;
                case 'warning':
                  console.warn('[warning]', data.message);
                  break;
                case 'success':
                  console.log('[success]', data.message);
                  break;
                case 'status':
                  console.log('[status]', data.message);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`Failed to install packages: ${error.message}`);
    }
  };

  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();
      
      if (data.active && data.healthy && data.sandboxData) {
        console.log('[checkSandboxStatus] Setting sandboxData from API:', data.sandboxData);
        setSandboxData(data.sandboxData);
        updateStatus('Sandbox active', true);
      } else if (data.active && !data.healthy) {
        // Sandbox exists but not responding
        updateStatus('Sandbox not responding', false);
        // Keep existing sandboxData if we have it - don't clear it
      } else {
        // Only clear sandboxData if we don't already have it or if we're explicitly checking from a fresh state
        // This prevents clearing sandboxData during normal operation when it should persist
        if (!sandboxData) {
          console.log('[checkSandboxStatus] No existing sandboxData, clearing state');
          setSandboxData(null);
          updateStatus('No sandbox', false);
        } else {
          // Keep existing sandboxData and just update status
          console.log('[checkSandboxStatus] Keeping existing sandboxData, sandbox inactive but data preserved');
          updateStatus('Sandbox status unknown', false);
        }
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      // Only clear on error if we don't have existing sandboxData
      if (!sandboxData) {
        setSandboxData(null);
        updateStatus('Error', false);
      } else {
        updateStatus('Status check failed', false);
      }
    }
  };

  const sandboxCreationRef = useRef<boolean>(false);
  
  const createSandbox = async (fromHomeScreen = false) => {
    // Prevent duplicate sandbox creation
    if (sandboxCreationRef.current) {
      console.log('[createSandbox] Sandbox creation already in progress, skipping...');
      return null;
    }
    
    sandboxCreationRef.current = true;
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus('Creating sandbox...', false);
    setResponseArea([]);
    setScreenshotError(null);

    // Show progressive status updates
    const statusUpdates = [
      { delay: 2000, message: 'Setting up container...' },
      { delay: 4000, message: 'Installing dependencies...' },
      { delay: 6000, message: 'Starting development server...' }
    ];

    const timeouts: NodeJS.Timeout[] = [];
    statusUpdates.forEach(update => {
      const timeout = setTimeout(() => {
        updateStatus(update.message, false);
      }, update.delay);
      timeouts.push(timeout);
    });

    try {
      const response = await fetch('/api/create-ai-sandbox-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Clear all pending status updates
      timeouts.forEach(clearTimeout);

      const data = await response.json();
      console.log('[createSandbox] Response data:', data);
      
      if (data.success) {
        sandboxCreationRef.current = false; // Reset the ref on success
        console.log('[createSandbox] Setting sandboxData from creation:', data);
        setSandboxData(data);
        updateStatus('Sandbox active', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);
        
        // Update URL with sandbox ID
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        router.push(`/generation?${newParams.toString()}`, { scroll: false });
        
        // Fade out loading background after sandbox loads
        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        // Fetch sandbox files after creation
        setTimeout(fetchSandboxFiles, 1000);
        
        // For Vercel sandboxes, Vite is already started during setupViteApp
        // No need to restart it immediately after creation
        // Only restart if there's an actual issue later
        console.log('[createSandbox] Sandbox ready with Vite server running');

        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);
        
        // Return the sandbox data so it can be used immediately
        return data;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      // Clear all pending status updates on error
      timeouts.forEach(clearTimeout);

      console.error('[createSandbox] Error:', error);
      updateStatus('Error', false);
      log(`Failed to create sandbox: ${error.message}`, 'error');
      throw error;
    } finally {
      setLoading(false);
      sandboxCreationRef.current = false; // Reset the ref
    }
  };

  const displayStructure = (structure: any) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || 'No structure available');
    }
  };

  const applyGeneratedCode = async (code: string, isEdit: boolean = false, overrideSandboxData?: SandboxData) => {
    setLoading(true);
    log('Applying AI-generated code...');
    
    try {
      // Show progress component instead of individual messages
      setCodeApplicationState({ stage: 'analyzing' });
      
      // Get pending packages from tool calls
      const pendingPackages = ((window as any).pendingPackages || []).filter((pkg: any) => pkg && typeof pkg === 'string');
      if (pendingPackages.length > 0) {
        console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
        // Clear pending packages after use
        (window as any).pendingPackages = [];
      }
      
      // Use streaming endpoint for real-time feedback
      const effectiveSandboxData = overrideSandboxData || sandboxData;
      const response = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: effectiveSandboxData?.sandboxId // Pass the sandbox ID to ensure proper connection
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  // Don't add as chat message, just update state
                  setCodeApplicationState({ stage: 'analyzing' });
                  break;
                  
                case 'step':
                  // Update progress state based on step
                  if (data.message.includes('Installing') && data.packages) {
                    setCodeApplicationState({ 
                      stage: 'installing', 
                      packages: data.packages 
                    });
                  } else if (data.message.includes('Creating files') || data.message.includes('Applying')) {
                    setCodeApplicationState({ 
                      stage: 'applying',
                      filesGenerated: [] // Files will be populated when complete
                    });
                  }
                  break;
                  
                case 'package-progress':
                  // Handle package installation progress
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (data.command && !data.command.includes('npm install')) {
                    console.log('[command]', data.command);
                  }
                  break;
                  
                case 'success':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'file-progress':
                  // Skip file progress messages, they're noisy
                  break;
                  
                case 'file-complete':
                  // Could add individual file completion messages if desired
                  break;
                  
                case 'command-progress':
                  console.log(`[${data.action}]`, data.command);
                  break;

                case 'command-output':
                  if (data.stream === 'stderr') {
                    console.error('[command-output]', data.output);
                  } else {
                    console.log('[command-output]', data.output);
                  }
                  break;

                case 'command-complete':
                  if (data.success) {
                    console.log('Command completed successfully');
                  } else {
                    console.error(`Command failed with exit code ${data.exitCode}`);
                  }
                  break;
                  
                case 'complete':
                  finalData = data;
                  setCodeApplicationState({ stage: 'complete' });
                  // Clear the state after a delay
                  setTimeout(() => {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  // Reset loading state when complete
                  setLoading(false);
                  break;
                  
                case 'error':
                  console.error(`Error: ${data.message || data.error || 'Unknown error'}`);
                  // Reset loading state on error
                  setLoading(false);
                  break;

                case 'warning':
                  console.warn(data.message);
                  break;

                case 'info':
                  // Show info messages, especially for package installation
                  if (data.message) {
                    console.log('[info]', data.message);
                  }
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      // Process final data
      if (finalData && finalData.type === 'complete') {
        const data: any = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message,
          autoCompleted: finalData.autoCompleted,
          autoCompletedComponents: finalData.autoCompletedComponents,
          warning: finalData.warning,
          missingImports: finalData.missingImports,
          debug: finalData.debug
        };
        
        if (data.success) {
          const { results } = data;
        
        // Log package installation results without duplicate messages
        if (results.packagesInstalled?.length > 0) {
          log(`Packages installed: ${results.packagesInstalled.join(', ')}`);
        }
        
        if (results.filesCreated?.length > 0) {
          log('Files created:');
          results.filesCreated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
          
          // Verify files were actually created by refreshing the sandbox if needed
          if (sandboxData?.sandboxId && results.filesCreated.length > 0) {
            // Small delay to ensure files are written
            setTimeout(() => {
              // Force refresh the iframe to show new files
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }, 1000);
          }
        }
        
        if (results.filesUpdated?.length > 0) {
          log('Files updated:');
          results.filesUpdated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
        }
        
        // Update conversation context with applied code
        setConversationContext(prev => ({
          ...prev,
          appliedCode: [...prev.appliedCode, {
            files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
            timestamp: new Date()
          }]
        }));
        
        if (results.commandsExecuted?.length > 0) {
          log('Commands executed:');
          results.commandsExecuted.forEach((cmd: string) => {
            log(`  $ ${cmd}`, 'command');
          });
        }
        
        if (results.errors?.length > 0) {
          results.errors.forEach((err: string) => {
            log(err, 'error');
          });
        }
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        if (data.explanation) {
          log(data.explanation);
        }
        
        if (data.autoCompleted) {
          log('Auto-generating missing components...', 'command');
          
          if (data.autoCompletedComponents) {
            setTimeout(() => {
              log('Auto-generated missing components:', 'info');
              data.autoCompletedComponents.forEach((comp: string) => {
                log(`  ${comp}`, 'command');
              });
            }, 1000);
          }
        } else if (data.warning) {
          log(data.warning, 'error');

          if (data.missingImports && data.missingImports.length > 0) {
            const missingList = data.missingImports.join(', ');
            console.log(`Missing components: ${missingList}`);
          }
        }
        
        log('Code applied successfully!');
        console.log('[applyGeneratedCode] Response data:', data);
        console.log('[applyGeneratedCode] Debug info:', data.debug);
        console.log('[applyGeneratedCode] Current sandboxData:', sandboxData);
        console.log('[applyGeneratedCode] Current iframe element:', iframeRef.current);
        console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current?.src);
        
        // Set applying code state for edits to show loading overlay
        // Removed overlay - changes apply directly
        
        if (results.filesCreated?.length > 0) {
          setConversationContext(prev => ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: results.filesCreated,
              timestamp: new Date()
            }]
          }));
          
          // Log success
          if (isEdit) {
            console.log('Edit applied successfully!');
          } else {
            console.log(`Applied ${results.filesCreated.length} files successfully!`);
          }

          // If there are failed packages, log warning
          if (results.packagesFailed?.length > 0) {
            console.warn('Some packages failed to install. Check the error banner above for details.');
          }
          
          // Fetch updated file structure
          await fetchSandboxFiles();
          
          // Skip automatic package check - it's not needed here and can cause false "no sandbox" messages
          // Packages are already installed during the apply-ai-code-stream process
          
          // Test build to ensure everything compiles correctly
          // Skip build test for now - it's causing errors with undefined activeSandbox
          // The build test was trying to access global.activeSandbox from the frontend,
          // but that's only available in the backend API routes
          console.log('[build-test] Skipping build test - would need API endpoint');
          
          // Force iframe refresh after applying code
          const refreshDelay = appConfig.codeApplication.defaultRefreshDelay; // Allow Vite to process changes
          
          setTimeout(() => {
            const currentSandboxData = effectiveSandboxData;
            if (iframeRef.current && currentSandboxData?.url) {
              console.log('[home] Refreshing iframe after code application...');
              
              // Method 1: Change src with timestamp
              const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&applied=true`;
              iframeRef.current.src = urlWithTimestamp;
              
              // Method 2: Force reload after a short delay
              setTimeout(() => {
                try {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.location.reload();
                    console.log('[home] Force reloaded iframe content');
                  }
                } catch (e) {
                  console.log('[home] Could not reload iframe (cross-origin):', e);
                }
                // Reload completed
              }, 1000);
            }
          }, refreshDelay);
          
          // Vite error checking removed - handled by template setup
        }
        
          // Give Vite HMR a moment to detect changes, then ensure refresh
          const currentSandboxData = effectiveSandboxData;
          if (iframeRef.current && currentSandboxData?.url) {
            // Wait for Vite to process the file changes
            // If packages were installed, wait longer for Vite to restart
            const packagesInstalled = results?.packagesInstalled?.length > 0 || data.results?.packagesInstalled?.length > 0;
            const refreshDelay = packagesInstalled ? appConfig.codeApplication.packageInstallRefreshDelay : appConfig.codeApplication.defaultRefreshDelay;
            console.log(`[applyGeneratedCode] Packages installed: ${packagesInstalled}, refresh delay: ${refreshDelay}ms`);
            
            setTimeout(async () => {
            if (iframeRef.current && currentSandboxData?.url) {
              console.log('[applyGeneratedCode] Starting iframe refresh sequence...');
              console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current.src);
              console.log('[applyGeneratedCode] Sandbox URL:', currentSandboxData.url);
              
              // Method 1: Try direct navigation first
              try {
                const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&force=true`;
                console.log('[applyGeneratedCode] Attempting direct navigation to:', urlWithTimestamp);
                
                // Remove any existing onload handler
                iframeRef.current.onload = null;
                
                // Navigate directly
                iframeRef.current.src = urlWithTimestamp;
                
                // Wait a bit and check if it loaded
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Try to access the iframe content to verify it loaded
                try {
                  const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                  if (iframeDoc && iframeDoc.readyState === 'complete') {
                    console.log('[applyGeneratedCode] Iframe loaded successfully');
                    return;
                  }
                } catch {
                  console.log('[applyGeneratedCode] Cannot access iframe content (CORS), assuming loaded');
                  return;
                }
              } catch (e) {
                console.error('[applyGeneratedCode] Direct navigation failed:', e);
              }
              
              // Method 2: Force complete iframe recreation if direct navigation failed
              console.log('[applyGeneratedCode] Falling back to iframe recreation...');
              const parent = iframeRef.current.parentElement;
              const newIframe = document.createElement('iframe');
              
              // Copy attributes
              newIframe.className = iframeRef.current.className;
              newIframe.title = iframeRef.current.title;
              newIframe.allow = iframeRef.current.allow;
              // Copy sandbox attributes
              const sandboxValue = iframeRef.current.getAttribute('sandbox');
              if (sandboxValue) {
                newIframe.setAttribute('sandbox', sandboxValue);
              }
              
              // Remove old iframe
              iframeRef.current.remove();
              
              // Add new iframe
              newIframe.src = `${currentSandboxData.url}?t=${Date.now()}&recreated=true`;
              parent?.appendChild(newIframe);
              
              // Update ref
              (iframeRef as any).current = newIframe;
              
              console.log('[applyGeneratedCode] Iframe recreated with new content');
            } else {
              console.error('[applyGeneratedCode] No iframe or sandbox URL available for refresh');
            }
          }, refreshDelay); // Dynamic delay based on whether packages were installed
        }
        
        } else {
          throw new Error(finalData?.error || 'Failed to apply code');
        }
      } else {
        // If no final data was received, still close loading
        console.warn('Code application may have partially succeeded. Check the preview.');
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev => ({
        ...prev,
        isEdit: false
      }));
    }
  };

  const fetchSandboxFiles = async () => {
    if (!sandboxData) return;
    
    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  };
  
//   const restartViteServer = async () => {
//     try {
//       addChatMessage('Restarting Vite dev server...', 'system');
//       
//       const response = await fetch('/api/restart-vite', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' }
//       });
//       
//       if (response.ok) {
//         const data = await response.json();
//         if (data.success) {
//           addChatMessage('✓ Vite dev server restarted successfully!', 'system');
//           
//           // Refresh the iframe after a short delay
//           setTimeout(() => {
//             if (iframeRef.current && sandboxData?.url) {
//               iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
//             }
//           }, 2000);
//         } else {
//           addChatMessage(`Failed to restart Vite: ${data.error}`, 'error');
//         }
//       } else {
//         addChatMessage('Failed to restart Vite server', 'error');
//       }
//     } catch (error) {
//       console.error('[restartViteServer] Error:', error);
//       addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
//     }
//   };

//   const applyCode = async () => {
//     const code = promptInput.trim();
//     if (!code) {
//       log('Please enter some code first', 'error');
//       addChatMessage('No code to apply. Please generate code first.', 'system');
//       return;
//     }
//     
//     // Prevent double clicks
//     if (loading) {
//       console.log('[applyCode] Already loading, skipping...');
//       return;
//     }
//     
//     // Determine if this is an edit based on whether we have applied code before
//     const isEdit = conversationContext.appliedCode.length > 0;
//     await applyGeneratedCode(code, isEdit);
//   };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
      return (
        /* Generation Tab Content */
        <div className="absolute inset-0 flex overflow-hidden">
          {/* File Explorer - Hide during edits */}
          {!generationProgress.isEdit && (
            <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
            <div className="p-4 bg-gray-100 text-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BsFolderFill style={{ width: '16px', height: '16px' }} />
                <span className="text-sm font-medium">Explorer</span>
              </div>
            </div>
            
            {/* File Tree */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              <div className="text-sm">
                {/* Root app folder */}
                <div 
                  className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                  onClick={() => toggleFolder('app')}
                >
                  {expandedFolders.has('app') ? (
                    <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                  ) : (
                    <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                  )}
                  {expandedFolders.has('app') ? (
                    <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                  ) : (
                    <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                  )}
                  <span className="font-medium text-gray-800">app</span>
                </div>
                
                {expandedFolders.has('app') && (
                  <div className="ml-6">
                    {/* Group files by directory */}
                    {(() => {
                      const fileTree: { [key: string]: Array<{ name: string; edited?: boolean }> } = {};
                      
                      // Create a map of edited files
                      // const editedFiles = new Set(
                      //   generationProgress.files
                      //     .filter(f => f.edited)
                      //     .map(f => f.path)
                      // );
                      
                      // Process all files from generation progress
                      generationProgress.files.forEach(file => {
                        const parts = file.path.split('/');
                        const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                        const fileName = parts[parts.length - 1];
                        
                        if (!fileTree[dir]) fileTree[dir] = [];
                        fileTree[dir].push({
                          name: fileName,
                          edited: file.edited || false
                        });
                      });
                      
                      return Object.entries(fileTree).map(([dir, files]) => (
                        <div key={dir} className="mb-1">
                          {dir && (
                            <div 
                              className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                              onClick={() => toggleFolder(dir)}
                            >
                              {expandedFolders.has(dir) ? (
                                <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                              ) : (
                                <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                              )}
                              {expandedFolders.has(dir) ? (
                                <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                              ) : (
                                <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                              )}
                              <span className="text-gray-700">{dir.split('/').pop()}</span>
                            </div>
                          )}
                          {(!dir || expandedFolders.has(dir)) && (
                            <div className={dir ? 'ml-8' : ''}>
                              {files.sort((a, b) => a.name.localeCompare(b.name)).map(fileInfo => {
                                const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                const isSelected = selectedFile === fullPath;
                                
                                return (
                                  <div 
                                    key={fullPath} 
                                    className={`flex items-center gap-2 py-0.5 px-3 rounded cursor-pointer transition-all ${
                                      isSelected 
                                        ? 'bg-blue-500 text-white' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleFileClick(fullPath)}
                                  >
                                    {getFileIcon(fileInfo.name)}
                                    <span className={`text-xs flex items-center gap-1 ${isSelected ? 'font-medium' : ''}`}>
                                      {fileInfo.name}
                                      {fileInfo.edited && (
                                        <span className={`text-[10px] px-1 rounded ${
                                          isSelected ? 'bg-blue-400' : 'bg-orange-500 text-white'
                                        }`}>✓</span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
          
          {/* Code Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thinking Mode Display - Only show during active generation */}
            {generationProgress.isGenerating && (generationProgress.isThinking || generationProgress.thinkingText) && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-purple-600 font-medium flex items-center gap-2">
                    {generationProgress.isThinking ? (
                      <>
                        <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse" />
                        AI is thinking...
                      </>
                    ) : (
                      <>
                        <span className="text-purple-600">✓</span>
                        Thought for {generationProgress.thinkingDuration || 0} seconds
                      </>
                    )}
                  </div>
                </div>
                {generationProgress.thinkingText && (
                  <div className="bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide">
                    <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                      {generationProgress.thinkingText}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            {/* Live Code Display */}
            <div className="flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide" ref={codeDisplayRef}>
                {/* Show selected file if one is selected */}
                {selectedFile ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(selectedFile)}
                          <span className="font-mono text-sm">{selectedFile}</span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="hover:bg-black/20 p-1 rounded transition-colors"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="bg-gray-900 border border-gray-700 rounded">
                        <SyntaxHighlighter
                          language={(() => {
                            const ext = selectedFile.split('.').pop()?.toLowerCase();
                            if (ext === 'css') return 'css';
                            if (ext === 'json') return 'json';
                            if (ext === 'html') return 'html';
                            return 'jsx';
                          })()}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {(() => {
                            // Find the file content from generated files
                            const file = generationProgress.files.find(f => f.path === selectedFile);
                            return file?.content || '// File content will appear here';
                          })()}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                ) : /* If no files parsed yet, show loading or raw stream */
                generationProgress.files.length === 0 && !generationProgress.currentFile ? (
                  generationProgress.isThinking ? (
                    // Beautiful loading state while thinking
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="mb-8 relative">
                          <div className="w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-spin border-t-transparent"></div>
                          </div>
                        </div>
                        <h3 className="text-xl font-medium text-white mb-2">AI is analyzing your request</h3>
                        <p className="text-gray-400 text-sm">{generationProgress.status || 'Preparing to generate code...'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gray-100 text-gray-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                          <span className="font-mono text-sm">Streaming code...</span>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-900 rounded">
                        <SyntaxHighlighter
                          language="jsx"
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {generationProgress.streamedCode || 'Starting code generation...'}
                        </SyntaxHighlighter>
                        <span className="inline-block w-3 h-5 bg-orange-400 ml-1 animate-pulse" />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {/* Show current file being generated */}
                    {generationProgress.currentFile && (
                      <div className="bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">{generationProgress.currentFile.path}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              generationProgress.currentFile.type === 'css' ? 'bg-blue-600 text-white' :
                              generationProgress.currentFile.type === 'javascript' ? 'bg-yellow-600 text-white' :
                              generationProgress.currentFile.type === 'json' ? 'bg-green-600 text-white' :
                              'bg-gray-200 text-gray-700'
                            }`}>
                              {generationProgress.currentFile.type === 'javascript' ? 'JSX' : generationProgress.currentFile.type.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded">
                          <SyntaxHighlighter
                            language={
                              generationProgress.currentFile.type === 'css' ? 'css' :
                              generationProgress.currentFile.type === 'json' ? 'json' :
                              generationProgress.currentFile.type === 'html' ? 'html' :
                              'jsx'
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                          >
                            {generationProgress.currentFile.content}
                          </SyntaxHighlighter>
                          <span className="inline-block w-3 h-4 bg-orange-400 ml-4 mb-4 animate-pulse" />
                        </div>
                      </div>
                    )}
                    
                    {/* Show completed files */}
                    {generationProgress.files.map((file, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            <span className="font-mono text-sm">{file.path}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            file.type === 'css' ? 'bg-blue-600 text-white' :
                            file.type === 'javascript' ? 'bg-yellow-600 text-white' :
                            file.type === 'json' ? 'bg-green-600 text-white' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {file.type === 'javascript' ? 'JSX' : file.type.toUpperCase()}
                          </span>
                        </div>
                        <div className="bg-gray-900 border border-gray-700  max-h-48 overflow-y-auto scrollbar-hide">
                          <SyntaxHighlighter
                            language={
                              file.type === 'css' ? 'css' :
                              file.type === 'json' ? 'json' :
                              file.type === 'html' ? 'html' :
                              'jsx'
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                            wrapLongLines={true}
                          >
                            {file.content}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    ))}
                    
                    {/* Show remaining raw stream if there's content after the last file */}
                    {!generationProgress.currentFile && generationProgress.streamedCode.length > 0 && (
                      <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">Processing...</span>
                          </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded">
                          <SyntaxHighlighter
                            language="jsx"
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={false}
                          >
                            {(() => {
                              // Show only the tail of the stream after the last file
                              const lastFileEnd = generationProgress.files.length > 0 
                                ? generationProgress.streamedCode.lastIndexOf('</file>') + 7
                                : 0;
                              let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();
                              
                              // Remove explanation tags and content
                              remainingContent = remainingContent.replace(/<explanation>[\s\S]*?<\/explanation>/g, '').trim();
                              
                              // If only whitespace or nothing left, show waiting message
                              return remainingContent || 'Waiting for next file...';
                            })()}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress indicator */}
            {generationProgress.components.length > 0 && (
              <div className="mx-6 mb-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                    style={{
                      width: `${(generationProgress.currentComponent / Math.max(generationProgress.components.length, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'preview') {
      // Show loading state for initial generation or when starting a new generation with existing sandbox
      const isInitialGeneration = !sandboxData?.url && (urlScreenshot || isCapturingScreenshot || isPreparingDesign || loadingStage);
      const isNewGenerationWithSandbox = isStartingNewGeneration && sandboxData?.url;
      const shouldShowLoadingOverlay = (isInitialGeneration || isNewGenerationWithSandbox) && 
        (loading || generationProgress.isGenerating || isPreparingDesign || loadingStage || isCapturingScreenshot || isStartingNewGeneration);
      
      if (isInitialGeneration || isNewGenerationWithSandbox) {
        return (
          <div className="relative w-full h-full bg-gray-900">
            {/* Screenshot as background when available */}
            {urlScreenshot && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={urlScreenshot} 
                alt="Website preview" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{ 
                  opacity: isScreenshotLoaded ? 1 : 0,
                  willChange: 'opacity'
                }}
                onLoad={() => setIsScreenshotLoaded(true)}
                loading="eager"
              />
            )}
            
            {/* Loading overlay - only show when actively processing initial generation */}
            {shouldShowLoadingOverlay && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                {/* Loading animation with skeleton */}
                <div className="text-center max-w-md">
                  {/* Animated skeleton lines */}
                  <div className="mb-6 space-y-3">
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse" 
                         style={{ animationDuration: '1.5s', animationDelay: '0s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  </div>
                  
                  {/* Spinner */}
                  <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                  
                  {/* Status text */}
                  <p className="text-white text-lg font-medium">
                    {isCapturingScreenshot ? 'Analyzing website...' :
                     isPreparingDesign ? 'Preparing design...' :
                     generationProgress.isGenerating ? 'Generating code...' :
                     'Loading...'}
                  </p>
                  
                  {/* Subtle progress hint */}
                  <p className="text-white/60 text-sm mt-2">
                    {isCapturingScreenshot ? 'Taking a screenshot of the site' :
                     isPreparingDesign ? 'Understanding the layout and structure' :
                     generationProgress.isGenerating ? 'Writing React components' :
                     'Please wait...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      // Show sandbox iframe - keep showing during edits, only hide during initial loading
      if (sandboxData?.url) {
        return (
          <div className="relative w-full h-full">
            <iframe
              ref={iframeRef}
              src={sandboxData.url}
              className="w-full h-full border-none"
              title="Open Lovable Sandbox"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
            
            {/* Package installation overlay - shows when installing packages or applying code */}
            {codeApplicationState.stage && codeApplicationState.stage !== 'complete' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center max-w-md">
                  <div className="mb-6">
                    {/* Animated icon based on stage */}
                    {codeApplicationState.stage === 'installing' ? (
                      <div className="w-16 h-16 mx-auto">
                        <svg className="w-full h-full animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : null}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {codeApplicationState.stage === 'analyzing' && 'Analyzing code...'}
                    {codeApplicationState.stage === 'installing' && 'Installing packages...'}
                    {codeApplicationState.stage === 'applying' && 'Applying changes...'}
                  </h3>
                  
                  {/* Package list during installation */}
                  {codeApplicationState.stage === 'installing' && codeApplicationState.packages && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {codeApplicationState.packages.map((pkg, index) => (
                          <span 
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full transition-all ${
                              codeApplicationState.installedPackages?.includes(pkg)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {pkg}
                            {codeApplicationState.installedPackages?.includes(pkg) && (
                              <span className="ml-1">✓</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Files being generated */}
                  {codeApplicationState.stage === 'applying' && codeApplicationState.filesGenerated && (
                    <div className="text-sm text-gray-600">
                      Creating {codeApplicationState.filesGenerated.length} files...
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-2">
                    {codeApplicationState.stage === 'analyzing' && 'Parsing generated code and detecting dependencies...'}
                    {codeApplicationState.stage === 'installing' && 'This may take a moment while npm installs the required packages...'}
                    {codeApplicationState.stage === 'applying' && 'Writing files to your sandbox environment...'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Show a subtle indicator when code is being edited/generated */}
            {generationProgress.isGenerating && generationProgress.isEdit && !codeApplicationState.stage && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Generating code...</span>
              </div>
            )}
            
            {/* Refresh button */}
            <button
              onClick={() => {
                if (iframeRef.current && sandboxData?.url) {
                  console.log('[Manual Refresh] Forcing iframe reload...');
                  const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
                  iframeRef.current.src = newSrc;
                }
              }}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
              title="Refresh sandbox"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        );
      }
      
      // Default state when no sandbox and no screenshot
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg">
          {screenshotError ? (
            <div className="text-center">
              <p className="mb-2">Failed to capture screenshot</p>
              <p className="text-sm text-gray-500">{screenshotError}</p>
            </div>
          ) : sandboxData ? (
            <div className="text-gray-500">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading preview...</p>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-sm">Setting up your app sandbox...</p>
            </div>
          )}
        </div>
      );
    }

    // Fallback for when on generation tab but no files to show
    if (activeTab === 'generation') {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center text-gray-500 max-w-md px-4">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">No code generated yet</h3>
            <p className="text-sm text-gray-500">
              Start a new generation or chat with the AI to create your site.
              The code will appear here as it's being generated.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const downloadZip = async () => {
    if (!sandboxData) {
      console.error('Please wait for the sandbox to be created before downloading.');
      return;
    }

    setLoading(true);
    log('Creating zip file...');
    
    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        log('Zip file created!');
        console.log('ZIP file created! Download starting...');

        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('Vite app downloaded! To run locally: npm install && npm run dev');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      log(`Failed to create zip: ${error.message}`, 'error');
      console.error(`Failed to create ZIP: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () => {
    if (!conversationContext.lastGeneratedCode) {
      console.log('No previous generation to re-apply');
      return;
    }

    if (!sandboxData) {
      console.error('Please create a sandbox first');
      return;
    }

    console.log('Re-applying last generation...');
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };

  // Auto-scroll code display to bottom when streaming
  useEffect(() => {
    if (codeDisplayRef.current && generationProgress.isStreaming) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath: string) => {
    setSelectedFile(filePath);
    // TODO: Add file content fetching logic here
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'jsx' || ext === 'js') {
      return <SiJavascript style={{ width: '16px', height: '16px' }} className="text-yellow-500" />;
    } else if (ext === 'tsx' || ext === 'ts') {
      return <SiReact style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'css') {
      return <SiCss3 style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'json') {
      return <SiJson style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    } else {
      return <FiFile style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    }
  };


  const captureUrlScreenshot = async (url: string) => {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      if (data.success && data.screenshot) {
        setIsScreenshotLoaded(false); // Reset loaded state for new screenshot
        setUrlScreenshot(data.screenshot);
        // Set preparing design state
        setIsPreparingDesign(true);
        // Store the clean URL for display
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        // Switch to preview tab to show the screenshot
        if (activeTab !== 'preview') {
          setActiveTab('preview');
        }
      } else {
        setScreenshotError(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleHomeScreenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startGeneration();
  };

  const startGeneration = async () => {
    if (!homeUrlInput.trim()) return;
    
    setHomeScreenFading(true);
    
    // Set immediate loading state for better UX
    setIsStartingNewGeneration(true);
    setLoadingStage('gathering');
    
    // Immediately switch to preview tab to show loading
    setActiveTab('preview');
    
    // Set loading background to ensure proper visual feedback
    setShowLoadingBackground(true);
    
    // Clear messages and immediately show the cloning message
    let displayUrl = homeUrlInput.trim();
    if (!displayUrl.match(/^https?:\/\//i)) {
      displayUrl = 'https://' + displayUrl;
    }
    // Remove protocol for cleaner display
    const cleanUrl = displayUrl.replace(/^https?:\/\//i, '');
    console.log(`Starting to clone ${cleanUrl}...`);
    
    // Start creating sandbox and capturing screenshot immediately in parallel
    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve(null);
    
    // Set loading stage immediately before hiding home screen
    setLoadingStage('gathering');
    // Also ensure we're on preview tab to show the loading overlay
    setActiveTab('preview');
    
    // Always capture screenshot for new URLs, even if sandbox exists
    // This ensures the loading screen shows properly
    captureUrlScreenshot(displayUrl);
    
    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);
      
      // Clear the starting flag after transition
      setTimeout(() => {
        setIsStartingNewGeneration(false);
      }, 1000);
      
      // Wait for sandbox to be ready (if it's still creating)
      await sandboxPromise;
      
      // Now start the clone process which will stream the generation
      setUrlInput(homeUrlInput);
      setUrlOverlayVisible(false); // Make sure overlay is closed
      setUrlStatus(['Scraping website content...']);
      
      try {
        // Scrape the website
        let url = homeUrlInput.trim();
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }
        
        // Screenshot is already being captured in parallel above
        
        let scrapeData;
        
        // Check if we have pre-scraped markdown content from search results
        const storedMarkdown = sessionStorage.getItem('siteMarkdown');
        if (storedMarkdown) {
          // Use the pre-scraped content
          scrapeData = {
            success: true,
            content: storedMarkdown,
            title: new URL(url).hostname,
            source: 'search-result'
          };
          sessionStorage.removeItem('siteMarkdown'); // Clear after use
          console.log('Using cached content from search results...');
        } else {
          // Perform fresh scraping
          const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          
          if (!scrapeResponse.ok) {
            throw new Error('Failed to scrape website');
          }
          
          scrapeData = await scrapeResponse.json();
          
          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape website');
          }
        }
        
        setUrlStatus(['Website scraped successfully!', 'Generating React app...']);
        
        // Clear preparing design state and switch to generation tab
        setIsPreparingDesign(false);
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null); // Clear screenshot when starting generation
        setTargetUrl(''); // Clear target URL
        
        // Update loading stage to planning
        setLoadingStage('planning');
        
        // Brief pause before switching to generation tab
        setTimeout(() => {
          setLoadingStage('generating');
          setActiveTab('generation');
        }, 1500);
        
        // Store scraped data in conversation context
        setConversationContext(prev => ({
          ...prev,
          scrapedWebsites: [...prev.scrapedWebsites, {
            url: url,
            content: scrapeData,
            timestamp: new Date()
          }],
          currentProject: `${url} Clone`
        }));
        
        // Filter out style-related context when using screenshot/URL-based generation
        // Only keep user's explicit instructions, not inherited styles
        let filteredContext = homeContextInput;
        if (homeUrlInput && homeContextInput) {
          // Check if the context contains default style names that shouldn't be inherited
          const stylePatterns = [
            'Glassmorphism style design',
            'Neumorphism style design', 
            'Brutalism style design',
            'Minimalist style design',
            'Dark Mode style design',
            'Gradient Rich style design',
            '3D Depth style design',
            'Retro Wave style design',
            'Modern clean and minimalist style design',
            'Fun colorful and playful style design',
            'Corporate professional and sleek style design',
            'Creative artistic and unique style design'
          ];
          
          // If the context exactly matches or starts with a style pattern, filter it out
          const startsWithStyle = stylePatterns.some(pattern => 
            homeContextInput.trim().startsWith(pattern)
          );
          
          if (startsWithStyle) {
            // Extract only the additional instructions part after the style
            const additionalMatch = homeContextInput.match(/\. (.+)$/);
            filteredContext = additionalMatch ? additionalMatch[1] : '';
          }
        }
        
        const prompt = `I want to recreate the ${url} website as a complete React application based on the scraped content below.

${JSON.stringify(scrapeData, null, 2)}

${filteredContext ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${filteredContext}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Implement ALL sections and features from the original site
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Ensure all text content matches the original
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${filteredContext ? '- Apply the user\'s context/theme requirements throughout the application' : ''}

Focus on the key sections and content, making it clean and modern.`;
        
        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Initializing AI...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          // Keep previous files until new ones are generated
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));
        
        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt,
            model: aiModel,
            context: {
              sandboxId: sandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext
            }
          })
        });
        
        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error('Failed to generate code');
        }
        
        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';
        let explanation = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';
                  
                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') &&
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                    console.log('[AI]', text.trim());
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);
                        
                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  
                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
        
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));
        
        if (generatedCode) {
          console.log('AI recreation generated!');

          // Log the explanation if available
          if (explanation && explanation.trim()) {
            console.log('[AI explanation]', explanation);
          }

          setPromptInput(generatedCode);

          // First application for cloned site should not be in edit mode
          await applyGeneratedCode(generatedCode, false);

          console.log(
            `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}!`
          );
          
          setConversationContext(prev => ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, {
              files: [],
              timestamp: new Date()
            }]
          }));
        } else {
          throw new Error('Failed to generate recreation');
        }
        
        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');
        
        // Clear generation progress and all screenshot/design states
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));
        
        // Clear screenshot and preparing design states to prevent them from showing on next run
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null); // Clear loading stage
        setIsStartingNewGeneration(false); // Clear new generation flag
        setShowLoadingBackground(false); // Clear loading background
        
        setTimeout(() => {
          // Switch back to preview tab but keep files
          setActiveTab('preview');
        }, 1000); // Show completion briefly then switch
      } catch (error: any) {
        console.error(`Failed to clone website: ${error.message}`);
        setUrlStatus([]);
        setIsPreparingDesign(false);
        setIsStartingNewGeneration(false); // Clear new generation flag on error
        setLoadingStage(null);
        // Also clear generation progress on error
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '',
          // Keep files to display in sidebar
          files: prev.files
        }));
      }
    }, 500);
  };

  return (
    <HeaderProvider>
      <div className="font-sans bg-background text-foreground h-screen flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Panel - Preview or Generation (full width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-4 pb-4 bg-white border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {/* Toggle-style Code/View switcher */}
              <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                <button
                  onClick={() => setActiveTab('generation')}
                  className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                    activeTab === 'generation' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Code</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                    activeTab === 'preview' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>View</span>
                  </div>
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button 
                onClick={reapplyLastGeneration}
                className="p-8 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Re-apply last generation"
                disabled={!conversationContext.lastGeneratedCode || !sandboxData}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={downloadZip}
                disabled={!sandboxData}
                className="p-8 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download your Vite app as ZIP"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </button>
              {/* Files generated count */}
              {activeTab === 'generation' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                <div className="text-gray-500 text-xs font-medium">
                  {generationProgress.files.length} files generated
                </div>
              )}
              
              {/* Live Code Generation Status */}
              {activeTab === 'generation' && generationProgress.isGenerating && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {generationProgress.isEdit ? 'Editing code' : 'Live generation'}
                </div>
              )}
              
              {/* Sandbox Status Indicator */}
              {sandboxData && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Sandbox active
                </div>
              )}
              
              {/* Open in new tab button */}
              {sandboxData && (
                <a 
                  href={sandboxData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {renderMainContent()}
          </div>
        </div>
      </div>




    </div>
    </HeaderProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AISandboxPage />
    </Suspense>
  );
}