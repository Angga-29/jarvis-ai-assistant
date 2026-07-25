import { app, BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ORB_SIZE = 130
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

let win = null

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: ORB_SIZE,
    height: ORB_SIZE,
    x: width - ORB_SIZE - 40,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      search: 'mode=orb',
    })
  } else {
    win.loadURL(`${DEV_SERVER_URL}/?mode=orb`)
  }
}

ipcMain.handle('capture-screen', async () => {
  const { width, height } = screen.getPrimaryDisplay().size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  })
  if (!sources.length) throw new Error('No screen source available')
  return sources[0].thumbnail.toDataURL()
})

ipcMain.on('move-window-by', (event, dx, dy) => {
  const sender = BrowserWindow.fromWebContents(event.sender)
  if (!sender) return
  const [x, y] = sender.getPosition()
  sender.setPosition(Math.round(x + dx), Math.round(y + dy))
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
