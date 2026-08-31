import { createInitialState, serializeState, deserializeState, InvalidStateError } from '../src/storage';

describe('createInitialState', () => {
  it('produces a state whose seed task links to the seed project', () => {
    const state = createInitialState();
    expect(state.tasks).toHaveLength(1);
    expect(state.projects).toHaveLength(1);
    expect(state.tasks[0]?.projectId).toBe(state.projects[0]?.id);
  });

  it('never seeds a GitHub token or leaves settings undefined', () => {
    const state = createInitialState();
    expect(state.settings).toBeDefined();
    expect('githubToken' in state.settings).toBe(false);
  });
});

describe('serializeState / deserializeState round-trip', () => {
  it('recovers an equivalent state from its own JSON', () => {
    const state = createInitialState();
    const json = serializeState(state);
    const recovered = deserializeState(json);
    expect(recovered.tasks).toEqual(state.tasks);
    expect(recovered.projects).toEqual(state.projects);
    expect(recovered.settings).toEqual(state.settings);
  });
});

describe('deserializeState — malformed input', () => {
  it('rejects non-JSON', () => {
    expect(() => deserializeState('not json{')).toThrow(InvalidStateError);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => deserializeState('[1,2,3]')).toThrow(InvalidStateError);
  });

  it('rejects an object missing required fields', () => {
    expect(() => deserializeState('{"tasks": []}')).toThrow(InvalidStateError);
  });

  it('rejects a backup whose lists are not arrays', () => {
    const bad = JSON.stringify({
      tasks: 'nope',
      projects: [],
      events: {},
      logEntries: [],
      ideas: [],
      settings: {},
    });
    expect(() => deserializeState(bad)).toThrow(InvalidStateError);
  });
});
