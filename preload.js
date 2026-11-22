const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('overlay', { desktop: true });
