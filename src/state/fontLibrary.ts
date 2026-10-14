import { useEffect, useSyncExternalStore } from 'react'
import { clearSealCache } from '../core/seal'

export interface CustomFont { key: string; label: string }
interface StoredFont { id: string; name: string; data: ArrayBuffer }
interface FontLibrarySnapshot { fonts: CustomFont[]; ready: boolean; importing: boolean }

interface StoredFontRecord { id: string; name: string; data: ArrayBuffer }

const listeners = new Set<() => void>()
let fonts: CustomFont[] = []
let ready = false
let importing = false
let snap: FontLibrarySnapshot = { fonts, ready, importing }
let pending: Promise<void> | null = null

function notify() {
  snap = { fonts, ready, importing }
  for (const listener of listeners) listener()
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cyber-imperial-fonts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('fonts', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readFonts(): Promise<StoredFontRecord[]> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('fonts').objectStore('fonts').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

async function storeFont(font: StoredFont) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('fonts', 'readwrite')
      tx.objectStore('fonts').put(font)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

async function register(font: StoredFont) {
  const face = await new FontFace(font.id, font.data).load()
  document.fonts.add(face)
  fonts = [...fonts, { key: font.id, label: font.name }]
  clearSealCache()
  window.dispatchEvent(new Event('imperial-fonts-changed'))
  notify()
}

export function ensureFontLibrary(): Promise<void> {
  pending ??= (async () => {
    try {
      const stored = await readFonts()
      for (const font of stored.slice(0, 8)) {
        if (!/^custom-[0-9a-f-]{36}$/.test(font.id) || !(font.data instanceof ArrayBuffer) || font.data.byteLength > 30 * 1024 * 1024) continue
        try { await register(font) } catch { /* 一个损坏的字体不影响其他字体 */ }
      }
    } catch { /* IndexedDB 不可用时仍可使用内置字体 */ }
    finally { ready = true; notify() }
  })()
  return pending
}

async function importFont(file: File): Promise<{ key: string; persisted: boolean }> {
  await ensureFontLibrary()
  if (fonts.length >= 8) throw new Error('最多导入 8 款字体')
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体')
  if (file.size > 30 * 1024 * 1024) throw new Error('字体文件须小于 30 MB')
  importing = true
  notify()
  try {
    const font = { id: `custom-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, '').slice(0, 36), data: await file.arrayBuffer() }
    await register(font)
    let persisted = true
    try { await storeFont(font) } catch { persisted = false }
    return { key: font.id, persisted }
  } catch (e) { throw new Error(e instanceof Error && e.message.startsWith('最多') ? e.message : '字体无法解析，请选择有效的字体文件') }
  finally { importing = false; notify() }
}

export function useFontLibrary(): FontLibrarySnapshot & { importFont: typeof importFont } {
  const snapshot = useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener) },
    () => snap,
  )
  useEffect(() => { void ensureFontLibrary() }, [])
  return { ...snapshot, importFont }
}
