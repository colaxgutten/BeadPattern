const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// Ensure patterns directory exists
function getPatternsDir() {
  const dir = path.join(app.getPath('userData'), 'patterns');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('file:readImage', async (_event, filePath) => {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'image/bmp';
  return `data:${mime};base64,${data.toString('base64')}`;
});

ipcMain.handle('patterns:save', async (_event, name, patternData) => {
  const dir = getPatternsDir();
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, '_');
  const file = path.join(dir, `${safe}.json`);
  fs.writeFileSync(file, JSON.stringify(patternData, null, 2), 'utf8');
  return { success: true, file };
});

ipcMain.handle('patterns:list', async () => {
  const dir = getPatternsDir();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const name = f.replace(/\.json$/, '');
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    let date = stat.mtime.toISOString();
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (data.date) date = data.date;
    } catch (_) {}
    return { name, date };
  });
});

ipcMain.handle('patterns:load', async (_event, name) => {
  const dir = getPatternsDir();
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, '_');
  const file = path.join(dir, `${safe}.json`);
  const data = fs.readFileSync(file, 'utf8');
  return JSON.parse(data);
});

ipcMain.handle('patterns:delete', async (_event, name) => {
  const dir = getPatternsDir();
  const safe = name.replace(/[^a-zA-Z0-9_\- ]/g, '_');
  const file = path.join(dir, `${safe}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
