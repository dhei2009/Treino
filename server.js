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
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
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
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  } catch {}
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

  const { data: records, error: dayErr } = await supabase
    .from('day_records')
    .select('user_id, day, status, note, updated_at')
    .in('user_id', ids)
    .order('day', { ascending: true });
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
  /^\/api\/(?:health|session|auth\/google-session|login|logout|state|day(?:\/[^/]+)?|settings(?:\/workspace-default)?|workspace|groups|invite|group(?:\/join)?|levels)$/;

const app = express();
app.set('trust proxy', 1);
app.use((req, _res, next) => {
  if (
    req.url === '/shape-together-api' ||
    req.url.startsWith('/shape-together-api/')
  ) {
    req.url = req.url.replace(/^\/shape-together-api/, '/api');
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

app.get('/api/state', requireAuth, async (req, res) => {
  try {
    res.json({
      state: await loadStateForUser(req.userId),
      me: publicUser(
        await getUserById(req.userId),
        await getPrefs(req.userId)
      )
    });
  } catch (e) {
    console.error('State load failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/day', requireAuth, async (req, res) => {
  const date = safeDate(req.body.date);
  const status = String(req.body.status || '');
  const note = String(req.body.note || '').trim().slice(0, 500);

  if (!date) return res.status(400).json({ error: 'Data inválida.' });
  if (!VALID_STATUS.has(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const supabase = requireSupabase();
    const { error } = await supabase.from('day_records').upsert(
      {
        user_id: req.userId,
        day: date,
        status,
        note,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,day' }
    );
    if (error) throw error;

    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, state: await loadStateForUser(req.userId) });
  } catch (e) {
    console.error('Day save failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/day/:date', requireAuth, async (req, res) => {
  const date = safeDate(req.params.date);
  if (!date) return res.status(400).json({ error: 'Data inválida.' });

  try {
    const supabase = requireSupabase();
    const { error } = await supabase
      .from('day_records')
      .delete()
      .eq('user_id', req.userId)
      .eq('day', date);
    if (error) throw error;

    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, state: await loadStateForUser(req.userId) });
  } catch (e) {
    console.error('Day delete failed:', e);
    res.status(500).json({ error: e.message });
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
    if (String(req.query.public || '') === '1') {
      const supabase = requireSupabase();
      const query = String(req.query.q || '').trim().replace(/[%,_]/g, ' ').slice(0, 80);
      let request = supabase
        .from('groups')
        .select('id, name, visibility')
        .eq('visibility', 'public')
        .order('name', { ascending: true })
        .limit(30);
      if (query) request = request.ilike('name', `%${query}%`);
      const { data, error } = await request;
      if (error) throw error;
      return res.json({ groups: (data || []).map((g) => ({ id: g.id, name: g.name, visibility: 'public' })) });
    }
    res.json({ groups: await groupsForUser(req.userId) });
  } catch (e) {
    console.error('Groups load failed:', e);
    res.status(500).json({ error: e.message });
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

    const { error: memberErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'owner' });
    if (memberErr) throw memberErr;

    const { error: userErr } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (userErr) throw userErr;

    res.json({ ok: true, group, state: await loadStateForUser(req.userId, 'group', group.id), me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) });
  } catch (e) {
    console.error('Group creation failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/group/join', requireAuth, async (req, res) => {
  try {
    const supabase = requireSupabase();
    const groupId = String(req.body.groupId || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!groupId && !code) return res.status(400).json({ error: 'Digite o código do convite ou escolha uma sala pública.' });

    let groupQuery = supabase.from('groups').select('*');
    if (groupId) groupQuery = groupQuery.eq('id', groupId);
    else groupQuery = groupQuery.eq('invite_code', code);
    const { data: group, error } = await groupQuery.maybeSingle();
    if (error) throw error;
    if (!group) return res.status(404).json({ error: groupId ? 'Sala não encontrada.' : 'Convite não encontrado.' });
    if (groupId && group.visibility !== 'public') return res.status(403).json({ error: 'Esta sala é privada. Peça o código de convite ao criador.' });

    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', group.id)
      .eq('user_id', req.userId)
      .maybeSingle();
    if (membershipCheckError) throw membershipCheckError;
    if (!existingMembership) {
      const { error: mErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'member' });
      if (mErr) throw mErr;
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
