import type { Note } from '@lifeos/shared';

const noteTypeOrder: Record<string, number> = {
  schedule: 0,
  task: 1,
  milestone: 2,
  note: 3,
  record: 4,
  review: 5,
};

const noteStatusOrder: Record<string, number> = {
  pending: 0,
  in_progress: 1,
  done: 2,
  cancelled: 3,
};

function visibleLabel(note: Note) {
  return (note.title || note.file_name.replace('.md', '')).toLocaleLowerCase();
}

export function compareCalendarNotes(left: Note, right: Note) {
  const typeDelta = (noteTypeOrder[left.type] ?? 99) - (noteTypeOrder[right.type] ?? 99);
  if (typeDelta !== 0) return typeDelta;

  const statusDelta = (noteStatusOrder[left.status] ?? 99) - (noteStatusOrder[right.status] ?? 99);
  if (statusDelta !== 0) return statusDelta;

  return visibleLabel(left).localeCompare(visibleLabel(right), 'zh-CN');
}

export function sortCalendarNotes(notes: Note[]) {
  return [...notes].sort(compareCalendarNotes);
}
