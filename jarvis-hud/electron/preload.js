import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('orbAPI', {
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  moveWindowBy: (dx, dy) => ipcRenderer.send('move-window-by', dx, dy),
})
