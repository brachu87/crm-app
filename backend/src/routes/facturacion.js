const express = require('express');
const forge = require('node-forge');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const afip = require('../lib/afip');
const invoicePdf = require('../lib/invoicePdf');

const router = express.Router();
router.use(authMiddleware);

function configView(b) {
  return {
    fiscalCuit: b.fiscalCuit || '',
    fiscalRazonSocial: b.fiscalRazonSocial || '',
    fiscalCondicion: b.fiscalCondicion || 'MONOTRIBUTO',
    fiscalPuntoVenta: b.fiscalPuntoVenta || '',
    fiscalDomicilio: b.fiscalDomicilio || '',
    afipEnv: b.afipEnv || 'homologacion',
    hasKey: !!b.afipKeyPem,
    hasCsr: !!b.afipCsrPem,
    hasCert: !!b.afipCertPem,
    csrPem: b.afipCsrPem || '',
    configured: !!(b.afipCertPem && b.afipKeyPem && b.fiscalCuit && b.fiscalPuntoVenta),
  };
}

// GET /api/facturacion/config
router.get('/config', async (req, res) => {
  try {
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!b) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(configView(b));
  } catch (e) { console.error('[fact] config get', e); res.status(500).json({ error: 'Error al cargar la configuración' }); }
});

// PUT /api/facturacion/config
router.put('/config', async (req, res) => {
  try {
    const d = req.body || {};
    const data = {
      fiscalCuit: String(d.fiscalCuit || '').replace(/\D/g, '') || null,
      fiscalRazonSocial: (d.fiscalRazonSocial || '').trim() || null,
      fiscalCondicion: d.fiscalCondicion || null,
      fiscalPuntoVenta: String(d.fiscalPuntoVenta || '').replace(/\D/g, '') || null,
      fiscalDomicilio: (d.fiscalDomicilio || '').trim() || null,
      afipEnv: d.afipEnv === 'produccion' ? 'produccion' : 'homologacion',
    };
    await prisma.business.update({ where: { id: req.user.businessId }, data });
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    res.json(configView(b));
  } catch (e) { console.error('[fact] config put', e); res.status(500).json({ error: 'Error al guardar la configuración' }); }
});

// POST /api/facturacion/generate-csr  -> genera clave privada + CSR
router.post('/generate-csr', async (req, res) => {
  try {
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!b.fiscalCuit || !b.fiscalRazonSocial) {
      return res.status(400).json({ error: 'Primero completá y guardá el CUIT y la razón social.' });
    }
    const { keyPem, csrPem } = afip.generateKeyAndCsr({ cuit: b.fiscalCuit, razonSocial: b.fiscalRazonSocial });
    await prisma.business.update({
      where: { id: b.id },
      data: { afipKeyPem: keyPem, afipCsrPem: csrPem, afipCertPem: null, afipToken: null, afipSign: null, afipTokenExp: null },
    });
    res.json({ ok: true, csrPem });
  } catch (e) { console.error('[fact] gen-csr', e); res.status(500).json({ error: 'Error al generar el CSR' }); }
});

// PUT /api/facturacion/cert  -> guarda el certificado devuelto por AFIP
router.put('/cert', async (req, res) => {
  try {
    const certPem = (req.body && req.body.certPem || '').trim();
    if (!certPem) return res.status(400).json({ error: 'Pegá el contenido del certificado (.crt / .pem)' });
    let cert;
    try { cert = forge.pki.certificateFromPem(certPem); }
    catch (e) { return res.status(400).json({ error: 'El certificado no es válido. Copiá el contenido completo del archivo .crt.' }); }

    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!b.afipKeyPem) return res.status(400).json({ error: 'Primero generá la clave y el CSR.' });
    // Verificar que el certificado corresponde a la clave generada
    try {
      const key = forge.pki.privateKeyFromPem(b.afipKeyPem);
      if (cert.publicKey.n.toString(16) !== key.n.toString(16)) {
        return res.status(400).json({ error: 'Ese certificado no corresponde a la clave generada en Gestumio. Verificá que subiste el CSR correcto a AFIP.' });
      }
    } catch (e) { /* si falla la comparación, seguimos */ }

    await prisma.business.update({
      where: { id: b.id },
      data: { afipCertPem: certPem, afipToken: null, afipSign: null, afipTokenExp: null },
    });
    const nb = await prisma.business.findUnique({ where: { id: b.id } });
    res.json(configView(nb));
  } catch (e) { console.error('[fact] cert', e); res.status(500).json({ error: 'Error al guardar el certificado' }); }
});

// POST /api/facturacion/test  -> prueba WSAA + consulta último comprobante
router.post('/test', async (req, res) => {
  try {
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!b.afipCertPem || !b.afipKeyPem) return res.status(400).json({ error: 'Falta el certificado. Completá la configuración.' });
    if (!b.fiscalCuit || !b.fiscalPuntoVenta) return res.status(400).json({ error: 'Falta CUIT o punto de venta.' });
    const auth = await afip.getAuth(b, prisma);
    const pv = parseInt(b.fiscalPuntoVenta.replace(/\D/g, ''), 10) || 1;
    const last = await afip.ultimoAutorizado(b.afipEnv, auth, b.fiscalCuit, pv, afip.CBTE_TIPO['FACTURA C']);
    res.json({ ok: true, env: b.afipEnv, ptoVta: pv, ultimoC: last });
  } catch (e) {
    console.error('[fact] test', e.message);
    res.status(400).json({ error: 'No se pudo conectar con AFIP: ' + (e.message || 'error desconocido') });
  }
});

// GET /api/facturacion  -> listado
router.get('/', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({ where: { businessId: req.user.businessId }, orderBy: { createdAt: 'desc' }, take: 300 });
    res.json(invoices);
  } catch (e) { console.error('[fact] list', e); res.status(500).json({ error: 'Error al cargar los comprobantes' }); }
});

// POST /api/facturacion/emitir
router.post('/emitir', async (req, res) => {
  try {
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    if (!b.afipCertPem || !b.afipKeyPem || !b.fiscalCuit || !b.fiscalPuntoVenta) {
      return res.status(400).json({ error: 'Primero completá la configuración de AFIP (CUIT, punto de venta y certificado).' });
    }
    const body = req.body || {};
    const tipo = String(body.tipo || '').toUpperCase();
    if (!afip.CBTE_TIPO[tipo]) return res.status(400).json({ error: 'Tipo de comprobante inválido' });
    const items = Array.isArray(body.items) ? body.items.filter(it => it && (it.descripcion || it.precio)) : [];
    if (!items.length) return res.status(400).json({ error: 'Agregá al menos un ítem con descripción y precio.' });

    let clientRec = null;
    if (body.clientId) clientRec = await prisma.client.findFirst({ where: { id: body.clientId, businessId: b.id } });
    const cli = body.cliente || {};
    const razon = (clientRec ? clientRec.name : '') || (cli.razonSocial || '').trim() || 'Consumidor Final';
    const cuit = String(cli.cuit || (clientRec && clientRec.cuit) || '').replace(/\D/g, '');
    const dni = String(cli.dni || (clientRec && clientRec.dni) || '').replace(/\D/g, '');

    let docTipo = 99, docNro = '0';
    if (tipo === 'FACTURA A') {
      if (!cuit || cuit.length < 11) return res.status(400).json({ error: 'Para Factura A el cliente debe tener CUIT válido.' });
      docTipo = 80; docNro = cuit;
    } else if (cuit && cuit.length >= 11) { docTipo = 80; docNro = cuit; }
    else if (dni) { docTipo = 96; docNro = dni; }

    const condId = Number(body.condicionIvaReceptorId) || (tipo === 'FACTURA A' ? 1 : 5);
    const params = {
      tipo, ptoVta: b.fiscalPuntoVenta, cuit: b.fiscalCuit,
      docTipo, docNro, condicionIvaReceptorId: condId, concepto: Number(body.concepto) || 2,
      items: items.map(it => ({ precio: Number(it.precio) || 0, cantidad: Number(it.cantidad) || 1, alicuota: Number(it.alicuota) || 0 })),
    };

    let auth, result;
    try {
      auth = await afip.getAuth(b, prisma);
      result = await afip.solicitarCAE(b.afipEnv, auth, params);
    } catch (e) {
      console.error('[fact] emitir afip', e.message);
      await prisma.invoice.create({ data: {
        businessId: b.id, clientId: clientRec ? clientRec.id : null, tipo, puntoVenta: String(params.ptoVta),
        total: 0, status: 'error', errorMsg: (e.message || 'Error de conexión con AFIP').slice(0, 480),
        clienteNombre: razon, clienteDoc: docNro, detalleJson: JSON.stringify(items),
      } });
      return res.status(502).json({ error: 'No se pudo conectar con AFIP: ' + (e.message || 'error') });
    }

    const aprobado = result.resultado === 'A' && result.cae;
    if (!aprobado) {
      const msg = result.mensajes.join(' · ') || 'AFIP rechazó el comprobante';
      await prisma.invoice.create({ data: {
        businessId: b.id, clientId: clientRec ? clientRec.id : null, tipo, puntoVenta: String(result.ptoVta),
        numero: String(result.numero), total: result.impTotal, status: 'error', errorMsg: msg.slice(0, 480),
        clienteNombre: razon, clienteDoc: docNro, detalleJson: JSON.stringify(items),
      } });
      return res.status(400).json({ error: msg, mensajes: result.mensajes });
    }

    let inv = await prisma.invoice.create({ data: {
      businessId: b.id, clientId: clientRec ? clientRec.id : null, tipo, puntoVenta: String(result.ptoVta).padStart(4, '0'),
      numero: String(result.numero).padStart(8, '0'), cae: result.cae, vencimientoCae: result.caeVto,
      clienteNombre: razon, clienteDoc: docNro, total: result.impTotal, moneda: 'PES',
      neto: result.impNeto, iva: result.impIVA, docTipoCode: docTipo, condReceptor: condId,
      status: 'issued', detalleJson: JSON.stringify(items),
    } });
    // Generar y guardar la URL del QR de AFIP
    try {
      const qrUrl = invoicePdf.buildQrUrl(inv, b);
      inv = await prisma.invoice.update({ where: { id: inv.id }, data: { qrUrl } });
    } catch (e) { console.error('[fact] qr', e.message); }
    res.json({ ok: true, invoice: inv, mensajes: result.mensajes });
  } catch (e) { console.error('[fact] emitir', e); res.status(500).json({ error: 'Error interno al emitir el comprobante' }); }
});

// GET /api/facturacion/:id/pdf  -> PDF de la factura con QR de AFIP
router.get('/:id/pdf', async (req, res) => {
  try {
    const inv = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId: req.user.businessId } });
    if (!inv) return res.status(404).json({ error: 'Comprobante no encontrado' });
    const b = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    const pdf = await invoicePdf.generateInvoicePdf(inv, b);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${inv.puntoVenta || ''}-${inv.numero || ''}.pdf"`);
    res.send(pdf);
  } catch (e) { console.error('[fact] pdf', e); res.status(500).json({ error: 'Error al generar el PDF' }); }
});

module.exports = router;
