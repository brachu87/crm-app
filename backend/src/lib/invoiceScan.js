// Lectura de facturas de compra con IA (Groq). Foto -> visión (Llama 4 Scout); PDF -> texto.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const PROMPT = `Sos un asistente que extrae datos de facturas de compra argentinas (AFIP/ARCA).
Devolvé SOLO un objeto JSON (sin texto adicional) con estas claves:
{
 "proveedor": "razón social o nombre del emisor, o null",
 "cuit": "CUIT del emisor solo números, o null",
 "fecha": "fecha de emisión en formato dd/mm/aaaa, o null",
 "tipo": "A, B, C, M o null",
 "numero": "número de comprobante ej 0001-00000123, o null",
 "neto": "importe neto gravado como número, o null",
 "noGravado": "importe no gravado o exento como número, o null",
 "ivaAlicuota": "alícuota de IVA principal en porcentaje (21, 10.5, 27, 0), o null",
 "iva": "total de IVA (crédito fiscal) como número, o null",
 "percepIva": "percepciones de IVA como número, o null",
 "percepIIBB": "percepciones de Ingresos Brutos como número, o null",
 "otrosTrib": "otros tributos/impuestos internos como número, o null",
 "total": "importe total como número, o null",
 "condicionIvaProveedor": "condición IVA del emisor: RI, Monotributo, Exento o Consumidor Final, o null",
 "categoria": "rubro sugerido del gasto: Alquiler, Servicios, Mercadería, Mantenimiento, Marketing, Equipamiento, Limpieza, Impuestos u Otro"
}
Usá punto decimal en los números, sin símbolos ni separadores de miles. Si un dato no aparece, poné null. Respondé en JSON.`;

async function callGroq(messages, model) {
  if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY');
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0, response_format: { type: 'json_object' }, max_tokens: 900 }),
  });
  if (!r.ok) { const t = await r.text(); console.error('[invoiceScan groq]', r.status, t.slice(0, 300)); throw new Error('El servicio de IA no está disponible (' + r.status + ')'); }
  const j = await r.json();
  const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '{}';
  try { return JSON.parse(content); } catch (e) { return {}; }
}

async function extractFromImage(dataUrl) {
  return callGroq([{
    role: 'user',
    content: [
      { type: 'text', text: PROMPT },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }], VISION_MODEL);
}

async function extractFromText(text) {
  return callGroq([
    { role: 'system', content: PROMPT },
    { role: 'user', content: 'Texto extraído de la factura:\n\n' + String(text).slice(0, 6000) },
  ], TEXT_MODEL);
}

module.exports = { extractFromImage, extractFromText };
