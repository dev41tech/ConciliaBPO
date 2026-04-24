import { useEffect, useState, useCallback } from 'react'
import type { UploadedFile } from '../types'

export interface HistoryEntry {
  id: string
  name: string
  sheets: string[]
  savedAt: number
  rawData: UploadedFile['rawData']
}

const DB_NAME = 'conciliador-bpo'
const STORE = 'file-history'
const MAX_ENTRIES = 6

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGetAll(): Promise<HistoryEntry[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as HistoryEntry[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function dbPut(entry: HistoryEntry): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* silently fail */ }
}

async function dbDelete(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* silently fail */ }
}

export function useFileHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    dbGetAll().then((all) => setEntries(all.sort((a, b) => b.savedAt - a.savedAt)))
  }, [])

  const addEntry = useCallback(async (file: UploadedFile) => {
    const existing = entries.find((e) => e.name === file.name)
    const entry: HistoryEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      name: file.name,
      sheets: file.sheets,
      savedAt: Date.now(),
      rawData: file.rawData,
    }
    await dbPut(entry)
    const all = await dbGetAll()
    const sorted = all.sort((a, b) => b.savedAt - a.savedAt)
    for (const old of sorted.slice(MAX_ENTRIES)) await dbDelete(old.id)
    setEntries(sorted.slice(0, MAX_ENTRIES))
  }, [entries])

  const removeEntry = useCallback(async (id: string) => {
    await dbDelete(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, addEntry, removeEntry }
}
