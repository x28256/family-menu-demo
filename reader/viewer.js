// SPDX-License-Identifier: GPL-3.0-or-later
"use strict";

const byId = (id) => document.getElementById(id);
const text = (tag, value, className) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
};
const strings = (values, maximum) => Array.isArray(values) && values.length <= maximum &&
  values.every((value) => typeof value === "string" && value.length <= 5000);

async function readMenu() {
  if (!location.hash.startsWith("#v1=")) throw new Error("missing payload");
  const encoded = location.hash.slice(4);
  if (!/^[A-Za-z0-9_-]{1,16000}$/.test(encoded)) throw new Error("invalid payload");
  if (typeof DecompressionStream !== "function") throw new Error("unsupported browser");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  if (json.length > 300000) throw new Error("oversize menu");
  const menu = JSON.parse(json);
  if (menu.schemaVersion !== 1 || typeof menu.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(menu.date) ||
      !["午餐", "晚餐"].includes(menu.meal) ||
      !Number.isInteger(menu.people) || menu.people < 1 || menu.people > 99 ||
      !Array.isArray(menu.dishes) || menu.dishes.length < 1 || menu.dishes.length > 30 ||
      !menu.dishes.every((dish) => typeof dish.name === "string" && dish.name.length <= 100 &&
        ["荤菜", "素菜", "汤品"].includes(dish.category) && typeof dish.portion === "string" &&
        dish.portion.length <= 200 && strings(dish.ingredients, 100) && strings(dish.steps, 100) &&
        typeof dish.sourceName === "string" && dish.sourceName.length <= 200 &&
        typeof dish.sourceUrl === "string" && dish.sourceUrl.length <= 1000) ||
      !(menu.shopping === null || strings(menu.shopping, 10))) throw new Error("invalid menu");
  return menu;
}

function render(menu) {
  document.title = `${menu.date} ${menu.meal} · 家庭菜单`;
  byId("heading").textContent = `${menu.date} · ${menu.meal}`;
  byId("meta").textContent = `${menu.people} 人用餐 · ${menu.dishes.length} 道菜`;
  byId("demo").hidden = !menu.demo;
  const overview = byId("overview");
  for (const category of ["荤菜", "素菜", "汤品"]) {
    const names = menu.dishes.filter((dish) => dish.category === category).map((dish) => dish.name);
    overview.append(text("p", `${category}：${names.join("、") || "未选"}`));
  }
  overview.hidden = false;

  const list = byId("dish-list");
  menu.dishes.forEach((dish, index) => {
    const details = document.createElement("details");
    details.className = "dish";
    const summary = document.createElement("summary");
    summary.append(text("span", String(index + 1).padStart(2, "0"), "number"));
    const title = text("span", "", "title");
    title.append(text("small", dish.category), text("strong", dish.name));
    summary.append(title, text("span", "", "expand"));
    details.append(summary);
    const body = text("div", "", "body");
    body.append(text("p", dish.portion, "portion"), text("h3", "准备食材"));
    const ingredients = document.createElement("ul");
    dish.ingredients.forEach((ingredient) => ingredients.append(text("li", ingredient)));
    body.append(ingredients, text("h3", "做法"));
    const steps = document.createElement("ol");
    dish.steps.forEach((step) => steps.append(text("li", step)));
    body.append(steps);
    const source = text("p", `来源：${dish.sourceName}`, "source");
    try {
      const url = new URL(dish.sourceUrl);
      if (url.protocol === "https:" && !url.username && !url.password) {
        const link = text("a", "查看原菜谱");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        source.append(" · ", link);
      }
    } catch (_) { /* An absent source link does not hide the menu. */ }
    body.append(source);
    details.append(body);
    list.append(details);
  });
  byId("dishes").hidden = false;
  if (menu.shopping !== null) {
    const shopping = byId("shopping-list");
    if (menu.shopping.length === 0) shopping.append(text("p", "本次没有列出的食材。"));
    else menu.shopping.forEach((line) => shopping.append(text("p", line)));
    byId("shopping").hidden = false;
  }
  byId("footer").hidden = false;
}

window.addEventListener("hashchange", () => location.reload());
readMenu().then(render).catch(() => {
  byId("heading").textContent = "菜单暂时无法打开";
  byId("error").textContent = "链接可能不完整，或当前浏览器不支持。请让发起人重新分享。";
  byId("error").hidden = false;
});
