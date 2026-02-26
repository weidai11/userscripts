import assert from 'assert';
import { buildFirestorePath } from '../../../src/scripts/power-reader/persistence/firestoreSyncBackend';
import {
  buildFirestoreApiBase,
  resetFirestoreEmulator,
  startFirestoreEmulator,
  stopFirestoreEmulator,
  type FirestoreEmulatorContext,
} from '../../helpers/firestoreEmulator';

type CommitResponse = {
  writeResults?: Array<{ updateTime?: string }>;
};

type FirestoreDocumentResponse = {
  fields?: Record<string, any>;
};

const projectId = process.env.PR_SYNC_FIRESTORE_PROJECT_ID || 'demo-pr-sync';

function commitUrl(context: FirestoreEmulatorContext): string {
  return `http://${context.host}/v1/projects/${encodeURIComponent(context.projectId)}/databases/(default)/documents:commit`;
}

function documentName(context: FirestoreEmulatorContext, documentPath: string): string {
  return `projects/${context.projectId}/databases/(default)/documents/${documentPath}`;
}

async function commitOnce(context: FirestoreEmulatorContext, payload: unknown): Promise<Response> {
  return fetch(commitUrl(context), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function parseCommit(response: Response): Promise<CommitResponse> {
  const body = await response.text();
  if (!body.trim()) return {};
  return JSON.parse(body) as CommitResponse;
}

function buildEnvelopeFields(nowIso: string): Record<string, unknown> {
  const nowMs = Date.parse(nowIso);
  return {
    schemaVersion: { integerValue: '1' },
    site: { stringValue: 'lw' },
    lastPushedBy: { stringValue: 'emulator-test' },
    lastPushedAt: { timestampValue: nowIso },
    lastPushedAtMs: { integerValue: String(nowMs) },
    expiresAt: { timestampValue: new Date(Date.parse(nowIso) + (24 * 60 * 60 * 1000)).toISOString() },
    fields: {
      mapValue: {
        fields: {
          read: {
            mapValue: {
              fields: {
                updatedAt: { timestampValue: nowIso },
                updatedBy: { stringValue: 'emulator-test' },
                clearEpoch: { integerValue: '0' },
                value: { mapValue: { fields: {} } },
              },
            },
          },
          loadFrom: {
            mapValue: {
              fields: {
                updatedAt: { timestampValue: nowIso },
                updatedBy: { stringValue: 'emulator-test' },
                version: { integerValue: '0' },
                clearEpoch: { integerValue: '0' },
              },
            },
          },
          authorPrefs: {
            mapValue: {
              fields: {
                updatedAt: { timestampValue: nowIso },
                updatedBy: { stringValue: 'emulator-test' },
                clearEpoch: { integerValue: '0' },
                value: { mapValue: { fields: {} } },
              },
            },
          },
        },
      },
    },
  };
}

function cloneFields(fields: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(fields)) as Record<string, unknown>;
}

function buildIntegerMap(count: number): Record<string, { integerValue: string }> {
  const out: Record<string, { integerValue: string }> = {};
  for (let i = 0; i < count; i += 1) {
    out[`k_${i}`] = { integerValue: '1' };
  }
  return out;
}

function buildAuthorPrefMap(count: number, nowIso: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < count; i += 1) {
    out[`Author_${i}`] = {
      mapValue: {
        fields: {
          v: { integerValue: '1' },
          version: { integerValue: '1' },
          updatedAt: { timestampValue: nowIso },
          updatedBy: { stringValue: 'emulator-test' },
        },
      },
    };
  }
  return out;
}

function buildReadMap(ids: string[]): Record<string, { integerValue: string }> {
  const out: Record<string, { integerValue: string }> = {};
  ids.forEach((id) => {
    out[id] = { integerValue: '1' };
  });
  return out;
}

function setEnvelopeReadMap(fields: Record<string, unknown>, ids: string[]): void {
  (fields as any).fields.mapValue.fields.read.mapValue.fields.value = {
    mapValue: { fields: buildReadMap(ids) },
  };
}

function extractReadKeys(doc: FirestoreDocumentResponse): string[] {
  const entries = (doc.fields as any)?.fields?.mapValue?.fields?.read?.mapValue?.fields?.value?.mapValue?.fields || {};
  return Object.entries(entries)
    .filter(([, value]) => (value as any)?.integerValue === '1')
    .map(([key]) => key)
    .sort();
}

async function run(): Promise<void> {
  const context = await startFirestoreEmulator(projectId);
  try {
    await resetFirestoreEmulator(context);

    const node = `pr_sync_${'a'.repeat(64)}`;
    const path = buildFirestorePath('lw', node);
    const name = documentName(context, path);
    const nowIso = new Date().toISOString();

    const createPayload = {
      writes: [
        {
          update: { name, fields: buildEnvelopeFields(nowIso) },
          currentDocument: { exists: false },
        },
      ],
    };
    const createResponse = await commitOnce(context, createPayload);
    assert.strictEqual(createResponse.status, 200, `Create commit failed (${createResponse.status})`);
    const createParsed = await parseCommit(createResponse);
    const firstUpdateTime = createParsed.writeResults?.[0]?.updateTime;
    assert.ok(firstUpdateTime, 'Create response did not include writeResults[0].updateTime');

    const updatePayload = {
      writes: [
        {
          update: { name, fields: buildEnvelopeFields(new Date().toISOString()) },
          currentDocument: { updateTime: firstUpdateTime },
        },
      ],
    };
    const updateResponse = await commitOnce(context, updatePayload);
    assert.strictEqual(updateResponse.status, 200, `Conditional update failed (${updateResponse.status})`);
    const updateParsed = await parseCommit(updateResponse);
    let latestUpdateTime = updateParsed.writeResults?.[0]?.updateTime || firstUpdateTime;

    const staleDiagnosticIso = '2000-01-01T00:00:00.000Z';
    const transformPayload = {
      writes: [
        {
          update: {
            name,
            fields: {
              ...buildEnvelopeFields(new Date().toISOString()),
              lastPushedAt: { timestampValue: staleDiagnosticIso },
            },
          },
          updateTransforms: [
            {
              fieldPath: 'lastPushedAt',
              setToServerValue: 'REQUEST_TIME',
            },
          ],
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    };
    const transformResponse = await commitOnce(context, transformPayload);
    assert.strictEqual(transformResponse.status, 200, `Transform update failed (${transformResponse.status})`);
    const transformParsed = await parseCommit(transformResponse);
    latestUpdateTime = transformParsed.writeResults?.[0]?.updateTime || latestUpdateTime;

    const staleResponse = await commitOnce(context, updatePayload);
    assert.notStrictEqual(staleResponse.status, 200, 'Stale CAS update unexpectedly succeeded');

    // Simulate two tabs marking read with the same starting updateTime:
    // tab A writes first, tab B collides on stale updateTime, re-reads, then writes merged union.
    const tabAFields = buildEnvelopeFields(new Date().toISOString());
    setEnvelopeReadMap(tabAFields, ['c_a', 'c_b']);
    const tabAResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: tabAFields },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.strictEqual(tabAResponse.status, 200, `Tab A CAS write failed (${tabAResponse.status})`);
    const tabAParsed = await parseCommit(tabAResponse);
    const tabAUpdateTime = tabAParsed.writeResults?.[0]?.updateTime;
    assert.ok(tabAUpdateTime, 'Tab A CAS write did not return updateTime');

    const tabBStaleFields = buildEnvelopeFields(new Date().toISOString());
    setEnvelopeReadMap(tabBStaleFields, ['c_a', 'c_c']);
    const tabBStaleResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: tabBStaleFields },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(tabBStaleResponse.status, 200, 'Tab B stale CAS write unexpectedly succeeded');

    const tabBMergedFields = buildEnvelopeFields(new Date().toISOString());
    setEnvelopeReadMap(tabBMergedFields, ['c_a', 'c_b', 'c_c']);
    const tabBMergedResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: tabBMergedFields },
          currentDocument: { updateTime: tabAUpdateTime },
        },
      ],
    });
    assert.strictEqual(tabBMergedResponse.status, 200, `Tab B merged CAS write failed (${tabBMergedResponse.status})`);
    const tabBMergedParsed = await parseCommit(tabBMergedResponse);
    latestUpdateTime = tabBMergedParsed.writeResults?.[0]?.updateTime || latestUpdateTime;

    const docResponse = await fetch(`${buildFirestoreApiBase(context)}/${path}`, { method: 'GET' });
    assert.strictEqual(docResponse.status, 200, `Document read failed (${docResponse.status})`);
    const docBody = await docResponse.text();
    const docParsed = JSON.parse(docBody) as FirestoreDocumentResponse;
    const transformedLastPushedAt = (docParsed.fields as any)?.lastPushedAt?.timestampValue;
    assert.ok(transformedLastPushedAt, 'Document read missing lastPushedAt.timestampValue');
    assert.notStrictEqual(
      transformedLastPushedAt,
      staleDiagnosticIso,
      'lastPushedAt transform was not applied'
    );
    assert.deepStrictEqual(
      extractReadKeys(docParsed),
      ['c_a', 'c_b', 'c_c'],
      'Concurrent read updates did not converge to union after CAS retry/re-read'
    );

    const listResponse = await fetch(`${buildFirestoreApiBase(context)}/pr_sync_v1/lw/nodes`, { method: 'GET' });
    assert.notStrictEqual(listResponse.status, 200, 'Collection list unexpectedly succeeded; rules should deny list');

    const deleteResponse = await commitOnce(context, {
      writes: [
        {
          delete: name,
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(deleteResponse.status, 200, 'Delete write unexpectedly succeeded; rules should deny delete');

    const invalidPathResponse = await fetch(
      `${buildFirestoreApiBase(context)}/pr_sync_v1/not-a-site/nodes/pr_sync_${'b'.repeat(64)}`,
      { method: 'GET' }
    );
    assert.notStrictEqual(invalidPathResponse.status, 200, 'Invalid site path unexpectedly succeeded');

    const invalidMissingChild = cloneFields(buildEnvelopeFields(nowIso));
    delete (invalidMissingChild.fields as any)?.mapValue?.fields?.read?.mapValue?.fields?.clearEpoch;
    const missingChildResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidMissingChild },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      missingChildResponse.status,
      200,
      'Envelope missing required child (read.clearEpoch) unexpectedly succeeded'
    );

    const invalidCounter = cloneFields(buildEnvelopeFields(nowIso));
    (invalidCounter.fields as any).mapValue.fields.loadFrom.mapValue.fields.version = { integerValue: '1000000001' };
    const invalidCounterResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidCounter },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidCounterResponse.status,
      200,
      'Envelope with out-of-range loadFrom.version unexpectedly succeeded'
    );

    const invalidLastPushedAtMs = cloneFields(buildEnvelopeFields(nowIso));
    (invalidLastPushedAtMs as any).lastPushedAtMs = { integerValue: '253402300800000' };
    const invalidLastPushedAtMsResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidLastPushedAtMs },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidLastPushedAtMsResponse.status,
      200,
      'Envelope with out-of-range lastPushedAtMs unexpectedly succeeded'
    );

    const invalidLoadFromValue = cloneFields(buildEnvelopeFields(nowIso));
    (invalidLoadFromValue.fields as any).mapValue.fields.loadFrom.mapValue.fields.value = { stringValue: 'not-a-date' };
    const invalidLoadFromResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidLoadFromValue },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidLoadFromResponse.status,
      200,
      'Envelope with invalid loadFrom.value unexpectedly succeeded'
    );

    const longLoadFromValue = cloneFields(buildEnvelopeFields(nowIso));
    (longLoadFromValue.fields as any).mapValue.fields.loadFrom.mapValue.fields.value = {
      stringValue: `2026-01-01T00:00:00.000Z${'x'.repeat(30)}`,
    };
    const longLoadFromResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: longLoadFromValue },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      longLoadFromResponse.status,
      200,
      'Envelope with oversized loadFrom.value unexpectedly succeeded'
    );

    const invalidLastPushedBy = cloneFields(buildEnvelopeFields(nowIso));
    (invalidLastPushedBy as any).lastPushedBy = { stringValue: 'x'.repeat(129) };
    const invalidLastPushedByResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidLastPushedBy },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidLastPushedByResponse.status,
      200,
      'Envelope with oversized lastPushedBy unexpectedly succeeded'
    );

    const invalidReadUpdatedBy = cloneFields(buildEnvelopeFields(nowIso));
    (invalidReadUpdatedBy.fields as any).mapValue.fields.read.mapValue.fields.updatedBy = { stringValue: 'x'.repeat(129) };
    const invalidReadUpdatedByResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidReadUpdatedBy },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidReadUpdatedByResponse.status,
      200,
      'Envelope with oversized read.updatedBy unexpectedly succeeded'
    );

    const invalidExpires = cloneFields(buildEnvelopeFields(nowIso));
    (invalidExpires as any).expiresAt = { timestampValue: new Date(Date.parse(nowIso) - 60_000).toISOString() };
    const invalidExpiresResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: invalidExpires },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      invalidExpiresResponse.status,
      200,
      'Envelope with past expiresAt unexpectedly succeeded'
    );

    const tooFarExpires = cloneFields(buildEnvelopeFields(nowIso));
    (tooFarExpires as any).expiresAt = { timestampValue: new Date(Date.parse(nowIso) + (182 * 24 * 60 * 60 * 1000)).toISOString() };
    const tooFarExpiresResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: tooFarExpires },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      tooFarExpiresResponse.status,
      200,
      'Envelope with out-of-range future expiresAt unexpectedly succeeded'
    );

    const readTooLarge = cloneFields(buildEnvelopeFields(nowIso));
    (readTooLarge.fields as any).mapValue.fields.read.mapValue.fields.value.mapValue.fields = buildIntegerMap(10001);
    const readTooLargeResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: readTooLarge },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      readTooLargeResponse.status,
      200,
      'Envelope with read.value > 10000 unexpectedly succeeded'
    );

    const authorPrefsTooLarge = cloneFields(buildEnvelopeFields(nowIso));
    (authorPrefsTooLarge.fields as any).mapValue.fields.authorPrefs.mapValue.fields.value.mapValue.fields =
      buildAuthorPrefMap(1001, nowIso);
    const authorPrefsTooLargeResponse = await commitOnce(context, {
      writes: [
        {
          update: { name, fields: authorPrefsTooLarge },
          currentDocument: { updateTime: latestUpdateTime },
        },
      ],
    });
    assert.notStrictEqual(
      authorPrefsTooLargeResponse.status,
      200,
      'Envelope with authorPrefs.value > 1000 unexpectedly succeeded'
    );

    console.log('Firestore emulator integration checks passed.');
  } finally {
    stopFirestoreEmulator();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
