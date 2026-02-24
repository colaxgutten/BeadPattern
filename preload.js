const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readImage: (filePath) => ipcRenderer.invoke('file:readImage', filePath),
  savePattern: (name, data) => ipcRenderer.invoke('patterns:save', name, data),
  listPatterns: () => ipcRenderer.invoke('patterns:list'),
  loadPattern: (name) => ipcRenderer.invoke('patterns:load', name),
  deletePattern: (name) => ipcRenderer.invoke('patterns:delete', name)
});
