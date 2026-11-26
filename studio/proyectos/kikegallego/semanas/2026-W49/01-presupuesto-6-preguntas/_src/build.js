// Carrusel 01 · presupuesto-6-preguntas · acento «criterio»
// Uso: node build.js   (genera _src/NN.html y slides/NN.png)
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/repos/kigalcontent/studio/open-carrusel/node_modules/puppeteer');

const OUT = path.join(__dirname, '..', 'slides');
const MONO = 'file:///C:/repos/kigaldevWeb/public/brand/kigaldev-monogram-console.svg';

// [[texto]] = señal
const s = (t) => t.replace(/\[\[(.+?)\]\]/g, '<span class="sig">$1</span>');

const slides = [
  { cover: true,
    title: 'Antes de firmar el presupuesto de tu web',
    body: 'Hazte estas [[seis preguntas]]. La última va sobre el peor día.' },
  { label: '1 · Alcance', title: '¿Sabes qué estás comprando?',
    body: 'Que ponga, función por función o página por página, qué entra en el precio y [[qué queda fuera]].' },
  { label: '2 · Propiedad del código y de las cuentas', title: '¿Es tuyo de verdad?',
    body: 'El dominio y las cuentas (hosting, analítica, anuncios), [[a nombre de tu empresa]] y con un correo tuyo.' },
  { label: '3 · Mantenimiento', title: '¿Y después de entregarlo?',
    body: 'Lo que cuesta construirlo, separado de lo que costará mantenerlo [[cada mes]].' },
  { label: '4 · Plazos', title: '¿Cuándo, y qué pasa si no?',
    body: 'Una fecha de entrega o, al menos, un plazo [[por escrito]].' },
  { label: '5 · Dependencias', title: '¿Te ata a él?',
    body: 'Lo que te entregan, ¿podría mantenerlo [[otro proveedor]] o solo quien te lo hace?' },
  { label: '6 · Qué pasa si el proveedor desaparece', title: 'El peor día', small: true,
    body: 'Si mañana cierra o deja de contestar, ¿te quedas hoy mismo con una copia de todo lo pagado y con los [[accesos de administrador]]?',
    foot: 'Guárdalo para cuando te llegue el próximo presupuesto.',
    strip: ['Alcance', 'Propiedad', 'Mantenimiento', 'Plazos', 'Dependencias', 'El peor día'] },
  { title: '12 preguntas,<br>6 bloques,<br>sin jerga',
    body: 'El revisor te da un semáforo claro y qué preguntarle a tu proveedor. Escríbeme <span class="sig mono">PRESUPUESTO</span> por privado y te lo paso.' },
];

const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;background:#0B0D10}
.slide{width:1080px;height:1350px;padding:104px 96px 112px;display:flex;flex-direction:column;color:#EDEFF1;
  font-family:'IBM Plex Sans',sans-serif;-webkit-font-smoothing:antialiased}
.top{display:flex;justify-content:space-between;align-items:center;min-height:48px}
.label{font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:500;color:#B7BDC5;letter-spacing:.01em}
.logo{width:60px;height:48px;display:block;flex:none}
.main{flex:1;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:104px;line-height:1.02;letter-spacing:-.025em;margin-bottom:56px}
.cover h1{font-size:124px;line-height:.98}
.small h1{font-size:112px}
p.body{font-size:46px;line-height:1.32;color:#EDEFF1;max-width:860px}
.cover p.body{font-size:52px}
.small p.body{font-size:44px}
.sig{color:#28D9FF}
.mono{font-family:'IBM Plex Mono',monospace;font-weight:600;letter-spacing:.02em}
.foot{font-size:32px;line-height:1.35;color:#B7BDC5;margin-top:48px}
.strip{margin-top:auto;padding-top:34px;border-top:2px solid #262B33;font-family:'IBM Plex Mono',monospace;font-size:27px;color:#B7BDC5;line-height:1.7;display:flex;flex-wrap:wrap;max-width:820px}
.strip span{white-space:nowrap}
.strip .br{flex-basis:100%;height:0}
.strip b{font-weight:400;color:#5C636D;padding:0 14px}
`;

function html(sl) {
  const cls = ['slide', sl.cover ? 'cover' : '', sl.small ? 'small' : ''].join(' ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@600;700&display=block" rel="stylesheet">
<style>${css}</style></head><body><div class="${cls}">
<div class="top"><div class="label">${sl.label || ''}</div><img class="logo" src="${MONO}" alt="KG"></div>
<div class="main"><h1>${s(sl.title)}</h1><p class="body">${s(sl.body)}</p>${sl.foot ? `<p class="foot">${sl.foot}</p>` : ''}</div>
${sl.strip ? `<div class="strip">${sl.strip.map((x, i) => `<span>${x}${i < sl.strip.length - 1 && i !== 2 ? '<b>·</b>' : ''}</span>${i === 2 ? '<i class="br"></i>' : ''}`).join('')}</div>` : ''}
</div></body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  for (let i = 0; i < slides.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    const file = path.join(__dirname, `${n}.html`);
    fs.writeFileSync(file, html(slides[i]), 'utf8');
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const ok = ['700 100px "Space Grotesk"', '400 40px "IBM Plex Sans"', '600 30px "IBM Plex Mono"'].map((f) => document.fonts.check(f));
      const sl = document.querySelector('.slide');
      const over = [...sl.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > 1080 - 90 + 1 || r.bottom > 1350 - 100 + 1 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.className || e.tagName);
      const img = document.querySelector('.logo');
      return { fonts: ok, overflow: over, logo: img.complete && img.naturalWidth > 0, scroll: sl.scrollHeight };
    });
    console.log(n, JSON.stringify(report));
    await page.screenshot({ path: path.join(OUT, `${n}.png`), clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  }
  await browser.close();
})();
