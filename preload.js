const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlay', { chooseAudio: () => ipcRenderer.invoke('choose-audio') });
