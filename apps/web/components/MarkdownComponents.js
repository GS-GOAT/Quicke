import React from 'react';

export const TableWrapper = ({ children }) => (
  <div className="w-full overflow-x-auto my-8 rounded-xl border border-gray-700/50 shadow-lg">
    <table className="w-full border-collapse table-auto">
      {children}
    </table>
  </div>
);

export const TableRow = ({ children, isHeader }) => (
  <tr className={`
    ${isHeader ? 'bg-gray-800/70' : 'odd:bg-transparent even:bg-gray-800/30'} 
    border-b border-gray-700/50 last:border-0 transition-colors duration-200 hover:bg-gray-700/30
  `}>
    {children}
  </tr>
);

export const TableCell = ({ children, isHeader }) => {
  const Component = isHeader ? 'th' : 'td';
  return (
    <Component className={`
      px-6 py-4 text-sm border-r border-gray-700/50 last:border-r-0
      ${isHeader 
        ? 'font-semibold text-gray-200 whitespace-nowrap bg-gray-800/50' 
        : 'text-gray-300 break-words'
      }
    `}>
      {children}
    </Component>
  );
};

// Enhanced Markdown components with better typography and spacing
export const MarkdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold mt-8 mb-6 pb-2 border-b border-gray-700/30 text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold mt-6 mb-4 text-white/90">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-medium mt-5 mb-3 text-white/80">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-lg font-medium mt-4 mb-2 text-gray-100/70">{children}</h4>
  ),
  
  p: ({ children }) => (
    <p className="my-4 leading-7 text-gray-200/90">{children}</p>
  ),
  
  ul: ({ children }) => (
    <ul className="my-4 pl-6 space-y-2 list-disc marker:text-gray-500">{children}</ul>
  ),
  
  ol: ({ children }) => (
    <ol className="my-4 pl-6 space-y-2 list-decimal marker:text-gray-500">{children}</ol>
  ),
  
  li: ({ children }) => (
    <li className="text-gray-200/90 leading-7">{children}</li>
  ),
  
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary-500/50 pl-4 my-6 italic text-gray-300/90 bg-gray-800/30 py-3 pr-4 rounded-r-lg">
      {children}
    </blockquote>
  ),
  
  // Tables with enhanced styling
  table: ({ children }) => (
    <TableWrapper>{children}</TableWrapper>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-800/70">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-700/50 bg-gray-900/20">{children}</tbody>
  ),
  tr: TableRow,
  th: ({ children }) => (
    <TableCell isHeader={true}>{children}</TableCell>
  ),
  td: ({ children }) => (
    <TableCell isHeader={false}>{children}</TableCell>
  ),
};