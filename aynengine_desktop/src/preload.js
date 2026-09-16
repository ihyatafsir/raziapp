/**
 * preload.js
 * Context Bridge for AynEngine AI Desktop
 * Strictly zero emojis.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AynEngineDesktop', {
  getStatus: () => ipcRenderer.invoke('engine:status'),
  translate: (payload) => ipcRenderer.invoke('engine:translate', payload),
  extractRoots: (payload) => ipcRenderer.invoke('engine:extract-roots', payload),
  compileEpub: (payload) => ipcRenderer.invoke('engine:compile-epub', payload),
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  saveFile: (defaultName, data) => ipcRenderer.invoke('dialog:save-file', defaultName, data)
});
