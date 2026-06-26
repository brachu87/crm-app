import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

// columns: [{ header: 'Nombre', value: (row) => row.name }]
function buildMatrix(rows, columns) {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => {
    const v = c.value(r);
    return v == null ? '' : v;
  }));
  return { header, body };
}

function downloadCSV(rows, columns, filename) {
  const { header, body } = buildMatrix(rows, columns);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...body].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename + '.csv';
  a.click();
}

function downloadXLSX(rows, columns, filename, sheetName) {
  const { header, body } = buildMatrix(rows, columns);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = header.map((h, i) => {
    const maxLen = Math.max(String(h).length, ...body.map((r) => String(r[i] ?? '').length), 0);
    return { wch: Math.min(45, Math.max(10, maxLen + 2)) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName || 'Datos').slice(0, 31));
  XLSX.writeFile(wb, filename + '.xlsx');
}

function printPDF(rows, columns, title) {
  const { header, body } = buildMatrix(rows, columns);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ths = header.map((h) => `<th>${esc(h)}</th>`).join('');
  const trs = body.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  const today = new Date().toLocaleDateString('es-AR');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:24px;}
  h1{font-size:20px;margin:0 0 2px;color:#1E2A38;}
  .sub{color:#777;font-size:12px;margin:0 0 16px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;}
  th{background:#1BA84C;color:#fff;}
  tr:nth-child(even) td{background:#f5f7f6;}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">${body.length} registros &middot; ${today}</p>
<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Permití las ventanas emergentes para exportar a PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

function useOutside(ref, onClose) {
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
}

const menuStyle = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
  background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.14)', minWidth: 180, zIndex: 60, overflow: 'hidden',
};
const itemStyle = {
  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink, #222)',
};
function hoverOn(e) { e.currentTarget.style.background = 'var(--primary-soft, #eef6ee)'; }
function hoverOff(e) { e.currentTarget.style.background = 'none'; }

export function ExportMenu({ rows = [], columns = [], filename = 'export', title = 'Listado', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const run = (fn) => { setOpen(false); fn(); };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-secondary" disabled={disabled} onClick={() => setOpen((o) => !o)}>↓ Exportar ▾</button>
      {open && (
        <div style={menuStyle}>
          <button style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={() => run(() => downloadXLSX(rows, columns, filename, title))}>📊 Excel (.xlsx)</button>
          <button style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={() => run(() => downloadCSV(rows, columns, filename))}>📄 CSV (.csv)</button>
          <button style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={() => run(() => printPDF(rows, columns, title))}>📕 PDF</button>
        </div>
      )}
    </div>
  );
}

export function ImportMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const run = () => { setOpen(false); onPick(); };
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-secondary" onClick={() => setOpen((o) => !o)}>↑ Importar ▾</button>
      {open && (
        <div style={menuStyle}>
          <button style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={run}>📊 Desde Excel (.xlsx)</button>
          <button style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff} onClick={run}>📄 Desde CSV (.csv)</button>
        </div>
      )}
    </div>
  );
}
