import React from 'react';

export type TableAlignment = 'left' | 'center' | 'right';

export interface TableColumn<TData> {
  key: string;
  header: React.ReactNode;
  accessor?: keyof TData | ((row: TData, index: number) => React.ReactNode);
  render?: (row: TData, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: TableAlignment;
}

export interface DataTableProps<TData> {
  columns: TableColumn<TData>[];
  data: TData[];
  loading?: boolean;
  loadingMessage?: React.ReactNode;
  emptyState?: React.ReactNode;
  rowKey?: (row: TData, index: number) => React.Key;
  getRowClassName?: (row: TData, index: number) => string;
  bodyClassName?: string;
  startIndex?: number;
}

/**
 * Reusable table component that mirrors the styling used in the Audit Planning table.
 * Accepts declarative column definitions and row rendering customizations.
 */
export function DataTable<TData>({
  columns,
  data,
  loading = false,
  loadingMessage = 'Loading...',
  emptyState = 'No data available.',
  rowKey,
  getRowClassName,
  bodyClassName = '',
}: DataTableProps<TData>) {
  const resolveCellValue = (row: TData, column: TableColumn<TData>, index: number) => {
    if (column.render) return column.render(row, index);
    if (typeof column.accessor === 'function') return column.accessor(row, index);
    if (column.accessor) return (row as Record<string, any>)[column.accessor as string];
    return null;
  };

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
            {loadingMessage}
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
            {emptyState}
          </td>
        </tr>
      );
    }

    return data.map((row, index) => {
      const rowClassName = getRowClassName ? getRowClassName(row, index) : 'transition-colors hover:bg-gray-50';
      return (
        <tr key={rowKey ? rowKey(row, index) : index} className={rowClassName}>
          {columns.map((column) => {
            const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
            const cellClasses = ['px-6', 'py-4', alignClass];
            // Add whitespace-nowrap only if specified in cellClassName
            // Don't add it by default to allow flexible column layouts
            if (column.cellClassName) {
              cellClasses.push(column.cellClassName);
            }
            return (
              <td key={column.key} className={cellClasses.join(' ')}>
                {resolveCellValue(row, column, index)}
              </td>
            );
          })}
        </tr>
      );
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => {
              const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
              const headerClasses = ['px-6', 'py-3', alignClass, 'text-xs', 'font-semibold', 'text-gray-700', 'uppercase', 'tracking-wider'];
              if (column.headerClassName) {
                headerClasses.push(column.headerClassName);
              }
              return (
                <th key={column.key} className={headerClasses.join(' ')}>
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={`divide-y divide-gray-200 ${bodyClassName}`}>{renderBody()}</tbody>
      </table>
    </div>
  );
}

export default DataTable;

