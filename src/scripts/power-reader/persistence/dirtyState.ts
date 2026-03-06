import type { SyncableField } from '../utils/storage';

export type DirtyFlags = Record<SyncableField, boolean>;
export type DirtySequence = Record<SyncableField, number>;

export interface DirtySnapshot {
  dirty: DirtyFlags;
  sequence: DirtySequence;
}

export interface SyncMetadataCounters {
  readClearEpoch: number;
  loadFromClearEpoch: number;
  loadFromVersion: number;
  authorPrefsClearEpoch: number;
  aiStudioPrefixVersion: number;
}

export const SYNCABLE_FIELDS: SyncableField[] = ['read', 'loadFrom', 'authorPrefs', 'aiStudioPrefix'];

export const createDirtySequence = (): DirtySequence => ({
  read: 0,
  loadFrom: 0,
  authorPrefs: 0,
  aiStudioPrefix: 0,
});

export const snapshotDirtyState = (
  dirty: DirtyFlags,
  sequence: DirtySequence
): DirtySnapshot => ({
  dirty: { ...dirty },
  sequence: { ...sequence },
});

export const clearCommittedDirtyFlags = (
  currentDirty: DirtyFlags,
  currentSequence: DirtySequence,
  snapshot: DirtySnapshot
): DirtyFlags => {
  const nextDirty: DirtyFlags = { ...currentDirty };
  for (const field of SYNCABLE_FIELDS) {
    if (!snapshot.dirty[field]) continue;
    if (!nextDirty[field]) continue;
    if (currentSequence[field] !== snapshot.sequence[field]) continue;
    nextDirty[field] = false;
  }
  return nextDirty;
};

export const mergeCommittedSyncMetadata = (
  current: SyncMetadataCounters,
  committed: SyncMetadataCounters
): SyncMetadataCounters => ({
  readClearEpoch: Math.max(current.readClearEpoch, committed.readClearEpoch),
  loadFromClearEpoch: Math.max(current.loadFromClearEpoch, committed.loadFromClearEpoch),
  loadFromVersion: Math.max(current.loadFromVersion, committed.loadFromVersion),
  authorPrefsClearEpoch: Math.max(current.authorPrefsClearEpoch, committed.authorPrefsClearEpoch),
  aiStudioPrefixVersion: Math.max(current.aiStudioPrefixVersion, committed.aiStudioPrefixVersion),
});
