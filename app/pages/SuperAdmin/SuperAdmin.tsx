import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Plus, Globe, Key, Edit2, Trash2, Users } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const API = '/api';

type UserRole = 'employee' | 'client' | 'none';

type User = {
  id: string;
  username: string;
  createdAt: string;
  role: UserRole;
};

function getToken() {
  return localStorage.getItem('superAdminToken');
}

function setToken(t: string) {
  localStorage.setItem('superAdminToken', t);
}

function clearToken() {
  localStorage.removeItem('superAdminToken');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type Site = {
  id: string;
  site_key: string;
  domain: string;
  name: string;
  features: { users?: boolean; analytics?: boolean; ecommerce?: boolean };
  createdAt: string;
};

export const SuperAdmin = () => {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDomain, setAddDomain] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDomain, setEditDomain] = useState('');
  const [editName, setEditName] = useState('');
  const [editFeatures, setEditFeatures] = useState({ users: true, analytics: false, ecommerce: false });
  const [copyKey, setCopyKey] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserUsername, setAddUserUsername] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [userRoleSaving, setUserRoleSaving] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    const res = await fetch(`${API}/hub/sites`, { headers: authHeaders() });
    if (res.status === 401) {
      clearToken();
      setLoggedIn(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setSites(data);
  }, []);

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

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoggedIn(false);
      return;
    }
    Promise.all([fetchSites(), fetchUsers()]).then(() => setLoggedIn(true)).catch(() => setLoggedIn(false));
  }, [fetchSites, fetchUsers]);

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
      fetchSites();
    } catch {
      setLoginError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/hub/sites`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName || 'New site', domain: addDomain.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      setAddOpen(false);
      setAddName('');
      setAddDomain('');
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
        body: JSON.stringify({ domain: editDomain, name: editName, features: editFeatures }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      setEditingId(null);
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: addUserUsername.trim(), password: addUserPassword, role: 'none' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Failed');
        return;
      }
      setAddUserOpen(false);
      setAddUserUsername('');
      setAddUserPassword('');
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
        <Helmet><title>Super Admin – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-8">
            <h1 className="text-xl font-bold text-white mb-2">Super Admin</h1>
            <p className="text-gray-400 text-sm mb-6">Hub for client CMS. Same login as this site’s /admin.</p>
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
      <Helmet><title>Super Admin – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="min-h-screen bg-[#1e1e1e]">
        <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Super Admin</h1>
            <p className="text-gray-400 text-sm">Manage client sites and features. Changing domain here keeps the same site key so client config does not break.</p>
          </div>
          <button
            onClick={() => { clearToken(); setLoggedIn(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} /> Log out
          </button>
        </header>

        <main className="p-6 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Sites</h2>
            <button
              onClick={() => setAddOpen(true)}
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
                      setEditingId(site.id);
                      setEditDomain(site.domain);
                      setEditName(site.name);
                      setEditFeatures({ ...site.features });
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

          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users size={20} /> Users (roles for login)
              </h2>
              <button
                type="button"
                onClick={() => setAddUserOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium hover:bg-[#e55200]"
              >
                <Plus size={18} /> Add user
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-4">Assign role per user. Default is &quot;none&quot;. Only &quot;employee&quot; can access the Ansatt page.</p>
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl bg-[#2a2a2a] border border-white/10 p-4 flex flex-wrap items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{user.username}</p>
                    <p className="text-gray-500 text-xs">Created: {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-sm">Role:</label>
                    <select
                      value={user.role}
                      onChange={(e) => handleUserRoleChange(user.id, e.target.value as UserRole)}
                      disabled={userRoleSaving === user.id}
                      className="bg-[#1a1a1a] border border-white/20 text-white rounded-lg px-3 py-2 text-sm min-w-[120px] disabled:opacity-50"
                    >
                      <option value="none">None</option>
                      <option value="employee">Employee</option>
                      <option value="client">Client</option>
                    </select>
                    {userRoleSaving === user.id && <span className="text-gray-500 text-xs">Saving…</span>}
                  </div>
                </div>
              ))}
            </div>
            {users.length === 0 && (
              <p className="text-gray-400 text-center py-6">No users yet. Add a user (default role: none).</p>
            )}
          </div>
        </main>

        {addOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Add site</h2>
              <form onSubmit={handleAddSite} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Mong Sushi"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Domain</label>
                  <input
                    type="text"
                    value={addDomain}
                    onChange={(e) => setAddDomain(e.target.value)}
                    placeholder="e.g. mongsushi.no or seashell-camel-446716.hostingersite.com"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => { setAddOpen(false); setAddName(''); setAddDomain(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
                </div>
              </form>
              <p className="text-gray-500 text-xs mt-4">After adding, copy the site key and set CMS_SITE_KEY in the client project env.</p>
            </div>
          </div>
        )}

        {addUserOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Add user</h2>
              <p className="text-gray-500 text-sm mb-4">New users get role &quot;none&quot; by default. Set role in the Users list after creating.</p>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username (e.g. email)</label>
                  <input
                    type="text"
                    value={addUserUsername}
                    onChange={(e) => setAddUserUsername(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={addUserPassword}
                    onChange={(e) => setAddUserPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Add user</button>
                  <button type="button" onClick={() => { setAddUserOpen(false); setAddUserUsername(''); setAddUserPassword(''); }} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold text-white mb-4">Edit site</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Domain (change when client moves domain)</label>
                  <input
                    type="text"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    placeholder="mongsushi.no"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Features (what client sees in their /admin)</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-white">
                      <input type="checkbox" checked={editFeatures.users} onChange={(e) => setEditFeatures((f) => ({ ...f, users: e.target.checked }))} className="rounded" />
                      Users
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input type="checkbox" checked={editFeatures.analytics} onChange={(e) => setEditFeatures((f) => ({ ...f, analytics: e.target.checked }))} className="rounded" />
                      Analytics
                    </label>
                    <label className="flex items-center gap-2 text-white">
                      <input type="checkbox" checked={editFeatures.ecommerce} onChange={(e) => setEditFeatures((f) => ({ ...f, ecommerce: e.target.checked }))} className="rounded" />
                      Ecommerce
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleUpdateSite(editingId)} disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
