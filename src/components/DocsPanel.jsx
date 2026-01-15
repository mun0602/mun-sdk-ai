import React from 'react';

// Documentation Panel - Model recommendations
const DOCS_CONTENT = {
  'recommended': {
    title: 'Models Khuyến Nghị',
    content: `
## Best Models - Task Phức Tạp

| Model | Config | Steps | Ghi chú |
|-------|--------|-------|---------|
| gpt-4.1 | Vision ✗ Reasoning ✓ | 14 | Linh hoạt, hoạt động mọi config |
| gpt-4.1 | Vision ✗ Reasoning ✗ | 10 | Nhanh, vẫn hoàn thành |
| glm-4-plus | Vision ✗ Reasoning ✓ | 29 | Step-by-step chi tiết |
| glm-4-plus | Vision ✗ Reasoning ✗ | 24 | Hoạt động với task ngắn |

## Fast Models - Task Nhanh

| Model | Config | Steps | Ghi chú |
|-------|--------|-------|---------|
| gpt-4.1 | Vision ✓ Reasoning ✗ | 7 | Nhanh nhất gpt-4.1 |
| qwen3-coder-plus | Vision ✗ Reasoning ✗ | 5 | All-in-one loop |
| vision-model | Vision ✓ Reasoning ✗ | 1 | Ultra fast |

## Models Chưa Pass Task Phức Tạp

| Model | Vấn đề |
|-------|--------|
| glm-4.6v (no vision) | Chậm, output nhiều think tags |
| gemini-3-pro-preview | Timeout >1000s |
| gemini-2.5-computer-use (task dài) | Token overflow 131K |
| gpt-5-mini | Complete sớm |
| gpt-5-codex | Từ chối task |
| glm-4.5 | SyntaxError / Timeout |

## Lưu Ý Quan Trọng

- **gpt-4.1**: Linh hoạt nhất - hoạt động với mọi config (vision ON/OFF, reasoning ON/OFF)
- **glm-4-plus**: Tốt nhất khi reasoning=ON, task ngắn có thể reasoning=OFF
- **glm-4.6v**: Chỉ dùng khi cần vision, không cần thì dùng glm-4-plus
- **Prompt tiếng Anh** tốt hơn tiếng Việt
- **Task phức tạp**: Nhiều steps = đáng tin cậy hơn
`
  }
};

function DocsPanel() {
  const renderMarkdown = (content) => {
    const lines = content.trim().split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let inCodeBlock = false;
    let codeLines = [];

    const processLine = (line, index) => {
      if (line.startsWith('\`\`\`')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLines = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <pre key={`code-${index}`} className="bg-secondary p-3 rounded text-sm overflow-x-auto my-2">
              <code>{codeLines.join('\n')}</code>
            </pre>
          );
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        if (!line.includes('---')) {
          tableRows.push(line.split('|').filter(cell => cell.trim()));
        }
        return;
      } else if (inTable) {
        inTable = false;
        if (tableRows.length > 0) {
          const headers = tableRows[0];
          const rows = tableRows.slice(1);
          elements.push(
            <div key={`table-${index}`} className="overflow-x-auto my-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary">
                    {headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium">{h.trim()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 ? 'bg-secondary/50' : ''}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 border-t border-border">{cell.trim()}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      if (line.startsWith('## ')) {
        elements.push(<h2 key={index} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={index} className="text-base font-semibold mt-3 mb-2">{line.slice(4)}</h3>);
      } else if (line.startsWith('- ')) {
        elements.push(<li key={index} className="ml-4 my-1">{line.slice(2)}</li>);
      } else if (line.trim()) {
        elements.push(<p key={index} className="my-1">{line}</p>);
      }
    };

    lines.forEach((line, index) => processLine(line, index));

    if (inTable && tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div key="table-final" className="overflow-x-auto my-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                {headers.map((h, i) => (
                  <th key={i} className="px-2 py-1 text-left font-medium">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? 'bg-secondary/50' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 border-t border-border">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  };

  const currentDoc = DOCS_CONTENT['recommended'];

  return (
    <div className="card">
      <h1 className="text-xl font-bold mb-4">{currentDoc.title}</h1>
      <div className="docs-body">
        {renderMarkdown(currentDoc.content)}
      </div>
    </div>
  );
}

export default DocsPanel;
