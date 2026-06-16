import type { StorageGateway } from '../core'

export const localStorageGateway: StorageGateway = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key)
}
