const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Genera el PDF de un recibo de pago y devuelve un Buffer.
 * data: {
 *   businessName, businessPhone, logoPath,
 *   nroRecibo, fecha, clientName, clientDni, serviceName,
 *   detalleLabel, detalleValue, formaPago,
 *   rows: [{label, value}], total
 * }
 */
function generateReceiptPdf(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#1BA84C';
      const GREY = '#6b7280';
      const LIGHT = '#9ca3af';
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;

      const headerTop = doc.y;
      // Logo (si existe)
      let textX = left;
      if (data.logoPath && fs.existsSync(data.logoPath)) {
        try { doc.image(data.logoPath, left, headerTop, { fit: [56, 56] }); textX = left + 68; } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111')
        .text(data.businessName || 'Mi negocio', textX, headerTop + 4, { width: 260 });
      if (data.businessPhone) {
        doc.font('Helvetica').fontSize(11).fillColor(GREY)
          .text(String(data.businessPhone), textX, doc.y + 2, { width: 260 });
      }
      // Bloque RECIBO (derecha)
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#111111')
        .text('RECIBO', left, headerTop + 2, { width: contentW, align: 'right' });
      doc.font('Helvetica').fontSize(11).fillColor(GREY)
        .text('N° ' + (data.nroRecibo || ''), left, doc.y + 2, { width: contentW, align: 'right' })
        .text('Fecha: ' + (data.fecha || ''), left, doc.y, { width: contentW, align: 'right' });

      let y = Math.max(doc.y, headerTop + 78) + 6;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(2).strokeColor('#e5e7eb').stroke();
      doc.y = y + 14;

      function row(label, value, opts = {}) {
        const yy = doc.y;
        doc.font('Helvetica').fontSize(12).fillColor(GREY).text(label, left, yy, { width: 220 });
        doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(12).fillColor('#111111')
          .text(value == null || value === '' ? '-' : String(value), left + 220, yy, { width: contentW - 220, align: 'right' });
        doc.y = Math.max(doc.y, yy) + 6;
        doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor('#f3f4f6').stroke();
        doc.y += 6;
      }

      row('Socio / Cliente', data.clientName);
      if (data.clientDni) row('DNI', data.clientDni);
      row('Actividad / Servicio', data.serviceName);
      if (data.detalleLabel) row(data.detalleLabel, data.detalleValue);
      row('Forma de pago', data.formaPago || 'Efectivo');

      doc.y += 2;
      doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(2).strokeColor('#e5e7eb').stroke();
      doc.y += 12;

      (data.rows || []).forEach((r) => row(r.label, r.value));

      const ty = doc.y + 6;
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('TOTAL ABONADO', left, ty, { width: 260 });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(PRIMARY)
        .text(data.total || '', left + 260, ty, { width: contentW - 260, align: 'right' });
      doc.y = ty + 28;

      // Firmas
      const sy = doc.y + 36;
      const colW = (contentW - 40) / 2;
      doc.moveTo(left, sy).lineTo(left + colW, sy).lineWidth(0.5).strokeColor('#9ca3af').stroke();
      doc.moveTo(left + colW + 40, sy).lineTo(right, sy).lineWidth(0.5).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica').fontSize(10).fillColor(GREY)
        .text('Firma y sello', left, sy + 6, { width: colW, align: 'center' })
        .text('Recibí conforme', left + colW + 40, sy + 6, { width: colW, align: 'center' });

      doc.font('Helvetica').fontSize(10).fillColor(LIGHT)
        .text('Este recibo es comprobante válido de pago.', left, doc.page.height - 70, { width: contentW, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

/**
 * Genera el PDF del recibo de haberes (liquidación) y devuelve un Buffer.
 * data: { businessName, logoPath, fecha, employeeName, employeeRole, estado,
 *         rows: [{label,value}], total, notes }
 */
function generatePayrollPdf(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#1BA84C', GREY = '#6b7280', LIGHT = '#9ca3af', INK = '#1E2A38';
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;

      const headerTop = doc.y;
      let textX = left;
      if (data.logoPath && fs.existsSync(data.logoPath)) {
        try { doc.image(data.logoPath, left, headerTop, { fit: [56, 56] }); textX = left + 68; } catch (_) {}
      }
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text(data.businessName || 'Mi negocio', textX, headerTop + 4, { width: 300 });
      doc.font('Helvetica').fontSize(12).fillColor(GREY).text('Recibo de Haberes', textX, doc.y + 2, { width: 300 });
      doc.font('Helvetica').fontSize(11).fillColor(GREY).text('Emitido: ' + (data.fecha || ''), left, headerTop + 2, { width: contentW, align: 'right' });

      let y = Math.max(doc.y, headerTop + 78) + 6;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(2).strokeColor('#e5e7eb').stroke();
      doc.y = y + 14;

      const empY = doc.y;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(data.employeeName || '', left, empY, { width: 320 });
      if (data.employeeRole) doc.font('Helvetica').fontSize(12).fillColor(GREY).text(data.employeeRole, left, doc.y + 1, { width: 320 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(data.estado === 'Pagado' ? '#065f46' : '#92400e')
        .text(String(data.estado || '').toUpperCase(), left, empY, { width: contentW, align: 'right' });
      doc.moveDown(0.8);

      function row(label, value) {
        const yy = doc.y;
        doc.font('Helvetica').fontSize(12).fillColor(GREY).text(label, left, yy, { width: 220 });
        doc.font('Helvetica').fontSize(12).fillColor('#111111').text(value == null || value === '' ? '-' : String(value), left + 220, yy, { width: contentW - 220, align: 'right' });
        doc.y = Math.max(doc.y, yy) + 6;
        doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor('#f3f4f6').stroke();
        doc.y += 6;
      }
      (data.rows || []).forEach((r) => row(r.label, r.value));

      const ty = doc.y + 6;
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('TOTAL A PAGAR', left, ty, { width: 260 });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(PRIMARY).text(data.total || '', left + 260, ty, { width: contentW - 260, align: 'right' });
      doc.y = ty + 26;

      if (data.notes) doc.font('Helvetica').fontSize(11).fillColor(GREY).text('Notas: ' + data.notes, left, doc.y + 4, { width: contentW });

      const sy = doc.y + 46;
      const colW = (contentW - 40) / 2;
      doc.moveTo(left, sy).lineTo(left + colW, sy).lineWidth(0.5).strokeColor('#9ca3af').stroke();
      doc.moveTo(left + colW + 40, sy).lineTo(right, sy).lineWidth(0.5).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica').fontSize(10).fillColor(GREY)
        .text('Empleador', left, sy + 6, { width: colW, align: 'center' })
        .text('Empleado / Recibí conforme', left + colW + 40, sy + 6, { width: colW, align: 'center' });

      doc.font('Helvetica').fontSize(10).fillColor(LIGHT)
        .text('Recibo generado digitalmente · ' + (data.businessName || ''), left, doc.page.height - 70, { width: contentW, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generateReceiptPdf, generatePayrollPdf };
