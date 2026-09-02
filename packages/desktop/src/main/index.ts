import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { is } from '@electron-toolkit/utils';
import type { WorklightState } from '@moonlight/core';
import { AnthropicClient, AnthropicApiError, buildRiffPrompt } from '@moonlight/core';
import { FileStorageAdapter, SafeStorageTokenStore } from './storage';

const storageAdapter = new FileStorageAdapter();

function imagesDir(): string {
  return join(app.getPath('userData'), 'idea-images');
}

// Idea image attachments: files live under userData/idea-images, named
// solely by a generated UUID + a whitelisted extension — never a path the
// renderer supplies. The custom `moonlight-image://` scheme below is the
// only way the renderer can read them back, and it re-validates every
// filename against the same whitelist before touching the filesystem, so
// there's no way for a crafted `moonlight-image://` URL to traverse out of
// that directory.
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const IMAGE_FILENAME_RE = new RegExp(`^[a-f0-9-]+\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i');

protocol.registerSchemesAsPrivileged([
  { scheme: 'moonlight-image', privileges: { standard: false, secure: true, supportFetchAPI: true, bypassCSP: false, corsEnabled: false } },
]);

// Two independent secrets, two independent files — connecting/disconnecting
// GitHub never touches the Anthropic key and vice versa.
const secretStores = {
  github: new SafeStorageTokenStore('moonlight-github-token.enc'),
  anthropic: new SafeStorageTokenStore('moonlight-anthropic-token.enc'),
} as const;
type SecretName = keyof typeof secretStores;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#17181A', // matches the dark-theme --bg token; avoids a white flash on launch
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on('ready-to-show', () => win.show());

  // Any link a user clicks (e.g. a GitHub PR URL from the activity feed)
  // opens in their real browser, never inside the app window.
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ---------- IPC: state persistence ----------
ipcMain.handle('state:load', async () => storageAdapter.load());
ipcMain.handle('state:save', async (_event, state: WorklightState) => storageAdapter.save(state));

// ---------- IPC: secrets (GitHub token, Anthropic API key) ----------
// The GitHub token is handed back to the renderer on request (it needs
// it to call the GitHub API directly). The Anthropic key is deliberately
// NOT retrievable this way — enforced here, not just by renderer
// convention — since only the ai:riff handler below is allowed to use it.
ipcMain.handle('secret:get', async (_event, name: SecretName) => {
  if (name === 'anthropic') {
    throw new Error('The Anthropic key cannot be read back from the renderer.');
  }
  return secretStores[name].get();
});
ipcMain.handle('secret:set', async (_event, name: SecretName, value: string) => secretStores[name].set(value));
ipcMain.handle('secret:clear', async (_event, name: SecretName) => secretStores[name].clear());
ipcMain.handle('secret:has', async (_event, name: SecretName) => (await secretStores[name].get()) !== null);

// ---------- IPC: AI riff (Creative Hub) ----------
// The renderer sends only the idea text/tag; this process holds the
// Anthropic key and makes the call itself, so the key is never
// serialized into the renderer's JS context at all.
ipcMain.handle('ai:riff', async (_event, ideaText: string, tag: string | null) => {
  const apiKey = await secretStores.anthropic.get();
  if (!apiKey) {
    throw new Error('No Anthropic API key connected. Add one in Settings to enable riffing.');
  }
  try {
    const client = new AnthropicClient(apiKey);
    const text = await client.complete(buildRiffPrompt(ideaText, tag));
    return text.trim();
  } catch (err) {
    if (err instanceof AnthropicApiError && err.status === 401) {
      throw new Error('That Anthropic API key was rejected. Check it in Settings.');
    }
    throw err;
  }
});

// ---------- IPC: JSON backup export / import ----------
ipcMain.handle('data:export', async (event, json: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: 'Export Moonlight backup',
    defaultPath: `moonlight-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return { saved: false as const };
  const { promises: fs } = await import('fs');
  await fs.writeFile(filePath, json, 'utf-8');
  return { saved: true as const, filePath };
});

ipcMain.handle('data:import', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    title: 'Import Moonlight backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (canceled || !filePaths[0]) return { loaded: false as const };
  const { promises: fs } = await import('fs');
  const json = await fs.readFile(filePaths[0], 'utf-8');
  return { loaded: true as const, json };
});

// ---------- IPC: idea image attachments ----------
ipcMain.handle('idea-image:add', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    title: 'Attach an image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
  };
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (canceled || !filePaths[0]) return null;
  const ext = extname(filePaths[0]).slice(1).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;
  const filename = `${randomUUID()}.${ext}`;
  const { promises: fs } = await import('fs');
  await fs.mkdir(imagesDir(), { recursive: true });
  await fs.copyFile(filePaths[0], join(imagesDir(), filename));
  return filename;
});

ipcMain.handle('idea-image:remove', async (_event, filename: string) => {
  if (!IMAGE_FILENAME_RE.test(filename)) return;
  const { promises: fs } = await import('fs');
  await fs.unlink(join(imagesDir(), filename)).catch(() => {});
});

void app.whenReady().then(async () => {
  const { promises: fs } = await import('fs');
  await fs.mkdir(imagesDir(), { recursive: true });

  // Serves idea image attachments to the sandboxed renderer. The filename
  // is re-validated against the same whitelist used to generate/remove
  // images, so a crafted moonlight-image:// URL can never read anything
  // outside imagesDir() — the renderer never gets a raw filesystem path.
  protocol.handle('moonlight-image', async (request) => {
    const url = new URL(request.url);
    const filename = decodeURIComponent(url.hostname || url.pathname.replace(/^\/+/, ''));
    if (!IMAGE_FILENAME_RE.test(filename)) {
      return new Response('Invalid filename', { status: 400 });
    }
    try {
      const data = await fs.readFile(join(imagesDir(), filename));
      return new Response(data);
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    // macOS convention: clicking the dock icon with no windows open
    // should reopen one. Harmless no-op on Windows/Linux.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
