#!/usr/bin/env python3
"""
Raster-to-Fillable-Line-Art SVG Vectorizer
==========================================
Converts raster images (colored ceramic tiles, illustrations, or black-and-white
line drawings) into clean, scalable SVG vector graphics with:
1. Smooth, uniform-width black ink outlines (`#000000`, `fill-rule="evenodd"`).
2. Pre-segmented, closed white-filled vector regions (`#ffffff`) tucked 2px
   beneath the black outlines so every individual leaf, petal, or frame can be
   recolored with a single click in Canva, Illustrator, Figma, or Inkscape.

Dependencies:
    pip install opencv-python numpy
"""

import argparse
import os
import cv2
import numpy as np


def enforce_d4_symmetry(arr: np.ndarray) -> np.ndarray:
    """
    Averages an image or mask across all 8 dihedral (D4) symmetry transforms
    (4 rotations x 2 reflections) for symmetric square tile patterns.
    """
    f = arr.astype(np.float32)
    t = np.transpose(f, (1, 0, 2)) if f.ndim == 3 else np.transpose(f, (1, 0))
    sym = (
        f
        + np.fliplr(f)
        + np.flipud(f)
        + np.flipud(np.fliplr(f))
        + t
        + np.fliplr(t)
        + np.flipud(t)
        + np.flipud(np.fliplr(t))
    ) / 8.0
    return sym


def clean_binary_mask(
    mask_bool: np.ndarray,
    open_radius: int = 3,
    close_radius: int = 5,
    min_area: int = 500,
    blur_radius: int = 7,
    symmetric: bool = False,
) -> np.ndarray:
    """
    Cleans a raw binary mask using morphological opening/closing, Gaussian
    level-set smoothing, optional 8-fold symmetry enforcement, and small-speck
    removal.
    """
    m = (mask_bool.astype(np.uint8)) * 255
    if open_radius > 0:
        k_open = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (open_radius * 2 + 1, open_radius * 2 + 1)
        )
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k_open)
    if close_radius > 0:
        k_close = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (close_radius * 2 + 1, close_radius * 2 + 1)
        )
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k_close)
    if blur_radius > 0:
        m = cv2.GaussianBlur(m, (blur_radius * 2 + 1, blur_radius * 2 + 1), 0)
        _, m = cv2.threshold(m, 127, 255, cv2.THRESH_BINARY)
    if symmetric:
        m = ((enforce_d4_symmetry(m) >= 127.5) * 255).astype(np.uint8)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = np.zeros_like(m)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            out[labels == i] = 255
    return out


def compute_smooth_inner_mask(
    outer_mask: np.ndarray,
    border_thickness: float = 10.0,
    blur_radius: int = 7,
    symmetric: bool = False,
) -> np.ndarray:
    """
    Computes the inner fill boundary of a shape by running an L2 Euclidean
    distance transform on a border-padded mask. Padding with 255 ensures that
    shapes clipped by the canvas edge remain open along the canvas boundary
    while maintaining a uniform outline thickness everywhere inside the canvas.
    """
    h, w = outer_mask.shape
    pad = int(border_thickness * 2.5) + 10
    padded = cv2.copyMakeBorder(
        outer_mask, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255
    )
    dist_padded = cv2.distanceTransform(padded, cv2.DIST_L2, 5)
    dist = dist_padded[pad : pad + h, pad : pad + w]
    inner = ((dist > border_thickness) * 255).astype(np.uint8)
    if blur_radius > 0:
        inner = cv2.GaussianBlur(
            inner, (blur_radius * 2 + 1, blur_radius * 2 + 1), 0
        )
        _, inner = cv2.threshold(inner, 127, 255, cv2.THRESH_BINARY)
    if symmetric:
        inner = ((enforce_d4_symmetry(inner) >= 127.5) * 255).astype(np.uint8)
    return inner


def mask_to_bezier_svg_path(
    mask: np.ndarray,
    approx_eps: float = 1.8,
    corner_angle_deg: float = 35.0,
    min_contour_area: float = 40.0,
) -> str:
    """
    Traces binary mask contours and converts polygon vertices into smooth
    Catmull-Rom cubic Bezier splines (`C` commands) while preserving crisp
    geometric corners (`L` commands) where the turning angle exceeds
    `corner_angle_deg`.
    """
    h, w = mask.shape
    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return ""

    path_parts = []
    for cnt in contours:
        if cv2.contourArea(cnt) < min_contour_area:
            continue
        approx = cv2.approxPolyDP(cnt, approx_eps, True)[:, 0, :].astype(np.float64)
        n = len(approx)
        if n < 3:
            continue

        def is_sharp_vertex(pa: np.ndarray, pb: np.ndarray, pc: np.ndarray) -> bool:
            # Keep vertices on the canvas boundary sharp
            if pb[0] <= 1 or pb[0] >= w - 2 or pb[1] <= 1 or pb[1] >= h - 2:
                return True
            v1 = pb - pa
            v2 = pc - pb
            n1 = np.linalg.norm(v1)
            n2 = np.linalg.norm(v2)
            if n1 < 1e-3 or n2 < 1e-3:
                return True
            cos_ang = np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0)
            ang = np.degrees(np.arccos(cos_ang))
            return ang > corner_angle_deg

        d_cmds = [f"M {approx[0][0]:.1f} {approx[0][1]:.1f}"]
        for i in range(n):
            p0 = approx[(i - 1) % n]
            p1 = approx[i]
            p2 = approx[(i + 1) % n]
            p3 = approx[(i + 2) % n]

            sharp1 = is_sharp_vertex(p0, p1, p2)
            sharp2 = is_sharp_vertex(p1, p2, p3)
            seg_len = np.linalg.norm(p2 - p1)

            if (sharp1 and sharp2) or seg_len < 3.0:
                d_cmds.append(f"L {p2[0]:.1f} {p2[1]:.1f}")
            else:
                # Catmull-Rom tangent vectors
                t1 = np.zeros(2) if sharp1 else (p2 - p0) / 6.0
                t2 = np.zeros(2) if sharp2 else (p3 - p1) / 6.0
                # Clamp tangent magnitude to prevent self-intersecting loops
                max_t = seg_len * 0.35
                if np.linalg.norm(t1) > max_t:
                    t1 = t1 / np.linalg.norm(t1) * max_t
                if np.linalg.norm(t2) > max_t:
                    t2 = t2 / np.linalg.norm(t2) * max_t

                c1 = p1 + t1
                c2 = p2 - t2
                d_cmds.append(
                    f"C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}"
                )

        d_cmds.append("Z")
        path_parts.append(" ".join(d_cmds))

    return " ".join(path_parts)


def vectorize_line_drawing_to_svg(
    img_path: str,
    svg_out_path: str,
    canvas_size: int = 2048,
    tuck_px: int = 2,
) -> None:
    """
    Mode A: Converts a black-and-white line drawing into a clean SVG with
    individual white-filled `<path>` regions tucked beneath the black linework.
    """
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {img_path}")

    # 1. Invert so black ink is foreground (255) and paper is background (0)
    ink_raw = 255 - img
    _, binary = cv2.threshold(ink_raw, 85, 255, cv2.THRESH_BINARY)

    # 2. Remove isolated scan dust specks and fill tiny pinholes inside ink lines
    num_l, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    clean_bin = np.zeros_like(binary)
    for i in range(1, num_l):
        if stats[i, cv2.CC_STAT_AREA] >= 35:
            clean_bin[labels == i] = 255

    inv_clean = 255 - clean_bin
    num_l2, labels2, stats2, _ = cv2.connectedComponentsWithStats(
        inv_clean, connectivity=8
    )
    for i in range(1, num_l2):
        if stats2[i, cv2.CC_STAT_AREA] < 25:
            clean_bin[labels2 == i] = 255

    # 3. Upscale to high-resolution canvas and smooth pixel staircase
    mask_dilated = cv2.dilate(
        clean_bin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )
    ink_clean_gray = np.where(mask_dilated > 0, ink_raw, 0)
    upscaled = cv2.resize(
        ink_clean_gray, (canvas_size, canvas_size), interpolation=cv2.INTER_CUBIC
    )

    blur_ink = cv2.GaussianBlur(upscaled, (9, 9), 0)
    _, mask_ink = cv2.threshold(blur_ink, 100, 255, cv2.THRESH_BINARY)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask_ink = cv2.morphologyEx(mask_ink, cv2.MORPH_CLOSE, k)
    mask_ink = cv2.morphologyEx(mask_ink, cv2.MORPH_OPEN, k)
    mask_ink = cv2.GaussianBlur(mask_ink, (7, 7), 0)
    _, mask_ink = cv2.threshold(mask_ink, 127, 255, cv2.THRESH_BINARY)

    # 4. Extract enclosed white regions via connected components on (255 - mask_ink)
    white_space = 255 - mask_ink
    num_w, labels_w, stats_w, _ = cv2.connectedComponentsWithStats(
        white_space, connectivity=4
    )

    k_tuck = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (tuck_px * 2 + 1, tuck_px * 2 + 1)
    )
    fill_paths = []
    reg_idx = 1
    for i in range(1, num_w):
        area = stats_w[i, cv2.CC_STAT_AREA]
        # Skip tiny specks or full-bleed outer margin (if it touches 0,0)
        if area < 500 or (
            stats_w[i, cv2.CC_STAT_LEFT] == 0 and stats_w[i, cv2.CC_STAT_TOP] == 0
        ):
            continue
        reg_mask = ((labels_w == i) * 255).astype(np.uint8)
        # Dilate by `tuck_px` so the fill tucks seamlessly under the black ink line
        reg_tucked = cv2.dilate(reg_mask, k_tuck)
        d_str = mask_to_bezier_svg_path(reg_tucked, approx_eps=1.6)
        if d_str:
            fill_paths.append(
                f'    <path id="fill-region-{reg_idx:02d}" d="{d_str}" fill="#ffffff" />'
            )
            reg_idx += 1

    # 5. Trace the master black ink outline
    ink_d = mask_to_bezier_svg_path(mask_ink, approx_eps=1.6)

    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_size} {canvas_size}" width="100%" height="100%">',
        "  <title>Vectorized Fillable Line Art</title>",
        '  <g id="fillable-color-regions">',
        *fill_paths,
        "  </g>",
        '  <g id="ink-outlines" fill="#000000" fill-rule="evenodd">',
        f'    <path id="linework" d="{ink_d}" />',
        "  </g>",
        "</svg>",
    ]
    with open(svg_out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(svg_lines))


def vectorize_colored_tile_to_svg(
    img_path: str,
    svg_out_path: str,
    canvas_size: int = 2048,
    symmetric: bool = True,
    border_thickness: float = 9.5,
    tuck_px: int = 2,
) -> None:
    """
    Mode B: Converts a colored ceramic tile / flat illustration into a colorless
    outline SVG with pre-segmented white-filled interior paths beneath the outlines.
    """
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {img_path}")

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)
    if symmetric:
        rgb = enforce_d4_symmetry(rgb)

    rgb = cv2.resize(rgb, (canvas_size, canvas_size), interpolation=cv2.INTER_CUBIC)
    # Edge-preserving bilateral filter removes stone/glaze texture while keeping sharp borders
    rgb_smooth = cv2.bilateralFilter(
        rgb.astype(np.uint8), d=15, sigmaColor=35, sigmaSpace=35
    ).astype(np.float32)

    R, G, B = rgb_smooth[:, :, 0], rgb_smooth[:, :, 1], rgb_smooth[:, :, 2]

    # Segment semantic color families (customizable or replaceable with K-Means)
    is_blue = (B > R - 3) & (R < 165)
    is_orange = (~is_blue) & ((R - G) > 29) & (G < 156)
    dist_beige = np.sqrt((R - 189) ** 2 + (G - 172) ** 2 + (B - 150) ** 2)
    dist_cream = np.sqrt((R - 224) ** 2 + (G - 214) ** 2 + (B - 201) ** 2)
    is_beige = (~is_blue) & (~is_orange) & (dist_beige < dist_cream - 2.0)

    beige_outer = clean_mask_pair(is_beige, symmetric=symmetric, blur_r=13)
    orange_outer = clean_mask_pair(is_orange, symmetric=symmetric, blur_r=9)
    blue_outer = clean_mask_pair(is_blue, symmetric=symmetric, blur_r=9)

    beige_inner = compute_smooth_inner_mask(
        beige_outer, border_thickness=border_thickness, symmetric=symmetric
    )
    orange_inner = compute_smooth_inner_mask(
        orange_outer, border_thickness=border_thickness - 0.5, symmetric=symmetric
    )
    blue_inner = compute_smooth_inner_mask(
        blue_outer, border_thickness=border_thickness, symmetric=symmetric
    )

    k_tuck = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (tuck_px * 2 + 1, tuck_px * 2 + 1)
    )

    def extract_component_fills(inner_mask: np.ndarray, prefix: str) -> list[str]:
        tucked = cv2.dilate(inner_mask, k_tuck)
        num_c, l_c, st_c, _ = cv2.connectedComponentsWithStats(tucked, connectivity=8)
        paths = []
        idx = 1
        for i in range(1, num_c):
            if st_c[i, cv2.CC_STAT_AREA] < 300:
                continue
            comp = ((l_c == i) * 255).astype(np.uint8)
            d_s = mask_to_bezier_svg_path(comp, approx_eps=2.0)
            if d_s:
                paths.append(
                    f'    <path id="{prefix}-fill-{idx:02d}" d="{d_s}" fill="#ffffff" fill-rule="evenodd" />'
                )
                idx += 1
        return paths

    fill_paths = [
        f'    <rect id="background-fill" width="{canvas_size}" height="{canvas_size}" fill="#ffffff" />',
        *extract_component_fills(beige_inner, "frame"),
        *extract_component_fills(orange_inner, "petal"),
        *extract_component_fills(blue_inner, "motif"),
    ]

    # Compound outline paths (outer + inner with fill-rule="evenodd" punches out the interior)
    beige_outline = (
        mask_to_bezier_svg_path(beige_outer, 2.2)
        + " "
        + mask_to_bezier_svg_path(beige_inner, 2.2)
    )
    orange_outline = (
        mask_to_bezier_svg_path(orange_outer, 2.0)
        + " "
        + mask_to_bezier_svg_path(orange_inner, 2.0)
    )
    blue_outline = (
        mask_to_bezier_svg_path(blue_outer, 2.0)
        + " "
        + mask_to_bezier_svg_path(blue_inner, 2.0)
    )

    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_size} {canvas_size}" width="100%" height="100%">',
        "  <title>Vectorized Fillable Tile Pattern</title>",
        '  <g id="fillable-color-regions">',
        *fill_paths,
        "  </g>",
        '  <g id="tile-outlines" fill="#000000" fill-rule="evenodd">',
        f'    <path id="frame-outline" d="{beige_outline}" />',
        f'    <path id="petals-outline" d="{orange_outline}" />',
        f'    <path id="motifs-outline" d="{blue_outline}" />',
        "  </g>",
        "</svg>",
    ]
    with open(svg_out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(svg_lines))


def clean_mask_pair(
    mask_bool: np.ndarray, symmetric: bool = True, blur_r: int = 9
) -> np.ndarray:
    return clean_binary_mask(
        mask_bool,
        open_radius=3,
        close_radius=5,
        min_area=800,
        blur_radius=blur_r,
        symmetric=symmetric,
    )


def start_server(port: int = 5050):
    """
    Runs a lightweight HTTP server enabling Tile Design Studio web UI to
    vectorize raster tiles on-the-fly.
    """
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import urllib.parse
    import tempfile

    class VectorizerHandler(BaseHTTPRequestHandler):
        def _set_headers(self, content_type="application/json", status=200):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.end_headers()

        def do_OPTIONS(self):
            self._set_headers(status=204)

        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path in ["/", "/health"]:
                self._set_headers("application/json")
                self.wfile.write(b'{"status": "ok", "service": "Tile Vectorizer API"}')
            else:
                self._set_headers(status=404)
                self.wfile.write(b'{"error": "Not found"}')

        def do_POST(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/vectorize":
                params = urllib.parse.parse_qs(parsed.query)
                mode = params.get("mode", ["lineart"])[0]
                symmetric = params.get("symmetric", ["false"])[0].lower() in ["true", "1", "yes"]

                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)

                if not body:
                    self._set_headers(status=400)
                    self.wfile.write(b'{"error": "Empty body"}')
                    return

                # Write to temp image
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
                    tmp_in.write(body)
                    tmp_in_path = tmp_in.name

                with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as tmp_out:
                    tmp_out_path = tmp_out.name

                try:
                    if mode == "lineart":
                        vectorize_line_drawing_to_svg(tmp_in_path, tmp_out_path)
                    else:
                        vectorize_colored_tile_to_svg(tmp_in_path, tmp_out_path, symmetric=symmetric)

                    with open(tmp_out_path, "r", encoding="utf-8") as f:
                        svg_content = f.read()

                    self._set_headers(content_type="image/svg+xml", status=200)
                    self.wfile.write(svg_content.encode("utf-8"))
                except Exception as e:
                    self._set_headers(content_type="application/json", status=500)
                    self.wfile.write(f'{{"error": "{str(e)}"}}'.encode("utf-8"))
                finally:
                    if os.path.exists(tmp_in_path):
                        os.unlink(tmp_in_path)
                    if os.path.exists(tmp_out_path):
                        os.unlink(tmp_out_path)
            else:
                self._set_headers(status=404)
                self.wfile.write(b'{"error": "Unknown endpoint"}')

        def log_message(self, format, *args):
            print(f"[Vectorizer Server] {self.address_string()} - {args[0]}")

    server = HTTPServer(("127.0.0.1", port), VectorizerHandler)
    print(f"=======================================================")
    print(f" Tile Vectorizer Server running at http://127.0.0.1:{port}/")
    print(f" Ready to vectorize raster tiles from Tile Design Studio")
    print(f" Press Ctrl+C to stop.")
    print(f"=======================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Vectorizer Server.")
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert raster tile patterns or line art into color-fillable SVGs."
    )
    parser.add_argument("input", nargs="?", default=None, help="Path to input raster image (PNG/JPEG)")
    parser.add_argument("output", nargs="?", default=None, help="Path to output SVG file")
    parser.add_argument(
        "--mode",
        choices=["lineart", "colored"],
        default="lineart",
        help="Use 'lineart' for B&W drawings or 'colored' for colored tiles",
    )
    parser.add_argument(
        "--symmetric",
        action="store_true",
        help="Enforce 8-fold dihedral (D4) symmetry for square tiles",
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Start local web vectorizer API server on port 5050",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5050,
        help="Port for local API server (default: 5050)",
    )
    args = parser.parse_args()

    if args.serve:
        start_server(port=args.port)
    elif args.input and args.output:
        if args.mode == "lineart":
            vectorize_line_drawing_to_svg(args.input, args.output)
        else:
            vectorize_colored_tile_to_svg(
                args.input, args.output, symmetric=args.symmetric
            )
        print(f"Successfully generated fillable SVG: {args.output}")
    else:
        parser.print_help()

