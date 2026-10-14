import { useSyncExternalStore } from 'react'
import { getStudioStore, type StudioSnapshot, type StudioState, type StudioTemplate } from './studioStore'
import type { DrawRecord } from '../core/palace'
import type { Stamp } from '../core/stamp'

export interface StudioApi extends StudioSnapshot {
  restored: boolean
  set: (patch: Partial<StudioState>) => void
  addStamp: (stamp: Stamp) => boolean
  clear: () => void
  undo: () => void
  redo: () => void
  regenerate: () => void
  createFromTemplate: (template: StudioTemplate) => void
  flip: () => DrawRecord | null
}

export type { StudioState, StudioTemplate }

export function useStudio(): StudioApi {
  const store = getStudioStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return {
    ...snapshot,
    restored: store.restored,
    set: store.set,
    addStamp: store.addStamp,
    clear: store.clear,
    undo: store.undo,
    redo: store.redo,
    regenerate: store.regenerate,
    createFromTemplate: store.createFromTemplate,
    flip: store.flip,
  }
}
