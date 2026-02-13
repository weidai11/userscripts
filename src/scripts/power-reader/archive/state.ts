/**
 * State management for User Archive 2.0
 */

import type { Post, Comment } from '../../../shared/graphql/queries';

export type ArchiveViewMode = 'card' | 'index' | 'thread';
export type ArchiveSortBy = 'date' | 'score' | 'replyTo';

export interface ArchiveFilter {
    regex: string;
    minScore: number | null;
    startDate: string | null;
    endDate: string | null;
}

export interface ArchiveState {
    // Target User info
    username: string;
    userId: string | null;

    // Data Store
    items: (Post | Comment)[]; // Unified feed
    itemById: Map<string, Post | Comment>;

    // Caching/Sync
    lastSyncDate: string | null; // Watermark for incremental updates

    // UI/View State
    viewMode: ArchiveViewMode;
    sortBy: ArchiveSortBy;
    filters: ArchiveFilter;

    // Loading status
    isSyncing: boolean;
    syncProgress: {
        postsFetched: number;
        commentsFetched: number;
        totalExpected?: number;
    };
}

/**
 * Create initial archive state
 */
export const createInitialArchiveState = (username: string): ArchiveState => ({
    username,
    userId: null,
    items: [],
    itemById: new Map(),
    lastSyncDate: null,
    viewMode: 'card',
    sortBy: 'date',
    filters: {
        regex: '',
        minScore: null,
        startDate: null,
        endDate: null
    },
    isSyncing: false,
    syncProgress: {
        postsFetched: 0,
        commentsFetched: 0
    }
});
