import { useCallback, useState } from 'react'
import { useDeleteExpense, useRestoreExpense, useUpdateExpense } from './useExpenses'
import { useDeleteIncome, useRestoreIncome, useUpdateIncome } from './useIncomes'
import type { Entry } from '../lib/history'
import type { NewExpense, NewIncome } from '../types'

/**
 * Editing and deleting logged entries, with the undo that stands in for an
 * "are you sure?". Shared by History and the laptop Add screen; render the
 * matching sheet and toast with <EntryDialogs>.
 */
export function useEntryActions() {
  const [editing, setEditing] = useState<Entry | null>(null)
  const [deleted, setDeleted] = useState<Entry | null>(null)

  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const restoreExpense = useRestoreExpense()
  const updateIncome = useUpdateIncome()
  const deleteIncome = useDeleteIncome()
  const restoreIncome = useRestoreIncome()

  const remove = (entry: Entry) => {
    if (entry.kind === 'expense') deleteExpense.mutate(entry.id)
    else deleteIncome.mutate(entry.id)
    setDeleted(entry)
  }

  const undo = () => {
    if (!deleted) return
    if (deleted.kind === 'expense') restoreExpense.mutate(deleted.item)
    else restoreIncome.mutate(deleted.item)
    setDeleted(null)
  }

  const dismissUndo = useCallback(() => setDeleted(null), [])

  return {
    editing,
    /** Opens the edit sheet; optimistic rows (not saved yet) can't be edited. */
    edit: (entry: Entry) => {
      if (!entry.id.startsWith('optimistic-')) setEditing(entry)
    },
    closeEditor: () => setEditing(null),
    saveExpense: (id: string, patch: Partial<NewExpense>) => updateExpense.mutate({ id, ...patch }),
    saveIncome: (id: string, patch: Partial<NewIncome>) => updateIncome.mutate({ id, ...patch }),
    deleted,
    remove,
    undo,
    dismissUndo,
  }
}

export type EntryActions = ReturnType<typeof useEntryActions>
