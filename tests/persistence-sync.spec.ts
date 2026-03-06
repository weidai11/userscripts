import { test, expect } from '@playwright/test';
import {
  FirestoreBackendError,
  buildFirestorePath,
  commitEnvelope,
  defaultEnvelope,
  getFirestoreBackendConfig,
  isCasConflict,
  isCreateRace,
  isInvalidArgument,
  isMissingDocumentError,
  isPermissionDenied,
  isQuotaExceeded,
  isUncertainWriteOutcome,
  readEnvelope,
  setFirestoreBackendConfigForTests,
  updateTimeToEpochMs,
} from '../src/scripts/power-reader/persistence/firestoreSyncBackend';
import {
  clearCommittedDirtyFlags,
  createDirtySequence,
  mergeCommittedSyncMetadata,
  snapshotDirtyState,
} from '../src/scripts/power-reader/persistence/dirtyState';
import { queryGraphQLResponse } from '../src/shared/graphql/client';
import { GET_CURRENT_USER } from '../src/shared/graphql/queries';

type GMOptions = {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  onload?: (response: { status: number; responseText: string }) => void;
  onerror?: (error: unknown) => void;
  ontimeout?: () => void;
};

const setMockRequest = (handler: (options: GMOptions) => void): void => {
  (globalThis as any).GM_xmlhttpRequest = (options: GMOptions) => handler(options);
};

const makeConfig = () => ({
  projectId: 'lw-power-reader-test',
  apiKey: 'test-api-key',
  host: 'firestore.googleapis.com',
});

test.describe('Persistence Sync Runtime Behavior', () => {
  test.beforeEach(() => {
    setFirestoreBackendConfigForTests({});
  });

  test('[PR-SYNC-01] buildFirestorePath is site-scoped', () => {
    expect(buildFirestorePath('lw', 'node123')).toBe('pr_sync_v1/lw/nodes/node123');
    expect(buildFirestorePath('eaf', 'node123')).toBe('pr_sync_v1/eaf/nodes/node123');
  });

  test('[PR-SYNC-04][PR-PERSIST-03][PR-PERSIST-06][PR-PERSIST-14][PR-PERSIST-17][PR-PERSIST-19][PR-PERSIST-23][PR-PERSIST-24][PR-PERSIST-34][PR-PERSIST-35][PR-PERSIST-44][PR-PERSIST-56][PR-PERSIST-74][PR-PERSIST-85][PR-PERSIST-87][PR-PERSIST-88][PR-PERSIST-89][PR-PERSIST-91][PR-PERSIST-92][PR-PERSIST-94][PR-PERSIST-95][PR-PERSIST-96][PR-PERSIST-97][PR-PERSIST-98][PR-PERSIST-99][PR-PERSIST-100] defaultEnvelope creates a usable baseline payload', () => {
    const nowIso = '2026-03-06T00:00:00.000Z';
    const expiresAtIso = '2026-04-01T00:00:00.000Z';
    const env = defaultEnvelope('lw', 'writer:abc123', nowIso, expiresAtIso);

    expect(env.schemaVersion).toBe(1);
    expect(env.site).toBe('lw');
    expect(env.lastPushedBy).toBe('writer:abc123');
    expect(env.fields.read.value).toEqual({});
    expect(env.fields.read.clearEpoch).toBe(0);
    expect(env.fields.loadFrom.version).toBe(0);
    expect(env.fields.authorPrefs.value).toEqual({});
    expect(env.fields.aiStudioPrefix.version).toBe(0);
  });

  test('error classifiers classify backend errors by code/status', () => {
    const cas = new FirestoreBackendError('cas mismatch', 409, 'ABORTED');
    const createRace = new FirestoreBackendError('already exists', 409, 'ALREADY_EXISTS');
    const missing = new FirestoreBackendError('missing', 404, 'NOT_FOUND');
    const denied = new FirestoreBackendError('denied', 403, 'PERMISSION_DENIED');
    const invalid = new FirestoreBackendError('invalid', 400, 'INVALID_ARGUMENT');
    const quota = new FirestoreBackendError('resource exhausted', 429, 'RESOURCE_EXHAUSTED');
    const uncertain = new FirestoreBackendError('unknown commit result', 500, 'UNCERTAIN_WRITE_OUTCOME');

    expect(isCasConflict(cas)).toBe(true);
    expect(isCreateRace(createRace)).toBe(true);
    expect(isMissingDocumentError(missing)).toBe(true);
    expect(isPermissionDenied(denied)).toBe(true);
    expect(isInvalidArgument(invalid)).toBe(true);
    expect(isQuotaExceeded(quota)).toBe(true);
    expect(isUncertainWriteOutcome(uncertain)).toBe(true);
  });

  test('updateTimeToEpochMs parses valid RFC3339 timestamps and rejects invalid values', () => {
    expect(updateTimeToEpochMs('2026-03-06T01:02:03.456Z')).toBe(1772758923456);
    expect(updateTimeToEpochMs('')).toBeUndefined();
    expect(updateTimeToEpochMs('not-a-date')).toBeUndefined();
  });

  test('[PR-PERSIST-101] clearCommittedDirtyFlags preserves fields dirtied after snapshot', () => {
    const initialSequence = createDirtySequence();
    initialSequence.read = 3;
    initialSequence.authorPrefs = 5;

    const snapshot = snapshotDirtyState(
      { read: true, loadFrom: false, authorPrefs: true, aiStudioPrefix: false },
      initialSequence
    );

    const currentDirty = {
      read: true,
      loadFrom: true,
      authorPrefs: true,
      aiStudioPrefix: false,
    };
    const currentSequence = {
      ...initialSequence,
      loadFrom: 1,
      authorPrefs: 6,
    };

    expect(clearCommittedDirtyFlags(currentDirty, currentSequence, snapshot)).toEqual({
      read: false,
      loadFrom: true,
      authorPrefs: true,
      aiStudioPrefix: false,
    });
  });

  test('[PR-PERSIST-101] clearCommittedDirtyFlags clears unchanged dirty fields from committed snapshot', () => {
    const sequence = createDirtySequence();
    sequence.read = 2;
    sequence.loadFrom = 4;
    const snapshot = snapshotDirtyState(
      { read: true, loadFrom: true, authorPrefs: false, aiStudioPrefix: false },
      sequence
    );
    const currentDirty = { read: true, loadFrom: true, authorPrefs: true, aiStudioPrefix: false };
    const currentSequence = { ...sequence, authorPrefs: 8 };

    expect(clearCommittedDirtyFlags(currentDirty, currentSequence, snapshot)).toEqual({
      read: false,
      loadFrom: false,
      authorPrefs: true,
      aiStudioPrefix: false,
    });
  });

  test('[PR-PERSIST-101] mergeCommittedSyncMetadata keeps newer local counters while applying committed floors', () => {
    expect(mergeCommittedSyncMetadata(
      {
        readClearEpoch: 6,
        loadFromClearEpoch: 12,
        loadFromVersion: 9,
        authorPrefsClearEpoch: 7,
        aiStudioPrefixVersion: 11,
      },
      {
        readClearEpoch: 4,
        loadFromClearEpoch: 10,
        loadFromVersion: 8,
        authorPrefsClearEpoch: 5,
        aiStudioPrefixVersion: 10,
      }
    )).toEqual({
      readClearEpoch: 6,
      loadFromClearEpoch: 12,
      loadFromVersion: 9,
      authorPrefsClearEpoch: 7,
      aiStudioPrefixVersion: 11,
    });

    expect(mergeCommittedSyncMetadata(
      {
        readClearEpoch: 2,
        loadFromClearEpoch: 3,
        loadFromVersion: 3,
        authorPrefsClearEpoch: 1,
        aiStudioPrefixVersion: 4,
      },
      {
        readClearEpoch: 5,
        loadFromClearEpoch: 6,
        loadFromVersion: 6,
        authorPrefsClearEpoch: 7,
        aiStudioPrefixVersion: 8,
      }
    )).toEqual({
      readClearEpoch: 5,
      loadFromClearEpoch: 6,
      loadFromVersion: 6,
      authorPrefsClearEpoch: 7,
      aiStudioPrefixVersion: 8,
    });
  });

  test('[PR-SYNC-03][PR-PERSIST-80] config override controls getFirestoreBackendConfig deterministically', () => {
    setFirestoreBackendConfigForTests({
      projectId: 'proj-test',
      apiKey: 'api-test',
      host: 'localhost:8080',
    });
    const cfg = getFirestoreBackendConfig();
    expect(cfg).toEqual({
      projectId: 'proj-test',
      apiKey: 'api-test',
      host: 'localhost:8080',
    });

    setFirestoreBackendConfigForTests({});
    expect(getFirestoreBackendConfig()).not.toBeNull();
  });

  test('[PR-PERSIST-25] commitEnvelope rejects CAS writes without expectedUpdateTime', async () => {
    setMockRequest(() => {
      throw new Error('request should not execute for invalid options');
    });

    const env = defaultEnvelope('lw', 'writer', '2026-03-06T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    await expect(
      commitEnvelope(makeConfig(), 'lw', 'node1', env, {} as any)
    ).rejects.toMatchObject({
      name: 'FirestoreBackendError',
      code: 'INVALID_COMMIT_OPTIONS',
    });
  });

  test('[PR-PERSIST-83][PR-PERSIST-86][PR-PERSIST-93] commitEnvelope emits server-timestamp transform and returns commit updateTime', async () => {
    const capturedPayloads: any[] = [];
    setMockRequest((options) => {
      capturedPayloads.push(options.data ? JSON.parse(options.data) : null);
      options.onload?.({
        status: 200,
        responseText: JSON.stringify({
          writeResults: [{ updateTime: '2026-03-06T12:00:00.000000Z' }],
        }),
      });
    });

    const env = defaultEnvelope('lw', 'writer', '2026-03-06T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
    env.fields.aiStudioPrefix.value = 'prefix';
    const res = await commitEnvelope(makeConfig(), 'lw', 'node-commit', env, {
      expectedUpdateTime: '2026-03-06T10:00:00.000000Z',
    });

    expect(res.updateTime).toBe('2026-03-06T12:00:00.000000Z');
    expect(capturedPayloads).toHaveLength(1);
    const payload = capturedPayloads[0];
    expect(payload.writes).toHaveLength(1);
    expect(payload.writes[0].updateTransforms).toEqual([
      { fieldPath: 'lastPushedAt', setToServerValue: 'REQUEST_TIME' },
    ]);
    expect(payload.writes[0].currentDocument.updateTime).toBe('2026-03-06T10:00:00.000000Z');
  });

  test('readEnvelope returns missing for 404 without throwing', async () => {
    setMockRequest((options) => {
      options.onload?.({ status: 404, responseText: '{}' });
    });
    const result = await readEnvelope(makeConfig(), 'lw', 'node-missing');
    expect(result).toEqual({ kind: 'missing' });
  });

  test('[PR-PERSIST-27][PR-PERSIST-38][PR-PERSIST-79][PR-PERSIST-84] readEnvelope decodes valid documents and filters malformed dynamic entries', async () => {
    const overLongPrefix = 'x'.repeat(9001);
    setMockRequest((options) => {
      const responseDoc = {
        updateTime: '2026-03-06T01:00:00.000000Z',
        fields: {
          schemaVersion: { integerValue: '1' },
          site: { stringValue: 'lw' },
          lastPushedBy: { stringValue: 'writer:ok' },
          lastPushedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
          expiresAt: { timestampValue: '2026-04-06T00:59:00.000Z' },
          fields: {
            mapValue: {
              fields: {
                read: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      clearEpoch: { integerValue: '2' },
                      value: {
                        mapValue: {
                          fields: {
                            valid_read_id: { integerValue: '1' },
                            invalid_read_id: { integerValue: '2' },
                          },
                        },
                      },
                    },
                  },
                },
                loadFrom: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      version: { integerValue: '4' },
                      clearEpoch: { integerValue: '1' },
                      value: { stringValue: '2026-03-01T00:00:00.000Z' },
                    },
                  },
                },
                authorPrefs: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      clearEpoch: { integerValue: '1' },
                      value: {
                        mapValue: {
                          fields: {
                            Valid_Author: {
                              mapValue: {
                                fields: {
                                  v: { integerValue: '1' },
                                  version: { integerValue: '3' },
                                  updatedAt: { timestampValue: '2026-03-06T00:30:00.000Z' },
                                  updatedBy: { stringValue: 'writer:ok' },
                                },
                              },
                            },
                            badAuthor: {
                              mapValue: {
                                fields: {
                                  v: { integerValue: '99' },
                                  version: { integerValue: '1' },
                                  updatedAt: { timestampValue: '2026-03-06T00:30:00.000Z' },
                                  updatedBy: { stringValue: 'writer:ok' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                aiStudioPrefix: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      version: { integerValue: '9' },
                      value: { stringValue: overLongPrefix },
                    },
                  },
                },
              },
            },
          },
        },
      };
      options.onload?.({ status: 200, responseText: JSON.stringify(responseDoc) });
    });

    const result = await readEnvelope(makeConfig(), 'lw', 'node-read');
    expect(result.kind).toBe('ok');
    expect(result.updateTime).toBe('2026-03-06T01:00:00.000000Z');

    const envelope = result.envelope!;
    expect(envelope.fields.read.value).toEqual({ valid_read_id: 1 });
    expect(Object.keys(envelope.fields.authorPrefs.value)).toEqual(['Valid_Author']);
    expect(envelope.fields.aiStudioPrefix.version).toBe(9);
    expect(envelope.fields.aiStudioPrefix.value).toBeUndefined();
  });

  test('readEnvelope tolerates empty aiStudioPrefix map by falling back to loadFrom metadata', async () => {
    setMockRequest((options) => {
      const responseDoc = {
        updateTime: '2026-03-06T01:00:00.000000Z',
        fields: {
          schemaVersion: { integerValue: '1' },
          site: { stringValue: 'lw' },
          lastPushedBy: { stringValue: 'writer:ok' },
          lastPushedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
          expiresAt: { timestampValue: '2026-04-06T00:59:00.000Z' },
          fields: {
            mapValue: {
              fields: {
                read: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      clearEpoch: { integerValue: '2' },
                      value: { mapValue: { fields: {} } },
                    },
                  },
                },
                loadFrom: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:58:00.000Z' },
                      updatedBy: { stringValue: 'writer:load' },
                      version: { integerValue: '4' },
                      clearEpoch: { integerValue: '1' },
                    },
                  },
                },
                authorPrefs: {
                  mapValue: {
                    fields: {
                      updatedAt: { timestampValue: '2026-03-06T00:59:00.000Z' },
                      updatedBy: { stringValue: 'writer:ok' },
                      clearEpoch: { integerValue: '1' },
                      value: { mapValue: { fields: {} } },
                    },
                  },
                },
                aiStudioPrefix: {
                  mapValue: {
                    fields: {},
                  },
                },
              },
            },
          },
        },
      };
      options.onload?.({ status: 200, responseText: JSON.stringify(responseDoc) });
    });

    const result = await readEnvelope(makeConfig(), 'lw', 'node-read-empty-prefix');
    expect(result.kind).toBe('ok');
    const envelope = result.envelope!;
    expect(envelope.fields.aiStudioPrefix.version).toBe(0);
    expect(envelope.fields.aiStudioPrefix.updatedAt).toBe('2026-03-06T00:58:00.000Z');
    expect(envelope.fields.aiStudioPrefix.updatedBy).toBe('writer:load');
  });

  test('[PR-SYNC-02][PR-SYNC-02.1][PR-PERSIST-04][PR-PERSIST-07][PR-PERSIST-15][PR-PERSIST-90] current-user GraphQL request carries operationName and supports abTestOverrides payloads', async () => {
    const hasWindow = 'window' in globalThis;
    const previousWindow = hasWindow ? (globalThis as any).window : undefined;
    let capturedBody: any = null;
    try {
      (globalThis as any).window = {
        location: {
          hostname: 'www.lesswrong.com',
        },
      };
      setMockRequest((options) => {
        capturedBody = options.data ? JSON.parse(options.data) : null;
        options.onload?.({
          status: 200,
          responseText: JSON.stringify({
            data: {
              currentUser: {
                _id: 'u-sync',
                username: 'sync-user',
                abTestOverrides: {
                  syncSecretV1: 'secret-token',
                },
              },
            },
          }),
        });
      });

      const response = await queryGraphQLResponse(GET_CURRENT_USER, {}, { operationName: 'GetCurrentUser' });
      expect(capturedBody.operationName).toBe('GetCurrentUser');
      expect(String(capturedBody.query)).toContain('abTestOverrides');
      expect((response.data as any)?.currentUser?.abTestOverrides?.syncSecretV1).toBe('secret-token');
    } finally {
      if (hasWindow) {
        (globalThis as any).window = previousWindow;
      } else {
        delete (globalThis as any).window;
      }
    }
  });
});
