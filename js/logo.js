// Logo da Defesa Civil.
// Para usar a logo OFICIAL: salve o arquivo como  img/logo-defesa-civil.png  (de preferência
// quadrado, com fundo transparente, 512×512 ou maior). Ela passa a aparecer automaticamente
// na tela inicial, no menu em VR e no piso do lobby.
// Enquanto o arquivo não existir, é desenhado o emblema internacional da defesa civil
// (triângulo azul sobre fundo laranja).

export const LOGO_URL = 'img/logo-defesa-civil.png';

/** Desenha o emblema internacional de defesa civil num canvas quadrado. */
export function drawEmblem(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = size / 2;
  // anel branco + círculo laranja
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r, r, r * 0.98, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(r * 0.8, r * 0.7, r * 0.1, r, r, r * 0.9);
  grad.addColorStop(0, '#fb923c');
  grad.addColorStop(1, '#ea580c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  // triângulo equilátero azul
  const side = r * 1.2;
  const h = (side * Math.sqrt(3)) / 2;
  const cy = r + h * 0.06;
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.moveTo(r, cy - (h * 2) / 3);
  ctx.lineTo(r + side / 2, cy + h / 3);
  ctx.lineTo(r - side / 2, cy + h / 3);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  return c;
}

let logoPromise = null;

/** Retorna um canvas quadrado com a logo (oficial, se existir; senão o emblema). */
export function getLogo(size = 512) {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const s = Math.min(size / img.width, size / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      c.userData = { official: true };
      resolve(c);
    };
    img.onerror = () => resolve(drawEmblem(size));
    img.src = LOGO_URL;
  });
  return logoPromise;
}
