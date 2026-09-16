/**
 * main.js
 * Electron Main Process for AynEngine AI Sovereign Desktop Studio
 * Strictly zero emojis.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let bridgeProcess = null;
let pendingRequests = new Map();
let requestIdCounter = 1;

function startPythonBridge() {
  const bridgeScript = path.join(__dirname, '..', 'backend', 'engine_bridge.py');
  bridgeProcess = spawn('python3', [bridgeScript, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutBuffer = '';
  bridgeProcess.stdout.on('data', (data) => {
    stdoutBuffer += data.toString('utf8');
    let lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // keep last incomplete chunk

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const res = JSON.parse(line);
        // Dispatch to oldest waiting request
        if (pendingRequests.size > 0) {
          const nextKey = pendingRequests.keys().next().value;
          const { resolve } = pendingRequests.get(nextKey);
          pendingRequests.delete(nextKey);
          resolve(res);
        }
      } catch (err) {
        console.error('Error parsing bridge output:', err, line);
      }
    }
  });

  bridgeProcess.stderr.on('data', (data) => {
    console.error('Bridge STDERR:', data.toString('utf8'));
  });

  bridgeProcess.on('close', (code) => {
    console.log('Bridge process exited with code:', code);
  });
}

function sendBridgeRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!bridgeProcess || bridgeProcess.killed) {
      return reject(new Error('Python bridge process is not running'));
    }
    const reqId = requestIdCounter++;
    pendingRequests.set(reqId, { resolve, reject });
    const line = JSON.stringify({ action, payload }) + '\n';
    bridgeProcess.stdin.write(line, 'utf8');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    frame: true,
    backgroundColor: '#0a0d14',
    title: 'AynEngine AI — Sovereign Morphological Translation Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startPythonBridge();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (bridgeProcess) {
    bridgeProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('engine:status', async () => {
  try {
    return await sendBridgeRequest('status');
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('engine:translate', async (event, payload) => {
  try {
    return await sendBridgeRequest('translate', payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('engine:extract-roots', async (event, payload) => {
  try {
    return await sendBridgeRequest('extract_roots', payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('engine:compile-epub', async (event, payload) => {
  try {
    return await sendBridgeRequest('compile_epub', payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Classical Manuscripts', extensions: ['txt', 'md', 'mARkdown', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf8');
  return { filePath, content };
});

ipcMain.handle('dialog:save-file', async (event, defaultName, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'EPUB Masterworks', extensions: ['epub'] },
      { name: 'JSON Records', extensions: ['json'] },
      { name: 'Markdown Text', extensions: ['md'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, data);
  return result.filePath;
});
