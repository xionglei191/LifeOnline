import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Note, TimelineTrack as TimelineTrackContract } from '@lifeos/shared';
import TimelineTrack from './TimelineTrack.vue';
import { togglePrivacyMode, usePrivacy } from '../composables/usePrivacy';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    file_name: overrides.file_name ?? 'note-1.md',
    file_path: overrides.file_path ?? '/vault/健康/note-1.md',
    title: overrides.title ?? 'Note 1',
    content: overrides.content ?? 'content',
    type: overrides.type ?? 'note',
    dimension: overrides.dimension ?? 'health',
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

describe('TimelineTrack', () => {
  it('renders shared dimension labels and uses local date ticks', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-22T23:30:00'));

      const tracks: TimelineTrackContract[] = [
        { dimension: 'life', notes: [createNote({ id: 'note-life', dimension: 'life', date: '2026-03-22' })] },
        { dimension: 'growth', notes: [createNote({ id: 'note-growth', dimension: 'growth', date: '2026-03-23' })] },
      ];

      const wrapper = mount(TimelineTrack, {
        props: {
          tracks,
          startDate: '2026-03-22',
          endDate: '2026-03-23',
        },
        global: {
          stubs: {
            NotePreview: true,
            Teleport: true,
          },
        },
      });

      expect(wrapper.text()).toContain('生活');
      expect(wrapper.text()).toContain('成长');
      expect(wrapper.findAll('.ruler-cell.today')).toHaveLength(1);
      expect(wrapper.findAll('.ruler-cell.today')[0].text()).toContain('22');
    } finally {
      vi.useRealTimers();
    }
  });

  it('projects shared priority and updated facts into the multi-note picker', async () => {
    const wrapper = mount(TimelineTrack, {
      props: {
        tracks: [
          {
            dimension: 'growth',
            notes: [
              createNote({
                id: 'note-a',
                dimension: 'growth',
                date: '2026-03-22',
                title: 'Alpha title',
                priority: 'high',
                updated: '2026-03-23T11:45:00.000Z',
              }),
              createNote({
                id: 'note-b',
                dimension: 'growth',
                date: '2026-03-22',
                title: 'Beta title',
                priority: 'low',
                updated: '2026-03-23T09:15:00.000Z',
              }),
            ],
          },
        ],
        startDate: '2026-03-20',
        endDate: '2026-03-24',
      },
      global: {
        stubs: {
          NotePreview: true,
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    await wrapper.get('.dot').trigger('click');
    await nextTick();

    const pickerText = document.body.textContent || '';
    expect(pickerText).toContain('高优先级');
    expect(pickerText).toContain('低优先级');
    expect(pickerText).toMatch(/更新 .*03\/23.*11:45|更新 .*3\/23.*11:45|更新 .*03\/23.*19:45|更新 .*3\/23.*19:45/);

    wrapper.unmount();
  });

  it('hides protected content in the multi-note picker while keeping public content visible', async () => {
    const { privacyMode } = usePrivacy();
    if (!privacyMode.value) togglePrivacyMode();

    const wrapper = mount(TimelineTrack, {
      props: {
        tracks: [
          {
            dimension: 'growth',
            notes: [
              createNote({ id: 'note-private', dimension: 'growth', date: '2026-03-22', title: 'Private title', content: 'private body', privacy: 'private', encrypted: false }),
              createNote({ id: 'note-encrypted', dimension: 'growth', date: '2026-03-22', title: 'Encrypted title', content: 'encrypted body', privacy: 'public', encrypted: true }),
              createNote({ id: 'note-public', dimension: 'growth', date: '2026-03-22', title: 'Public title', content: 'public body', privacy: 'public', encrypted: false }),
            ],
          },
        ],
        startDate: '2026-03-20',
        endDate: '2026-03-24',
      },
      global: {
        stubs: {
          NotePreview: true,
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    await wrapper.get('.dot').trigger('click');
    await nextTick();

    const pickerText = document.body.textContent || '';
    expect(pickerText).toContain('🔒 当前内容受隐私保护，预览已隐藏');
    expect(pickerText).toContain('🔒 内容已加密，预览已隐藏');
    expect(pickerText).toContain('public body');
    expect(pickerText).not.toContain('private body');
    expect(pickerText).not.toContain('encrypted body');

    wrapper.unmount();
    if (privacyMode.value) togglePrivacyMode();
  });

  it('orders multi-note picker entries by visible shared titles', async () => {
    // Clean up DOM from previous Teleport renders
    document.body.innerHTML = '';

    const wrapper = mount(TimelineTrack, {
      props: {
        tracks: [
          {
            dimension: 'growth',
            notes: [
              createNote({ id: 'note-z', dimension: 'growth', date: '2026-03-22', title: 'Zeta title', file_name: 'b-file.md' }),
              createNote({ id: 'note-a', dimension: 'growth', date: '2026-03-22', title: 'Alpha title', file_name: 'z-file.md' }),
            ],
          },
        ],
        startDate: '2026-03-20',
        endDate: '2026-03-24',
      },
      global: {
        stubs: {
          NotePreview: true,
          Teleport: false,
        },
      },
      attachTo: document.body,
    });

    await wrapper.get('.dot').trigger('click');
    await nextTick();

    const pickerTitles = Array.from(document.body.querySelectorAll('.picker-title')).map((node) => node.textContent?.trim());
    expect(pickerTitles).toEqual(['Alpha title', 'Zeta title']);

    wrapper.unmount();
  });
});
