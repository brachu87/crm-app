const PDFDocument = require('pdfkit');
const fs = require('fs');

const DARK = '#1e2a38';
const GREY = '#6b7280';
const GREEN = '#1ba84c';
const money = (n) => '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdate = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';

function generateBudgetPdf(budget, biz, opts = {}) {
  let items = [];
  try { items = JSON.parse(budget.itemsJson || '[]'); } catch (_) {}
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left, right = doc.page.width - doc.page.margins.right, W = right - left;

      // ── Encabezado: emisor a la izq, caja PRESUPUESTO a la der ──
      const boxW = 180, boxH = 66, boxX = right - boxW, boxY = 40;
      let emisorX = left;
      if (opts.logoPath && fs.existsSync(opts.logoPath)) {
        try { doc.image(opts.logoPath, left, boxY, { fit: [50, 50] }); emisorX = left + 60; } catch (_) {}
      }
      doc.roundedRect(boxX, boxY, boxW, boxH, 6).lineWidth(1).strokeColor(GREEN).stroke();
      doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN).text('PRESUPUESTO', boxX, boxY + 10, { width: boxW, align: 'center' });
      doc.font('Helvetica').fontSize(10).fillColor(DARK).text('N° ' + String(budget.numero || 0).padStart(6, '0'), boxX, boxY + 34, { width: boxW, align: 'center' });
      doc.fontSize(8).fillColor(GREY).text('Documento no válido como factura', boxX, boxY + boxH - 12, { width: boxW, align: 'center' });

      const emW = boxX - emisorX - 16;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK).text(biz.fiscalRazonSocial || biz.name || '', emisorX, boxY, { width: emW });
      doc.font('Helvetica').fontSize(9).fillColor(GREY);
      if (biz.fiscalCuit) doc.text('CUIT: ' + biz.fiscalCuit, emisorX, doc.y + 3, { width: emW });
      if (biz.fiscalDomicilio || biz.address) doc.text(biz.fiscalDomicilio || biz.address, { width: emW });
      if (biz.phone) doc.text('Tel: ' + biz.phone, { width: emW });
      if (biz.email) doc.text(biz.email, { width: emW });

      // ── Fecha / validez / cliente ──
      let y = boxY + boxH + 22;
      doc.font('Helvetica').fontSize(9).fillColor(GREY);
      doc.text('Fecha: ' + fdate(budget.createdAt), left, y);
      if (budget.validoHasta) doc.text('Válido hasta: ' + fdate(budget.validoHasta), left + 180, y);
      y = doc.y + 10;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('Cliente: ', left, y, { continued: true })
         .font('Helvetica').fillColor(GREY).text(budget.clienteNombre || 'Consumidor final' + (budget.clienteDoc ? ' · ' + budget.clienteDoc : ''));
      y = doc.y + 16;

      // ── Tabla de ítems ──
      const c1 = left, c2 = left + W * 0.60, c3 = left + W * 0.74, c4 = right;
      doc.rect(left, y, W, 22).fill('#f1f5f4');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text('Descripción', c1 + 6, y + 6);
      doc.text('Cant.', c2, y + 6, { width: c3 - c2 - 6, align: 'right' });
      doc.text('P. unit.', c3, y + 6, { width: 60, align: 'right' });
      doc.text('Subtotal', c4 - 70, y + 6, { width: 64, align: 'right' });
      y += 24;
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      let total = 0;
      for (const it of items) {
        const cant = Number(it.cantidad) || 1, precio = Number(it.precio) || 0, sub = cant * precio;
        total += sub;
        const h = Math.max(18, doc.heightOfString(String(it.descripcion || ''), { width: c2 - c1 - 12, fontSize: 9 }) + 6);
        doc.fillColor(DARK).text(String(it.descripcion || ''), c1 + 6, y + 3, { width: c2 - c1 - 12 });
        doc.text(String(cant), c2, y + 3, { width: c3 - c2 - 6, align: 'right' });
        doc.text(money(precio), c3, y + 3, { width: 60, align: 'right' });
        doc.text(money(sub), c4 - 70, y + 3, { width: 64, align: 'right' });
        y += h;
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
      }
      const totalCalc = (typeof budget.total === 'number' && budget.total) ? budget.total : total;
      y += 12;
      doc.font('Helvetica-Bold').fontSize(13).fillColor(DARK).text('TOTAL', c3 - 30, y, { width: 90, align: 'right' });
      doc.fillColor(GREEN).text(money(totalCalc), c4 - 110, y, { width: 104, align: 'right' });
      y = doc.y + 20;

      if (budget.notas) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Notas', left, y);
        doc.font('Helvetica').fontSize(9).fillColor(GREY).text(String(budget.notas), left, doc.y + 2, { width: W });
      }

      doc.font('Helvetica').fontSize(8).fillColor(GREY)
        .text('Presupuesto generado con Gestumio · gestumio.com · No es una factura ni comprobante fiscal.',
          left, doc.page.height - 55, { width: W, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generateBudgetPdf };
