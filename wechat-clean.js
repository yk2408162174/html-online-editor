/*!
 * WeChat SingleFile article cleaner (browser port of scripts/clean.py)
 * Exposes window.WechatClean
 */
(() => {
  "use strict";

  const KEEP_CSS_SUBSTR = [
    "rich_media", "wx_wap", "wxw-img", "rich_pages", "autotypesetting",
    "list-paddingleft", "js_content", "js_title", "js_underline",
    "activity-name", "activity-detail", "pages_skin", "windows-title",
    "appmsg_content_new_ui", "appmsg_skin", "appmsg_style", "mm_appmsg",
    "not_in_mm", "__bg_gif", "img-content", "page-content", "js_article",
    "js_base_container", "rich_media_meta", "icon_appmsg_tag", "album_read",
    "bottom_bar", "sns_opr", "wx_follow", "interaction_bar", "stream_friends",
  ];

  const BARE_OK = /^(html|body|a|img|p|section|div|span|h1|ul|ol|li|strong|b|em|svg)(:[a-z-]+)?$/i;

  const DROP_ATTRS = new Set([
    "reportloaderror", "data-src", "data-fail", "data-report-img-idx",
    "data-aistatus", "data-imgfileid", "data-backw", "data-backh", "data-index",
    "data-original-style", "data-lazy-bgimg", "data-ratio", "data-s", "data-type",
    "data-w", "wah-hotarea", "_width",
  ]);

  const BODY_CLASS =
    "zh_CN wx_wap_page wx_wap_desktop_fontsize_2 mm_appmsg " +
    "appmsg_skin_default appmsg_style_default pages_skin_pc pages_skin_windows " +
    "windows-title-bold appmsg_content_new_ui wx_wap_page_primary not_in_mm";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function splitRules(css) {
    const rules = [];
    let i = 0;
    const n = css.length;
    while (i < n) {
      while (i < n && /\s/.test(css[i])) i++;
      if (i >= n) break;
      const brace = css.indexOf("{", i);
      if (brace < 0) break;
      let depth = 0, j = brace;
      while (j < n) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") {
          depth--;
          if (depth === 0) { j++; break; }
        }
        j++;
      }
      rules.push(css.slice(i, j));
      i = j;
    }
    return rules;
  }

  function selKeep(sel, allow) {
    const s = sel.trim();
    if (!s) return false;
    const low = s.toLowerCase();
    if (allow.some(k => low.includes(k))) return true;
    if (["weui-dialog", "weui-half-screen", "popover", "reward", "emotion",
         "snackbar", "teleporter", "underline-edu", "mpda_", "keyboard"]
        .some(x => low.includes(x))) return false;
    if (BARE_OK.test(s) || s.startsWith(":root")) return true;
    return false;
  }

  function filterCss(css, allow) {
    css = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const kept = [];
    for (let rule of splitRules(css)) {
      rule = rule.trim();
      if (!rule || !rule.includes("{")) continue;
      if (/^@keyframes\b/i.test(rule)) continue;
      if (/^@font-face\b/i.test(rule)) {
        if (rule.toLowerCase().includes("pingfang")) kept.push(rule);
        continue;
      }
      if (/^@(media|supports)\b/i.test(rule)) {
        const m = rule.match(/^(@(?:media|supports)[^{]+)\{([\s\S]*)\}\s*$/i);
        if (!m) continue;
        const inner = [];
        for (const sub of splitRules(m[2])) {
          if (!sub.includes("{")) continue;
          const bi = sub.indexOf("{");
          const sel = sub.slice(0, bi);
          const body = sub.slice(bi + 1);
          const goods = sel.split(",").map(x => x.trim()).filter(x => selKeep(x, allow));
          if (goods.length) inner.push(goods.join(", ") + " {" + body);
        }
        if (inner.length) kept.push(m[1] + "{\n" + inner.join("\n") + "\n}");
        continue;
      }
      const bi = rule.indexOf("{");
      const sel = rule.slice(0, bi);
      const body = rule.slice(bi + 1);
      const goods = sel.split(",").map(x => x.trim()).filter(x => selKeep(x, allow));
      if (goods.length) kept.push(goods.join(", ") + " {" + body);
    }
    return (kept.join("\n\n") + "\n").replace(/\n{3,}/g, "\n\n");
  }

  function fixCssUrls(css) {
    return css
      .replace(/url\(\s*["']?\.\.\/images\//gi, 'url("images/')
      .replace(/url\(\s*['"]?\.\.\/images\//gi, 'url("images/');
  }

  function isHidden(el) {
    const style = (el.getAttribute("style") || "").replace(/\s/g, "").toLowerCase();
    const classes = el.className && typeof el.className === "string" ? el.className : "";
    if (classes.split(/\s+/).includes("sf-hidden")) return true;
    if (style.includes("display:none")) return true;
    if (style.includes("visibility:hidden")) return true;
    return false;
  }

  function cleanStyle(style) {
    if (!style) return null;
    const parts = [];
    for (const decl of style.split(";")) {
      const d = decl.trim();
      if (!d || !d.includes(":")) continue;
      const ci = d.indexOf(":");
      const prop = d.slice(0, ci).trim().toLowerCase();
      const val = d.slice(ci + 1).trim();
      if (prop === "visibility" && val.toLowerCase().replace(/\s/g, "").startsWith("visible")) continue;
      parts.push(prop + ": " + val);
    }
    return parts.length ? parts.join("; ") : null;
  }

  function stripAttrs(el) {
    const names = Array.from(el.attributes).map(a => a.name);
    for (const name of names) {
      const lname = name.toLowerCase();
      if (DROP_ATTRS.has(lname) || lname.startsWith("data-v-")) {
        el.removeAttribute(name);
        continue;
      }
      if (lname === "style") {
        const cleaned = cleanStyle(el.getAttribute(name));
        if (cleaned == null) el.removeAttribute(name);
        else el.setAttribute(name, cleaned);
      }
      if (lname === "leaf" || lname === "nodeleaf" || lname === "textstyle") {
        el.removeAttribute(name);
      }
    }
  }

  function removeChrome(doc, opts) {
    const killIds = new Set([
      "js_fullscreen_layout_padding", "js_top_ad_area", "js_novel_card",
      "js_profile_card", "audio_panel_area", "js_profile_card_modal",
      "js_emotion_panel_pc", "js_alert_panel", "js_pc_weapp_code",
      "js_minipro_dialog", "js_link_dialog", "js_product_dialog",
      "js_analyze_btn", "js_jump_wx_qrcode_dialog", "js_related_news_flow_area",
      "content_bottom_area",
    ]);
    if (!opts.keepBottom) {
      killIds.add("unlogin_bottom_bar");
      killIds.add("js_article_bottom_bar");
    }

    // comments
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(c => c.remove());

    const all = Array.from(doc.querySelectorAll("*"));
    for (const el of all) {
      if (!el.isConnected) continue;
      const eid = el.id || "";
      const classes = typeof el.className === "string" ? el.className : "";
      try {
        if (killIds.has(eid)) { el.remove(); continue; }
        if (!opts.keepAlbum && classes.includes("album_read")) { el.remove(); continue; }
        if (!opts.keepMeta && eid === "meta_content") { el.remove(); continue; }
        if (isHidden(el)) { el.remove(); continue; }
        if (classes.includes("weui-a11y_ref") || classes.includes("wx-root") || classes.includes("teleporter")) {
          el.remove();
          continue;
        }
      } catch (_) { /* ignore */ }
    }

    doc.querySelectorAll("*").forEach(stripAttrs);
  }

  function collectCssFromDoc(doc) {
    const chunks = [];
    doc.querySelectorAll("style").forEach(s => chunks.push(s.textContent || ""));
    return chunks.join("\n\n");
  }

  function allowList(opts) {
    let allow = KEEP_CSS_SUBSTR.slice();
    if (!opts.keepMeta) {
      allow = allow.filter(x => x !== "rich_media_meta" && x !== "icon_appmsg_tag");
    }
    if (!opts.keepAlbum) allow = allow.filter(x => x !== "album_read");
    if (!opts.keepBottom) {
      allow = allow.filter(x =>
        !["bottom_bar", "sns_opr", "wx_follow", "interaction_bar", "stream_friends"].includes(x)
      );
    }
    return allow;
  }

  function buildOneHtml({ title, description, css, headerHtml, contentHtml, hasFavicon }) {
    const favicon = hasFavicon
      ? '  <link rel="shortcut icon" type="image/x-icon" href="images/11.png"/>\n'
      : "";
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover"/>
  <meta name="description" content="${escapeHtml(description)}"/>
  <meta name="referrer" content="no-referrer"/>
  <title>${escapeHtml(title)}</title>
${favicon}  <style>
${css}
  </style>
</head>
<body class="${BODY_CLASS}" id="activity-detail">
  <div class="rich_media" id="js_article">
    <div class="rich_media_inner" id="js_base_container">
      <div class="rich_media_area_primary" id="page-content">
        <div class="rich_media_area_primary_inner">
          <div class="rich_media_wrp" id="img-content">
${headerHtml}
${contentHtml}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Clean a WeChat article HTML string (SingleFile / already extracted).
   * @param {string} html
   * @param {{ keepMeta?: boolean, keepBottom?: boolean, keepAlbum?: boolean, extraCss?: string, hasFavicon?: boolean }} opts
   * @returns {{ html: string, title: string }}
   */
  function cleanHtml(html, opts = {}) {
    const options = {
      keepMeta: !!opts.keepMeta,
      keepBottom: !!opts.keepBottom,
      keepAlbum: !!opts.keepAlbum,
    };
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let cssRaw = collectCssFromDoc(doc);
    if (opts.extraCss) cssRaw = (cssRaw ? cssRaw + "\n\n" : "") + opts.extraCss;

    removeChrome(doc, options);

    const titleEl = doc.getElementById("activity-name") || doc.querySelector("h1");
    const title = (titleEl && titleEl.textContent.trim())
      || (doc.querySelector("title") && doc.querySelector("title").textContent.trim())
      || "article";
    const descMeta = doc.querySelector('meta[name="description"]');
    const description = descMeta ? (descMeta.getAttribute("content") || "") : "";

    const headerParts = [];
    if (titleEl) headerParts.push(titleEl.outerHTML);
    if (options.keepMeta) {
      const meta = doc.getElementById("meta_content");
      if (meta) headerParts.push(meta.outerHTML);
    }
    const headerHtml = headerParts.join("\n");

    const contentEl = doc.getElementById("js_content");
    if (!contentEl) {
      throw new Error("未找到 #js_content，可能不是微信公众号导出页");
    }
    const contentHtml = contentEl.outerHTML;

    const articleCss = fixCssUrls(filterCss(cssRaw, allowList(options)));
    const out = buildOneHtml({
      title,
      description,
      css: articleCss,
      headerHtml,
      contentHtml,
      hasFavicon: !!opts.hasFavicon,
    });
    return { html: out, title };
  }

  function usedImageNames(html) {
    const names = new Set();
    const re1 = /(?:src|href)=["']([^"']+)["']/gi;
    let m;
    while ((m = re1.exec(html))) {
      const p = m[1].replace(/\\/g, "/");
      if (p.includes("images/") || /\.(png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(p)) {
        names.add(p.split("/").pop().split("?")[0]);
      }
    }
    const re2 = /url\(["']?([^)"']+)["']?\)/gi;
    while ((m = re2.exec(html))) {
      const p = m[1].replace(/\\/g, "/");
      if (p.includes("images/")) names.add(p.split("/").pop().split("?")[0]);
    }
    return names;
  }

  async function readTextFile(handle) {
    const file = await handle.getFile();
    return file.text();
  }

  async function writeTextFile(dirHandle, name, text) {
    const fh = await dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  async function collectCssFromDir(dirHandle, doc) {
    const chunks = [];
    const seen = new Set();

    const tryRead = async (name) => {
      try {
        const fh = await dirHandle.getFileHandle(name);
        if (seen.has(name)) return;
        seen.add(name);
        chunks.push(await readTextFile(fh));
      } catch (_) { /* missing */ }
    };

    for (const link of doc.querySelectorAll("link[href]")) {
      const rel = (link.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("stylesheet")) continue;
      const href = link.getAttribute("href") || "";
      const base = href.replace(/^\.\//, "").split("/").pop();
      if (base && base.endsWith(".css")) await tryRead(href.includes("/") ? href.split("/").pop() : href);
    }

    // stylesheet_*.css in root
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file" && /^stylesheet_.*\.css$/i.test(entry.name)) {
        await tryRead(entry.name);
      }
      if (entry.kind === "file" && entry.name === "styles-common.css") {
        await tryRead(entry.name);
      }
    }

    // css/ subfolder
    try {
      const cssDir = await dirHandle.getDirectoryHandle("css");
      for await (const entry of cssDir.values()) {
        if (entry.kind === "file" && entry.name.endsWith(".css")) {
          if (seen.has("css/" + entry.name)) continue;
          seen.add("css/" + entry.name);
          chunks.push(await readTextFile(entry));
        }
      }
    } catch (_) { /* no css/ */ }

    // 内联 <style> 由 cleanHtml 自行收集，这里只补外部 CSS
    return chunks.join("\n\n");
  }

  async function pruneImages(dirHandle, html) {
    const used = usedImageNames(html);
    used.add("11.png");
    let removed = 0;
    try {
      const imgDir = await dirHandle.getDirectoryHandle("images");
      for await (const entry of imgDir.values()) {
        if (entry.kind === "file" && !used.has(entry.name)) {
          await imgDir.removeEntry(entry.name);
          removed++;
        }
      }
    } catch (_) { /* no images */ }
    return removed;
  }

  async function removeLeftovers(dirHandle) {
    const removed = [];
    for (const name of ["build.py", "styles-common.css"]) {
      try {
        await dirHandle.removeEntry(name);
        removed.push(name);
      } catch (_) {}
    }
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file" && /^stylesheet_.*\.css$/i.test(entry.name)) {
        try {
          await dirHandle.removeEntry(entry.name);
          removed.push(entry.name);
        } catch (_) {}
      }
    }
    for (const name of ["partials", "css"]) {
      try {
        await dirHandle.removeEntry(name, { recursive: true });
        removed.push(name + "/");
      } catch (_) {}
    }
    return removed;
  }

  /**
   * Clean a WeChat article folder via File System Access API.
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {object} opts
   */
  async function cleanDirectory(dirHandle, opts = {}) {
    const indexHandle = await dirHandle.getFileHandle("index.html");
    const raw = await readTextFile(indexHandle);

    // backup once
    try {
      await dirHandle.getFileHandle("index.html.bak");
    } catch (_) {
      await writeTextFile(dirHandle, "index.html.bak", raw);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    const extraCss = await collectCssFromDir(dirHandle, doc);

    let hasFavicon = false;
    try {
      const imgDir = await dirHandle.getDirectoryHandle("images");
      await imgDir.getFileHandle("11.png");
      hasFavicon = true;
    } catch (_) {}

    // Re-parse with merged CSS path: strip styles from doc then cleanHtml with extraCss
    // removeChrome mutates — start from raw again
    const { html, title } = cleanHtml(raw, {
      ...opts,
      extraCss,
      hasFavicon,
    });

    await writeTextFile(dirHandle, "index.html", html);
    const leftovers = await removeLeftovers(dirHandle);
    const imagesRemoved = await pruneImages(dirHandle, html);

    // slim manifest if present
    try {
      const man = await dirHandle.getFileHandle("manifest.json");
      const data = JSON.parse(await readTextFile(man));
      const res = {};
      for (const [k, v] of Object.entries(data.resources || {})) {
        if (!k.startsWith("images/")) continue;
        try {
          const imgDir = await dirHandle.getDirectoryHandle("images");
          await imgDir.getFileHandle(k.slice("images/".length));
          res[k] = v;
        } catch (_) {}
      }
      data.resources = res;
      data.indexFilename = "index.html";
      await writeTextFile(dirHandle, "manifest.json", JSON.stringify(data, null, 2) + "\n");
    } catch (_) {}

    return {
      html,
      title,
      leftovers,
      imagesRemoved,
      chars: html.length,
    };
  }

  function isWechatHtml(html) {
    return /id=["']js_content["']/i.test(html) || /id=["']activity-name["']/i.test(html);
  }

  window.WechatClean = {
    cleanHtml,
    cleanDirectory,
    isWechatHtml,
    usedImageNames,
  };
})();
