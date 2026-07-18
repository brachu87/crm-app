const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');

const LETRA = { 'FACTURA A': 'A', 'FACTURA B': 'B', 'FACTURA C': 'C', 'FACTURA X': 'X' };
const CBTE_COD = {
  'FACTURA A': 1, 'FACTURA B': 6, 'FACTURA C': 11,
  'NOTA DE DEBITO A': 2, 'NOTA DE DEBITO B': 7, 'NOTA DE DEBITO C': 12,
  'NOTA DE CREDITO A': 3, 'NOTA DE CREDITO B': 8, 'NOTA DE CREDITO C': 13,
};
const DOC_LABEL = { 80: 'CUIT', 96: 'DNI', 99: 'Consumidor Final' };

function money(n) { return '$ ' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fechaCae(v) { const s = String(v || '').replace(/\D/g, ''); return s.length === 8 ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : (v || '-'); }

function buildQrUrl(inv, biz) {
  const payload = {
    ver: 1,
    fecha: new Date(inv.createdAt || Date.now()).toISOString().slice(0, 10),
    cuit: Number(String(biz.fiscalCuit || '').replace(/\D/g, '')) || 0,
    ptoVta: Number(String(inv.puntoVenta || '').replace(/\D/g, '')) || 0,
    tipoCmp: CBTE_COD[inv.tipo] || 0,
    nroCmp: Number(String(inv.numero || '').replace(/\D/g, '')) || 0,
    importe: Math.round((inv.total || 0) * 100) / 100,
    moneda: 'PES', ctz: 1,
    tipoDocRec: inv.docTipoCode || 99,
    nroDocRec: Number(String(inv.clienteDoc || '0').replace(/\D/g, '')) || 0,
    tipoCodAut: 'E',
    codAut: Number(String(inv.cae || '0').replace(/\D/g, '')) || 0,
  };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return 'https://www.afip.gob.ar/fe/qr/?p=' + b64;
}

async function generateInvoicePdf(inv, biz, opts = {}) {
  let items = [];
  try { items = JSON.parse(inv.detalleJson || '[]'); } catch (_) {}
  const letra = String(inv.tipo || '').trim().slice(-1) || 'C';
  const isC = letra === 'C' || letra === 'X';
  const qrUrl = inv.qrUrl || buildQrUrl(inv, biz);
  const qrBuf = inv.cae ? await QRCode.toBuffer(qrUrl, { margin: 1, width: 220 }) : null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left, right = doc.page.width - doc.page.margins.right, W = right - left;
      const mid = left + W / 2;
      const GREY = '#555', DARK = '#111';

      const BRAND = '#1BA84C';
      const boxW = 54, boxH = 62, boxX = mid - boxW / 2, boxY = 40;

      // Logo del negocio (si existe)
      let emisorX = left;
      if (opts.logoPath && fs.existsSync(opts.logoPath)) {
        try { doc.image(opts.logoPath, left, boxY, { fit: [50, 50] }); emisorX = left + 60; } catch (_) {}
      }

      // Recuadro con la letra (centro)
      doc.rect(boxX, boxY, boxW, boxH).lineWidth(1).strokeColor('#000').stroke();
      doc.font('Helvetica-Bold').fontSize(34).fillColor(DARK).text(letra, boxX, boxY + 10, { width: boxW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor(GREY).text(CBTE_COD[inv.tipo] ? 'COD. ' + String(CBTE_COD[inv.tipo]).padStart(2, '0') : 'NO FISCAL', boxX, boxY + boxH - 14, { width: boxW, align: 'center' });

      // Emisor (izquierda)
      const emW = boxX - emisorX - 12;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(DARK).text(biz.fiscalRazonSocial || biz.name || '', emisorX, boxY, { width: emW });
      doc.font('Helvetica').fontSize(9).fillColor(GREY);
      const condLabel = biz.fiscalCondicion === 'RI' ? 'IVA Responsable Inscripto' : biz.fiscalCondicion === 'EXENTO' ? 'IVA Exento' : 'Responsable Monotributo';
      doc.text('CUIT: ' + (biz.fiscalCuit || ''), emisorX, doc.y + 3, { width: emW });
      doc.text(condLabel, { width: emW });
      if (biz.fiscalDomicilio) doc.text(biz.fiscalDomicilio, { width: emW });
      if (biz.phone) doc.text('Tel: ' + biz.phone, { width: emW });
      if (biz.email) doc.text(biz.email, { width: emW });
      const emisorBottom = doc.y;

      // Comprobante (derecha)
      const rx = boxX + boxW + 12, rW = right - rx;
      doc.font('Helvetica-Bold').fontSize(13).fillColor(DARK).text(String(inv.tipo || 'FACTURA').replace('CREDITO', 'CRÉDITO').replace('DEBITO', 'DÉBITO'), rx, boxY, { width: rW, align: 'right' });
      doc.font('Helvetica').fontSize(10).fillColor(GREY)
        .text('N°: ' + (inv.puntoVenta || '') + '-' + (inv.numero || ''), rx, doc.y + 4, { width: rW, align: 'right' })
        .text('Fecha: ' + new Date(inv.createdAt || Date.now()).toLocaleDateString('es-AR', { timeZone: 'UTC' }), { width: rW, align: 'right' });

      let y = Math.max(emisorBottom, doc.y, boxY + boxH) + 14;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(2).strokeColor(BRAND).stroke(); y += 12;

      // Cliente
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('Cliente:', left, y);
      doc.font('Helvetica').fillColor(GREY)
        .text(inv.clienteNombre || 'Consumidor Final', left + 55, y, { width: W - 55 })
        .text((DOC_LABEL[inv.docTipoCode] || 'Doc') + ': ' + (inv.clienteDoc || '0'), left + 55, doc.y, { width: W - 55 });
      y = doc.y + 14;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor('#ddd').stroke(); y += 10;

      // Tabla ítems
      const c2 = right - 210, c3 = right - 130, c4 = right - 60;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK);
      doc.text('Descripción', left, y);
      doc.text('Cant.', c2, y, { width: 40, align: 'right' });
      doc.text(isC ? 'Precio' : 'P.Unit', c3, y, { width: 60, align: 'right' });
      doc.text('Subtotal', c4, y, { width: 60, align: 'right' });
      y = doc.y + 4; doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#eee').stroke(); y += 4;
      doc.font('Helvetica').fillColor('#222').fontSize(9);
      items.forEach(it => {
        const cant = Number(it.cantidad) || 1, precio = Number(it.precio) || 0;
        const yy = y;
        doc.text(String(it.descripcion || ''), left, yy, { width: c2 - left - 8 });
        doc.text(String(cant), c2, yy, { width: 40, align: 'right' });
        doc.text(money(precio), c3, yy, { width: 60, align: 'right' });
        doc.text(money(cant * precio), c4, yy, { width: 60, align: 'right' });
        y = Math.max(doc.y, yy) + 6;
      });
      y += 6; doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor('#ddd').stroke(); y += 10;

      function tot(label, val, bold) {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(DARK)
          .text(label, c3 - 60, y, { width: 120, align: 'right' });
        doc.text(money(val), c4, y, { width: 60, align: 'right' });
        y = doc.y + 4;
      }
      if (!isC) { tot('Neto:', inv.neto || 0); tot('IVA:', inv.iva || 0); }
      tot('TOTAL:', inv.total || 0, true);
      y += 14;

      if (inv.cae) {
        if (qrBuf) { try { doc.image(qrBuf, left, y, { fit: [95, 95] }); } catch (_) {} }
        doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('CAE N°: ' + inv.cae, left + 110, y + 10, { width: W - 110 });
        doc.font('Helvetica').fontSize(10).fillColor(GREY).text('Vencimiento CAE: ' + fechaCae(inv.vencimientoCae), left + 110, doc.y + 2, { width: W - 110 });
        doc.fillColor('#999').fontSize(8).text('Comprobante autorizado electrónicamente por AFIP/ARCA', left + 110, doc.y + 6, { width: W - 110 });
      } else if (inv.tipo === 'FACTURA X') {
        doc.font('Helvetica').fontSize(9).fillColor('#777').text('Documento no fiscal — Comprobante X. Sin validez como factura ante AFIP/ARCA.', left, y, { width: W });
      } else {
        doc.font('Helvetica').fontSize(9).fillColor('#b00').text('Comprobante NO autorizado', left, y);
      }
      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generateInvoicePdf, buildQrUrl };
