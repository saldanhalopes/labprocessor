import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Plus, X, ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  width: number;
  editable?: boolean;
  type?: 'text' | 'number' | 'select' | 'readonly';
  options?: string[];
}

interface SpreadsheetTableProps {
  columns: Column[];
  data: any[];
  onCellChange: (rowIndex: number, columnKey: string, value: any) => void;
  onRowAdd?: () => void;
  onRowDelete?: (rowIndex: number) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  columns,
  data,
  onCellChange,
  onRowAdd,
  onRowDelete,
  searchable = true,
  searchPlaceholder = 'Filtrar...',
  emptyMessage = 'Nenhuma atividade. Clique em "+" para adicionar.'
}) => {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [filterText, setFilterText] = useState('');
  const [resizing, setResizing] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const editRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editingCell && editRef.current) {
      editRef.current.focus();
      if (editRef.current instanceof HTMLInputElement) {
        editRef.current.select();
      }
    }
  }, [editingCell]);

  const getColumnWidth = (col: Column) => columnWidths[col.key] || col.width;

  const startResize = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = getColumnWidth(columns.find(c => c.key === colKey)!);

    const onMouseMove = (me: MouseEvent) => {
      const delta = me.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const onMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    setResizing(colKey);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columns, columnWidths]);

  const handleSort = (colKey: string) => {
    if (sortColumn === colKey) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  const startEdit = (rowIndex: number, colKey: string) => {
    const col = columns.find(c => c.key === colKey);
    if (!col || col.editable === false || col.type === 'readonly') return;
    setEditingCell({ row: rowIndex, col: colKey });
    let val = data[rowIndex]?.[colKey] ?? '';
    if (col.type === 'number') val = val === 0 ? '' : String(val);
    setEditValue(String(val));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const col = columns.find(c => c.key === editingCell.col);
    let value: any = editValue;
    if (col?.type === 'number') {
      value = editValue === '' ? 0 : parseFloat(editValue);
      if (isNaN(value)) value = 0;
    }
    onCellChange(editingCell.row, editingCell.col, value);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
      const nextRow = editingCell.row + 1;
      if (nextRow < data.length) {
        setTimeout(() => startEdit(nextRow, editingCell.col), 0);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      const colIndex = columns.findIndex(c => c.key === editingCell.col);
      const dir = e.shiftKey ? -1 : 1;
      let newColIndex = colIndex + dir;
      if (newColIndex < 0 && editingCell.row > 0) {
        newColIndex = columns.length - 1;
        setTimeout(() => startEdit(editingCell.row - 1, columns[newColIndex].key), 0);
      } else if (newColIndex >= columns.length && editingCell.row < data.length - 1) {
        setTimeout(() => startEdit(editingCell.row + 1, columns[0].key), 0);
      } else if (newColIndex >= 0 && newColIndex < columns.length) {
        setTimeout(() => startEdit(editingCell.row, columns[newColIndex].key), 0);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleRowClick = (rowIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow !== null) {
      const start = Math.min(lastClickedRow, rowIndex);
      const end = Math.max(lastClickedRow, rowIndex);
      const sel = new Set<number>();
      for (let i = start; i <= end; i++) sel.add(i);
      setSelectedRows(sel);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(rowIndex)) next.delete(rowIndex);
        else next.add(rowIndex);
        return next;
      });
    } else {
      setSelectedRows(new Set([rowIndex]));
    }
    setLastClickedRow(rowIndex);
  };

  const filtered = useMemo(() => {
    if (!filterText.trim()) return data;
    const q = filterText.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, filterText, columns]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortColumn];
      const vb = b[sortColumn];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDirection === 'asc' ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), 'pt', { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortColumn, sortDirection]);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortColumn !== colKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-teal-600" />
      : <ArrowDown className="w-3 h-3 text-teal-600" />;
  };

  const renderCell = (rowIndex: number, col: Column) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === col.key;
    const value = data[rowIndex]?.[col.key];

    if (isEditing) {
      if (col.type === 'select' && col.options) {
        return (
          <select
            ref={editRef as React.Ref<HTMLSelectElement>}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full px-1 py-0.5 text-xs border-2 border-teal-400 rounded outline-none bg-white"
          >
            {col.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          ref={editRef as React.Ref<HTMLInputElement>}
          type={col.type === 'number' ? 'number' : 'text'}
          step="any"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-1 py-0.5 text-xs border-2 border-teal-400 rounded outline-none bg-white"
        />
      );
    }

    const display = value != null ? String(value) : '';
    const isSelected = selectedRows.has(rowIndex);
    const isReadonly = col.editable === false || col.type === 'readonly';

    return (
      <div
        className={`px-1 py-0.5 text-xs truncate ${isReadonly ? 'cursor-default text-slate-400' : 'cursor-cell'}`}
        onDoubleClick={() => !isReadonly && startEdit(rowIndex, col.key)}
        title={isReadonly ? undefined : 'Duplo clique para editar'}
      >
        {value != null ? display : <span className="text-slate-300">—</span>}
      </div>
    );
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {searchable && (
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-teal-400"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
            {sorted.length}/{data.length}
          </span>
        </div>
      )}

      <div className="overflow-x-auto no-scrollbar" style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <table ref={tableRef} className="w-full border-collapse" style={{ userSelect: resizing ? 'none' : undefined }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-slate-200">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="relative text-left py-1.5 px-2 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-r border-slate-200/50 last:border-r-0"
                  style={{ width: getColumnWidth(col), minWidth: 60 }}
                >
                  <button
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-teal-700 w-full"
                  >
                    {col.label}
                    <SortIcon colKey={col.key} />
                  </button>
                  <div
                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-teal-400 active:bg-teal-500 z-20"
                    onMouseDown={e => startResize(e, col.key)}
                  />
                </th>
              ))}
              {onRowDelete && (
                <th className="w-8 py-1.5 px-1 text-center border-r-0" />
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onRowDelete ? 1 : 0)} className="py-8 text-center text-xs text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, displayIdx) => {
                const rowIndex = data.indexOf(row);
                const isSelected = selectedRows.has(rowIndex);
                return (
                  <tr
                    key={rowIndex}
                    onClick={e => handleRowClick(rowIndex, e)}
                    className={`border-b border-slate-50 transition-colors ${
                      isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className="border-r border-slate-50 last:border-r-0"
                        style={{ width: getColumnWidth(col) }}
                      >
                        {renderCell(rowIndex, col)}
                      </td>
                    ))}
                    {onRowDelete && (
                      <td className="text-center">
                        <button
                          onClick={e => { e.stopPropagation(); onRowDelete(rowIndex); }}
                          className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600"
                          title="Remover"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onRowAdd && (
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onRowAdd}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Nova atividade
          </button>
        </div>
      )}
    </div>
  );
};
