// Drag and drop in the table: where does a dragged row end up? Pure logic, no React.
// Rules:
//  - dropping on a category row puts the item INSIDE that category
//  - dropping on a task row puts the item next to it, i.e. in the same category (or the main list)
//  - dropping on the "main list" zone takes the item out of any category
//  - a category can never go into itself or into one of its own sub-categories

const parentGroupOf = (tasks, t) => {
  for (let p = tasks[t.parentId]; p; p = tasks[p.parentId]) if (p.isGroup) return p.id;
  return null;
};

// is `maybeInside` the same as, or somewhere below, `ancestorId`?
const isInside = (tasks, maybeInside, ancestorId) => {
  for (let p = maybeInside, n = 0; p && n < 200; p = tasks[p.parentId], n++) if (p.id === ancestorId) return true;
  return false;
};

// overId: a task/category id, or 'root' for the main-list zone
// returns { ok, noop, parentId }  (parentId null = main list)
export function resolveDrop(tasks, dragId, overId) {
  const dragged = tasks[dragId];
  if (!dragged || !overId) return { ok: false, noop: false, parentId: null };
  let parentId;
  if (overId === 'root') {
    parentId = null;
  } else {
    const over = tasks[overId];
    if (!over || over.id === dragId || over.tableId !== dragged.tableId) return { ok: false, noop: false, parentId: null };
    parentId = over.isGroup ? over.id : parentGroupOf(tasks, over);
  }
  // no cycles: the destination may not be the dragged category or anything inside it
  if (parentId && isInside(tasks, tasks[parentId], dragId)) return { ok: false, noop: false, parentId };
  const noop = parentId === (dragged.parentId || null);
  return { ok: true, noop, parentId };
}
