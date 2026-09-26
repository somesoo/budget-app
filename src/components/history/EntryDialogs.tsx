import { formatMoney } from '../../lib/calculations'
import type { EntryActions } from '../../hooks/useEntryActions'
import type { Category } from '../../types'
import { EntryEditor } from './EntryEditor'
import { UndoToast } from './UndoToast'

/** The edit sheet and the undo toast that go with useEntryActions(). */
export function EntryDialogs({
  actions,
  categories,
}: {
  actions: EntryActions
  categories: Category[]
}) {
  const { editing, deleted } = actions
  return (
    <>
      {editing && (
        <EntryEditor
          entry={editing}
          categories={categories}
          onClose={actions.closeEditor}
          onSaveExpense={actions.saveExpense}
          onSaveIncome={actions.saveIncome}
          onDelete={actions.remove}
        />
      )}
      {deleted && (
        <UndoToast
          key={`${deleted.kind}-${deleted.id}`}
          message={`${deleted.kind === 'expense' ? 'Expense' : 'Income'} deleted · ${formatMoney(deleted.item.amount)}`}
          onUndo={actions.undo}
          onDismiss={actions.dismissUndo}
        />
      )}
    </>
  )
}
