import React, { useState } from 'react';
import type { AdminUser, UserRole } from '../shared';

type Props = {
  users: AdminUser[];
  loading: boolean;
  userForm: { username: string; password: string };
  editingId: string | null;
  editPassword: string;
  userRoleSaving: string | null;
  onUserFormChange: (next: { username: string; password: string }) => void;
  onAddUser: (e: React.FormEvent) => void;
  onStartEdit: (id: string | null) => void;
  onEditPasswordChange: (value: string) => void;
  onUpdateUser: (id: string, newUsername?: string, newPassword?: string) => void;
  onDeleteUser: (id: string) => void;
  onRoleChange: (id: string, role: UserRole) => void;
};

export function UsersSection(props: Props) {
  const {
    users,
    loading,
    userForm,
    editingId,
    editPassword,
    userRoleSaving,
    onUserFormChange,
    onAddUser,
    onStartEdit,
    onEditPasswordChange,
    onUpdateUser,
    onDeleteUser,
    onRoleChange,
  } = props;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">Users</h1>
      <p className="text-gray-400 text-sm mb-6">Users who can log in at `/login` as employees. New users default to role `none`.</p>

      <div className="rounded-xl bg-[#2a2a2a] border border-white/10 p-6 mb-8">
        <h2 className="text-lg font-medium text-white mb-4">Add user</h2>
        <form onSubmit={onAddUser} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={userForm.username}
              onChange={(e) => onUserFormChange({ ...userForm, username: e.target.value })}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white w-56"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => onUserFormChange({ ...userForm, password: e.target.value })}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/20 text-white w-48"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !userForm.username.trim() || !userForm.password}
            className="px-4 py-2 rounded-lg bg-[#FF5B00] text-white font-medium disabled:opacity-50"
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
            {users.map((user) => (
              <EditableUserRow
                key={user.id}
                user={user}
                editing={editingId === user.id}
                editPassword={editPassword}
                userRoleSaving={userRoleSaving === user.id}
                onStartEdit={onStartEdit}
                onEditPasswordChange={onEditPasswordChange}
                onUpdateUser={onUpdateUser}
                onDeleteUser={onDeleteUser}
                onRoleChange={onRoleChange}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="px-4 py-8 text-gray-400 text-center">No users yet. Add one above.</p>}
      </div>
    </div>
  );
}

const EditableUserRow: React.FC<{
  user: AdminUser;
  editing: boolean;
  editPassword: string;
  userRoleSaving: boolean;
  onStartEdit: (id: string | null) => void;
  onEditPasswordChange: (value: string) => void;
  onUpdateUser: (id: string, newUsername?: string, newPassword?: string) => void;
  onDeleteUser: (id: string) => void;
  onRoleChange: (id: string, role: UserRole) => void;
}> = function EditableUserRow({
  user,
  editing,
  editPassword,
  userRoleSaving,
  onStartEdit,
  onEditPasswordChange,
  onUpdateUser,
  onDeleteUser,
  onRoleChange,
}) {
  const [draftUsername, setDraftUsername] = useState(user.username);

  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3 text-white">
        {editing ? (
          <input
            type="text"
            value={draftUsername}
            onChange={(e) => setDraftUsername(e.target.value)}
            className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-48"
          />
        ) : (
          <span onClick={() => onStartEdit(user.id)} className="cursor-pointer hover:underline">{user.username}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          onChange={(e) => onRoleChange(user.id, e.target.value as UserRole)}
          disabled={userRoleSaving}
          className="bg-[#1a1a1a] border border-white/20 text-white rounded px-2 py-1 text-sm min-w-[100px] disabled:opacity-50"
        >
          <option value="none">None</option>
          <option value="employee">Employee</option>
          <option value="client">Client</option>
        </select>
      </td>
      <td className="px-4 py-3 text-gray-400 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="password"
                placeholder="New password"
                value={editPassword}
                onChange={(e) => onEditPasswordChange(e.target.value)}
                className="px-2 py-1 rounded bg-[#1a1a1a] border border-white/20 text-white w-32 text-sm"
              />
              <button type="button" onClick={() => onUpdateUser(user.id, draftUsername)} className="text-xs px-2 py-1 rounded bg-white/10 text-white">
                Save name
              </button>
              <button type="button" onClick={() => editPassword && onUpdateUser(user.id, undefined, editPassword)} className="text-xs px-2 py-1 rounded bg-[#FF5B00] text-white">
                Set password
              </button>
              <button type="button" onClick={() => onStartEdit(null)} className="text-gray-400 hover:text-white text-xs">Cancel</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onStartEdit(user.id)} className="text-xs text-[#FF5B00] hover:underline">Edit</button>
              <button type="button" onClick={() => onDeleteUser(user.id)} className="text-xs text-red-400 hover:underline">Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
