import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  expiredSessionCookieHeader,
  openSession,
  readSessionCookie,
  sealSession,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieHeader
} from './session-cookie.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const APP_ORIGIN = process.env.APP_ORIGIN || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const AVATAR_BUCKET = 'avatars';
const REQUIRED_TABLES = [
  'app_users',
  'groups',
  'group_members',
  'group_invites',
  'day_records',
  'user_preferences'
];
const VALID_STATUS = new Set(['red','green','blue','orange']);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Shape Together: configure SUPABASE_URL e SUPABASE_ANON_KEY no ambiente do servidor.');
  process.exit(1);
}

const supabase = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const DATABASE_SETUP_ERROR = 'A persistência no Supabase requer SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
app.set('trust proxy', 1);
app.use((req, _res, next) => {
  if (req.url === '/shape-together-api' || req.url.startsWith('/shape-together-api/')) {
    req.url = req.url.replace(/^\/shape-together-api/, '/api');
  }
  next();
});
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const challengeStart = '2026-09-29';
const challengeEnd = '2026-12-31';

const DEFAULTS = {
  light: { accent: '#11120F' },
  dark: { accent: '#F5F3ED' }
};

function setSessionCookie(req, res, session) {
  const value = sealSession(session, SESSION_SECRET);
  res.setHeader('Set-Cookie', sessionCookieHeader(req, value, SESSION_MAX_AGE_SECONDS, COOKIE_SECURE));
}
function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', expiredSessionCookieHeader(req, COOKIE_SECURE));
}
function jwtExpiry(accessToken) {
  try {
    const payload = String(accessToken || '').split('.')[1];
    const exp = Number(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp);
    return Number.isFinite(exp) ? exp : 0;
  } catch {
    return 0;
  }
}
function authCredentialError(error) {
  return [400, 401, 403].includes(Number(error?.status || error?.statusCode));
}
function initials(name) {
  return String(name || 'EU').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'EU';
}
function cleanHex(value, fallback = '#11120F') {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || '')) ? String(value).toUpperCase() : fallback;
}
function safeDate(value) {
  const s = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function publicAvatarUrl(pathValue) {
  if (!pathValue) return null;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(pathValue);
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
    accent: cleanHex(pref?.accent, pref?.theme === 'dark' ? DEFAULTS.dark.accent : DEFAULTS.light.accent),
    activeGroupId: row.active_group_id || null
  };
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  if (!['image/jpeg','image/png','image/webp'].includes(mime)) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 7 * 1024 * 1024) return null;
  return { mime, buffer, ext: mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg' };
}

async function uploadAvatar(appUserId, kind, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Imagem de perfil inválida ou grande demais.');
  const pathName = `${appUserId}/${kind}.${parsed.ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(pathName, parsed.buffer, {
    contentType: parsed.mime,
    upsert: true,
    cacheControl: '31536000'
  });
  if (error) throw error;
  return pathName;
}

async function deleteAvatarFiles(appUserId) {
  const paths = [
    `${appUserId}/profile.jpg`, `${appUserId}/profile.png`, `${appUserId}/profile.webp`,
    `${appUserId}/original.jpg`, `${appUserId}/original.png`, `${appUserId}/original.webp`
  ];
  try { await supabase.storage.from(AVATAR_BUCKET).remove(paths); } catch {}
}

async function getUserById(id) {
  const { data, error } = await supabase.from('app_users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
async function getPrefs(userId) {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
async function ensurePrefs(userId) {
  const existing = await getPrefs(userId);
  if (existing) return existing;
  const { data, error } = await supabase.from('user_preferences').insert({
    user_id: userId, theme: 'light', accent: DEFAULTS.light.accent
  }).select('*').single();
  if (error) throw error;
  return data;
}
async function activeGroupForUser(userId) {
  const user = await getUserById(userId);
  if (!user?.active_group_id) return null;
  const { data, error } = await supabase.from('groups').select('*').eq('id', user.active_group_id).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadStateForUser(userId) {
  const user = await getUserById(userId);
  if (!user) throw new Error('Usuário não encontrado.');
  const prefs = await getPrefs(userId);
  const group = user.active_group_id ? await activeGroupForUser(userId) : null;
  let ids = [userId];
  if (group) {
    const { data: members, error: memberErr } = await supabase
      .from('group_members')
      .select('user_id, role, joined_at')
      .eq('group_id', group.id)
      .order('joined_at', { ascending: true });
    if (memberErr) throw memberErr;
    ids = [...new Set([userId, ...(members || []).map(m => m.user_id)])];
  }

  const { data: users, error: usersErr } = await supabase.from('app_users').select('*').in('id', ids);
  if (usersErr) throw usersErr;
  const { data: prefRows, error: prefErr } = await supabase.from('user_preferences').select('*').in('user_id', ids);
  if (prefErr) throw prefErr;
  const prefMap = new Map((prefRows || []).map(p => [p.user_id, p]));
  const { data: records, error: dayErr } = await supabase
    .from('day_records')
    .select('user_id, day, status, note, updated_at')
    .in('user_id', ids)
    .order('day', { ascending: true });
  if (dayErr) throw dayErr;

  const dayMap = {};
  for (const id of ids) dayMap[id] = {};
  for (const r of (records || [])) {
    dayMap[r.user_id] ||= {};
    dayMap[r.user_id][r.day] = {
      status: r.status,
      note: r.note || '',
      updatedAt: r.updated_at
    };
  }

  const byId = new Map((users || []).map(u => [u.id, u]));
  const ordered = ids.map(id => byId.get(id)).filter(Boolean).map(u => publicUser(u, prefMap.get(u.id)));
  if (!byId.has(userId)) throw new Error('Usuário autenticado não foi encontrado em app_users.');
  return {
    users: ordered,
    days: dayMap,
    group: group ? {
      id: group.id,
      name: group.name,
      inviteCode: group.invite_code,
      challengeStart: group.challenge_start,
      challengeEnd: group.challenge_end
    } : null
  };
}

async function groupIdForUser(userId) {
  const u = await getUserById(userId);
  return u?.active_group_id || null;
}
async function broadcastGroup(groupId) {
  if (!groupId) return;
  for (const s of io.sockets.sockets.values()) {
    if (!s.userId) continue;
    const gid = await groupIdForUser(s.userId).catch(() => null);
    if (gid === groupId) {
      const payload = await loadStateForUser(s.userId).catch(() => null);
      if (payload) s.emit('state:update', payload);
    }
  }
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, derived) => {
    if (err) reject(err); else resolve(`${salt}:${derived.toString('hex')}`);
  }));
}
async function verifyPassword(password, stored) {
  return await new Promise((resolve, reject) => {
    const [salt, key] = String(stored || '').split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      try { resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived)); }
      catch { resolve(false); }
    });
  });
}

async function sessionUser(req, res) {
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

  let authUser = null;
  let shouldRefreshCookie = false;
  const expiry = Number(session.expiresAt) || jwtExpiry(session.accessToken);
  if (expiry <= Math.floor(Date.now() / 1000) + 60) {
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: session.refreshToken });
    if (error) {
      if (authCredentialError(error)) {
        clearSessionCookie(req, res);
        return null;
      }
      throw error;
    }
    if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.user) {
      clearSessionCookie(req, res);
      return null;
    }
    session = {
      ...session,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Number(data.session.expires_at) || jwtExpiry(data.session.access_token)
    };
    authUser = data.user;
    shouldRefreshCookie = true;
  } else {
    const { data, error } = await authClient.auth.getUser(session.accessToken);
    if (error) {
      if (authCredentialError(error)) {
        clearSessionCookie(req, res);
        return null;
      }
      throw error;
    }
    authUser = data?.user || null;
  }

  if (!authUser?.id || authUser.id !== session.authUserId) {
    clearSessionCookie(req, res);
    return null;
  }

  let appUser = await getUserById(session.appUserId);
  if (!appUser || appUser.auth_user_id !== authUser.id) {
    appUser = await createOrLinkAppUser(authUser);
    if (session.appUserId !== appUser.id) {
      session = { ...session, appUserId: appUser.id };
      shouldRefreshCookie = true;
    }
  }
  if (shouldRefreshCookie) setSessionCookie(req, res, session);
  return { id: appUser.id, kind: 'google', authUserId: authUser.id };
}
async function requireAuth(req, res, next) {
  try {
    const session = await sessionUser(req, res);
    if (!session) return res.status(401).json({ error: 'Faça login.' });
    req.userId = session.id;
    req.authUserId = session.authUserId || null;
    next();
  } catch {
    res.status(503).json({ error: 'Não foi possível validar a sessão agora. Tente novamente.' });
  }
}
function appOrigin(req) {
  if (APP_ORIGIN) return APP_ORIGIN.replace(/\/+$/, '');
  const host = req.get('host') || 'localhost';
  return `${req.protocol}://${host}`;
}

const databaseRoutes = /^\/api\/(?:health|session|auth\/google-session|login|logout|state|day(?:\/[^/]+)?|settings|invite|group(?:\/join)?|levels)$/;
app.use((req, res, next) => {
  if (!supabase && databaseRoutes.test(req.path)) {
    return res.status(503).json({ error: DATABASE_SETUP_ERROR });
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  const tableChecks = await Promise.all(REQUIRED_TABLES.map(async table => {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    return [table, !error];
  }));
  const { error: bucketError } = await supabase.storage.getBucket(AVATAR_BUCKET);
  const tables = Object.fromEntries(tableChecks);
  const avatars = !bucketError;
  const ok = Object.values(tables).every(Boolean) && avatars;
  res.status(ok ? 200 : 503).json({
    ok,
    database: 'supabase',
    tables,
    storage: { avatars },
    stage: 2
  });
});

app.get('/api/session', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: DATABASE_SETUP_ERROR });
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
    res.status(503).json({ error: 'Não foi possível restaurar a sessão agora. Tente novamente.' });
  }
});

app.get('/api/auth/providers', (_req, res) => res.json({
  google: Boolean(SUPABASE_ANON_KEY && supabase && SESSION_SECRET.length >= 16),
  persistentDatabase: Boolean(supabase),
  stage: 2
}));

app.get('/api/auth/config', (_req, res) => {
  if (!SUPABASE_ANON_KEY) return res.status(503).json({ error: 'SUPABASE_ANON_KEY não configurada no servidor.' });
  res.json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
});

app.get('/auth/google', async (req, res) => {
  if (!SUPABASE_ANON_KEY || !supabase || SESSION_SECRET.length < 16) return res.redirect('/?auth_error=session_not_configured');
  const invite = String(req.query.invite || '').trim();
  const redirectTo = `${appOrigin(req)}/auth/callback${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } });
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data?.url) return res.redirect('/?auth_error=google_failed');
  res.redirect(data.url);
});

app.get('/auth/callback', (req, res) => {
  const invite = String(req.query.invite || '').trim();
  const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';
  res.send(`<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Shape Together</title></head><body><p>Concluindo login…</p><script>location.replace('/?auth_callback=1${qs.slice(1) ? '&' + qs.slice(1) : ''}'+location.hash)</script></body></html>`);
});

async function createOrLinkAppUser(authUser) {
  const authUserId = String(authUser.id || '');
  if (!authUserId) throw new Error('A identidade autenticada não tem um ID válido.');
  const email = String(authUser.email || '').trim().toLowerCase();
  const byAuthId = async () => {
    const { data, error } = await supabase.from('app_users').select('*').eq('auth_user_id', authUserId).maybeSingle();
    if (error) throw error;
    return data;
  };
  const byEmail = async () => {
    if (!email) return null;
    const { data, error } = await supabase.from('app_users').select('*').eq('email', email).limit(2);
    if (error) throw error;
    if ((data || []).length > 1) throw new Error('Há mais de um usuário com este e-mail; vínculo interrompido para evitar duplicação.');
    return data?.[0] || null;
  };
  const linkUnclaimedUser = async existing => {
    if (existing.auth_user_id === authUserId) return existing;
    if (existing.auth_user_id) throw new Error('Este registro de app_users já está vinculado a outra identidade Google.');
    const updates = { auth_user_id: authUserId };
    if (!existing.email && email) updates.email = email;
    const { data, error } = await supabase.from('app_users')
      .update(updates)
      .eq('id', existing.id)
      .is('auth_user_id', null)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    const linked = await byAuthId();
    if (linked) return linked;
    throw new Error('O vínculo do usuário mudou durante o login; tente novamente.');
  };

  let existing = await byAuthId();
  if (!existing) {
    existing = await byEmail();
    if (existing) return linkUnclaimedUser(existing);
  }
  if (existing) return existing;

  const metadataName = String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || '').trim();
  const name = existing?.name || metadataName || email.split('@')[0] || 'Usuário';
  const rawBaseUsername = String(email.split('@')[0] || `user_${authUserId.slice(0, 8)}`)
    .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 34);
  const baseUsername = rawBaseUsername.length >= 2 ? rawBaseUsername : `user_${authUserId.slice(0, 8)}`;
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix
      ? `${baseUsername.slice(0, 40 - String(suffix).length - 1)}_${suffix}`
      : baseUsername;
    const { data: clash, error: clashError } = await supabase.from('app_users').select('id').eq('username', candidate).maybeSingle();
    if (clashError) throw clashError;
    if (clash) continue;

    const { data, error } = await supabase.from('app_users')
      .insert({ auth_user_id: authUserId, name, username: candidate, email: email || null, initials: initials(name), password_hash: null })
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
    if (!accessToken || !refreshToken) return res.status(400).json({ error: 'A sessão Google está incompleta; entre novamente.' });
    if (SESSION_SECRET.length < 16) return res.status(503).json({ error: 'A sessão persistente não está configurada no servidor.' });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Sessão Google inválida.' });
    const appUser = await createOrLinkAppUser(authData.user);
    const expiresAt = jwtExpiry(accessToken);
    if (!expiresAt) return res.status(401).json({ error: 'O token Google não informa uma expiração válida; entre novamente.' });
    setSessionCookie(req, res, {
      kind: 'google',
      appUserId: appUser.id,
      authUserId: authData.user.id,
      accessToken,
      refreshToken,
      expiresAt
    });
    res.json({ user: publicUser(appUser, await getPrefs(appUser.id)) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Não foi possível iniciar a sessão Google.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { data: u, error } = await supabase.from('app_users').select('*').eq('username', username).maybeSingle();
    if (error) throw error;
    if (!u || !(await verifyPassword(password, u.password_hash))) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    await ensurePrefs(u.id);
    setSessionCookie(req, res, { kind: 'legacy', appUserId: u.id });
    res.json({ user: publicUser(u, await getPrefs(u.id)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/state', requireAuth, async (req, res) => {
  try { res.json({ state: await loadStateForUser(req.userId), me: publicUser(await getUserById(req.userId), await getPrefs(req.userId)) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/day', requireAuth, async (req, res) => {
  const date = safeDate(req.body.date);
  const status = String(req.body.status || '');
  const note = String(req.body.note || '').trim().slice(0, 500);
  if (!date) return res.status(400).json({ error: 'Data inválida.' });
  if (!VALID_STATUS.has(status)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const { error } = await supabase.from('day_records').upsert({ user_id: req.userId, day: date, status, note, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
    if (error) throw error;
    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, state: await loadStateForUser(req.userId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/day/:date', requireAuth, async (req, res) => {
  const date = safeDate(req.params.date);
  if (!date) return res.status(400).json({ error: 'Data inválida.' });
  try {
    const { error } = await supabase.from('day_records').delete().eq('user_id', req.userId).eq('day', date);
    if (error) throw error;
    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, state: await loadStateForUser(req.userId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
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
    if (req.body.initials !== undefined) updates.initials = String(req.body.initials).trim().slice(0, 3) || initials(updates.name || user.name);
    if (req.body.color !== undefined) updates.color = cleanHex(req.body.color, user.color || '#4C7DFF');

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

    const { data: nextUser, error: userErr } = await supabase.from('app_users').update(updates).eq('id', req.userId).select('*').single();
    if (userErr) throw userErr;

    const prefUpdates = {};
    if (req.body.theme === 'dark' || req.body.theme === 'light') prefUpdates.theme = req.body.theme;
    if (req.body.accent !== undefined) prefUpdates.accent = cleanHex(req.body.accent, prefs.accent || (prefs.theme === 'dark' ? DEFAULTS.dark.accent : DEFAULTS.light.accent));
    let nextPrefs = prefs;
    if (Object.keys(prefUpdates).length) {
      const { data, error } = await supabase.from('user_preferences').upsert({ user_id: req.userId, ...prefUpdates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('*').single();
      if (error) throw error;
      nextPrefs = data;
    }

    const state = await loadStateForUser(req.userId);
    const me = publicUser(nextUser, nextPrefs);
    const gid = await groupIdForUser(req.userId);
    await broadcastGroup(gid);
    res.json({ ok: true, user: me, state });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invite', requireAuth, async (req, res) => {
  try {
    let group = await activeGroupForUser(req.userId);
    if (!group) {
      const code = crypto.randomBytes(5).toString('hex').toUpperCase();
      const { data: g, error: ge } = await supabase.from('groups').insert({ name: 'Shape Together', created_by: req.userId, invite_code: code, challenge_start: challengeStart, challenge_end: challengeEnd }).select('*').single();
      if (ge) throw ge;
      group = g;
      const { error: meErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'owner' });
      if (meErr) throw meErr;
      await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    }
    const origin = appOrigin(req);
    const url = `${origin}/?invite=${encodeURIComponent(group.invite_code)}`;
    res.json({ ok: true, code: group.invite_code, url, groupId: group.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/group', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || 'Shape Together').trim().slice(0, 60) || 'Shape Together';
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const { data: group, error } = await supabase.from('groups').insert({ name, created_by: req.userId, invite_code: code, challenge_start: challengeStart, challenge_end: challengeEnd }).select('*').single();
    if (error) throw error;
    const { error: memberErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: req.userId, role: 'owner' });
    if (memberErr) throw memberErr;
    const { error: userErr } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (userErr) throw userErr;
    res.json({ ok: true, group, state: await loadStateForUser(req.userId) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/group/join', requireAuth, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Código do convite ausente.' });
    const { data: group, error } = await supabase.from('groups').select('*').eq('invite_code', code).maybeSingle();
    if (error) throw error;
    if (!group) return res.status(404).json({ error: 'Convite não encontrado.' });
    const { error: mErr } = await supabase.from('group_members').upsert({ group_id: group.id, user_id: req.userId, role: 'member' }, { onConflict: 'group_id,user_id' });
    if (mErr) throw mErr;
    const { error: uErr } = await supabase.from('app_users').update({ active_group_id: group.id }).eq('id', req.userId);
    if (uErr) throw uErr;
    const state = await loadStateForUser(req.userId);
    await broadcastGroup(group.id);
    res.json({ ok: true, group, state });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/levels', requireAuth, async (_req, res) => {
  // Mantido apenas por compatibilidade com versões anteriores.
  res.json({ ok: true });
});

io.use(async (socket, next) => {
  try {
    const encoded = readSessionCookie(socket.handshake.headers.cookie || '');
    const session = openSession(encoded, SESSION_SECRET);
    if (!session) return next(new Error('unauthorized'));

    if (session.kind === 'google') {
      if (!session.accessToken || Number(session.expiresAt) <= Math.floor(Date.now() / 1000)) {
        return next(new Error('unauthorized'));
      }
      const { data, error } = await authClient.auth.getUser(session.accessToken);
      if (error || data?.user?.id !== session.authUserId) return next(new Error('unauthorized'));
    }

    const user = await getUserById(session.appUserId);
    if (!user || (session.kind === 'google' && user.auth_user_id !== session.authUserId)) {
      return next(new Error('unauthorized'));
    }
    socket.userId = user.id;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', async socket => {
  const payload = await loadStateForUser(socket.userId).catch(() => null);
  if (payload) socket.emit('state:update', payload);
});

server.listen(PORT, () => console.info(`Shape Together online on port ${PORT}`));
