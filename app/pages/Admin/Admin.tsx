import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FileText, Globe, LogOut, ShoppingBag, Users, UserPlus } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { ClientSitesSection } from './sections/ClientSitesSection';
import { PagesSection } from './sections/PagesSection';
import { UsersSection } from './sections/UsersSection';
import { EmployeesSection } from './sections/EmployeesSection';
import {
  API,
  DEFAULT_FEATURES,
  authHeaders,
  clearToken,
  getToken,
  setToken,
  type AdminUser,
  type Features,
  type Site,
  type Tab,
  type UserRole,
} from './shared';

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
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.features) setFeatures(data.features);
        if (data?.name) setSiteName(data.name);
      })
      .catch(() => setFeatures(DEFAULT_FEATURES));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoggedIn(false);
      return;
    }
    Promise.all([fetchUsers(), fetchSites()]).then(() => setLoggedIn(true)).catch(() => setLoggedIn(false));
  }, [fetchUsers, fetchSites]);

  async function handleLogin(e: React.FormEvent) {
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
      await Promise.all([fetchUsers(), fetchSites()]);
    } catch {
      setLoginError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
  }

  async function handleAddUser(e: React.FormEvent) {
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
      await fetchUsers();
    } finally {
      setLoading(false);
    }
  }

  async function handleUserRoleChange(id: string, role: UserRole) {
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
      setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role } : user)));
    } finally {
      setUserRoleSaving(null);
    }
  }

  async function handleUpdateUser(id: string, newUsername?: string, newPassword?: string) {
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
      await fetchUsers();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Delete this user? They will no longer be able to log in.')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Delete failed');
        return;
      }
      await fetchUsers();
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePasswordError('');
    const res = await fetch(`${API}/admin/change-password`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChangePasswordError(data.message || 'Failed');
      return;
    }
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
  }

  async function handleAddSite(e: React.FormEvent) {
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
      await fetchSites();
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSite(id: string) {
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
      await fetchSites();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSite(id: string) {
    if (!confirm('Remove this site from the hub?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/hub/sites/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed');
        return;
      }
      await fetchSites();
    } finally {
      setLoading(false);
    }
  }

  function copySiteKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopyKey(key);
    setTimeout(() => setCopyKey(null), 2000);
  }

  if (loggedIn === null) {
    return <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!loggedIn) {
    return (
      <>
        <Helmet><title>Admin Login – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-8">
            <h1 className="text-xl font-bold text-white mb-6">Admin</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white" required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/20 text-white" required />
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-medium text-white bg-[#FF5B00] hover:bg-[#e55200] disabled:opacity-50">
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <p className="mt-4 text-center"><Link to="/" className="text-sm text-gray-400 hover:text-white">← Back to site</Link></p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Admin – Asoldi</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="min-h-screen bg-[#1e1e1e] flex">
        <aside className="w-60 bg-[#23282d] text-white flex flex-col fixed inset-y-0 left-0">
          <div className="p-4 border-b border-white/10">
            <Link to="/" className="text-lg font-semibold text-white">{siteName || 'Admin'}</Link>
            <p className="text-xs text-gray-400 mt-1">Client CMS</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            <SidebarButton active={tab === 'clients'} onClick={() => setTab('clients')} icon={<Globe size={18} />} label="Manage clients" />
            <SidebarButton active={tab === 'pages'} onClick={() => setTab('pages')} icon={<FileText size={18} />} label="Pages" />
            {features.users !== false && <SidebarButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={18} />} label="Users" />}
            <SidebarButton active={tab === 'employees'} onClick={() => setTab('employees')} icon={<UserPlus size={18} />} label="Employees" />
            {features.analytics && <SidebarButton active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={<BarChart3 size={18} />} label="Analytics" />}
            {features.ecommerce && <SidebarButton active={tab === 'ecommerce'} onClick={() => setTab('ecommerce')} icon={<ShoppingBag size={18} />} label="Ecommerce" />}
          </nav>
          <div className="p-2 border-t border-white/10 space-y-1">
            <button onClick={() => setChangePasswordOpen(true)} className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white">Change my password</button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white">
              <LogOut size={18} /> Log out
            </button>
          </div>
        </aside>

        <main className="flex-1 ml-60 p-8">
          {tab === 'clients' && (
            <ClientSitesSection
              sites={sites}
              loading={loading}
              copyKey={copyKey}
              onAdd={() => setAddSiteOpen(true)}
              onEdit={(site) => {
                setEditingSiteId(site.id);
                setEditSiteDomain(site.domain);
                setEditSiteName(site.name);
                setEditSiteFeatures({ users: !!site.features.users, analytics: !!site.features.analytics, ecommerce: !!site.features.ecommerce });
              }}
              onDelete={handleDeleteSite}
              onCopyKey={copySiteKey}
            />
          )}
          {tab === 'pages' && <PagesSection />}
          {tab === 'users' && (
            <UsersSection
              users={users}
              loading={loading}
              userForm={userForm}
              editingId={editingId}
              editPassword={editPassword}
              userRoleSaving={userRoleSaving}
              onUserFormChange={setUserForm}
              onAddUser={handleAddUser}
              onStartEdit={setEditingId}
              onEditPasswordChange={setEditPassword}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onRoleChange={handleUserRoleChange}
            />
          )}
          {tab === 'employees' && <EmployeesSection />}
          {tab === 'analytics' && <PlaceholderSection title="Analytics" description="Connect Google Analytics or Business Profile. Coming soon." />}
          {tab === 'ecommerce' && <PlaceholderSection title="Ecommerce" description="Products and pricing. Coming soon." />}
        </main>
      </div>

      {addSiteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Add site</h2>
            <form onSubmit={handleAddSite} className="space-y-4">
              <input type="text" value={addSiteName} onChange={(e) => setAddSiteName(e.target.value)} placeholder="Site name" className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" />
              <input type="text" value={addSiteDomain} onChange={(e) => setAddSiteDomain(e.target.value)} placeholder="Domain" className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50">Add</button>
                <button type="button" onClick={() => setAddSiteOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSiteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-xl border border-white/10 p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-4">Edit site</h2>
            <div className="space-y-4">
              <input type="text" value={editSiteName} onChange={(e) => setEditSiteName(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" />
              <input type="text" value={editSiteDomain} onChange={(e) => setEditSiteDomain(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" />
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={editSiteFeatures.users} onChange={(e) => setEditSiteFeatures((prev) => ({ ...prev, users: e.target.checked }))} /> Users</label>
                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={editSiteFeatures.analytics} onChange={(e) => setEditSiteFeatures((prev) => ({ ...prev, analytics: e.target.checked }))} /> Analytics</label>
                <label className="flex items-center gap-2 text-white"><input type="checkbox" checked={editSiteFeatures.ecommerce} onChange={(e) => setEditSiteFeatures((prev) => ({ ...prev, ecommerce: e.target.checked }))} /> Ecommerce</label>
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
              <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" required />
              <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white" required />
              {changePasswordError && <p className="text-red-400 text-sm">{changePasswordError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium">Save</button>
                <button type="button" onClick={() => setChangePasswordOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-white">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

function SidebarButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${active ? 'bg-[#FF5B00] text-white' : 'text-gray-300 hover:bg-white/10'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
