# -*- coding: utf-8 -*-
"""
Clean a SingleFile WeChat (mp.weixin.qq.com) article export
into one self-contained index.html (CSS inlined) + images/.

Usage:
  py clean.py [article_dir]

Options:
  --keep-meta      Keep 原创/作者/时间/地区 under title
  --keep-bottom    Keep bottom 赞/分享/推荐/写留言 bar
  --keep-album     Keep album 上一篇/下一篇 nav
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from html import escape
from pathlib import Path

from bs4 import BeautifulSoup, Comment

KEEP_CSS_SUBSTR = (
    "rich_media",
    "wx_wap",
    "wxw-img",
    "rich_pages",
    "autotypesetting",
    "list-paddingleft",
    "js_content",
    "js_title",
    "js_underline",
    "activity-name",
    "activity-detail",
    "pages_skin",
    "windows-title",
    "appmsg_content_new_ui",
    "appmsg_skin",
    "appmsg_style",
    "mm_appmsg",
    "not_in_mm",
    "__bg_gif",
    "img-content",
    "page-content",
    "js_article",
    "js_base_container",
    "rich_media_meta",
    "icon_appmsg_tag",
    "album_read",
    "bottom_bar",
    "sns_opr",
    "wx_follow",
    "interaction_bar",
    "stream_friends",
)

BARE_OK = re.compile(
    r"^(html|body|a|img|p|section|div|span|h1|ul|ol|li|strong|b|em|svg)(:[a-z-]+)?$",
    re.I,
)

DROP_ATTRS = {
    "reportloaderror",
    "data-src",
    "data-fail",
    "data-report-img-idx",
    "data-aistatus",
    "data-imgfileid",
    "data-backw",
    "data-backh",
    "data-index",
    "data-original-style",
    "data-lazy-bgimg",
    "data-ratio",
    "data-s",
    "data-type",
    "data-w",
    "wah-hotarea",
    "_width",
}


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Clean SingleFile WeChat article → one HTML")
    ap.add_argument("dir", nargs="?", default=".", help="Article folder (default: .)")
    ap.add_argument("--keep-meta", action="store_true")
    ap.add_argument("--keep-bottom", action="store_true")
    ap.add_argument("--keep-album", action="store_true")
    return ap.parse_args()


def split_rules(css: str) -> list[str]:
    rules, i, n = [], 0, len(css)
    while i < n:
        while i < n and css[i].isspace():
            i += 1
        if i >= n:
            break
        brace = css.find("{", i)
        if brace < 0:
            break
        depth, j = 0, brace
        while j < n:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        rules.append(css[i:j])
        i = j
    return rules


def sel_keep(sel: str, allow: tuple[str, ...]) -> bool:
    s = sel.strip()
    if not s:
        return False
    low = s.lower()
    if any(k in low for k in allow):
        return True
    if any(
        x in low
        for x in (
            "weui-dialog",
            "weui-half-screen",
            "popover",
            "reward",
            "emotion",
            "snackbar",
            "teleporter",
            "underline-edu",
            "mpda_",
            "keyboard",
        )
    ):
        return False
    if BARE_OK.match(s) or s.startswith(":root"):
        return True
    return False


def filter_css(css: str, allow: tuple[str, ...]) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    kept = []
    for rule in split_rules(css):
        rule = rule.strip()
        if not rule or "{" not in rule:
            continue
        if re.match(r"@keyframes\b", rule, re.I):
            continue
        if re.match(r"@font-face\b", rule, re.I):
            if "pingfang" in rule.lower():
                kept.append(rule)
            continue
        if re.match(r"@(media|supports)\b", rule, re.I):
            m = re.match(r"(@(?:media|supports)[^{]+)\{(.*)\}\s*$", rule, re.S | re.I)
            if not m:
                continue
            inner = []
            for sub in split_rules(m.group(2)):
                if "{" not in sub:
                    continue
                sel, _, body = sub.partition("{")
                goods = [x.strip() for x in sel.split(",") if sel_keep(x, allow)]
                if goods:
                    inner.append(", ".join(goods) + " {" + body)
            if inner:
                kept.append(m.group(1) + "{\n" + "\n".join(inner) + "\n}")
            continue
        sel, _, body = rule.partition("{")
        goods = [x.strip() for x in sel.split(",") if sel_keep(x, allow)]
        if goods:
            kept.append(", ".join(goods) + " {" + body)
    return re.sub(r"\n{3,}", "\n\n", "\n\n".join(kept) + "\n")


def fix_css_urls_for_html_root(css: str) -> str:
    """Rewrite urls that assumed css/ subfolder so they work from index.html."""
    css = re.sub(r'url\(\s*["\']?\.\./images/', 'url("images/', css)
    css = re.sub(r"url\(\s*['\"]?\.\./images/", 'url("images/', css)
    return css


def is_hidden(el) -> bool:
    style = (el.get("style") or "").replace(" ", "").lower()
    classes = el.get("class") or []
    if "sf-hidden" in classes:
        return True
    if "display:none" in style:
        return True
    if "visibility:hidden" in style:
        return True
    return False


def clean_style(style: str | None) -> str | None:
    if not style:
        return None
    parts = []
    for decl in style.split(";"):
        decl = decl.strip()
        if not decl or ":" not in decl:
            continue
        prop, _, val = decl.partition(":")
        prop, val = prop.strip().lower(), val.strip()
        if prop == "visibility" and val.lower().replace(" ", "").startswith("visible"):
            continue
        parts.append(f"{prop}: {val}")
    return "; ".join(parts) if parts else None


def strip_attrs(el) -> None:
    for name in list(el.attrs):
        lname = name.lower()
        if lname in DROP_ATTRS or lname.startswith("data-v-"):
            del el.attrs[name]
            continue
        if lname == "style":
            cleaned = clean_style(str(el.attrs[name]))
            if cleaned is None:
                del el.attrs[name]
            else:
                el.attrs[name] = cleaned
        if lname in {"leaf", "nodeleaf", "textstyle"}:
            del el.attrs[name]


def remove_chrome(soup: BeautifulSoup, args: argparse.Namespace) -> None:
    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()

    kill_ids = {
        "js_fullscreen_layout_padding",
        "js_top_ad_area",
        "js_novel_card",
        "js_profile_card",
        "audio_panel_area",
        "js_profile_card_modal",
        "js_emotion_panel_pc",
        "js_alert_panel",
        "js_pc_weapp_code",
        "js_minipro_dialog",
        "js_link_dialog",
        "js_product_dialog",
        "js_analyze_btn",
        "js_jump_wx_qrcode_dialog",
        "js_related_news_flow_area",
        "content_bottom_area",
    }
    if not args.keep_bottom:
        kill_ids.add("unlogin_bottom_bar")
        kill_ids.add("js_article_bottom_bar")

    for el in list(soup.find_all(True)):
        if getattr(el, "decomposed", False):
            continue
        eid = el.get("id")
        classes = " ".join(el.get("class") or [])
        try:
            if eid in kill_ids:
                el.decompose()
                continue
            if not args.keep_album and "album_read" in classes:
                el.decompose()
                continue
            if not args.keep_meta and eid == "meta_content":
                el.decompose()
                continue
            if is_hidden(el):
                el.decompose()
                continue
            if "weui-a11y_ref" in classes or "wx-root" in classes or "teleporter" in classes:
                el.decompose()
                continue
        except Exception:
            pass

    for el in soup.find_all(True):
        strip_attrs(el)


def collect_css(root: Path, soup: BeautifulSoup) -> str:
    chunks = []
    seen = set()
    for link in soup.find_all("link", href=True):
        rel = link.get("rel")
        rel_s = " ".join(rel) if isinstance(rel, list) else str(rel or "")
        if "stylesheet" not in rel_s.lower():
            continue
        path = (root / link["href"]).resolve()
        if path.exists() and path.suffix.lower() == ".css" and path not in seen:
            chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
            seen.add(path)
    css_dir = root / "css"
    extras = list(root.glob("stylesheet_*.css"))
    if css_dir.exists():
        extras += list(css_dir.glob("stylesheet_*.css"))
        article = css_dir / "article.css"
        if article.exists() and not chunks:
            extras.append(article)
    for path in extras:
        path = path.resolve()
        if path not in seen and path.exists():
            chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
            seen.add(path)
    for style in soup.find_all("style"):
        chunks.append(style.get_text() or "")
    return "\n\n".join(chunks)


def used_image_names(html: str) -> set[str]:
    names = set()
    for m in re.finditer(r"""(?:src|href)=["']([^"']+)["']""", html, re.I):
        p = m.group(1).replace("\\", "/")
        if "images/" in p or p.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico")):
            names.add(Path(p).name)
    for m in re.finditer(r"""url\(["']?([^)"']+)["']?\)""", html):
        p = m.group(1).replace("\\", "/")
        if "images/" in p:
            names.add(Path(p).name)
    return names


def build_one_html(
    title: str,
    description: str,
    css: str,
    header_html: str,
    content_html: str,
    body_class: str,
    has_favicon: bool,
) -> str:
    favicon = ""
    if has_favicon:
        favicon = '  <link rel="shortcut icon" type="image/x-icon" href="images/11.png"/>\n'
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover"/>
  <meta name="description" content="{escape(description, quote=True)}"/>
  <meta name="referrer" content="no-referrer"/>
  <title>{escape(title)}</title>
{favicon}  <style>
{css}
  </style>
</head>
<body class="{body_class}" id="activity-detail">
  <div class="rich_media" id="js_article">
    <div class="rich_media_inner" id="js_base_container">
      <div class="rich_media_area_primary" id="page-content">
        <div class="rich_media_area_primary_inner">
          <div class="rich_media_wrp" id="img-content">
{header_html}
{content_html}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""


def main() -> None:
    args = parse_args()
    root = Path(args.dir).resolve()
    index = root / "index.html"
    if not index.exists():
        raise SystemExit(f"No index.html in {root}")

    raw = index.read_text(encoding="utf-8", errors="ignore")
    bak = root / "index.html.bak"
    if not bak.exists():
        bak.write_text(raw, encoding="utf-8")
        print("Backup → index.html.bak")

    soup = BeautifulSoup(raw, "lxml")
    css_raw = collect_css(root, soup)
    remove_chrome(soup, args)

    title_el = soup.find(id="activity-name") or soup.find("h1")
    title = (
        title_el.get_text(strip=True)
        if title_el
        else (soup.title.string if soup.title else "article")
    )
    desc_meta = soup.find("meta", attrs={"name": "description"})
    description = desc_meta.get("content", "") if desc_meta else ""

    header_parts = []
    if title_el:
        header_parts.append(str(title_el))
    if args.keep_meta:
        meta = soup.find(id="meta_content")
        if meta:
            header_parts.append(str(meta))
    header_html = "\n".join(header_parts)

    content_el = soup.find(id="js_content")
    if not content_el:
        raise SystemExit("Missing #js_content — not a WeChat article export?")
    content_html = str(content_el)

    allow = list(KEEP_CSS_SUBSTR)
    if not args.keep_meta:
        allow = [x for x in allow if x not in ("rich_media_meta", "icon_appmsg_tag")]
    if not args.keep_album:
        allow = [x for x in allow if x != "album_read"]
    if not args.keep_bottom:
        allow = [
            x
            for x in allow
            if x
            not in ("bottom_bar", "sns_opr", "wx_follow", "interaction_bar", "stream_friends")
        ]

    article_css = fix_css_urls_for_html_root(filter_css(css_raw, tuple(allow)))

    body_class = (
        "zh_CN wx_wap_page wx_wap_desktop_fontsize_2 mm_appmsg "
        "appmsg_skin_default appmsg_style_default pages_skin_pc pages_skin_windows "
        "windows-title-bold appmsg_content_new_ui wx_wap_page_primary not_in_mm"
    )
    has_favicon = (root / "images" / "11.png").exists()

    html = build_one_html(
        title, description, article_css, header_html, content_html, body_class, has_favicon
    )
    index.write_text(html, encoding="utf-8")
    print(f"Wrote index.html ({len(html):,} chars, CSS inlined)")

    # remove modular leftovers
    for name in ("build.py", "partials", "css"):
        p = root / name
        if p.is_file():
            p.unlink()
            print("Removed", name)
        elif p.is_dir():
            shutil.rmtree(p)
            print("Removed", name + "/")
    for p in list(root.glob("stylesheet_*.css")) + list(root.glob("styles-common.css")):
        p.unlink()
        print("Removed", p.name)

    # prune unused images
    used = used_image_names(html)
    used.add("11.png")
    img_dir = root / "images"
    removed = 0
    if img_dir.exists():
        for p in list(img_dir.rglob("*")):
            if p.is_file() and p.name not in used:
                p.unlink()
                removed += 1
        for d in sorted(img_dir.rglob("*"), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    if removed:
        print("Removed unused images:", removed)

    # slim manifest
    man = root / "manifest.json"
    if man.exists():
        try:
            data = json.loads(man.read_text(encoding="utf-8"))
            res = {
                k: v
                for k, v in data.get("resources", {}).items()
                if k.startswith("images/") and (root / k).exists()
            }
            data["resources"] = res
            data["indexFilename"] = "index.html"
            man.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass

    total = sum(p.stat().st_size for p in root.rglob("*") if p.is_file() and p.name != "index.html.bak")
    gifs = list(img_dir.glob("*.gif")) if img_dir.exists() else []
    print(f"Done. Folder size ≈ {total/1024/1024:.1f} MB (excl. .bak)")
    if gifs:
        print(f"Note: {len(gifs)} GIF(s) ≈ {sum(p.stat().st_size for p in gifs)/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
