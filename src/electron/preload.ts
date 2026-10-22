import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, DesktopApi } from '../shared/contracts';
const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('state'),
  start: input => ipcRenderer.invoke('start', input),
  stop: () => ipcRenderer.invoke('stop'),
  openEvidence: id => ipcRenderer.invoke('evidence', id),
  subscribe: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state);
    ipcRenderer.on('state:update', listener);
    return () => ipcRenderer.removeListener('state:update', listener);
  }
};
contextBridge.exposeInMainWorld('desktop', api);
