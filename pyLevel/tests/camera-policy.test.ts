import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCameraPolicy } from '../src/exam/camera-policy.ts';
import type { ExamEvent } from '../src/exam/definition.ts';

test('brief detection gaps do not become incidents and a stable face is required before starting', () => {
  const events: ExamEvent[] = [];
  const camera = createCameraPolicy(event => events.push(event));
  assert.equal(camera.observe('single', 0).ready, false);
  assert.equal(camera.observe('single', 1500).ready, true);
  camera.observe('missing', 2000);
  camera.observe('single', 4000);
  camera.observe('multiple', 5000);
  camera.observe('single', 6000);
  assert.equal(events.length, 0);
});

test('sustained absence and multiple faces report separate episodes with stable ids and final durations', () => {
  const events: ExamEvent[] = [];
  let id = 0;
  const camera = createCameraPolicy(event => events.push(event), () => String(++id));
  camera.observe('missing', 0);
  assert.equal(camera.observe('missing', 4999).alert, false);
  assert.equal(camera.observe('missing', 5000).alert, true);
  camera.observe('missing', 15000);
  camera.observe('single', 17000);
  assert.deepEqual(events.map(e => [e.id, e.kind, e.durationMs]), [['1', 'camera_missing', 5000], ['1', 'camera_missing', 15000], ['1', 'camera_missing', 17000]]);
  camera.observe('multiple', 18000);
  camera.observe('multiple', 21000);
  camera.flush(22000);
  assert.equal(events.at(-1)!.id, '2');
  assert.equal(events.at(-1)!.kind, 'camera_multiple');
  assert.equal(events.at(-1)!.durationMs, 4000);
});

test('hidden or suspended video resets detection so background time is not counted as an absent face', () => {
  const events: ExamEvent[] = [];
  const camera = createCameraPolicy(event => events.push(event));
  camera.observe('missing', 0);
  camera.reset(2000);
  camera.observe('missing', 60000);
  camera.observe('single', 61000);
  assert.equal(events.length, 0);
  camera.observe('interrupted', 62000);
  camera.observe('single', 67000);
  assert.equal(events.at(-1)!.kind, 'camera_interrupted');
  assert.equal(events.at(-1)!.durationMs, 5000);
});
