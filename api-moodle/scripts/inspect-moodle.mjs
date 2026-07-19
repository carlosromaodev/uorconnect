#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { join } from 'node:path';
import playwright from 'playwright-core';
import { hasSameOrigin, preparePrivateDirectory, writePrivateFile } from './inspection-security.mjs';

const { chromium } = playwright;

const BASE_URL = 'https://moodle.uor.edu.ao';
const username = process.argv[2] ?? process.env.MOODLE_TEST_USERNAME;
const outputDir = process.env.MOODLE_INSPECTION_OUTPUT ?? '/tmp/moodle-uor-inspection';
const privateStrings = new Set([username]);

if (!username) {
  console.error('Uso: node inspect-moodle.mjs <utilizador>');
  process.exit(2);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const password = await new Promise((resolve) => {
  process.stdout.write('Palavra-passe (entrada não persistida): ');
  rl.once('line', resolve);
});
rl.close();

if (typeof password !== 'string' || password.length === 0) {
  console.error('A palavra-passe não pode estar vazia.');
  process.exit(2);
}

const sensitiveKey = /(?:pass|password|token|sesskey|cookie|authorization|secret|key)/i;

function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveKey.test(key)) url.searchParams.set(key, `<${key.toUpperCase()}>`);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function redactPayload(payload) {
  if (!payload) return null;
  const trimmed = payload.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(redactObject(JSON.parse(trimmed)));
    } catch {
      // Fall through to form/text handling.
    }
  }
  try {
    const params = new URLSearchParams(payload);
    if ([...params.keys()].length > 0) {
      for (const key of [...params.keys()]) {
        if (sensitiveKey.test(key) || /username/i.test(key)) {
          params.set(key, `<${key.toUpperCase()}>`);
        }
      }
      return params.toString();
    }
  } catch {
    // Fall through to conservative text redaction.
  }
  return payload
    .replaceAll(password, '<PASSWORD>')
    .replaceAll(username, '<TEST_USERNAME>')
    .replace(/("(?:sesskey|token|password|authorization)"\s*:\s*")[^"]+/gi, '$1<REDACTED>');
}

function redactObject(value, key = '') {
  if (sensitiveKey.test(key)) return `<${key.toUpperCase() || 'REDACTED'}>`;
  if (Array.isArray(value)) return value.map((item) => redactObject(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactObject(childValue, childKey),
    ]));
  }
  if (typeof value === 'string') {
    let result = value;
    for (const privateValue of privateStrings) {
      if (privateValue) result = result.replaceAll(privateValue, '<PRIVATE_VALUE>');
    }
    return result
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<STUDENT_EMAIL>')
      .replace(/([?&](?:sesskey|token|password|key)=)[^&\s'"<>]+/gi, '$1<REDACTED>')
      .replace(/(\b(?:sesskey|token|password|key)=)[^&\s'"<>]+/gi, '$1<REDACTED>');
  }
  return value;
}

function shapeOf(value, depth = 0) {
  if (depth > 4) return Array.isArray(value) ? 'array' : typeof value;
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0], depth + 1)] : [];
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shapeOf(child, depth + 1)]));
  }
  return value === null ? 'null' : typeof value;
}

function cleanText(text, maxLength = 300) {
  let result = text ?? '';
  for (const privateValue of privateStrings) {
    if (privateValue) result = result.replaceAll(privateValue, '<PRIVATE_VALUE>');
  }
  return result
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<STUDENT_EMAIL>')
    .replace(/([?&](?:sesskey|token|password|key)=)[^&\s'"<>]+/gi, '$1<REDACTED>')
    .replace(/(\b(?:sesskey|token|password|key)=)[^&\s'"<>]+/gi, '$1<REDACTED>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--disable-dev-shm-usage'],
});
const context = await browser.newContext({ locale: 'pt-PT', timezoneId: 'Africa/Luanda' });
const page = await context.newPage();

const traffic = [];
page.on('response', async (response) => {
  const request = response.request();
  const url = response.url();
  if (!hasSameOrigin(url, BASE_URL)) return;
  const headers = response.headers();
  let responseShape = null;
  if ((headers['content-type'] ?? '').includes('application/json')) {
    try {
      responseShape = shapeOf(await response.json());
    } catch {
      // Some responses report JSON but have an empty or non-JSON body.
    }
  }
  const requestHeaders = request.headers();
  traffic.push({
    url: redactUrl(url),
    method: request.method(),
    resourceType: request.resourceType(),
    status: response.status(),
    contentType: headers['content-type'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
    requestContentType: requestHeaders['content-type'] ?? null,
    hasCookie: Boolean(requestHeaders.cookie),
    redirectedFrom: request.redirectedFrom() ? redactUrl(request.redirectedFrom().url()) : null,
    requestBody: redactPayload(request.postData()),
    responseShape,
  });
});

async function snapshot(label) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const cfg = globalThis.M?.cfg;
    const links = [...document.querySelectorAll('a[href]')].map((link) => ({
      text: (link.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      href: link.href,
      title: link.getAttribute('title'),
    }));
    const headings = [...document.querySelectorAll('h1,h2,h3')].map((item) => item.textContent);
    const forms = [...document.forms].map((form) => ({
      action: form.action,
      method: form.method,
      fields: [...form.elements].map((field) => ({
        name: field.name || null,
        type: field.type || field.tagName.toLowerCase(),
      })),
    }));
    return {
      title: document.title,
      url: location.href,
      headings,
      links,
      forms,
      relevantText: [...document.querySelectorAll([
        '#region-main',
        '[data-region="course-content"]',
        '.course-content',
        '.block_timeline',
        '.eventlist',
        '.activity-information',
      ].join(','))].map((item) => item.textContent).join('\n'),
      moodleConfig: cfg ? {
        wwwroot: cfg.wwwroot,
        homeurl: cfg.homeurl,
        ajaxurl: cfg.ajaxurl,
        contextid: cfg.contextid,
        courseId: cfg.courseId,
        theme: cfg.theme,
        language: cfg.language,
        hasSesskey: Boolean(cfg.sesskey),
      } : null,
    };
  });
  return {
    label,
    title: cleanText(data.title),
    url: redactUrl(data.url),
    headings: data.headings.map((item) => cleanText(item)),
    links: data.links
      .filter((item) => hasSameOrigin(item.href, BASE_URL))
      .map((item) => ({ ...item, text: cleanText(item.text), href: redactUrl(item.href) })),
    forms: data.forms.map((form) => ({
      ...form,
      action: redactUrl(form.action),
      fields: form.fields,
    })),
    relevantText: cleanText(data.relevantText, 5000),
    moodleConfig: data.moodleConfig,
  };
}

const snapshots = [];
let logoutUrlRaw = null;
let completedEvidencePath = null;
try {
  await page.goto(`${BASE_URL}/login/index.php`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  snapshots.push(await snapshot('login'));

  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login/'), { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  logoutUrlRaw = await page.locator('a[href*="/login/logout.php"]').first().getAttribute('href').catch(() => null);
  snapshots.push(await snapshot('authenticated-entry'));

  const profileLink = page.locator('a[href*="/user/profile.php?id="]').first();
  if (await profileLink.count()) {
    const displayName = cleanText(await profileLink.textContent());
    if (displayName && !displayName.startsWith('<')) privateStrings.add(displayName);
  }

  const fixedPages = [
    ['courses', '/my/courses.php'],
    ['calendar', '/calendar/view.php?view=month'],
    ['notifications', '/message/output/popup/notifications.php'],
    ['messages', '/message/index.php'],
    ['profile', '/user/profile.php'],
    ['grades-overview', '/grade/report/overview/index.php'],
    ['private-files', '/user/files.php'],
    ['preferences', '/user/preferences.php'],
  ];
  for (const [label, pathname] of fixedPages) {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    snapshots.push(await snapshot(label));
    if (label === 'profile') {
      const legalName = await page.locator('dt:has-text("Nome completo") + dd').first().textContent().catch(() => null);
      if (legalName?.trim()) privateStrings.add(legalName.trim());
    }
  }

  const courseIds = [...new Set(snapshots
    .flatMap((item) => item.links)
    .map((item) => {
      try {
        const url = new URL(item.href);
        return url.pathname === '/course/view.php' || url.pathname === '/course/user.php'
          ? Number(url.searchParams.get('id'))
          : null;
      } catch {
        return null;
      }
    })
    .filter(Number.isFinite))]
    .sort((a, b) => b - a)
    .slice(0, 3);
  const courseUrls = courseIds.map((id) => `${BASE_URL}/course/view.php?id=${id}`);
  for (const [index, url] of courseUrls.entries()) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    snapshots.push(await snapshot(`course-${index + 1}`));
  }

  const representativeActivities = new Map();
  for (const item of snapshots.filter((entry) => entry.label.startsWith('course-'))) {
    for (const link of item.links) {
      const match = link.href.match(/\/mod\/([^/]+)\/view\.php\?id=/);
      if (match && !representativeActivities.has(match[1])) {
        representativeActivities.set(match[1], link.href);
      }
    }
  }
  for (const [type, url] of [...representativeActivities].slice(0, 10)) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    snapshots.push(await snapshot(`activity-${type}`));
  }

  const serviceChecks = [
    ['rest-endpoint', '/webservice/rest/server.php'],
    ['token-endpoint', '/login/token.php'],
    ['webservice-docs', '/admin/webservice/documentation.php'],
  ];
  for (const [label, pathname] of serviceChecks) {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    snapshots.push(await snapshot(label));
  }

  const cookies = await context.cookies(BASE_URL);
  const evidence = {
    capturedAt: new Date().toISOString(),
    authenticated: !page.url().includes('/login/'),
    cookies: cookies.map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      session: cookie.expires === -1,
      value: '<REDACTED>',
    })),
    snapshots: redactObject(snapshots),
    traffic: redactObject(traffic),
  };

  await preparePrivateDirectory(outputDir);
  const evidencePath = join(outputDir, 'full-inspection.json');
  const screenshotPath = join(outputDir, 'last-page.png');
  await writePrivateFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await writePrivateFile(screenshotPath, await page.screenshot({ fullPage: true }));
  completedEvidencePath = evidencePath;
} finally {
  try {
    if (!logoutUrlRaw && !page.isClosed()) {
      logoutUrlRaw = await page.locator('a[href*="/login/logout.php"]').first().getAttribute('href').catch(() => null);
    }
    if (!logoutUrlRaw && !page.isClosed()) {
      await page.goto(`${BASE_URL}/my/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      logoutUrlRaw = await page.locator('a[href*="/login/logout.php"]').first().getAttribute('href').catch(() => null);
    }
    if (logoutUrlRaw && hasSameOrigin(logoutUrlRaw, BASE_URL) && !page.isClosed()) {
      await page.goto(new URL(logoutUrlRaw, BASE_URL).href, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    }
  } catch {
    console.error('Aviso: não foi possível confirmar o logout Moodle; a sessão local será encerrada.');
  }
  await browser.close();
}

if (completedEvidencePath) console.log(`\nInspeção concluída: ${completedEvidencePath}`);
