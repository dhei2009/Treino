import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import {
  expiredSessionCookieHeader,
  openSession,
  readSessionCookie,
  sealSession,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieHeader
} from './session-cookie.js';
import { validatePlannerRange, validatePlannerTaskInput } from './planner-validation.js';

const PORT = 3000;
const AVATAR_BUCKET = 'avatars';
const challengeStart = '2026-09-29';
const challengeEnd = '2026-12-31';

const DEFAULTS = {
  light: { accent: '#11120F' },
  dark: { accent: '#F5F3ED' }
};

const REQUIRED_TABLES = [
  'app_users',
  'groups',
  'group_members',
  'group_invites',
  'day_records',
  'group_day_records',
  'planner_tasks',
  'personal_organizer_items',
  'personal_habit_logs',
  'user_preferences'
];

const VALID_STATUS = new Set(['red', 'green', 'blue', 'orange']);

/**
 * Cloudflare Workers exposes bindings through `env`.
 * We keep the existing variable names for compatibility with the current
 * Cloudflare configuration, while also accepting Supabase's new recommended
 * names. The clients are created lazily so a deployment/validation step that
 * does not expose runtime secrets cannot crash the Worker module at import time.
 */
function runtimeConfig() {
  return {
    APP_ORIGIN: String(env.APP_ORIGIN || '').trim(),
    SUPABASE_URL: String(env.SUPABASE_URL || '').trim(),
    SUPABASE_PUBLISHABLE_KEY: String(
      env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''
    ).trim(),
    SUPABASE_SECRET_KEY: String(
      env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''
    ).trim(),
    SESSION_SECRET: String(env.SESSION_SECRET || ''),
    COOKIE_SECURE: String(env.COOKIE_SECURE || 'true').toLowerCase() === 'true'
  };
}

let cachedPublishable = { url: '', key: '', client: null };
let cachedSecret = { url: '', key: '', client: null };

function getAuthClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = runtimeConfig();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  if (
    cachedPublishable.client &&
    cachedPublishable.url === SUPABASE_URL &&
    cachedPublishable.key === SUPABASE_PUBLISHABLE_KEY
  ) {
    return cachedPublishable.client;
  }

  cachedPublishable = {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY,
    client: createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  };
  return cachedPublishable.client;
}

function getSupabase() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = runtimeConfig();
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;

  if (
    cachedSecret.client &&
    cachedSecret.url === SUPABASE_URL &&
    cachedSecret.key === SUPABASE_SECRET_KEY
  ) {
    return cachedSecret.client;
  }

  cachedSecret = {
    url: SUPABASE_URL,
    key: SUPABASE_SECRET_KEY,
    client: createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  };
  return cachedSecret.client;
}

function configStatus() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SESSION_SECRET } = runtimeConfig();
  return {
    url: Boolean(SUPABASE_URL),
    publishable: Boolean(SUPABASE_PUBLISHABLE_KEY),
    secret: Boolean(SUPABASE_SECRET_KEY),
    session: SESSION_SECRET.length >= 16
  };
}

function databaseUnavailableError() {
  return new Error(
    'Persistência indisponível: configure SUPABASE_URL e uma chave Secret do Supabase no ambiente do Worker.'
  );
}

function requireSupabase() {
  const client = getSupabase();
  if (!client) throw databaseUnavailableError();
  return client;
}

function requireAuthClient() {
  const client = getAuthClient();
  if (!client) {
    throw new Error(
      'Autenticação indisponível: configure SUPABASE_URL e uma chave Publishable do Supabase no ambiente do Worker.'
    );
  }
  return client;
}

function setSessionCookie(req, res, session) {
  const { SESSION_SECRET, COOKIE_SECURE } = runtimeConfig();
  if (SESSION_SECRET.length < 16) {
    throw new Error('SESSION_SECRET não configurada ou muito curta.');
  }
  const value = sealSession(session, SESSION_SECRET);
  res.setHeader(
    'Set-Cookie',
    sessionCookieHeader(req, value, SESSION_MAX_AGE_SECONDS, COOKIE_SECURE)
  );
}

function clearSessionCookie(req, res) {
  const { COOKIE_SECURE } = runtimeConfig();
  res.setHeader('Set-Cookie', expiredSessionCookieHeader(req, COOKIE_SECURE));
}

function jwtExpiry(accessToken) {
  try {
    const payload = String(accessToken || '').split('.')[1];
    const exp = Number(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp
    );
    return Number.isFinite(exp) ? exp : 0;
  } catch {
    return 0;
  }
}

function authCredentialError(error) {
  return [400, 401, 403].includes(
    Number(error?.status || error?.statusCode)
  );
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function initials(name) {
  return (
    String(name || 'EU')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join('')
      .toUpperCase() || 'EU'
  );
}

function cleanHex(value, fallback = '#11120F') {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || ''))
    ? String(value).toUpperCase()
    : fallback;
}

function safeDate(value) {
  const s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [year, month, day] = s.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? s : null;
}

function todayInAppTimezone() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validateRecordDate(date, group = null) {
  const start = safeDate(group?.challenge_start) || challengeStart;
  const end = safeDate(group?.challenge_end) || challengeEnd;
  if (date < start || date > end) return 'A data está fora do período deste desafio.';
  if (date > todayInAppTimezone()) return 'Não é possível registrar um dia futuro.';
  return null;
}

function publicAvatarUrl(pathValue) {
  if (!pathValue) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(pathValue);
  return data?.publicUrl || null;
}

function publicUser(row, pref = null) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    initials: row.initials,
    email: row.email || '',
    color: cleanHex(row.color, '#4C7DFF'),
    avatar: publicAvatarUrl(row.avatar_path),
    avatarSource: publicAvatarUrl(row.avatar_source_path),
    avatarCrop: row.avatar_crop || null,
    theme: pref?.theme || 'light',
    accent: cleanHex(
      pref?.accent,
      pref?.theme === 'dark' ? DEFAULTS.dark.accent : DEFAULTS.light.accent
    ),
    activeGroupId: row.active_group_id || null,
    defaultWorkspace: pref?.default_workspace_mode === 'group' ? 'group' : 'personal'
  };
}

function parseDataUrl(value) {
  const match = String(value || '').match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i
  );
  if (!match) return null;
  const mime =
    match[1].toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : match[1].toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 7 * 1024 * 1024) return null;
  return {
    mime,
    buffer,
    ext: mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg'
  };
}

async function uploadAvatar(appUserId, kind, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Imagem de perfil inválida ou grande demais.');
  const supabase = requireSupabase();
  const pathName = `${appUserId}/${kind}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(pathName, parsed.buffer, {
      contentType: parsed.mime,
      upsert: true,
      cacheControl: '31536000'
    });
  if (error) throw error;
  return pathName;
}

async function deleteAvatarFiles(appUserId) {
  const supabase = requireSupabase();
  const paths = [
    `${appUserId}/profile.jpg`,
    `${appUserId}/profile.png`,
    `${appUserId}/profile.webp`,
    `${appUserId}/original.jpg`,
    `${appUserId}/original.png`,
    `${appUserId}/original.webp`
  ];
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  if (error) throw error;
}

async function getUserById(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPrefs(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensurePrefs(userId) {
  const existing = await getPrefs(userId);
  if (existing) return existing;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_preferences')
    .insert({
      user_id: userId,
      theme: 'light',
      accent: DEFAULTS.light.accent
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function activeGroupForUser(userId) {
  const supabase = requireSupabase();
  const user = await getUserById(userId);
  const groupId = user?.active_group_id || null;
  if (!groupId) return null;

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function groupsForUser(userId) {
  const supabase = requireSupabase();
  const { data: members, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (memberError) throw memberError;

  const ids = [...new Set((members || []).map((m) => m.group_id))];
  if (!ids.length) return [];

  const { data: groupRows, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .in('id', ids);
  if (groupError) throw groupError;

  const byId = new Map((groupRows || []).map((g) => [g.id, g]));
  return (members || [])
    .map((m) => {
      const g = byId.get(m.group_id);
      if (!g) return null;
      return {
        id: g.id,
        name: g.name,
        inviteCode: g.invite_code,
        visibility: g.visibility === 'public' ? 'public' : 'private',
        role: m.role,
        challengeStart: g.challenge_start,
        challengeEnd: g.challenge_end
      };
    })
    .filter(Boolean);
}

async function groupForUser(userId, groupId) {
  const id = String(groupId || '').trim();
  if (!id) return null;
  const supabase = requireSupabase();
  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id, role')
    .eq('group_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (groupError) throw groupError;
  return group;
}

async function loadStateForUser(userId, workspaceMode = 'auto', requestedGroupId = null) {
  const supabase = requireSupabase();
  const user = await getUserById(userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const prefs = await ensurePrefs(userId);
  let mode = workspaceMode === 'group' || workspaceMode === 'personal'
    ? workspaceMode
    : (prefs.default_workspace_mode === 'group' ? 'group' : 'personal');
  const groups = await groupsForUser(userId);
  let group = null;

  if (mode === 'group') {
    group = requestedGroupId
      ? await groupForUser(userId, requestedGroupId)
      : await activeGroupForUser(userId);
    if (!group) {
      if (workspaceMode === 'auto') {
        mode = 'personal';
      } else {
        throw Object.assign(new Error('Você ainda não participa de nenhuma sala.'), { code: 'NO_GROUP' });
      }
    }
  }

  let ids = [userId];
  if (group) {
    const { data: members, error: memberErr } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', group.id)
      .order('joined_at', { ascending: true });
    if (memberErr) throw memberErr;
    ids = [...new Set([userId, ...(members || []).map((m) => m.user_id)])];
  }

  const { data: users, error: usersErr } = await supabase
    .from('app_users')
    .select('*')
    .in('id', ids);
  if (usersErr) throw usersErr;

  const { data: prefRows, error: prefErr } = await supabase
    .from('user_preferences')
    .select('*')
    .in('user_id', ids);
  if (prefErr) throw prefErr;

  const prefMap = new Map((prefRows || []).map((p) => [p.user_id, p]));

  const recordsQuery = group
    ? supabase.from('group_day_records')
        .select('group_id, user_id, day, status, note, updated_at')
        .eq('group_id', group.id)
        .in('user_id', ids)
    : supabase.from('day_records')
        .select('user_id, day, status, note, updated_at')
        .eq('user_id', userId);
  const { data: records, error: dayErr } = await recordsQuery.order('day', { ascending: true });
  if (dayErr) throw dayErr;

  const dayMap = {};
  for (const id of ids) dayMap[id] = {};
  for (const r of records || []) {
    dayMap[r.user_id] ||= {};
    dayMap[r.user_id][r.day] = {
      status: r.status,
      note: r.note || '',
      updatedAt: r.updated_at
    };
  }

  const byId = new Map((users || []).map((u) => [u.id, u]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((u) => publicUser(u, prefMap.get(u.id)));

  if (!byId.has(userId)) {
    throw new Error('Usuário autenticado não foi encontrado em app_users.');
  }

  return {
    workspaceMode: group ? 'group' : 'personal',
    users: ordered,
    days: dayMap,
    groups,
    group: group
      ? {
          id: group.id,
          name: group.name,
          inviteCode: group.invite_code,
          visibility: group.visibility === 'public' ? 'public' : 'private',
          challengeStart: group.challenge_start,
          challengeEnd: group.challenge_end
        }
      : null
  };
}

async function groupIdForUser(userId) {
  const group = await activeGroupForUser(userId);
  return group?.id || null;
}

// Intencionalmente sem Socket.IO no Worker.
// O estado persistido é retornado em cada mutação. A sincronização em tempo
// real será adicionada com Supabase Realtime em etapa própria.
async function broadcastGroup(_groupId) {}

async function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString('hex')
) {
  return await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, stored) {
  return await new Promise((resolve, reject) => {
    const [salt, key] = String(stored || '').split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived));
      } catch {
        resolve(false);
      }
    });
  });
}

async function sessionUser(req, res) {
  const { SESSION_SECRET } = runtimeConfig();
  if (SESSION_SECRET.length < 16) return null;

  const encoded = readSessionCookie(req.headers.cookie || '');
  if (!encoded) return null;

  let session = openSession(encoded, SESSION_SECRET);
  if (!session) {
    clearSessionCookie(req, res);
    return null;
  }

  if (session.kind === 'legacy') {
    const user = await getUserById(session.appUserId);
    if (!user) {
      clearSessionCookie(req, res);
      return null;
    }
    return { id: user.id, kind: 'legacy' };
  }

  if (!session.accessToken || !session.refreshToken || !session.authUserId) {
    clearSessionCookie(req, res);
    return null;
  }

  // A sessão já foi assinada pelo Worker no login. Não precisamos chamar
  // Supabase Auth novamente a cada abertura do site: isso deixava a tela de
  // preparação dependente de uma chamada externa antes mesmo de carregar o app.
  // Validamos o vínculo local e só fazemos refresh quando o token está perto de expirar.
  let shouldRefreshCookie = false;
  const expiry = Number(session.expiresAt) || jwtExpiry(session.accessToken);
  let appUser = await getUserById(session.appUserId);

  if (!appUser || appUser.auth_user_id !== session.authUserId) {
    clearSessionCookie(req, res);
    return null;
  }

  if (expiry <= Math.floor(Date.now() / 1000) + 90) {
    const authClient = requireAuthClient();
    let refreshResult;
    try {
      refreshResult = await withTimeout(
        authClient.auth.refreshSession({ refresh_token: session.refreshToken }),
        10000,
        'O servidor demorou para atualizar a sessão.'
      );
    } catch (error) {
      if (authCredentialError(error) || /demorou para atualizar/i.test(String(error?.message || ''))) {
        clearSessionCookie(req, res);
        return null;
      }
      throw error;
    }

    const { data, error } = refreshResult;
    if (error) {
      if (authCredentialError(error)) {
        clearSessionCookie(req, res);
        return null;
      }
      throw error;
    }
    if (
      !data?.session?.access_token ||
      !data?.session?.refresh_token ||
      !data?.user ||
      data.user.id !== session.authUserId
    ) {
      clearSessionCookie(req, res);
      return null;
    }

    session = {
      ...session,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt:
        Number(data.session.expires_at) || jwtExpiry(data.session.access_token)
    };
    shouldRefreshCookie = true;
  }

  if (shouldRefreshCookie) setSessionCookie(req, res, session);
  return {
    id: appUser.id,
    kind: 'google',
    authUserId: session.authUserId
  };
}

async function requireAuth(req, res, next) {
  try {
    const session = await sessionUser(req, res);
    if (!session) return res.status(401).json({ error: 'Faça login.' });
    req.userId = session.id;
    req.authUserId = session.authUserId || null;
    next();
  } catch (e) {
    console.error('Falha ao validar sessão:', e);
    res
      .status(503)
      .json({ error: 'Não foi possível validar a sessão agora. Tente novamente.' });
  }
}

function appOrigin(req) {
  const { APP_ORIGIN } = runtimeConfig();
  if (APP_ORIGIN) return APP_ORIGIN.replace(/\/+$/, '');
  const host = req.get('host') || 'localhost';
  return `${req.protocol}://${host}`;
}

const databaseRoutes =
  /^\/api\/(?:health|session|auth\/google-session|login|logout|state|day(?:\/[^/]+)?|tasks(?:\/[^/]+)?|organizer(?:\/.*)?|settings(?:\/workspace-default)?|account(?:\/delete)?|workspace|groups(?:\/public)?|invite|group(?:\/(?:join|join-public))?|levels)$/;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, _res, next) => {
  if (
    req.url === '/shape-together-api' ||
    req.url.startsWith('/shape-together-api/')
  ) {
    req.url = req.url.replace(/^\/shape-together-api/, '/api');
  }
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  next();
});
app.use(express.json({ limit: '8mb' }));

app.use((req, res, next) => {
  if (databaseRoutes.test(req.path) && !getSupabase()) {
    return res.status(503).json({
      error: databaseUnavailableError().message,
      config: configStatus()
    });
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    const supabase = requireSupabase();
    const tableChecks = await Promise.all(
      REQUIRED_TABLES.map(async (table) => {
        const { error } = await supabase
          .from(table)
          .select('*', { head: true, count: 'exact' })
          .limit(1);
        return [table, !error];
      })
    );

    const { error: bucketError } = await supabase.storage.getBucket(
      AVATAR_BUCKET
    );
    const tables = Object.fromEntries(tableChecks);
    const avatars = !bucketError;
    const ok = Object.values(tables).every(Boolean) && avatars;

    res.status(ok ? 200 : 503).json({
      ok,
      database: 'supabase',
      tables,
      storage: { avatars },
      stage: 2,
      config: configStatus()
    });
  } catch (e) {
    console.error('Health check failed:', e);
    res.status(503).json({
      ok: false,
      error: e.message || 'Health check falhou.',
      config: configStatus(),
      stage: 2
    });
  }
});

app.get('/api/session', async (req, res) => {
  if (!getSupabase()) {
    return res.status(503).json({
      error: databaseUnavailableError().message,
      config: configStatus()
    });
  }

  try {
    const s = await sessionUser(req, res);
    if (!s) return res.json({ user: null });
    const u = await getUserById(s.id);
    if (!u) {
      clearSessionCookie(req, res);
      return res.json({ user: null });
    }
    const p = await getPrefs(u.id);
    res.json({ user: publicUser(u, p) });
  } catch (e) {
    console.error('Session restore failed:', e);
    res.status(503).json({
      error: 'Não foi possível restaurar a sessão agora. Tente novamente.'
    });
  }
});

app.get('/api/auth/providers', (_req, res) => {
  const config = configStatus();
  res.json({
    google: config.publishable && config.secret && config.session,
    persistentDatabase: config.url && config.secret,
    stage: 2,
    config
  });
});

app.get('/api/auth/config', (_req, res) => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = runtimeConfig();
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return res.status(503).json({
      error: 'Supabase URL ou Publishable Key não configurados no servidor.'
    });
  }
  res.json({ url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY });
});

app.get('/auth/google', async (req, res) => {
  const config = configStatus();
  if (!config.publishable || !config.secret || !config.session) {
    return res.redirect('/?auth_error=session_not_configured');
  }

  try {
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = runtimeConfig();
    const invite = String(req.query.invite || '').trim();
    const redirectTo = `${appOrigin(req)}/auth/callback${
      invite ? `?invite=${encodeURIComponent(invite)}` : ''
    }`;

    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'implicit'
      }
    });

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error || !data?.url) {
      console.error('Google OAuth URL error:', error);
      return res.redirect('/?auth_error=google_failed');
    }

    res.redirect(data.url);
  } catch (e) {
    console.error('Google OAuth start failed:', e);
    res.redirect('/?auth_error=google_failed');
  }
});

app.get('/auth/callback', (req, res) => {
  const invite = String(req.query.invite || '').trim();
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';
  res.send(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shape Together</title></head><body><p>Concluindo login…</p><script>location.replace('/?auth_callback=1${
      qs.slice(1) ? '&' + qs.slice(1) : ''
    }'+location.hash)</script></body></html>`
  );
});

async function createOrLinkAppUser(authUser) {
  const supabase = requireSupabase();
  const authUserId = String(authUser.id || '');
  if (!authUserId) {
    throw new Error('A identidade autenticada não tem um ID válido.');
  }

  const email = String(authUser.email || '').trim().toLowerCase();

  const byAuthId = async () => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const byEmail = async () => {
    if (!email) return null;
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .limit(2);
    if (error) throw error;
    if ((data || []).length > 1) {
      throw new Error(
        'Há mais de um usuário com este e-mail; vínculo interrompido para evitar duplicação.'
      );
    }
    return data?.[0] || null;
  };

  const linkUnclaimedUser = async (existing) => {
    if (existing.auth_user_id === authUserId) return existing;
    if (existing.auth_user_id) {
      throw new Error(
        'Este registro de app_users já está vinculado a outra identidade Google.'
      );
    }

    const updates = { auth_user_id: authUserId };
    if (!existing.email && email) updates.email = email;

    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', existing.id)
      .is('auth_user_id', null)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const linked = await byAuthId();
    if (linked) return linked;
    throw new Error(
      'O vínculo do usuário mudou durante o login; tente novamente.'
    );
  };

  let existing = await byAuthId();
  if (!existing) {
    existing = await byEmail();
    if (existing) return linkUnclaimedUser(existing);
  }
  if (existing) return existing;

  const metadataName = String(
    authUser.user_metadata?.full_name || authUser.user_metadata?.name || ''
  ).trim();
  const name = metadataName || email.split('@')[0] || 'Usuário';
  const rawBaseUsername = String(
    email.split('@')[0] || `user_${authUserId.slice(0, 8)}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 34);
  const baseUsername =
    rawBaseUsername.length >= 2
      ? rawBaseUsername
      : `user_${authUserId.slice(0, 8)}`;

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix
      ? `${baseUsername.slice(
          0,
          40 - String(suffix).length - 1
        )}_${suffix}`
      : baseUsername;

    const { data: clash, error: clashError } = await supabase
      .from('app_users')
      .select('id')
      .eq('username', candidate)
      .maybeSingle();
    if (clashError) throw clashError;
    if (clash) continue;

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        auth_user_id: authUserId,
        name,
        username: candidate,
        email: email || null,
        initials: initials(name),
        password_hash: null
      })
      .select('*')
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error;

    const concurrentlyCreated = await byAuthId();
    if (concurrentlyCreated) return concurrentlyCreated;

    const emailRow = await byEmail();
    if (emailRow) return linkUnclaimedUser(emailRow);
  }

  throw new Error('Não foi possível reservar um nome de usuário exclusivo.');
}

app.post('/api/auth/google-session', async (req, res) => {
  try {
    const accessToken = String(req.body?.access_token || '');
    const refreshToken = String(req.body?.refresh_token || '');

    if (!accessToken || !refreshToken) {
      return res
        .status(400)
        .json({ error: 'A sessão Google está incompleta; entre novamente.' });
    }

    const { SESSION_SECRET } = runtimeConfig();
    if (SESSION_SECRET.length < 16) {
      return res.status(503).json({
        error: 'A sessão persistente não está configurada no servidor.'
      });
    }

    const authClient = requireAuthClient();
    const { data: authData, error: authError } = await authClient.auth.getUser(
      accessToken
    );
    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Sessão Google inválida.' });
    }

    const appUser = await createOrLinkAppUser(authData.user);
    const expiresAt = jwtExpiry(accessToken);
    if (!expiresAt) {
      return res.status(401).json({
        error: 'O token Google não informa uma expiração válida; entre novamente.'
      });
    }

    setSessionCookie(req, res, {
      kind: 'google',
      appUserId: appUser.id,
      authUserId: authData.user.id,
      accessToken,
      refreshToken,
      expiresAt
    });

    res.json({
      user: publicUser(appUser, await getPrefs(appUser.id))
    });
  } catch (e) {
    console.error('Google session failed:', e);
    res
      .status(500)
      .json({ error: e.message || 'Não foi possível iniciar a sessão Google.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const supabase = requireSupabase();
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { data: u, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    await ensurePrefs(u.id);
    setSessionCookie(req, res, {
      kind: 'legacy',
      appUserId: u.id
    });
    res.json({ user: publicUser(u, await getPrefs(u.id)) });
  } catch (e) {
    console.error('Legacy login failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

// Exclusão de conta solicitada pelo próprio usuário autenticado.
// Dados pessoais são removidos por FK (day_records, preferences e memberships);
// salas compartilhadas são preservadas para os demais participantes.
app.delete('/api/account', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Conta não encontrada.' });

    // A sessão Google só pode excluir o usuário Auth que está vinculado ao perfil.
    if (req.authUserId && user.auth_user_id !== req.authUserId) {
      return res.status(403).json({ error: 'A sessão não corresponde a esta conta.' });
    }
    if (user.auth_user_id && !req.authUserId) {
      return res.status(403).json({ error: 'Entre novamente com Google para excluir esta conta.' });
    }

    // Transfer groups created/owned by this account before its membership cascades.
    const { data: createdGroups, error: createdGroupsError } = await supabase
      .from('groups').select('id').eq('created_by', req.userId);
    if (createdGroupsError) throw createdGroupsError;
    const { data: ownedMemberships, error: ownedMembershipsError } = await supabase
      .from('group_members').select('group_id').eq('user_id', req.userId).eq('role', 'owner');
    if (ownedMembershipsError) throw ownedMembershipsError;
    const ownedGroupIds = new Set([
      ...(createdGroups || []).map((group) => group.id),
      ...(ownedMemberships || []).map((membership) => membership.group_id)
    ]);
    for (const groupId of ownedGroupIds) {
      const { data: remaining, error: remainingError } = await supabase
        .from('group_members').select('user_id, joined_at')
        .eq('group_id', groupId).neq('user_id', req.userId)
        .order('joined_at', { ascending: true }).limit(1);
      if (remainingError) throw remainingError;
      if (remaining?.[0]) {
        const newOwnerId = remaining[0].user_id;
        const { error: promoteError } = await supabase.from('group_members')
          .update({ role: 'owner' }).eq('group_id', groupId).eq('user_id', newOwnerId);
        if (promoteError) throw promoteError;
        const { error: creatorTransferError } = await supabase.from('groups')
          .update({ created_by: newOwnerId }).eq('id', groupId);
        if (creatorTransferError) throw creatorTransferError;
      } else {
        const { error: deleteEmptyGroupError } = await supabase.from('groups').delete().eq('id', groupId);
        if (deleteEmptyGroupError) throw deleteEmptyGroupError;
      }
    }

    // Planner tasks are cleaned up without deleting the tasks shared with surviving rooms.
    // Personal tasks are removed; shared tasks lose only their creator reference and remain in the room.
    const { error: personalPlannerCleanupError } = await supabase
      .from('planner_tasks').delete().eq('owner_id', req.userId).is('workspace_group_id', null);
    if (personalPlannerCleanupError) throw personalPlannerCleanupError;
    const { error: sharedPlannerOwnerError } = await supabase
      .from('planner_tasks').update({ owner_id: null }).eq('owner_id', req.userId)
      .not('workspace_group_id', 'is', null);
    if (sharedPlannerOwnerError) throw sharedPlannerOwnerError;

    await deleteAvatarFiles(req.userId);

    if (user.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.auth_user_id);
      if (authDeleteError) throw authDeleteError;
    }

    const { error: profileDeleteError } = await supabase
      .from('app_users')
      .delete()
      .eq('id', req.userId);
    if (profileDeleteError) throw profileDeleteError;

    clearSessionCookie(req, res);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Account deletion failed:', e);
    return res.status(500).json({ error: 'Não foi possível concluir a exclusão da conta. Nenhuma confirmação de exclusão foi emitida; tente novamente ou entre em contato com o suporte.' });
  }
});

app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const mode = ['group', 'personal'].includes(String(req.query.mode || '')) ? String(req.query.mode) : 'auto';
    const groupId = mode === 'group' ? String(req.query.groupId || '') : null;
    res.json({
      state: await loadStateForUser(req.userId, mode, groupId),
      me: publicUser(
        await getUserById(req.userId),
        await getPrefs(req.userId)
      )
    });
  } catch (e) {
    console.error('State load failed:', e);
    res.status(500).json({ error: e.code === 'NO_GROUP' ? e.message : 'Não foi possível carregar os dados. Tente novamente.' });
  }
});

const PLANNER_TASK_COLUMNS = 'id, owner_id, workspace_group_id, title, details, due_date, priority, status, category, created_at, updated_at';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function serializePlannerTask(row, canManage = false) {
  return {
    id: row.id,
    ownerId: row.owner_id || null,
    workspaceGroupId: row.workspace_group_id || null,
    title: row.title,
    details: row.details || '',
    dueDate: row.due_date || null,
    priority: row.priority,
    status: row.status,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canManage: Boolean(canManage)
  };
}

async function plannerTaskAccess(task, userId) {
  if (!task.workspace_group_id) {
    const isOwner = task.owner_id === userId;
    return { canRead: isOwner, canManage: isOwner };
  }
  const group = await groupForUser(userId, task.workspace_group_id);
  if (!group) return { canRead: false, canManage: false };
  const supabase = requireSupabase();
  const { data: membership, error } = await supabase.from('group_members')
    .select('role').eq('group_id', task.workspace_group_id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!membership) return { canRead: false, canManage: false };
  return {
    canRead: true,
    canManage: task.owner_id === userId || ['owner', 'admin'].includes(membership.role)
  };
}

app.get('/api/tasks', requireAuth, async (req, res) => {
  const range = validatePlannerRange(req.query.from, req.query.to);
  if (range.error) return res.status(400).json({ error: range.error });
  const groupMode = String(req.query.workspaceMode || 'personal') === 'group';
  const requestedGroupId = String(req.query.groupId || '');
  if (groupMode && !isUuid(requestedGroupId)) {
    return res.status(400).json({ error: 'Selecione uma sala válida para ver as tarefas.' });
  }

  try {
    const supabase = requireSupabase();
    let query = supabase.from('planner_tasks').select(PLANNER_TASK_COLUMNS)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }).limit(500);
    let canManageAll = true;
    if (groupMode) {
      const group = await groupForUser(req.userId, requestedGroupId);
      if (!group) return res.status(403).json({ error: 'Você não participa desta sala.' });
      const { data: membership, error: membershipError } = await supabase.from('group_members')
        .select('role').eq('group_id', group.id).eq('user_id', req.userId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({ error: 'Você não participa desta sala.' });
      canManageAll = ['owner', 'admin'].includes(membership.role);
      query = query.eq('workspace_group_id', group.id);
    } else {
      query = query.eq('owner_id', req.userId).is('workspace_group_id', null);
    }
    if (range.from && range.to) {
      query = query.or(`due_date.is.null,and(due_date.gte.${range.from},due_date.lte.${range.to})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const tasks = (data || []).map((row) => serializePlannerTask(
      row,
      groupMode ? (row.owner_id === req.userId || canManageAll) : row.owner_id === req.userId
    ));
    return res.json({ tasks, currentUserId: req.userId });
  } catch (error) {
    console.error('Planner tasks load failed:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as tarefas. Confira a migração do Planejador e tente novamente.' });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const parsed = validatePlannerTaskInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const groupMode = req.body?.workspaceMode === 'group';
  const requestedGroupId = String(req.body?.groupId || '');
  if (groupMode && !isUuid(requestedGroupId)) {
    return res.status(400).json({ error: 'Selecione uma sala válida para compartilhar a tarefa.' });
  }
  try {
    const supabase = requireSupabase();
    let groupId = null;
    if (groupMode) {
      const group = await groupForUser(req.userId, requestedGroupId);
      if (!group) return res.status(403).json({ error: 'Você não participa desta sala.' });
      groupId = group.id;
    }
    const { data, error } = await supabase.from('planner_tasks').insert({
      owner_id: req.userId,
      workspace_group_id: groupId,
      ...parsed.value
    }).select(PLANNER_TASK_COLUMNS).single();
    if (error) throw error;
    return res.status(201).json({ task: serializePlannerTask(data, true) });
  } catch (error) {
    console.error('Planner task create failed:', error);
    return res.status(500).json({ error: 'Não foi possível salvar a tarefa. Tente novamente.' });
  }
});

app.patch('/api/tasks/:taskId', requireAuth, async (req, res) => {
  const taskId = String(req.params.taskId || '');
  if (!isUuid(taskId)) return res.status(400).json({ error: 'Identificador de tarefa inválido.' });
  const parsed = validatePlannerTaskInput(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const supabase = requireSupabase();
    const { data: existing, error: loadError } = await supabase.from('planner_tasks')
      .select(PLANNER_TASK_COLUMNS).eq('id', taskId).maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    const access = await plannerTaskAccess(existing, req.userId);
    if (!access.canRead) return res.status(403).json({ error: 'Você não tem acesso a esta tarefa.' });
    if (!access.canManage) return res.status(403).json({ error: 'Somente quem criou a tarefa ou um administrador da sala pode alterá-la.' });
    const { data, error } = await supabase.from('planner_tasks').update(parsed.value)
      .eq('id', taskId).select(PLANNER_TASK_COLUMNS).single();
    if (error) throw error;
    return res.json({ task: serializePlannerTask(data, true) });
  } catch (error) {
    console.error('Planner task update failed:', error);
    return res.status(500).json({ error: 'Não foi possível atualizar a tarefa. Tente novamente.' });
  }
});

app.delete('/api/tasks/:taskId', requireAuth, async (req, res) => {
  const taskId = String(req.params.taskId || '');
  if (!isUuid(taskId)) return res.status(400).json({ error: 'Identificador de tarefa inválido.' });
  try {
    const supabase = requireSupabase();
    const { data: existing, error: loadError } = await supabase.from('planner_tasks')
      .select(PLANNER_TASK_COLUMNS).eq('id', taskId).maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    const access = await plannerTaskAccess(existing, req.userId);
    if (!access.canRead) return res.status(403).json({ error: 'Você não tem acesso a esta tarefa.' });
    if (!access.canManage) return res.status(403).json({ error: 'Somente quem criou a tarefa ou um administrador da sala pode excluí-la.' });
    const { error } = await supabase.from('planner_tasks').delete().eq('id', taskId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (error) {
    console.error('Planner task delete failed:', error);
    return res.status(500).json({ error: 'Não foi possível excluir a tarefa. Tente novamente.' });
  }
});


// Personal organization: goals, projects and habit check-ins.
const ORGANIZER_ITEM_COLUMNS = 'id, owner_id, type, title, details, due_date, priority, status, progress, cadence, created_at, updated_at';

function isOrganizerDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function serializeOrganizerItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    details: row.details || '',
    dueDate: row.due_date || null,
    priority: row.priority || 'normal',
    status: row.status || 'active',
    progress: Number(row.progress) || 0,
    cadence: row.cadence || 'daily',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateOrganizerItemInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Dados do item inválidos.' };
  }
  const value = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const allowedTypes = new Set(['goal', 'project', 'habit']);
  const allowedPriorities = new Set(['low', 'normal', 'high']);
  const allowedStatuses = new Set(['active', 'paused', 'done']);
  const allowedCadences = new Set(['daily', 'weekdays', 'weekly']);

  if (!partial || has('type')) {
    const type = String(body.type || '').trim();
    if (!allowedTypes.has(type)) return { error: 'Selecione uma categoria válida: meta, projeto ou hábito.' };
    if (!partial) value.type = type;
  }
  if (!partial || has('title')) {
    const title = String(body.title || '').trim();
    if (title.length < 1 || title.length > 160) return { error: 'O nome deve ter entre 1 e 160 caracteres.' };
    value.title = title;
  }
  if (!partial || has('details')) {
    const details = String(body.details ?? '').trim();
    if (details.length > 2000) return { error: 'A descrição deve ter no máximo 2.000 caracteres.' };
    value.details = details;
  }
  if (!partial || has('dueDate')) {
    const date = body.dueDate === '' || body.dueDate === null || body.dueDate === undefined ? null : String(body.dueDate);
    if (date !== null && !isOrganizerDate(date)) return { error: 'O prazo informado não é uma data válida.' };
    value.due_date = date;
  }
  if (!partial || has('priority')) {
    const priority = String(body.priority || 'normal');
    if (!allowedPriorities.has(priority)) return { error: 'Prioridade inválida.' };
    value.priority = priority;
  }
  if (!partial || has('status')) {
    const status = String(body.status || (partial ? '' : 'active'));
    if (!allowedStatuses.has(status)) return { error: 'Estado inválido.' };
    value.status = status;
  }
  if (!partial || has('progress')) {
    const progress = body.progress === undefined && !partial ? 0 : Number(body.progress);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { error: 'O progresso deve ser um número inteiro de 0 a 100.' };
    value.progress = progress;
  }
  if (!partial || has('cadence')) {
    const cadence = String(body.cadence || 'daily');
    if (!allowedCadences.has(cadence)) return { error: 'Frequência de hábito inválida.' };
    value.cadence = cadence;
  }
  if (partial && !Object.keys(value).length) return { error: 'Informe ao menos um campo para atualizar.' };
  return { value };
}

app.get('/api/organizer', requireAuth, async (req, res) => {
  const to = req.query.to === undefined ? new Date().toISOString().slice(0, 10) : String(req.query.to);
  let from = req.query.from === undefined ? null : String(req.query.from);
  if (!isOrganizerDate(to) || (from !== null && !isOrganizerDate(from))) {
    return res.status(400).json({ error: 'O período informado não é válido.' });
  }
  if (!from) {
    const start = new Date(`${to}T12:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 59);
    from = start.toISOString().slice(0, 10);
  }
  if (from > to) return res.status(400).json({ error: 'A data inicial precisa vir antes da data final.' });
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 366) return res.status(400).json({ error: 'O intervalo de hábitos não pode ultrapassar 367 dias.' });
  try {
    const supabase = requireSupabase();
    const [itemsResult, logsResult] = await Promise.all([
      supabase.from('personal_organizer_items').select(ORGANIZER_ITEM_COLUMNS)
        .eq('owner_id', req.userId).order('created_at', { ascending: false }).limit(500),
      supabase.from('personal_habit_logs').select('id, item_id, log_date')
        .eq('owner_id', req.userId).gte('log_date', from).lte('log_date', to)
        .order('log_date', { ascending: false }).limit(10000)
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (logsResult.error) throw logsResult.error;
    return res.json({
      items: (itemsResult.data || []).map(serializeOrganizerItem),
      habitLogs: (logsResult.data || []).map((row) => ({ id: row.id, itemId: row.item_id, date: row.log_date })),
      from,
      to
    });
  } catch (error) {
    console.error('Personal organizer load failed:', error);
    return res.status(500).json({ error: 'Não foi possível carregar sua organização pessoal. Confira a migração supabase/personal-organization.sql e tente novamente.' });
  }
});

app.post('/api/organizer/items', requireAuth, async (req, res) => {
  const parsed = validateOrganizerItemInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('personal_organizer_items')
      .insert({ owner_id: req.userId, ...parsed.value })
      .select(ORGANIZER_ITEM_COLUMNS).single();
    if (error) throw error;
    return res.status(201).json({ item: serializeOrganizerItem(data) });
  } catch (error) {
    console.error('Personal organizer create failed:', error);
    return res.status(500).json({ error: 'Não foi possível salvar este item. Confira a migração de organização pessoal e tente novamente.' });
  }
});

app.patch('/api/organizer/items/:itemId', requireAuth, async (req, res) => {
  const itemId = String(req.params.itemId || '');
  if (!isUuid(itemId)) return res.status(400).json({ error: 'Identificador do item inválido.' });
  const parsed = validateOrganizerItemInput(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('personal_organizer_items')
      .update(parsed.value).eq('id', itemId).eq('owner_id', req.userId)
      .select(ORGANIZER_ITEM_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item não encontrado nesta conta.' });
    return res.json({ item: serializeOrganizerItem(data) });
  } catch (error) {
    console.error('Personal organizer update failed:', error);
    return res.status(500).json({ error: 'Não foi possível atualizar este item. Tente novamente.' });
  }
});

app.delete('/api/organizer/items/:itemId', requireAuth, async (req, res) => {
  const itemId = String(req.params.itemId || '');
  if (!isUuid(itemId)) return res.status(400).json({ error: 'Identificador do item inválido.' });
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('personal_organizer_items').delete()
      .eq('id', itemId).eq('owner_id', req.userId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item não encontrado nesta conta.' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Personal organizer delete failed:', error);
    return res.status(500).json({ error: 'Não foi possível excluir este item. Tente novamente.' });
  }
});

app.post('/api/organizer/items/:itemId/check', requireAuth, async (req, res) => {
  const itemId = String(req.params.itemId || '');
  if (!isUuid(itemId)) return res.status(400).json({ error: 'Identificador do hábito inválido.' });
  const date = String(req.body?.date || '');
  if (!isOrganizerDate(date)) return res.status(400).json({ error: 'A data de registro não é válida.' });
  if (date > new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'Não é possível registrar um hábito em uma data futura.' });
  const done = req.body?.done === true;
  try {
    const supabase = requireSupabase();
    const { data: item, error: itemError } = await supabase.from('personal_organizer_items')
      .select('id, type').eq('id', itemId).eq('owner_id', req.userId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return res.status(404).json({ error: 'Hábito não encontrado nesta conta.' });
    if (item.type !== 'habit') return res.status(400).json({ error: 'Somente hábitos podem receber registros diários.' });
    if (done) {
      const { error } = await supabase.from('personal_habit_logs')
        .upsert({ owner_id: req.userId, item_id: itemId, log_date: date }, { onConflict: 'owner_id,item_id,log_date', ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('personal_habit_logs').delete()
        .eq('owner_id', req.userId).eq('item_id', itemId).eq('log_date', date);
      if (error) throw error;
    }
    return res.json({ ok: true, itemId, date, done });
  } catch (error) {
    console.error('Personal habit check-in failed:', error);
    return res.status(500).json({ error: 'Não foi possível registrar o hábito. Confira a migração de organização pessoal e tente novamente.' });
  }
});

app.post('/api/day', requireAuth, async (req, res) => {
  const date = safeDate(req.body?.date);
  const status = String(req.body?.status || '');
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const mode = req.body?.workspaceMode === 'group' ? 'group' : 'personal';

  if (!date) return res.status(400).json({ error: 'Data inválida.' });
  if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'Status inválido.' });

  try {
    const supabase = requireSupabase();
    let group = null;
    if (mode === 'group') {
      group = await groupForUser(req.userId, req.body?.groupId);
      if (!group) return res.status(403).json({ error: 'Você não participa desta sala.' });
    }
    const dateError = validateRecordDate(date, group);
    if (dateError) return res.status(400).json({ error: dateError });

    const record = {
      user_id: req.userId,
      day: date,
      status,
      note,
      updated_at: new Date().toISOString()
    };
    const query = mode === 'group'
      ? supabase.from('group_day_records').upsert({ ...record, group_id: group.id }, { onConflict: 'group_id,user_id,day' })
      : supabase.from('day_records').upsert(record, { onConflict: 'user_id,day' });
    const { error } = await query;
    if (error) throw error;

    await broadcastGroup(group?.id || null);
    res.json({ ok: true, state: await loadStateForUser(req.userId, mode, group?.id || null) });
  } catch (e) {
    console.error('Day save failed:', e);
    res.status(500).json({ error: 'Não foi possível salvar o registro. Tente novamente.' });
  }
});

app.delete('/api/day/:date', requireAuth, async (req, res) => {
  const date = safeDate(req.params.date);
  const mode = req.query.workspaceMode === 'group' ? 'group' : 'personal';
  if (!date) return res.status(400).json({ error: 'Data inválida.' });

  try {
    const supabase = requireSupabase();
    let group = null;
    if (mode === 'group') {
      group = await groupForUser(req.userId, req.query.groupId);
      if (!group) return res.status(403).json({ error: 'Você não participa desta sala.' });
    }
    const dateError = validateRecordDate(date, group);
    if (dateError) return res.status(400).json({ error: dateError });

    const query = mode === 'group'
      ? supabase.from('group_day_records').delete().eq('group_id', group.id).eq('user_id', req.userId).eq('day', date)
      : supabase.from('day_records').delete().eq('user_id', req.userId).eq('day', date);
    const { error } = await query;
    if (error) throw error;

    await broadcastGroup(group?.id || null);
    res.json({ ok: true, state: await loadStateForUser(req.userId, mode, group?.id || null) });
  } catch (e) {
    console.error('Day delete failed:', e);
    res.status(500).json({ error: 'Não foi possível apagar o registro. Tente novamente.' });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const prefs = await ensurePrefs(req.userId);
    const updates = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 60);
      if (name.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
      updates.name = name;
      updates.initials = initials(name);
    }
    if (req.body.initials !== undefined) {
      updates.initials = String(req.body.initials).trim().slice(0, 3) || initials(updates.name || user.name);
    }
    if (req.body.color !== undefined) {
      updates.color = cleanHex(req.body.color, user.color || '#4C7DFF');
    }

    let avatarPath = user.avatar_path;
    let avatarSourcePath = user.avatar_source_path;
    if (req.body.avatar === null) {
      await deleteAvatarFiles(req.userId);
      avatarPath = null;
      avatarSourcePath = null;
      updates.avatar_crop = null;
    } else if (req.body.avatar) {
      avatarPath = await uploadAvatar(req.userId, 'profile', req.body.avatar);
      if (req.body.avatarSource) avatarSourcePath = await uploadAvatar(req.userId, 'original', req.body.avatarSource);
      updates.avatar_crop = req.body.avatarCrop && typeof req.body.avatarCrop === 'object' ? req.body.avatarCrop : null;
    }
    if (req.body.avatarSource === null) avatarSourcePath = null;
    updates.avatar_path = avatarPath;
    updates.avatar_source_path = avatarSourcePath;

    const { data: nextUser, error: userErr } = await supabase
      .from('app_users').update(updates).eq('id', req.userId).select('*').single();
    if (userErr) throw userErr;

    const prefUpdates = {};
    if (req.body.theme === 'dark' || req.body.theme === 'light') prefUpdates.theme = req.body.theme;
    if (req.body.accent !== undefined) {
      prefUpdates.accent = cleanHex(req.body.accent, prefs.accent || (prefs.theme === 'dark' ? DEFAULTS.dark.accent : DEFAULTS.light.accent));
    }

    let nextPrefs = prefs;
    if (Object.keys(prefUpdates).length) {
      const { data, error } = await supabase.from('user_preferences').upsert({
        user_id: req.userId, ...prefUpdates, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }).select('*').single();
      if (error) throw error;
      nextPrefs = data;
    }

    const state = await loadStateForUser(req.userId, 'auto');
    const me = publicUser(nextUser, nextPrefs);
    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, user: me, state });
  } catch (e) {
    console.error('Settings save failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/settings/workspace-default', requireAuth, async (req, res) => {
  try {
    const mode = String(req.body?.defaultWorkspace || '').trim().toLowerCase();
    if (!['personal', 'group'].includes(mode)) {
      return res.status(400).json({ error: 'Espaço inicial inválido.' });
    }
    const prefs = await ensurePrefs(req.userId);
    const supabase = requireSupabase();
    let defaultGroup = null;
    if (mode === 'group') {
      defaultGroup = req.body?.groupId ? await groupForUser(req.userId, req.body.groupId) : await activeGroupForUser(req.userId);
      if (!defaultGroup) {
        const available = await groupsForUser(req.userId);
        if (available.length) defaultGroup = await groupForUser(req.userId, available[0].id);
      }
      if (!defaultGroup) return res.status(400).json({ error: 'Entre ou crie uma sala antes de escolhê-la como espaço inicial.' });
      const { error: activeGroupError } = await supabase.from('app_users').update({ active_group_id: defaultGroup.id }).eq('id', req.userId);
      if (activeGroupError) throw activeGroupError;
    }
    const { data: nextPrefs, error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: req.userId, theme: prefs.theme, accent: prefs.accent, default_workspace_mode: mode, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*').single();
    if (error) throw error;
    res.json({ ok: true, user: publicUser(await getUserById(req.userId), nextPrefs) });
  } catch (e) {
    console.error('Default workspace save failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/workspace', requireAuth, async (req, res) => {
  try {
    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (!['personal', 'group'].includes(mode)) return res.status(400).json({ error: 'Modo de espaço inválido.' });

    let group = null;
    if (mode === 'group') {
      group = req.body?.groupId ? await groupForUser(req.userId, req.body.groupId) : await activeGroupForUser(req.userId);
      if (!group) return res.status(403).json({ error: 'Você não participa dessa sala.' });
      const supabase = requireSupabase();
      const { error } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
      if (error) throw error;
    }

    const state = await loadStateForUser(req.userId, mode, group?.id || null);
    res.json({ ok: true, state, me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) });
  } catch (e) {
    console.error('Workspace switch failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/groups', requireAuth, async (req, res) => {
  try {
    res.json({ groups: await groupsForUser(req.userId) });
  } catch (e) {
    console.error('Groups load failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/groups/public', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, challenge_start, challenge_end, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);
    if (groupsError) throw groupsError;
    const ids = (groups || []).map((g) => g.id);
    if (!ids.length) return res.json({ groups: [] });

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', ids);
    if (membersError) throw membersError;
    const counts = new Map();
    const joined = new Set();
    for (const m of members || []) {
      counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1);
      if (m.user_id === req.userId) joined.add(m.group_id);
    }
    res.json({ groups: (groups || []).map((g) => ({
      id: g.id, name: g.name, memberCount: counts.get(g.id) || 0,
      isMember: joined.has(g.id), challengeStart: g.challenge_start, challengeEnd: g.challenge_end
    })) });
  } catch (e) {
    console.error('Public groups load failed:', e);
    res.status(500).json({ error: 'Não foi possível carregar as salas públicas.' });
  }
});

app.post('/api/group/join-public', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const groupId = String(req.body?.groupId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) {
      return res.status(400).json({ error: 'Sala inválida.' });
    }
    const { data: group, error: groupError } = await supabase
      .from('groups').select('*').eq('id', groupId).eq('visibility', 'public').maybeSingle();
    if (groupError) throw groupError;
    if (!group) return res.status(404).json({ error: 'Sala pública não encontrada.' });

    const { data: existing, error: memberCheckError } = await supabase
      .from('group_members').select('role').eq('group_id', group.id).eq('user_id', req.userId).maybeSingle();
    if (memberCheckError) throw memberCheckError;
    if (!existing) {
      const { error: insertError } = await supabase.from('group_members').insert({
        group_id: group.id, user_id: req.userId, role: 'member'
      });
      if (insertError && insertError.code !== '23505') throw insertError;
    }
    const { error: updateError } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (updateError) throw updateError;

    const state = await loadStateForUser(req.userId, 'group', group.id);
    await broadcastGroup(group.id);
    res.json({ ok: true, group, state, me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) });
  } catch (e) {
    console.error('Public group join failed:', e);
    res.status(500).json({ error: 'Não foi possível entrar na sala pública.' });
  }
});

app.post('/api/invite', requireAuth, async (req, res) => {
  try {
    const group = await activeGroupForUser(req.userId);
    if (!group) return res.status(400).json({ error: 'Escolha uma sala antes de gerar o convite.' });
    const origin = appOrigin(req);
    const url = `${origin}/?invite=${encodeURIComponent(group.invite_code)}`;
    res.json({
      ok: true,
      code: group.invite_code,
      url,
      groupId: group.id,
      name: group.name,
      visibility: group.visibility === 'public' ? 'public' : 'private'
    });
  } catch (e) {
    console.error('Invite creation failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/group', requireAuth, async (req, res) => {
  let createdGroupId = null;
  try {
    const supabase = requireSupabase();
    const name = String(req.body.name || 'Shape Together').trim().slice(0, 60) || 'Shape Together';
    const visibility = String(req.body.visibility || 'private').trim().toLowerCase() === 'public' ? 'public' : 'private';
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();

    const { data: group, error } = await supabase.from('groups').insert({
      name,
      created_by: req.userId,
      invite_code: code,
      visibility,
      challenge_start: challengeStart,
      challenge_end: challengeEnd
    }).select('*').single();
    if (error) throw error;
    createdGroupId = group.id;

    const { error: memberErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'owner' });
    if (memberErr) throw memberErr;

    const { error: userErr } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (userErr) throw userErr;

    res.json({ ok: true, group, state: await loadStateForUser(req.userId, 'group', group.id), me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) });
  } catch (e) {
    console.error('Group creation failed:', e);
    if (createdGroupId) {
      try {
        const supabase = requireSupabase();
        const { error: cleanupError } = await supabase.from('groups').delete().eq('id', createdGroupId);
        if (cleanupError) console.error('Partial group cleanup failed:', cleanupError);
      } catch (cleanupError) {
        console.error('Partial group cleanup failed:', cleanupError);
      }
    }
    res.status(500).json({ error: 'Não foi possível criar a sala. Tente novamente.' });
  }
});

app.post('/api/group/join', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Código do convite ausente.' });

    const { data: group, error } = await supabase.from('groups').select('*').eq('invite_code', code).maybeSingle();
    if (error) throw error;
    if (!group) return res.status(404).json({ error: 'Convite não encontrado.' });

    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('group_members').select('role').eq('group_id', group.id).eq('user_id', req.userId).maybeSingle();
    if (membershipCheckError) throw membershipCheckError;
    if (!existingMembership) {
      const { error: mErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'member' });
      if (mErr && mErr.code !== '23505') throw mErr;
    }

    const { error: uErr } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (uErr) throw uErr;

    const state = await loadStateForUser(req.userId, 'group', group.id);
    await broadcastGroup(group.id);
    res.json({ ok: true, group, state, me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) });
  } catch (e) {
    console.error('Group join failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/levels', requireAuth, async (_req, res) => {
  // Mantido apenas por compatibilidade com versões anteriores.
  res.json({ ok: true });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Rota não encontrada.' });
  }
  // Static assets are normally served by Workers Static Assets before this
  // Express handler. If the Worker is invoked for a non-API path, returning
  // 404 keeps the API side predictable instead of pretending an asset exists.
  res.status(404).send('Not Found');
});

app.listen(PORT);
export default httpServerHandler({ port: PORT });
