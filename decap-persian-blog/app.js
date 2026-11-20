/* منطق مشترک وبلاگ: خواندن فهرست، پارس front matter و نمایش Markdown */

const BLOG_INDEX_URL = "content/blog/posts.json";
const BLOG_DIRECTORY = "content/blog/";

function parseMarkdownFile(rawText) {
  const match = rawText.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);

  if (!match) {
    throw new Error("ساختار front matter این مقاله معتبر نیست.");
  }

  const yamlText = match[1];
  const body = match[2].trim();
  const data = window.jsyaml.load(yamlText) || {};

  return {
    title: String(data.title || "بدون عنوان"),
    date: data.date || "",
    cover: data.cover || "",
    excerpt: data.excerpt || "",
    body
  };
}

async function fetchPostIndex() {
  const response = await fetch(BLOG_INDEX_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("فهرست مقالات دریافت نشد.");
  return response.json();
}

async function fetchPost(slug) {
  const response = await fetch(`${BLOG_DIRECTORY}${encodeURIComponent(slug)}.md`, { cache: "no-store" });
  if (!response.ok) throw new Error("مقاله موردنظر پیدا نشد.");
  const rawText = await response.text();
  return { ...parseMarkdownFile(rawText), slug };
}

function formatPersianDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "long", day: "numeric"
  }).format(date);
}

function safeMarkdown(markdown) {
  const html = window.marked.parse(markdown || "");
  return window.DOMPurify.sanitize(html);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function renderPostCard(post) {
  const image = post.cover
    ? `<img class="post-cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="lazy">`
    : `<div class="post-cover-placeholder" aria-hidden="true"></div>`;

  return `
    <article class="post-card">
      <a href="article.html?slug=${encodeURIComponent(post.slug)}">
        ${image}
        <div class="post-card-content">
          <span class="post-date">${escapeHtml(formatPersianDate(post.date))}</span>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt || "برای خواندن این مقاله وارد شوید.")}</p>
        </div>
      </a>
    </article>
  `;
}

async function renderHomePage() {
  const container = document.getElementById("posts");
  if (!container) return;

  try {
    const index = await fetchPostIndex();
    const slugs = Array.isArray(index.posts) ? index.posts : [];
    const posts = await Promise.all(slugs.map(slug => fetchPost(slug)));
    posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    document.getElementById("post-count").textContent = `${posts.length} مقاله`;
    container.innerHTML = posts.length
      ? posts.map(renderPostCard).join("")
      : '<p class="state-message">هنوز مقاله‌ای منتشر نشده است.</p>';
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="state-message">بارگذاری مقالات ممکن نشد. مطمئن شوید سایت را از طریق یک وب‌سرور اجرا کرده‌اید و فایل content/blog/posts.json وجود دارد.</p>';
  }
}

async function renderArticlePage() {
  const container = document.getElementById("article");
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug || !/^[\p{L}\p{N}_-]+$/u.test(slug)) {
    container.innerHTML = '<p class="state-message">شناسه مقاله معتبر نیست.</p><a class="back-link" href="index.html">بازگشت به مقالات</a>';
    return;
  }

  try {
    const post = await fetchPost(slug);
    document.title = `${post.title} | وبلاگ من`;
    const cover = post.cover
      ? `<img class="article-cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}">`
      : "";

    container.innerHTML = `
      <a href="index.html">← بازگشت به مقالات</a>
      <h1>${escapeHtml(post.title)}</h1>
      <span class="post-date">${escapeHtml(formatPersianDate(post.date))}</span>
      ${cover}
      ${post.excerpt ? `<p class="article-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
      <div class="article-body">${safeMarkdown(post.body)}</div>
      <a class="back-link" href="index.html">بازگشت به همه مقالات</a>
    `;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="state-message">مقاله پیدا نشد یا بارگذاری آن با خطا روبه‌رو شد.</p><a class="back-link" href="index.html">بازگشت به مقالات</a>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHomePage();
  renderArticlePage();
});
