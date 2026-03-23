import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Note } from '@lifeos/shared';
import NotePreview from './NotePreview.vue';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'preview-1.md',
    file_path: overrides.file_path ?? '/vault/生活/preview-1.md',
    title: overrides.title ?? 'Preview 1',
    content: overrides.content ?? 'preview content',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'life',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    date: overrides.date ?? '2026-03-22',
    due: overrides.due ?? undefined,
    source: overrides.source ?? 'web',
    created: overrides.created ?? '2026-03-22T10:00:00.000Z',
    updated: overrides.updated ?? '2026-03-22T10:00:00.000Z',
    approval_status: overrides.approval_status ?? null,
    approval_operation: overrides.approval_operation ?? null,
    approval_action: overrides.approval_action ?? null,
    approval_risk: overrides.approval_risk ?? null,
    approval_scope: overrides.approval_scope ?? null,
    privacy: overrides.privacy ?? 'private',
    encrypted: overrides.encrypted ?? false,
    indexed_at: overrides.indexed_at ?? '2026-03-22T10:00:00.000Z',
    file_modified_at: overrides.file_modified_at ?? '2026-03-22T10:00:00.000Z',
  };
}

describe('NotePreview', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
  });

  it('prefers shared note titles in the single-note preview path', () => {
    const wrapper = mount(NotePreview, {
      props: {
        note: createNote({ title: 'Shared preview title', file_name: 'fallback-preview-name.md' }),
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('Shared preview title');
    expect(document.body.textContent).not.toContain('fallback-preview-name');

    wrapper.unmount();
  });

  it('projects shared priority and updated facts in the single-note preview path', () => {
    const wrapper = mount(NotePreview, {
      props: {
        note: createNote({ priority: 'high', updated: '2026-03-23T11:45:00.000Z', due: '2026-03-24' }),
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('高');
    expect(document.body.textContent).toContain('截止 2026-03-24');
    expect(document.body.textContent).toMatch(/更新 .*03\/23.*11:45|更新 .*3\/23.*11:45|更新 .*03\/23.*19:45|更新 .*3\/23.*19:45/);

    wrapper.unmount();
  });

  it('hides protected content in the single-note preview path', () => {
    sessionStorage.setItem('privacyMode', '1');

    const wrapper = mount(NotePreview, {
      props: {
        note: createNote({
          content: 'top secret preview content',
          privacy: 'private',
          encrypted: false,
        }),
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('🔒 当前内容受隐私保护，预览已隐藏');
    expect(document.body.textContent).not.toContain('top secret preview content');

    wrapper.unmount();
  });

  it('hides encrypted content in multi-note previews', () => {
    const wrapper = mount(NotePreview, {
      props: {
        notes: [
          createNote({ id: 'preview-a', title: 'Alpha title', encrypted: true, content: 'encrypted body' }),
          createNote({ id: 'preview-b', title: 'Beta title', content: 'public body', privacy: 'public' }),
        ],
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('🔒 内容已加密，预览已隐藏');
    expect(document.body.textContent).not.toContain('encrypted body');
    expect(document.body.textContent).toContain('public body');

    wrapper.unmount();
  });

  it('orders multi-note previews by visible shared titles', () => {
    const wrapper = mount(NotePreview, {
      props: {
        notes: [
          createNote({ id: 'preview-z', title: 'Zeta title', file_name: 'b-file.md' }),
          createNote({ id: 'preview-a', title: 'Alpha title', file_name: 'z-file.md' }),
        ],
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    const previewTitles = Array.from(document.body.querySelectorAll('.multi-title')).map((node) => node.textContent?.trim());
    expect(previewTitles).toEqual(['Alpha title', 'Zeta title']);

    wrapper.unmount();
  });

  it('renders recency facts in the multi-note preview path', () => {
    const wrapper = mount(NotePreview, {
      props: {
        notes: [
          createNote({ id: 'preview-b', title: 'Beta title', updated: '2026-03-23T11:45:00.000Z' }),
          createNote({ id: 'preview-a', title: 'Alpha title', updated: '2026-03-23T09:15:00.000Z' }),
        ],
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toMatch(/更新 .*03\/23.*11:45|更新 .*3\/23.*11:45|更新 .*03\/23.*19:45|更新 .*3\/23.*19:45/);

    wrapper.unmount();
  });

  it('renders dimension labels from shared helpers in the single-note preview', () => {
    const wrapper = mount(NotePreview, {
      props: {
        note: createNote({ dimension: 'growth', file_name: 'growth-preview.md' }),
        visible: true,
        pos: { x: 24, y: 24 },
      },
      global: {
        stubs: {
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    expect(document.body.textContent).toContain('成长');
    expect(document.body.querySelector('.preview-dim')?.getAttribute('style')).toContain('var(--dim-growth)');

    wrapper.unmount();
  });
});
