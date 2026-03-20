import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, LogOut, LayoutDashboard, BarChart3, ShoppingBag, Globe, Plus, Key, Edit2, Trash2, FileText, ExternalLink } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const API = '/api';

// Accept both keys: old Super Admin used superAdminToken, Admin used adminToken. Same backend, same login.
function getToken() {
  return localStorage.getItem('adminToken') || localStorage.getItem('superAdminToken');
}

function setToken(t: string) {
  localStorage.setItem('adminToken', t);
  localStorage.setItem('superAdminToken', t);
}

function clearToken() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('superAdminToken');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Tab = 'clients' | 'pages' | 'users' | 'analytics' | 'ecommerce';

const SITE_PAGES = [
  { path: '/', label: 'Home' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/about', label: 'About' },
  { path: '/booking', label: 'Booking' },
  { path: '/clients', label: 'Clients' },
  { path: '/services/web-development', label: 'Web Development' },
  { path: '/services/social-media', label: 'Social Media Marketing' },
  { path: '/services/email-marketing', label: 'Email Marketing' },
  { path: '/services/photo-video', label: 'Photo & Video' },
  { path: '/1000kr', label: '1000kr' },
  { path: '/bli-ansatt', label: 'Bli ansatt' },
  { path: '/login', label: 'Login' },
  { path: '/ansatt', label: 'Ansatt' },
];
type Features = { users?: boolean; analytics?: boolean; ecommerce?: boolean };
type UserRole = 'employee' | 'client' | 'none';

type Site = {
  id: string;
  site_key: string;
  domain: string;
  name: string;
  features: { users?: boolean; analytics?: boolean; ecommerce?: boolean };
  createdAt: string;
};

type AdminUser = {
  id: string;
  username: string;
  createdAt: string;
  role: UserRole;
};

const DEFAULT_FEATURES: Features = { users: true, analytics: false, ecommerce: false };

export const Admin = () => {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('clients');
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES);
  const [siteName, setSiteName] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [userRoleSaving, setUserRoleSaving] = useState<string | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [addSiteName, setAddSiteName] = useState('');
  const [addSiteDomain, setAddSiteDomain] = useState('');
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editSiteDomain, setEditSiteDomain] = useState('');
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteFeatures, setEditSiteFeatures] = useState({ users: true, analytics: false, ecommerce: false });
  const [copyKey, setCopyKey] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
    if (res.status === 401) {
      clearToken();
      setLoggedIn(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
  }, []);

  const fetchSites = useCallback(async () => {
    const res = await fetch(`${API}/hub/sites`, { headers: authHeaders() });
    if (res.status === 401) {
      clearToken();
      setLoggedIn(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setSites(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetch(`${API}/cms/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.features) setFeatures(data.features);
        if (data?.name) setSiteName(data.name);
      })
      .catch(() => setFeatures(DEFAULT_FEATURES));
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoggedIn(false);
      return;
    }
    Promise.all([fetchUsers(), fetchSites()]).then(() => setLoggedIn(true)).catch(() => setLoggedIn(false));
  }, [fetchUsers, fetchSites]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.message || 'Invalid credentials');
        return;
      }
      setToken(data.token);
      setLoggedIn(true);
      fetchUsers();
    } catch {
      setLoginError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, role: 'none' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed to create user');
        return;
      }
      setUserForm({ username: '', password: '' });
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleChange = async (id: string, role: UserRole) => {
    setUserRoleSaving(id);
    try {
      const res = await fetch(`${API}/admin/users/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } finally {
      setUserRoleSaving(null);
    }
  };

  const handleUpdateUser = async (id: string, newUsername?: string, newPassword?: string) => {
    setLoading(true);
    try {
      const body: { username?: string; password?: string } = {};
      if (newUsername !== undefined) body.username = newUsername;
      if (newPassword !== undefined && newPassword !== '') body.password = newPassword;
      const res = await fetch(`${API}/admin/users/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Update failed');
        return;
      }
      setEditingId(null);
      setEditPassword('');
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this user? They will no longer be able to log in.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Delete failed');
        return;
      }
      fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    const res = await fetch(`${API}/admin/change-password`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChangePasswordError(data.message || 'Failed');
      return;
    }
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/hub/sites`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addSiteName || 'New site', domain: addSiteDomain.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      setAddSiteOpen(false);
      setAddSiteName('');
      setAddSiteDomain('');
      fetchSites();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSite = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/hub/sites/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: editSiteDomain, name: editSiteName, features: editSiteFeatures }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      setEditingSiteId(null);
      fetchSites();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm('Remove this site from the hub? The client CMS will stop receiving feature updates until re-added.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/hub/sites/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      fetchSites();
    } finally {
      setLoading(false);
    }
  };

  const copySiteKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopyKey(key);
    setTimeout(() => setCopyKey(null), 2000);
  };

  if (loggedIn === null) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <>
        <Helmet><title>Admin Login – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-8">
            <h1 className="text-xl font-bold text-white mb-6">Admin</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF5B00]"
                required
              />
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium text-white bg-[#FF5B00] hover:bg-[#e55200] disabled:opacity-50"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <p className="mt-4 text-center">
              <Link to="/" className="text-sm text-gray-400 hover:text-white">← Back to site</Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Admin – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="min-h-screen bg-[#1e1e1e] flex">
        {/* Sidebar */}
        <aside className="w-56 bg-[#23282d] text-white flex flex-col fixed inset-y-0 left-0">
          <div className="p-4 border-b border-white/10">
            <Link to="/" className="text-lg font-semibold text-white">{siteName || 'Admin'}</Link>
            <p className="text-xs text-gray-400 mt-1">Client CMS</p>
          </div>
          <nav className="flex-1 p-2">
            <button
              onClick={() => setTab('clients')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                tab === 'clients' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <Globe size={18} /> Manage clients
            </button>
            <button
              onClick={() => setTab('pages')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                tab === 'pages' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <FileText size={18} /> Pages
            </button>
            {features.users !== false && (
              <button
                onClick={() => setTab('users')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                  tab === 'users' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <Users size={18} /> Users
              </button>
            )}
            {features.analytics && (
              <button
                onClick={() => setTab('analytics')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                  tab === 'analytics' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <BarChart3 size={18} /> Analytics
              </button>
            )}
            {features.ecommerce && (
              <button
                onClick={() => setTab('ecommerce')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                  tab === 'ecommerce' ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                <ShoppingBag size={18} /> Ecommerce
              </button>
            )}
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium text-gray-400 opacity-70">
              <LayoutDashboard size={18} /> Dashboard (soon)
            </div>
          </nav>
          <div className="p-2 border-t border-white/10 space-y-1">
            <button
              onClick={() => setChangePasswordOpen(true)}
              className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white"
            >
              Change my password
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={18} /> Log out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-56 p-8">
          {tab === 'pages' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-2">Pages</h1>
              <p className="text-gray-400 text-sm mb-6">Quick navigation to all pages on this site.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SITE_PAGES.map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl bg-[#2a2a2a] border border-white/10 px-4 py-3 hover:border-[#FF5B00]/50 hover:bg-[#2a2a2a]/80 transition-colors group"
                  >
                    <span className="text-white font-medium">{p.label}</span>
                    <ExternalLink size={16} className="text-gray-400 group-hover:text-[#FF5B00] flex-shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {tab === 'clients' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-2">Manage clients</h1>
              <p className="text-gray-400 text-sm mb-6">Client sites in the hub. Add a site to get a site key for client CMS. Changing domain keeps the same site key.</p>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Sites</h2>
                <button
                  type="button"
                  onClick={() => setAddSiteOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200]"
                >
                  <Plus size={18} /> Add site
                </button>
              </div>
              <div className="space-y-4">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="rounded-xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-wrap items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{site.name || 'Unnamed'}</p>
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Globe size={14} /> {site.domain || '—'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                        <Key size={12} /> <code className="bg-black/30 px-1 rounded">{site.site_key}</code>
                        <button
                          type="button"
                          onClick={() => copySiteKey(site.site_key)}
                          className="text-[#FF5B00] hover:underline ml-1"
                        >
                          {copyKey === site.site_key ? 'Copied!' : 'Copy'}
                        </button>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {site.features?.users && <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-300">Users</span>}
                      {site.features?.analytics && <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300">Analytics</span>}
                      {site.features?.ecommerce && <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300">Ecommerce</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSiteId(site.id);
                          setEditSiteDomain(site.domain);
                          setEditSiteName(site.name);
                          setEditSiteFeatures({ ...site.features });
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(site.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {sites.length === 0 && (
                <p className="text-gray-400 text-center py-8">No sites yet. Add one to get a site key for client CMS.</p>
              )}
            </div>
          )}
          {tab === 'analytics' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>
              <p className="text-gray-400">Connect Google Analytics or Business Profile. Coming soon.</p>
            </div>
          )}
          {tab === 'ecommerce' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Ecommerce</h1>
              <p className="text-gray-400">Products and pricing. Coming soon.</p>
            </div>
          )}
          {tab === 'users' && (
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-white mb-6">Users</h1>
              <p className="text-gray-400 text-sm mb-6">Users who can log in at /login (ansatt). Set role per user: only &quot;employee&quot; can access the Ansatt page. New users get role &quot;none&quot; by default.</p>

              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
                <h2 className="text-lg font-medium text-white mb-4">Add user</h2>
                <form onSubmit={handleAddUser} className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Username</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="e.g. email or username"
                      className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500 w-56"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Password</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="New password"
                      className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white placeholder-gray-500 w-48"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !userForm.username.trim() || !userForm.password}
                    className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200] disabled:opacity-50"
                  >
                    Add user
                  </button>
                </form>
              </div>

              <div className="rounded-xl bg-[#2a2a2a] border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-gray-400 font-medium">Username</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Role</th>
                      <th className="px-4 py-3 text-gray-400 font-medium">Created</th>
                      <th className="px-4 py-3 text-gray-400 font-medium w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">
                          {editingId === u.id ? (
                            <input
                              type="text"
                              defaultValue={u.username}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== u.username) handleUpdateUser(u.id, v);
                                setEditingId(null);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                              className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-48"
                            />
                          ) : (
                            <span onClick={() => setEditingId(u.id)} className="cursor-pointer hover:underline">{u.username}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleUserRoleChange(u.id, e.target.value as UserRole)}
                            disabled={userRoleSaving === u.id}
                            className="bg-[#1a1a1a] border border-white/20 text-white rounded px-2 py-1 text-sm min-w-[100px] disabled:opacity-50"
                          >
                            <option value="none">None</option>
                            <option value="employee">Employee</option>
                            <option value="client">Client</option>
                          </select>
                          {userRoleSaving === u.id && <span className="text-gray-500 text-xs ml-1">Saving…</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {editingId === u.id ? (
                              <>
                                <input
                                  type="password"
                                  placeholder="New password"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-32 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => editPassword && handleUpdateUser(u.id, undefined, editPassword)}
                                  className="text-xs px-2 py-1 rounded bg-[#FF5B00] text-white"
                                >
                                  Set password
                                </button>
                                <button type="button" onClick={() => { setEditingId(null); setEditPassword(''); }} className="text-gray-400 hover:text-white text-xs">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(u.id)}
                                  className="text-xs text-[#FF5B00] hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-xs text-red-400 hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="px-4 py-8 text-gray-400 text-center">No users yet. Add one above.</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {addSiteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Add site</h2>
            <form onSubmit={handleAddSite} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={addSiteName}
                  onChange={(e) => setAddSiteName(e.target.value)}
                  placeholder="e.g. Mong Sushi"
                  className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Domain</label>
                <input
                  type="text"
                  value={addSiteDomain}
                  onChange={(e) => setAddSiteDomain(e.target.value)}
                  placeholder="e.g. mongsushi.no"
                  className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Add</button>
                <button type="button" onClick={() => { setAddSiteOpen(false); setAddSiteName(''); setAddSiteDomain(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </form>
            <p className="text-gray-500 text-xs mt-4">After adding, copy the site key and set CMS_SITE_KEY in the client project env.</p>
          </div>
        </div>
      )}

      {editingSiteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Edit site</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Domain</label>
                <input
                  type="text"
                  value={editSiteDomain}
                  onChange={(e) => setEditSiteDomain(e.target.value)}
                  placeholder="mongsushi.no"
                  className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Features</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-white">
                    <input type="checkbox" checked={editSiteFeatures.users} onChange={(e) => setEditSiteFeatures((f) => ({ ...f, users: e.target.checked }))} className="rounded" />
                    Users
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input type="checkbox" checked={editSiteFeatures.analytics} onChange={(e) => setEditSiteFeatures((f) => ({ ...f, analytics: e.target.checked }))} className="rounded" />
                    Analytics
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input type="checkbox" checked={editSiteFeatures.ecommerce} onChange={(e) => setEditSiteFeatures((f) => ({ ...f, ecommerce: e.target.checked }))} className="rounded" />
                    Ecommerce
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleUpdateSite(editingSiteId)} disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setEditingSiteId(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {changePasswordOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Change my password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                required
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                required
              />
              {changePasswordError && <p className="text-red-400 text-sm">{changePasswordError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium">Save</button>
                <button type="button" onClick={() => { setChangePasswordOpen(false); setChangePasswordError(''); setCurrentPassword(''); setNewPassword(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
