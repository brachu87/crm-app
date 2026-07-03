// Modal de confirmación estilizado (reemplaza al confirm() nativo del navegador).
// Uso:  if (!(await confirmDialog('¿Eliminar esto?'))) return;
// Devuelve una Promise<boolean>.
export default function confirmDialog(message, opts = {}) {
  const {
    title = 'Confirmar',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = true,
  } = opts;

  return new Promise((resolve) => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      animation: 'gzConfirmFade .12s ease-out',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#ffffff', borderRadius: '14px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      width: '100%', maxWidth: '400px', overflow: 'hidden',
      fontFamily: 'inherit',
      animation: 'gzConfirmPop .14s ease-out',
    });

    const body = document.createElement('div');
    Object.assign(body.style, { padding: '22px 22px 8px 22px' });
    const h = document.createElement('div');
    h.textContent = title;
    Object.assign(h.style, { fontSize: '17px', fontWeight: '700', color: '#1E2A38', marginBottom: '8px' });
    const p = document.createElement('div');
    p.textContent = message;
    Object.assign(p.style, { fontSize: '14px', color: '#475569', lineHeight: '1.5' });
    body.appendChild(h); body.appendChild(p);

    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 22px 20px 22px',
    });

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = cancelText;
    Object.assign(btnCancel.style, {
      padding: '9px 16px', borderRadius: '9px', border: '1px solid #d1d5db',
      background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    });

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.textContent = confirmText;
    Object.assign(btnOk.style, {
      padding: '9px 16px', borderRadius: '9px', border: 'none',
      background: danger ? '#dc2626' : '#1E2A38', color: '#fff',
      fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    });

    footer.appendChild(btnCancel); footer.appendChild(btnOk);
    card.appendChild(body); card.appendChild(footer);
    overlay.appendChild(card);

    let styleEl = document.getElementById('gz-confirm-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'gz-confirm-style';
      styleEl.textContent =
        '@keyframes gzConfirmFade{from{opacity:0}to{opacity:1}}' +
        '@keyframes gzConfirmPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}';
      document.head.appendChild(styleEl);
    }

    function cleanup(result) {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    }

    btnCancel.addEventListener('click', () => cleanup(false));
    btnOk.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    setTimeout(() => btnOk.focus(), 0);
  });
}
