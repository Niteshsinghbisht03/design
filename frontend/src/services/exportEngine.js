/**
 * Export Engine for Tile Design Studio
 * Handles High-Res Client Spec Sheet PNG generation and 1024x1024 Seamless 3D Diffuse Texture Maps.
 * Inlines JPEG/PNG textures as Base64 data URLs to prevent HTML5 canvas CORS taint.
 */

export function fetchImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width || 300;
        c.height = img.naturalHeight || img.height || 300;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        console.warn("Canvas taint fallback:", err);
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

export async function getUsedMaterialsBase64Map(fills, materials, tab = 'p', centerFillActive = false, centerFillColor = null) {
  const map = {};
  const usedIndices = new Set(Object.values(fills || {}));
  if (tab === "b" && centerFillActive && centerFillColor != null) {
    usedIndices.add(centerFillColor);
  }
  for (const idx of usedIndices) {
    const m = materials[idx];
    if (m && !m.isColor && !map[m.id]) {
      const srcUrl = m.file.startsWith('/') ? m.file : `/static/materials/${m.file}`;
      map[m.id] = await fetchImageAsBase64(srcUrl);
    }
  }
  return map;
}

export function buildSvgDefs(materials, isExport = false, base64Map = {}) {
  if (!materials || !materials.length) return '<defs></defs>';
  return `<defs>` + materials.map(m => {
    if (m.isColor) {
      return `<pattern id="${m.id}" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="${m.file}"/>
      </pattern>`;
    }
    const resolvedUrl = m.file.startsWith('/') ? m.file : `/static/materials/${m.file}`;
    const src = isExport && base64Map[m.id] ? base64Map[m.id] : resolvedUrl;
    return `<pattern id="${m.id}" width="100" height="100" patternUnits="userSpaceOnUse">
      <image href="${src}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>
    </pattern>`;
  }).join("") + `</defs>`;
}

export function getFillOf(matIndex, materials) {
  if (matIndex == null) return "#f4ece3";
  const m = materials && materials[matIndex];
  if (!m) return "#ffffff";
  return `url(#${m.id})`;
}

export function buildTileInnerSvg(pattern, fills, materials, asOutline = false) {
  if (!pattern || !pattern.r) return "";
  let inner = pattern.r.map((r, i) =>
    r.e.map(([d, t]) =>
      `<path data-r="${i}" d="${d}"${t ? ` transform="${t}"` : ""}
        fill="${asOutline ? "none" : getFillOf(fills[i], materials)}"
        stroke="${pattern.outline ? "none" : (asOutline ? "currentColor" : "#24201d")}"
        stroke-width="${asOutline ? 1.6 : 0.6}"
        stroke-linejoin="round"
        fill-rule="evenodd" />`
    ).join("")
  ).join("");

  if (pattern.outline) {
    inner += `<path d="${pattern.outline.d}"${pattern.outline.transform ? ` transform="${pattern.outline.transform}"` : ""} fill="${asOutline ? "currentColor" : "#000000"}" fill-rule="evenodd" pointer-events="none" />`;
  }
  return inner;
}

export function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to render SVG to image: " + err));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

export function sanitizeFileName(str) {
  return (str || "tile_design").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
}

export function generateWhatsAppLink({ brand = "Tile Design Studio", pattern, fills, materials, clientName, roomArea }) {
  const patName = pattern ? (pattern.name || pattern.id) : "Tile Pattern";
  const areaText = roomArea ? `\nRoom/Area: ${roomArea}` : "";
  const clientText = clientName ? `\nClient/Project: ${clientName}` : "";

  const matSummary = pattern && pattern.r
    ? pattern.r
        .map((r, i) => (fills[i] != null && materials[fills[i]]) ? `${r.n}: ${materials[fills[i]].name}` : null)
        .filter(Boolean)
        .join(", ")
    : "";

  const text = `*${brand} — Tile Specification*\nPattern: ${patName} (250x250x22mm)${areaText}${clientText}\n\n*Applied Material Textures:*\n${matSummary || "Default textures"}\n\nGenerated with Tile Design Studio Pro`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function exportClientSpecPng({ pattern, fills, materials, clientName, roomArea, tileRotation = 0, altRotation = false, groutColor = "#e2dbd2", tab = 'p', centerFillActive = false, centerFillColor = null, brandName = "Tile Studio Pro" }) {
  const W = 1200, H = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Canvas Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header Brand Strip
  ctx.fillStyle = "#24201d";
  ctx.font = "bold 34px 'Fraunces', serif, Georgia";
  ctx.fillText(brandName, 60, 80);

  ctx.fillStyle = "#756a61";
  ctx.font = "18px 'Inter', sans-serif, Arial";
  ctx.fillText("Production Specification & Client Presentation Sheet", 60, 114);

  // Metadata Box
  ctx.fillStyle = "#faf7f2";
  ctx.fillRect(60, 140, W - 120, 100);
  ctx.strokeStyle = "#e5dbd0";
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 140, W - 120, 100);

  ctx.fillStyle = "#24201d";
  ctx.font = "600 16px 'Inter', sans-serif, Arial";
  ctx.fillText(`Design: ${pattern.name || pattern.id} (${pattern.id})`, 85, 178);
  ctx.fillText(`Dimensions: 250 × 250 × 22 mm`, 85, 212);

  const proj = clientName || "General Specification";
  const area = roomArea || "Floor Installation";
  ctx.fillText(`Project: ${proj}`, 650, 178);
  ctx.fillText(`Area: ${area}`, 650, 212);

  // Pre-fetch Base64 image data for self-contained SVG export
  const base64Map = await getUsedMaterialsBase64Map(fills, materials, tab, centerFillActive, centerFillColor);
  const defsString = buildSvgDefs(materials, true, base64Map);
  const tileInner = buildTileInnerSvg(pattern, fills, materials, false);

  const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defsString}${tileInner}</svg>`;

  let repeatSvg = "";
  if (tab === "p") {
    let items = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        let rot = tileRotation;
        if (altRotation && (x + y) % 2 === 1) {
          rot = (rot + 90) % 360;
        }
        items.push(`<g transform="translate(${x * 100} ${y * 100}) rotate(${rot} 50 50)"><use href="#tg"/></g>`);
      }
    }
    repeatSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${defsString}<defs><g id="tg">${tileInner}</g></defs><rect width="400" height="400" fill="${groutColor}"/>${items.join("")}</svg>`;
  } else {
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">${defsString}<defs><g id="bu">${tileInner}</g></defs><rect width="600" height="600" fill="${centerFillActive ? getFillOf(centerFillColor, materials) : "#ffffff"}"/>`;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const x = c * 100, y = r * 100;
        let angle = null;
        if (r === 0) angle = 0;
        else if (r === 5) angle = 180;
        else if (c === 5) angle = 90;
        else if (c === 0) angle = 270;

        if (angle === null) {
          s += `<rect x="${x}" y="${y}" width="100" height="100" fill="${centerFillActive ? getFillOf(centerFillColor, materials) : "#f4f6f8"}" stroke="#e0e4e8" stroke-width="1"/>`;
        } else {
          s += `<use href="#bu" transform="translate(${x} ${y}) rotate(${angle} 50 50)"/>`;
        }
      }
    }
    s += `</svg>`;
    repeatSvg = s;
  }

  const [tileImg, repeatImg] = await Promise.all([
    svgToImage(tileSvg),
    svgToImage(repeatSvg)
  ]);

  // Draw 1x1 Tile Specimen
  ctx.fillStyle = "#24201d";
  ctx.font = "600 20px 'Fraunces', serif, Georgia";
  ctx.fillText("1. Single Tile Specimen (250 × 250 mm)", 60, 285);
  ctx.drawImage(tileImg, 60, 305, 480, 480);
  ctx.strokeStyle = "#e5dbd0";
  ctx.strokeRect(60, 305, 480, 480);

  // Draw 4x4 Repeat Visual
  ctx.fillText("2. Floor Repeat Installation (4 × 4)", 580, 285);
  ctx.drawImage(repeatImg, 580, 305, 560, 560);
  ctx.strokeRect(580, 305, 560, 560);

  // Material Specification Table
  ctx.fillText("3. Applied Material Textures & Finishes", 60, 835);
  let tableY = 870;

  for (let idx = 0; idx < pattern.r.length; idx++) {
    const r = pattern.r[idx];
    const mi = fills[idx];
    const m = mi != null ? materials[mi] : null;
    const mName = m ? m.name : "White (Unfilled)";

    // Swatch box
    if (m && base64Map[m.id]) {
      try {
        const thumbImg = await svgToImage(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><image href="${base64Map[m.id]}" width="30" height="30" preserveAspectRatio="xMidYMid slice"/></svg>`);
        ctx.drawImage(thumbImg, 60, tableY, 28, 28);
      } catch (e) {
        ctx.fillStyle = "#f4ece3";
        ctx.fillRect(60, tableY, 28, 28);
      }
    } else if (m && m.isColor) {
      ctx.fillStyle = m.file;
      ctx.fillRect(60, tableY, 28, 28);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(60, tableY, 28, 28);
    }

    ctx.strokeStyle = "#24201d";
    ctx.lineWidth = 1;
    ctx.strokeRect(60, tableY, 28, 28);

    ctx.fillStyle = "#24201d";
    ctx.font = "600 16px 'Inter', sans-serif";
    ctx.fillText(`${r.n}:`, 105, tableY + 20);

    ctx.fillStyle = "#756a61";
    ctx.font = "16px 'Inter', sans-serif";
    ctx.fillText(`${mName}${m ? ` [${m.file}]` : ""}`, 240, tableY + 20);

    tableY += 40;
  }

  // Footer Disclaimer
  ctx.fillStyle = "#a39587";
  ctx.font = "14px 'Inter', sans-serif";
  ctx.fillText("Material textures are authentic physical scans. Natural organic stone and terrazzo variations occur. Made with Tile Studio Pro.", 60, H - 40);

  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      downloadBlob(blob, `${pattern.id}-${sanitizeFileName(proj)}-spec.png`);
      resolve(true);
    }, "image/png");
  });
}

export async function export3dTextureMap({ pattern, fills, materials }) {
  const S = 1024;
  const base64Map = await getUsedMaterialsBase64Map(fills, materials);
  const defsString = buildSvgDefs(materials, true, base64Map);
  const tileInner = buildTileInnerSvg(pattern, fills, materials, false);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    ${defsString}
    <defs><g id="u">${tileInner}</g></defs>
    <use href="#u" transform="translate(0 0)"/>
    <use href="#u" transform="translate(100 0)"/>
    <use href="#u" transform="translate(0 100)"/>
    <use href="#u" transform="translate(100 100)"/>
  </svg>`;

  const img = await svgToImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, S, S);

  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      downloadBlob(blob, `${pattern.id}-seamless-texture-1024.png`);
      resolve(true);
    }, "image/png");
  });
}

