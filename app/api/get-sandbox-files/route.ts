import { NextResponse } from 'next/server';
import { parseJavaScriptFile, buildComponentTree } from '@/lib/file-parser';
import { FileManifest, FileInfo, RouteInfo } from '@/types/file-manifest';
// SandboxState type used implicitly through global.activeSandbox

declare global {
  var activeSandbox: any;
  var activeSandboxProvider: any;
}

export async function GET() {
  try {
    console.log('[get-sandbox-files] ========== GET REQUEST RECEIVED ==========');
    // Check both V2 provider (new) and V1 sandbox (legacy) patterns
    const provider = global.activeSandboxProvider;
    const sandbox = global.activeSandbox;

    console.log('[get-sandbox-files] Global state:', {
      hasProvider: !!provider,
      hasSandbox: !!sandbox,
      providerType: provider?.constructor?.name,
      sandboxType: sandbox?.constructor?.name
    });

    if (!provider && !sandbox) {
      console.error('[get-sandbox-files] No active sandbox found!');
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 404 });
    }

    console.log('[get-sandbox-files] Fetching and analyzing file structure...');

    // Detect provider type
    const isE2B = provider && provider.constructor.name === 'E2BProvider';
    const isVercel = provider && provider.constructor.name === 'VercelProvider';
    const isV1Sandbox = !provider && sandbox;

    console.log('[get-sandbox-files] Provider type:', { isE2B, isVercel, isV1Sandbox });

    // Determine the working directory
    const cwd = isVercel ? '/vercel/sandbox' : isE2B ? '/home/user/app' : '.';
    const activeSandboxInstance = provider?.sandbox || sandbox;

    if (!activeSandboxInstance) {
      return NextResponse.json({
        success: false,
        error: 'No sandbox instance available'
      }, { status: 404 });
    }

    // Read content of files
    const filesContent: Record<string, string> = {};
    let structure = '';

    if (isE2B) {
      // E2B Provider - use Python code execution
      console.log('[get-sandbox-files] Using E2B Python-based file reading');

      try {
        const pythonCode = `
import os
import json
from pathlib import Path

os.chdir('/home/user/app')

# Extensions to include
extensions = ['.jsx', '.js', '.tsx', '.ts', '.css', '.json']

# Directories to exclude
exclude_dirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__']

files_data = {}

def should_exclude(path):
    parts = Path(path).parts
    return any(excluded in parts for excluded in exclude_dirs)

# Walk through directory
for root, dirs, files in os.walk('.'):
    # Filter out excluded directories
    dirs[:] = [d for d in dirs if d not in exclude_dirs]

    for file in files:
        file_path = os.path.join(root, file)

        # Check if file has one of the desired extensions
        if any(file.endswith(ext) for ext in extensions):
            if not should_exclude(file_path):
                try:
                    # Check file size (limit to 100KB)
                    file_size = os.path.getsize(file_path)
                    if file_size < 100000:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            # Remove leading './' from path
                            rel_path = file_path[2:] if file_path.startswith('./') else file_path
                            files_data[rel_path] = content
                except Exception as e:
                    # Skip files that can't be read
                    pass

# Get directory structure
dirs_list = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    level = root.replace('.', '').count(os.sep)
    if level < 5:  # Limit depth
        dirs_list.append(root)

print("FILES_DATA_START")
print(json.dumps(files_data))
print("FILES_DATA_END")
print("DIRS_START")
print('\\n'.join(dirs_list[:50]))
print("DIRS_END")
`;

        const result = await activeSandboxInstance.runCode(pythonCode);
        const output = result.logs.stdout.join('\n');

        // Parse files data
        const filesMatch = output.match(/FILES_DATA_START\n([\s\S]*?)\nFILES_DATA_END/);
        if (filesMatch) {
          const filesJson = filesMatch[1];
          try {
            const parsedFiles = JSON.parse(filesJson);
            Object.assign(filesContent, parsedFiles);
            console.log('[get-sandbox-files] Loaded', Object.keys(filesContent).length, 'files from E2B');
          } catch (e) {
            console.error('[get-sandbox-files] Failed to parse files JSON:', e);
          }
        }

        // Parse directory structure
        const dirsMatch = output.match(/DIRS_START\n([\s\S]*?)\nDIRS_END/);
        if (dirsMatch) {
          structure = dirsMatch[1];
        }

      } catch (error) {
        console.error('[get-sandbox-files] E2B Python execution error:', error);
        throw error;
      }

    } else if (isVercel) {
      // Vercel Provider - use runCommand
      console.log('[get-sandbox-files] Using Vercel command-based file reading');

      const findResult = await activeSandboxInstance.runCommand({
        cmd: 'find',
        args: [
          '.',
          '-name', 'node_modules', '-prune', '-o',
          '-name', '.git', '-prune', '-o',
          '-name', 'dist', '-prune', '-o',
          '-name', 'build', '-prune', '-o',
          '-name', '.next', '-prune', '-o',
          '-type', 'f',
          '(',
          '-name', '*.jsx',
          '-o', '-name', '*.js',
          '-o', '-name', '*.tsx',
          '-o', '-name', '*.ts',
          '-o', '-name', '*.css',
          '-o', '-name', '*.json',
          ')',
          '-print'
        ],
        cwd
      });

      if (findResult.exitCode !== 0) {
        throw new Error('Failed to list files');
      }

      let stdoutContent = '';
      if (typeof findResult.stdout === 'function') {
        stdoutContent = await findResult.stdout();
      } else {
        stdoutContent = findResult.stdout || '';
      }

      const fileList = stdoutContent.split('\n').filter((f: string) => f.trim());
      console.log('[get-sandbox-files] Found', fileList.length, 'files');

      for (const filePath of fileList) {
        try {
          const statResult = await activeSandboxInstance.runCommand({
            cmd: 'bash',
            args: ['-c', `wc -c < "${filePath}"`],
            cwd
          });

          if (statResult.exitCode === 0) {
            let sizeOutput = '';
            if (typeof statResult.stdout === 'function') {
              sizeOutput = await statResult.stdout();
            } else {
              sizeOutput = statResult.stdout || '0';
            }

            const fileSize = parseInt(sizeOutput.trim());

            if (fileSize < 100000) {
              const catResult = await activeSandboxInstance.runCommand({
                cmd: 'cat',
                args: [filePath],
                cwd
              });

              if (catResult.exitCode === 0) {
                let content = '';
                if (typeof catResult.stdout === 'function') {
                  content = await catResult.stdout();
                } else {
                  content = catResult.stdout || '';
                }

                const relativePath = filePath.replace(/^\.\//, '');
                filesContent[relativePath] = content;
              }
            }
          }
        } catch (parseError) {
          console.debug('Error reading file:', filePath, parseError);
          continue;
        }
      }

      // Get directory structure
      const treeResult = await activeSandboxInstance.runCommand({
        cmd: 'find',
        args: ['.', '-type', 'd', '-not', '-path', '*/node_modules*', '-not', '-path', '*/.git*', '-not', '-path', '*/.next*'],
        cwd
      });

      if (treeResult.exitCode === 0) {
        let treeOutput = '';
        if (typeof treeResult.stdout === 'function') {
          treeOutput = await treeResult.stdout();
        } else {
          treeOutput = treeResult.stdout || '';
        }

        const dirs = treeOutput.split('\n').filter((d: string) => d.trim());
        structure = dirs.slice(0, 50).join('\n');
      }

    } else {
      // V1 Sandbox - use runCommand
      console.log('[get-sandbox-files] Using V1 sandbox command-based file reading');

      const findResult = await activeSandboxInstance.runCommand({
        cmd: 'find',
        args: [
          '.',
          '-name', 'node_modules', '-prune', '-o',
          '-name', '.git', '-prune', '-o',
          '-name', 'dist', '-prune', '-o',
          '-name', 'build', '-prune', '-o',
          '-type', 'f',
          '(',
          '-name', '*.jsx',
          '-o', '-name', '*.js',
          '-o', '-name', '*.tsx',
          '-o', '-name', '*.ts',
          '-o', '-name', '*.css',
          '-o', '-name', '*.json',
          ')',
          '-print'
        ]
      });

      if (findResult.exitCode !== 0) {
        throw new Error('Failed to list files');
      }

      const stdoutContent = findResult.stdout || '';
      const fileList = stdoutContent.split('\n').filter((f: string) => f.trim());
      console.log('[get-sandbox-files] Found', fileList.length, 'files');

      for (const filePath of fileList) {
        try {
          const statResult = await activeSandboxInstance.runCommand({
            cmd: 'stat',
            args: ['-f', '%z', filePath]
          });

          if (statResult.exitCode === 0) {
            const fileSize = parseInt(statResult.stdout || '0');

            if (fileSize < 100000) {
              const catResult = await activeSandboxInstance.runCommand({
                cmd: 'cat',
                args: [filePath]
              });

              if (catResult.exitCode === 0) {
                const relativePath = filePath.replace(/^\.\//, '');
                filesContent[relativePath] = catResult.stdout || '';
              }
            }
          }
        } catch (parseError) {
          console.debug('Error reading file:', filePath, parseError);
          continue;
        }
      }

      // Get directory structure
      const treeResult = await activeSandboxInstance.runCommand({
        cmd: 'find',
        args: ['.', '-type', 'd', '-not', '-path', '*/node_modules*', '-not', '-path', '*/.git*']
      });

      if (treeResult.exitCode === 0) {
        const dirs = (treeResult.stdout || '').split('\n').filter((d: string) => d.trim());
        structure = dirs.slice(0, 50).join('\n');
      }
    }
    
    // Build enhanced file manifest
    const fileManifest: FileManifest = {
      files: {},
      routes: [],
      componentTree: {},
      entryPoint: '',
      styleFiles: [],
      timestamp: Date.now(),
    };
    
    // Process each file
    for (const [relativePath, content] of Object.entries(filesContent)) {
      const fullPath = `/${relativePath}`;
      
      // Create base file info
      const fileInfo: FileInfo = {
        content: content,
        type: 'utility',
        path: fullPath,
        relativePath,
        lastModified: Date.now(),
      };
      
      // Parse JavaScript/JSX files
      if (relativePath.match(/\.(jsx?|tsx?)$/)) {
        const parseResult = parseJavaScriptFile(content, fullPath);
        Object.assign(fileInfo, parseResult);
        
        // Identify entry point
        if (relativePath === 'src/main.jsx' || relativePath === 'src/index.jsx') {
          fileManifest.entryPoint = fullPath;
        }
        
        // Identify App.jsx
        if (relativePath === 'src/App.jsx' || relativePath === 'App.jsx') {
          fileManifest.entryPoint = fileManifest.entryPoint || fullPath;
        }
      }
      
      // Track style files
      if (relativePath.endsWith('.css')) {
        fileManifest.styleFiles.push(fullPath);
        fileInfo.type = 'style';
      }
      
      fileManifest.files[fullPath] = fileInfo;
    }
    
    // Build component tree
    fileManifest.componentTree = buildComponentTree(fileManifest.files);
    
    // Extract routes (simplified - looks for Route components or page pattern)
    fileManifest.routes = extractRoutes(fileManifest.files);
    
    // Update global file cache with manifest
    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.manifest = fileManifest;
    }

    return NextResponse.json({
      success: true,
      files: filesContent,
      structure,
      fileCount: Object.keys(filesContent).length,
      manifest: fileManifest,
    });

  } catch (error) {
    console.error('[get-sandbox-files] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

function extractRoutes(files: Record<string, FileInfo>): RouteInfo[] {
  const routes: RouteInfo[] = [];
  
  // Look for React Router usage
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.content.includes('<Route') || fileInfo.content.includes('createBrowserRouter')) {
      // Extract route definitions (simplified)
      const routeMatches = fileInfo.content.matchAll(/path=["']([^"']+)["'].*(?:element|component)={([^}]+)}/g);
      
      for (const match of routeMatches) {
        const [, routePath] = match;
        // componentRef available in match but not used currently
        routes.push({
          path: routePath,
          component: path,
        });
      }
    }
    
    // Check for Next.js style pages
    if (fileInfo.relativePath.startsWith('pages/') || fileInfo.relativePath.startsWith('src/pages/')) {
      const routePath = '/' + fileInfo.relativePath
        .replace(/^(src\/)?pages\//, '')
        .replace(/\.(jsx?|tsx?)$/, '')
        .replace(/index$/, '');
        
      routes.push({
        path: routePath,
        component: path,
      });
    }
  }
  
  return routes;
}