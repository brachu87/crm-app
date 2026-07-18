// Integración DIRECTA con los Web Services de AFIP/ARCA (WSAA + WSFEv1).
// Sin terceros ni costos por comprobante. Requiere certificado digital del negocio.
const forge = require('node-forge');

const ENDPOINTS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

const CBTE_TIPO = {
  'FACTURA A': 1, 'FACTURA B': 6, 'FACTURA C': 11,
  'NOTA DE DEBITO A': 2, 'NOTA DE DEBITO B': 7, 'NOTA DE DEBITO C': 12,
  'NOTA DE CREDITO A': 3, 'NOTA DE CREDITO B': 8, 'NOTA DE CREDITO C': 13,
};
const IVA_ID = { 0: 3, 10.5: 4, 21: 5, 27: 6, 5: 8, 2.5: 9 };

function endpoints(env) { return ENDPOINTS[env === 'produccion' ? 'produccion' : 'homologacion']; }

// ---------- Certificado ----------
function generateKeyAndCsr({ cuit, razonSocial }) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { shortName: 'C', value: 'AR' },
    { shortName: 'O', value: (razonSocial || 'Gestumio').slice(0, 60) },
    { shortName: 'CN', value: (razonSocial || 'gestumio').slice(0, 60).replace(/[^\w .-]/g, '') || 'gestumio' },
    { type: '2.5.4.5', value: 'CUIT ' + String(cuit || '').replace(/\D/g, '') },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());
  return {
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    csrPem: forge.pki.certificationRequestToPem(csr),
  };
}

// ---------- WSAA ----------
function isoOffset(d) {
  // Devuelve ISO8601 con offset -03:00 (hora Argentina)
  const pad = (n) => String(n).padStart(2, '0');
  const t = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}-03:00`;
}

function buildTRA(service) {
  const now = Date.now();
  const uniqueId = Math.floor(now / 1000);
  const gen = isoOffset(new Date(now - 10 * 60 * 1000));
  const exp = isoOffset(new Date(now + 10 * 60 * 1000));
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${uniqueId}</uniqueId><generationTime>${gen}</generationTime><expirationTime>${exp}</expirationTime>` +
    `</header><service>${service}</service></loginTicketRequest>`;
}

function signCMS(traXml, certPem, keyPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

function unescapeXml(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function pick(xml, tag) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i'));
  return m ? m[1] : null;
}
function pickAll(xml, tag) {
  const re = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'gi');
  const out = []; let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

async function callWSAA(env, cms) {
  const url = endpoints(env).wsaa;
  const body =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body,
  });
  const text = await res.text();
  const ret = pick(text, 'loginCmsReturn');
  if (!ret) {
    const fault = pick(text, 'faultstring') || 'Error de autenticación WSAA';
    throw new Error(unescapeXml(fault));
  }
  const ticket = unescapeXml(ret);
  const token = pick(ticket, 'token');
  const sign = pick(ticket, 'sign');
  const exp = pick(ticket, 'expirationTime');
  if (!token || !sign) throw new Error('WSAA no devolvió token/sign');
  return { token, sign, exp: exp ? new Date(exp) : new Date(Date.now() + 11 * 3600 * 1000) };
}

// Obtiene un TA válido (reutiliza el cacheado en el negocio si no venció)
async function getAuth(biz, prisma) {
  if (!biz.afipCertPem || !biz.afipKeyPem) throw new Error('Falta el certificado. Completá la configuración de AFIP.');
  const now = Date.now();
  if (biz.afipToken && biz.afipSign && biz.afipTokenExp && new Date(biz.afipTokenExp).getTime() > now + 10 * 60 * 1000) {
    return { token: biz.afipToken, sign: biz.afipSign };
  }
  const tra = buildTRA('wsfe');
  const cms = signCMS(tra, biz.afipCertPem, biz.afipKeyPem);
  const auth = await callWSAA(biz.afipEnv, cms);
  if (prisma) {
    await prisma.business.update({
      where: { id: biz.id },
      data: { afipToken: auth.token, afipSign: auth.sign, afipTokenExp: auth.exp },
    });
  }
  return { token: auth.token, sign: auth.sign };
}

// ---------- WSFEv1 ----------
async function wsfeCall(env, method, innerXml) {
  const url = endpoints(env).wsfe;
  const body =
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
    `<soap:Body>${innerXml}</soap:Body></soap:Envelope>`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `http://ar.gov.afip.dif.FEV1/${method}` },
    body,
  });
  return res.text();
}

function authXml(auth, cuit) {
  return `<ar:Auth><ar:Token>${auth.token}</ar:Token><ar:Sign>${auth.sign}</ar:Sign><ar:Cuit>${String(cuit).replace(/\D/g, '')}</ar:Cuit></ar:Auth>`;
}

async function ultimoAutorizado(env, auth, cuit, ptoVta, cbteTipo) {
  const inner = `<ar:FECompUltimoAutorizado>${authXml(auth, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`;
  const xml = await wsfeCall(env, 'FECompUltimoAutorizado', inner);
  const errs = pickAll(xml, 'Msg');
  const nro = pick(xml, 'CbteNro');
  if (nro == null) throw new Error(errs.join(' · ') || 'No se pudo obtener el último comprobante autorizado');
  return parseInt(nro, 10) || 0;
}

function fmt2(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
function ymd(d) { const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; }

// params: { tipo, ptoVta, cuit, docTipo, docNro, condicionIvaReceptorId, concepto, items:[{precio,cantidad,alicuota}] }
async function solicitarCAE(env, auth, params) {
  const cbteTipo = CBTE_TIPO[params.tipo];
  const ptoVta = parseInt(String(params.ptoVta).replace(/\D/g, ''), 10) || 1;
  const last = await ultimoAutorizado(env, auth, params.cuit, ptoVta, cbteTipo);
  const nro = last + 1;
  const isC = String(params.tipo).trim().slice(-1) === 'C';
  const hoy = new Date();
  const fch = ymd(hoy);

  // Cálculo de importes
  let impNeto = 0, impIVA = 0;
  const ivaGroups = {}; // alicuotaId -> {base, imp}
  for (const it of params.items) {
    const cant = Number(it.cantidad) || 1;
    const base = (Number(it.precio) || 0) * cant;
    if (isC) {
      impNeto += base;
    } else {
      const alic = Number(it.alicuota) || 0;
      const iva = base * (alic / 100);
      impNeto += base; impIVA += iva;
      const id = IVA_ID[alic] != null ? IVA_ID[alic] : 5;
      if (!ivaGroups[id]) ivaGroups[id] = { base: 0, imp: 0 };
      ivaGroups[id].base += base; ivaGroups[id].imp += iva;
    }
  }
  const impTotal = impNeto + impIVA;

  const concepto = params.concepto || 2; // 1=Productos 2=Servicios 3=Ambos
  const fechasServ = (concepto === 2 || concepto === 3)
    ? `<ar:FchServDesde>${fch}</ar:FchServDesde><ar:FchServHasta>${fch}</ar:FchServHasta><ar:FchVtoPago>${fch}</ar:FchVtoPago>`
    : '';

  let asocXml = '';
  if (Array.isArray(params.asociados) && params.asociados.length) {
    asocXml = '<ar:CbtesAsoc>' + params.asociados.map((a) =>
      `<ar:CbteAsoc><ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.ptoVta}</ar:PtoVta><ar:Nro>${a.nro}</ar:Nro><ar:Cuit>${String(a.cuit).replace(/\D/g, '')}</ar:Cuit></ar:CbteAsoc>`
    ).join('') + '</ar:CbtesAsoc>';
  }

  let ivaXml = '';
  if (!isC && Object.keys(ivaGroups).length) {
    ivaXml = '<ar:Iva>' + Object.entries(ivaGroups).map(([id, g]) =>
      `<ar:AlicIva><ar:Id>${id}</ar:Id><ar:BaseImp>${fmt2(g.base)}</ar:BaseImp><ar:Importe>${fmt2(g.imp)}</ar:Importe></ar:AlicIva>`
    ).join('') + '</ar:Iva>';
  }

  const det =
    `<ar:FECAEDetRequest>` +
    `<ar:Concepto>${concepto}</ar:Concepto>` +
    `<ar:DocTipo>${params.docTipo}</ar:DocTipo>` +
    `<ar:DocNro>${params.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${nro}</ar:CbteDesde><ar:CbteHasta>${nro}</ar:CbteHasta>` +
    `<ar:CbteFch>${fch}</ar:CbteFch>` +
    `<ar:ImpTotal>${fmt2(impTotal)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>0.00</ar:ImpTotConc>` +
    `<ar:ImpNeto>${fmt2(impNeto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0.00</ar:ImpOpEx>` +
    `<ar:ImpIVA>${fmt2(impIVA)}</ar:ImpIVA>` +
    `<ar:ImpTrib>0.00</ar:ImpTrib>` +
    fechasServ +
    `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${params.condicionIvaReceptorId || 5}</ar:CondicionIVAReceptorId>` +
    asocXml +
    ivaXml +
    `</ar:FECAEDetRequest>`;

  const inner =
    `<ar:FECAESolicitar>${authXml(auth, params.cuit)}<ar:FeCAEReq>` +
    `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq>${det}</ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`;

  const xml = await wsfeCall(env, 'FECAESolicitar', inner);
  const resultado = pick(xml, 'Resultado');
  const cae = pick(xml, 'CAE');
  const caeVto = pick(xml, 'CAEFchVto');
  const obs = pickAll(xml, 'Msg').filter(Boolean);

  return {
    resultado, cae: cae && cae !== '' ? cae : null,
    caeVto: caeVto || null, numero: nro, ptoVta, cbteTipo,
    impTotal, impNeto, impIVA, mensajes: obs,
  };
}

module.exports = {
  ENDPOINTS, CBTE_TIPO, endpoints,
  generateKeyAndCsr, getAuth, ultimoAutorizado, solicitarCAE, ymd,
};
