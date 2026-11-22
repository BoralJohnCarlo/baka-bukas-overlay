const { app, BrowserWindow, screen, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
let win;
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width, height, x: 0, y: 0, transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'index.html'));
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Shift+H', () => { if (win.isVisible()) win.hide(); else win.show(); });
}
app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
ipcMain.handle('choose-audio', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }] });
  if (result.canceled || !result.filePaths.length) return null;
  const { pathToFileURL } = require('url');
  return pathToFileURL(result.filePaths[0]).href;
});
