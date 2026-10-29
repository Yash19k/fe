export interface IdentifiedTask {
  id: string;
}

export function restoreTaskPosition<T extends IdentifiedTask>(
  current: T[],
  previous: T[],
  taskId: string,
): T[] {
  const previousIndex = previous.findIndex((task) => task.id === taskId);
  if (previousIndex < 0) return current;

  const previousTask = previous[previousIndex];
  const restored = current.filter((task) => task.id !== taskId);
  restored.splice(Math.min(previousIndex, restored.length), 0, previousTask);
  return restored;
}
