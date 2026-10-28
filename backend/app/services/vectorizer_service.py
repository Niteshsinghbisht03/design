"""
Raster-to-Fillable-Line-Art Vectorizer Service
Transforms raster images (ceramic tiles, illustrations, or sketches) into
production-grade scalable SVG vector line art with:
1. Uniform-width black ink outlines (`#000000`, `fill-rule="evenodd"`).
2. Closed `#ffffff` vector regions tucked 2px beneath the black outlines for 1-click filling.
3. Optional 8-fold (D4) dihedral symmetry enforcement for square tiles.
"""

import cv2
import numpy as np


def enforce_d4_symmetry(arr: np.ndarray) -> np.ndarray:
    """Averages an image across all 8 dihedral (D4) symmetry transforms."""
    f = arr.astype(np.float32)
    h, w = f.shape[:2]
    if h != w:
        min_d = min(h, w)
        top = (h - min_d) // 2
        left = (w - min_d) // 2
        f = f[top : top + min_d, left : left + min_d]

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
    """Cleans a raw binary mask with morphology, smoothing, and connected components."""
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


def compute_smooth_inner_mask(
    outer_mask: np.ndarray,
    border_thickness: float = 10.0,
    blur_radius: int = 7,
    symmetric: bool = False,
) -> np.ndarray:
    """Distance transform on border-padded mask for uniform-width outline tucking."""
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
    """Converts mask contours into smooth Catmull-Rom cubic Bezier splines while keeping sharp corners."""
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
                t1 = np.zeros(2) if sharp1 else (p2 - p0) / 6.0
                t2 = np.zeros(2) if sharp2 else (p3 - p1) / 6.0
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


def analyze_image_properties(img_bgr: np.ndarray) -> dict:
    """
    Analyzes color saturation, 90th percentile saturation, and cross-channel RGB
    standard deviation to distinguish black & white line drawings / sketches from
    multi-colored ceramic tiles or photos.
    """
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    mean_sat = float(np.mean(sat))
    p90_sat = float(np.percentile(sat, 90))
    rgb_std = float(np.std(img_bgr.astype(np.float32), axis=2).mean())

    # Ceramic tile photos typically have mean_sat > 25 and p90_sat > 45,
    # while B&W scans/sketches have mean_sat < 5 and p90_sat < 15.
    is_colored = mean_sat > 14.0 or p90_sat > 35.0 or rgb_std > 8.0
    detected_mode = "colored" if is_colored else "lineart"
    suggested_symmetry = True if is_colored else False

    return {
        "detected_mode": detected_mode,
        "suggested_symmetry": suggested_symmetry,
        "mean_saturation": mean_sat,
        "p90_saturation": p90_sat,
        "rgb_channel_std": rgb_std,
    }


def vectorize_image_bytes(
    image_bytes: bytes,
    mode: str = "auto",
    symmetric: bool = None,
    canvas_size: int = 2048,
    tuck_px: int = 2,
) -> dict:
    """
    Main vectorizer entry point for FastAPI.
    Accepts raw image bytes, runs the vectorizer, and returns:
    {
      "svg": "<svg ...>...</svg>",
      "region_count": int,
      "mode": detected_or_requested_mode,
      "requested_mode": mode,
      "symmetric": bool,
      "width": canvas_size,
      "height": canvas_size
    }
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    color_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if color_img is None:
        raise ValueError("Could not decode image bytes")

    # Center crop to 1:1 square if rectangular
    h, w = color_img.shape[:2]
    if h != w:
        min_d = min(h, w)
        top = (h - min_d) // 2
        left = (w - min_d) // 2
        color_img = color_img[top : top + min_d, left : left + min_d]

    # Automatic mode and symmetry detection
    props = analyze_image_properties(color_img)
    effective_mode = props["detected_mode"] if mode == "auto" else mode
    if symmetric is None:
        effective_symmetric = props["suggested_symmetry"] if mode == "auto" else (True if effective_mode == "colored" else False)
    else:
        effective_symmetric = bool(symmetric)

    if effective_mode == "lineart":
        img = cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)

        ink_raw = 255 - img
        _, binary = cv2.threshold(ink_raw, 85, 255, cv2.THRESH_BINARY)

        num_l, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        clean_bin = np.zeros_like(binary)
        for i in range(1, num_l):
            if stats[i, cv2.CC_STAT_AREA] >= 35:
                clean_bin[labels == i] = 255

        inv_clean = 255 - clean_bin
        num_l2, labels2, stats2, _ = cv2.connectedComponentsWithStats(inv_clean, connectivity=8)
        for i in range(1, num_l2):
            if stats2[i, cv2.CC_STAT_AREA] < 25:
                clean_bin[labels2 == i] = 255

        mask_dilated = cv2.dilate(clean_bin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        ink_clean_gray = np.where(mask_dilated > 0, ink_raw, 0)
        upscaled = cv2.resize(ink_clean_gray, (canvas_size, canvas_size), interpolation=cv2.INTER_CUBIC)

        if effective_symmetric:
            upscaled = enforce_d4_symmetry(upscaled).astype(np.uint8)

        blur_ink = cv2.GaussianBlur(upscaled, (9, 9), 0)
        _, mask_ink = cv2.threshold(blur_ink, 100, 255, cv2.THRESH_BINARY)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask_ink = cv2.morphologyEx(mask_ink, cv2.MORPH_CLOSE, k)
        mask_ink = cv2.morphologyEx(mask_ink, cv2.MORPH_OPEN, k)
        mask_ink = cv2.GaussianBlur(mask_ink, (7, 7), 0)
        _, mask_ink = cv2.threshold(mask_ink, 127, 255, cv2.THRESH_BINARY)

        white_space = 255 - mask_ink
        num_w, labels_w, stats_w, _ = cv2.connectedComponentsWithStats(white_space, connectivity=4)

        k_tuck = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (tuck_px * 2 + 1, tuck_px * 2 + 1))
        fill_paths = []
        reg_idx = 1
        for i in range(1, num_w):
            area = stats_w[i, cv2.CC_STAT_AREA]
            if area < 500 or (stats_w[i, cv2.CC_STAT_LEFT] == 0 and stats_w[i, cv2.CC_STAT_TOP] == 0):
                continue
            reg_mask = ((labels_w == i) * 255).astype(np.uint8)
            reg_tucked = cv2.dilate(reg_mask, k_tuck)
            d_str = mask_to_bezier_svg_path(reg_tucked, approx_eps=1.6)
            if d_str:
                fill_paths.append(
                    f'    <path id="fill-region-{reg_idx:02d}" data-name="Region {reg_idx}" d="{d_str}" fill="#ffffff" />'
                )
                reg_idx += 1

        ink_d = mask_to_bezier_svg_path(mask_ink, approx_eps=1.6)

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_size} {canvas_size}" width="100%" height="100%">
  <title>Vectorized Fillable Line Art</title>
  <g id="fillable-color-regions">
{chr(10).join(fill_paths)}
  </g>
  <g id="ink-outlines" fill="#000000" fill-rule="evenodd">
    <path id="linework" d="{ink_d}" />
  </g>
</svg>"""

        return {
            "svg": svg,
            "region_count": len(fill_paths),
            "mode": "lineart",
            "requested_mode": mode,
            "symmetric": effective_symmetric,
            "width": canvas_size,
            "height": canvas_size,
        }

    else:
        # Mode B: Colored Ceramic Tile
        img = color_img

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)
        if effective_symmetric:
            rgb = enforce_d4_symmetry(rgb)

        rgb = cv2.resize(rgb, (canvas_size, canvas_size), interpolation=cv2.INTER_CUBIC)
        rgb_smooth = cv2.bilateralFilter(
            rgb.astype(np.uint8), d=15, sigmaColor=35, sigmaSpace=35
        ).astype(np.float32)

        R, G, B = rgb_smooth[:, :, 0], rgb_smooth[:, :, 1], rgb_smooth[:, :, 2]

        is_blue = (B > R - 3) & (R < 165)
        is_orange = (~is_blue) & ((R - G) > 29) & (G < 156)
        dist_beige = np.sqrt((R - 189) ** 2 + (G - 172) ** 2 + (B - 150) ** 2)
        dist_cream = np.sqrt((R - 224) ** 2 + (G - 214) ** 2 + (B - 201) ** 2)
        is_beige = (~is_blue) & (~is_orange) & (dist_beige < dist_cream - 2.0)

        beige_outer = clean_mask_pair(is_beige, symmetric=effective_symmetric, blur_r=13)
        orange_outer = clean_mask_pair(is_orange, symmetric=effective_symmetric, blur_r=9)
        blue_outer = clean_mask_pair(is_blue, symmetric=effective_symmetric, blur_r=9)

        border_thickness = 9.5
        beige_inner = compute_smooth_inner_mask(beige_outer, border_thickness=border_thickness, symmetric=effective_symmetric)
        orange_inner = compute_smooth_inner_mask(orange_outer, border_thickness=border_thickness - 0.5, symmetric=effective_symmetric)
        blue_inner = compute_smooth_inner_mask(blue_outer, border_thickness=border_thickness, symmetric=effective_symmetric)

        k_tuck = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (tuck_px * 2 + 1, tuck_px * 2 + 1))

        def extract_component_fills(inner_mask: np.ndarray, prefix: str) -> list:
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
                        f'    <path id="{prefix}-fill-{idx:02d}" data-name="{prefix.capitalize()} {idx}" d="{d_s}" fill="#ffffff" fill-rule="evenodd" />'
                    )
                    idx += 1
            return paths

        frame_fills = extract_component_fills(beige_inner, "frame")
        petal_fills = extract_component_fills(orange_inner, "petal")
        motif_fills = extract_component_fills(blue_inner, "motif")

        # Fallback to universal adaptive color/edge segmentation if specific ceramic palette returned no regions
        if len(frame_fills) + len(petal_fills) + len(motif_fills) == 0:
            gray = cv2.cvtColor(rgb_smooth.astype(np.uint8), cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 25, 80)
            if effective_symmetric:
                edges = ((enforce_d4_symmetry(edges) >= 30) * 255).astype(np.uint8)
            k_edge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            edges_dil = cv2.dilate(edges, k_edge)
            inv_edges = 255 - edges_dil
            num_c, l_c, st_c, _ = cv2.connectedComponentsWithStats(inv_edges, connectivity=4)
            for i in range(1, num_c):
                if st_c[i, cv2.CC_STAT_AREA] < 400:
                    continue
                comp = ((l_c == i) * 255).astype(np.uint8)
                comp_tuck = cv2.dilate(comp, k_tuck)
                d_s = mask_to_bezier_svg_path(comp_tuck, approx_eps=2.0)
                if d_s:
                    frame_fills.append(
                        f'    <path id="segment-fill-{len(frame_fills)+1:02d}" data-name="Segment {len(frame_fills)+1}" d="{d_s}" fill="#ffffff" fill-rule="evenodd" />'
                    )

            edge_outline_d = mask_to_bezier_svg_path(edges_dil, approx_eps=1.8)
            outlines_svg = f'    <path id="universal-outline" d="{edge_outline_d}" />'
        else:
            beige_outline = mask_to_bezier_svg_path(beige_outer, 2.2) + " " + mask_to_bezier_svg_path(beige_inner, 2.2)
            orange_outline = mask_to_bezier_svg_path(orange_outer, 2.0) + " " + mask_to_bezier_svg_path(orange_inner, 2.0)
            blue_outline = mask_to_bezier_svg_path(blue_outer, 2.0) + " " + mask_to_bezier_svg_path(blue_inner, 2.0)
            outlines_svg = f"""    <path id="frame-outline" d="{beige_outline}" />
    <path id="petals-outline" d="{orange_outline}" />
    <path id="motifs-outline" d="{blue_outline}" />"""

        fill_paths = [
            f'    <rect id="background-fill" data-name="Background" width="{canvas_size}" height="{canvas_size}" fill="#ffffff" />',
            *frame_fills,
            *petal_fills,
            *motif_fills,
        ]

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_size} {canvas_size}" width="100%" height="100%">
  <title>Vectorized Fillable Tile Pattern</title>
  <g id="fillable-color-regions">
{chr(10).join(fill_paths)}
  </g>
  <g id="tile-outlines" fill="#000000" fill-rule="evenodd">
{outlines_svg}
  </g>
</svg>"""

        return {
            "svg": svg,
            "region_count": len(fill_paths),
            "mode": "colored",
            "requested_mode": mode,
            "symmetric": effective_symmetric,
            "width": canvas_size,
            "height": canvas_size,
        }
