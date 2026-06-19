import React from 'react';

export default function Table({ 
  headers, 
  children, 
  className = '',
  containerClassName = ''
}) {
  return (
    <div className={`overflow-x-auto w-full border border-border-subtle rounded-lg bg-surface-container-lowest ${containerClassName}`}>
      <table className={`min-w-full divide-y divide-border-subtle table-auto text-left ${className}`}>
        <thead className="bg-surface-container-low">
          <tr>
            {headers.map((header, idx) => (
              <th 
                key={idx} 
                className="px-6 py-3 font-title-sm text-title-sm text-on-surface font-bold uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-transparent">
          {children}
        </tbody>
      </table>
    </div>
  );
}
