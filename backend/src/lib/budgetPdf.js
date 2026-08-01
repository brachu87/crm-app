const PDFDocument = require('pdfkit');
const fs = require('fs');

const DARK = '#1e2a38';
const GREY = '#6b7280';
const LINE = '#e5e7eb';
const ZEBRA = '#f8faf9';
const HEADBG = '#eef2f1';
const GREEN = '#1ba84c';
const money = (n) => '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdate = (d) => { try { return d ? new Date(d).toLocaleDateString('es-AR') : '-'; } catch (_) { return '-'; } };

function generateBudgetPdf(budget, biz, opts = {}) {
  let items = [];
  try { items = JSON.parse(budget.itemsJson || '[]'); } catch (_) {}
  if (!Array.isArray(items)) items = [];

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const W = right - left;
      const bottomLimit = doc.page.height - 72; // deja lugar para el pie

      // Columnas de la tabla
      const colDesc = left + 8;
      const colCantX = left + W * 0.56;
      const colCantW = W * 0.13;
      const colUnitX = left + W * 0.69;
      const colUnitW = W * 0.15;
      const colSubX = left + W * 0.84;
      const colSubW = W * 0.16 - 8;

      // ── Encabezado: emisor a la izq, caja PRESUPUESTO a la der ──
      const boxW = 190, boxH = 70, boxX = right - boxW, boxY = 40;
      let emisorX = left;
      if (opts.logoPath && fs.existsSync(opts.logoPath)) {
        try { doc.image(opts.logoPath, left, boxY, { fit: [52, 52] }); emisorX = left + 64; } catch (_) {}
      }
      doc.roundedRect(boxX, boxY, boxW, boxH, 8).lineWidth(1.2).strokeColor(GREEN).stroke();
      doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN).text('PRESUPUESTO', boxX, boxY + 11, { width: boxW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('N° ' + String(budget.numero || 0).padStart(6, '0'), boxX, boxY + 36, { width: boxW, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(GREY).text('Documento no válido como factura', boxX, boxY + boxH - 13, { width: boxW, align: 'center' });

      const emW = boxX - emisorX - 18;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK).text(biz.fiscalRazonSocial || biz.name || '', emisorX, boxY + 2, { width: emW });
      doc.font('Helvetica').fontSize(9).fillColor(GREY);
      const emiLine = (t) => { if (t) doc.text(String(t), emisorX, doc.y + 2, { width: emW }); };
      if (biz.fiscalCuit) emiLine('CUIT: ' + biz.fiscalCuit);
      emiLine(biz.fiscalDomicilio || biz.address);
      if (biz.phone) emiLine('Tel: ' + biz.phone);
      emiLine(biz.email);

      // ── Bloque fecha / validez / cliente ──
      let y = Math.max(doc.y, boxY + boxH) + 20;
      const infoH = 54;
      doc.roundedRect(left, y, W, infoH, 6).fillColor('#f8faf9').fill();
      doc.roundedRect(left, y, W, infoH, 6).lineWidth(0.8).strokeColor(LINE).stroke();
      const pad = 12;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('FECHA', left + pad, y + 9);
      doc.font('Helvetica').fontSize(10).fillColor(DARK).text(fdate(budget.createdAt), left + pad, y + 22);
      if (budget.validoHasta) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('VÁLIDO HASTA', left + pad + 150, y + 9);
        doc.font('Helvetica').fontSize(10).fillColor(DARK).text(fdate(budget.validoHasta), left + pad + 150, y + 22);
      }
      const cliDoc = budget.clienteDoc ? ' · ' + budget.clienteDoc : '';
      const cliName = (budget.clienteNombre || 'Consumidor final') + cliDoc;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY).text('CLIENTE', left + pad + 320, y + 9, { width: W - pad - 320 });
      doc.font('Helvetica').fontSize(10).fillColor(DARK).text(cliName, left + pad + 320, y + 22, { width: W - pad - 332 });
      y += infoH + 20;

      // ── Cabecera de tabla (reutilizable tras salto de página) ──
      const drawTableHead = () => {
        doc.roundedRect(left, y, W, 24, 3).fillColor(HEADBG).fill();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
        doc.text('Descripción', colDesc, y + 7, { width: colCantX - colDesc - 6 });
        doc.text('Cant.', colCantX, y + 7, { width: colCantW, align: 'right' });
        doc.text('P. unitario', colUnitX, y + 7, { width: colUnitW, align: 'right' });
        doc.text('Subtotal', colSubX, y + 7, { width: colSubW, align: 'right' });
        y += 24;
      };
      drawTableHead();

      // ── Filas ──
      doc.font('Helvetica').fontSize(9);
      let total = 0, zebra = false;
      for (const it of items) {
        const cant = Number(it.cantidad) || 1;
        const precio = Number(it.precio) || 0;
        const sub = cant * precio;
        total += sub;
        const desc = String(it.descripcion || '');
        const textH = doc.heightOfString(desc, { width: colCantX - colDesc - 6 });
        const rowH = Math.max(20, textH + 10);

        // Salto de página si no entra
        if (y + rowH > bottomLimit) {
          doc.addPage();
          y = doc.page.margins.top;
          drawTableHead();
          doc.font('Helvetica').fontSize(9);
          zebra = false;
        }

        if (zebra) { doc.rect(left, y, W, rowH).fillColor(ZEBRA).fill(); }
        zebra = !zebra;
        doc.fillColor(DARK).text(desc, colDesc, y + 6, { width: colCantX - colDesc - 6 });
        doc.fillColor(DARK).text(String(cant), colCantX, y + 6, { width: colCantW, align: 'right' });
        doc.text(money(precio), colUnitX, y + 6, { width: colUnitW, align: 'right' });
        doc.text(money(sub), colSubX, y + 6, { width: colSubW, align: 'right' });
        y += rowH;
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(LINE).stroke();
      }

      const totalCalc = (typeof budget.total === 'number' && budget.total) ? budget.total : total;

      // ── Caja de TOTAL ──
      const tBoxW = 230, tBoxH = 40, tBoxX = right - tBoxW;
      if (y + tBoxH + 8 > bottomLimit) { doc.addPage(); y = doc.page.margins.top; }
      y += 12;
      doc.roundedRect(tBoxX, y, tBoxW, tBoxH, 6).fillColor('#eef7f0').fill();
      doc.roundedRect(tBoxX, y, tBoxW, tBoxH, 6).lineWidth(1).strokeColor(GREEN).stroke();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text('TOTAL', tBoxX + 14, y + 13);
      doc.font('Helvetica-Bold').fontSize(15).fillColor(GREEN).text(money(totalCalc), tBoxX + 14, y + 11, { width: tBoxW - 28, align: 'right' });
      y += tBoxH + 22;

      // ── Notas ──
      if (budget.notas) {
        const notasH = doc.heightOfString(String(budget.notas), { width: W - 24 }) + 30;
        if (y + notasH > bottomLimit) { doc.addPage(); y = doc.page.margins.top; }
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Notas', left, y);
        doc.font('Helvetica').fontSize(9).fillColor(GREY).text(String(budget.notas), left, doc.y + 3, { width: W });
      }

      // ── Pie en todas las páginas ──
      const range = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
      // (no buffering en este flujo; escribimos el pie en la página actual)
      doc.font('Helvetica').fontSize(8).fillColor(GREY)
        .text('Presupuesto generado con Gestumio · gestumio.com · No es una factura ni comprobante fiscal.',
          left, doc.page.height - 52, { width: W, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generateBudgetPdf };
