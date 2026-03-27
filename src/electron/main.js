const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Prevent garbage collection
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'نظام خبرني العقاري',
    icon: path.join(__dirname, '../public/favicon.ico'), // Ensure you have an icon
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simple migration. Use preload in production for security.
      webSecurity: false, // Allow loading local resources if needed
    },
  });

  // Remove Menu Bar (Optional - for cleaner look)
  mainWindow.setMenuBarVisibility(false);

  // Determine if we are in Dev or Prod
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In Dev: Load from Vite Dev Server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); // Open DevTools for debugging
  } else {
    // In Prod: Load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle External Links (Open in Browser, not in App)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
