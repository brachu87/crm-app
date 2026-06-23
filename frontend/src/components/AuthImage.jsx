import { useState, useEffect } from 'react';
import api from '../api/client';

// Carga una imagen protegida usando el header Authorization (axios),
// sin exponer el token JWT en la URL. Muestra `fallback` si no hay imagen.
export default function AuthImage({ path, alt = '', style, className, fallback = null, cacheKey }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    setFailed(false);
    setSrc(null);
    api.get(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, cacheKey]);

  if (failed || !src) return fallback;
  return <img src={src} alt={alt} style={style} className={className} />;
}
