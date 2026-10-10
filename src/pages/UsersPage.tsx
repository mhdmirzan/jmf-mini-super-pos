import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { userService, settingsService } from '../services/api';
import type { User, UserRole } from '../types';
import {
  Button,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  PageHeader,
  Toast,
  EmptyState,
} from '../components/common';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const roleUpper = (currentUser?.role || '').toUpperCase();
  const isSuperAdmin = roleUpper === 'SUPER_ADMIN';
  const isAdmin = roleUpper === 'ADMIN';

  if (!isSuperAdmin && !isAdmin) {
    return <Navigate to="/pos" replace />;
  }

  const [users, setUsers] = useState<User[]>([]);
  const [maxUsers, setMaxUsers] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [addForm, setAddForm] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'CASHIER' as UserRole,
  });

  const [editForm, setEditForm] = useState({
    username: '',
    fullName: '',
    role: 'CASHIER' as UserRole,
    isActive: 1,
    newPassword: '',
  });

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const canChangePasswordFor = (u: User) => {
    const targetRole = (u.role || '').toUpperCase();
    if (isSuperAdmin) {
      if (targetRole === 'SUPER_ADMIN') return u.id === currentUser?.id;
      return targetRole === 'ADMIN' || targetRole === 'CASHIER';
    }
    if (isAdmin) return targetRole === 'CASHIER';
    return false;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const uRes = await userService.list(currentUser?.role);
      if (uRes.success && uRes.users) {
        setUsers(uRes.users);
      } else if (uRes.error) {
        showToast(uRes.error, 'error');
      }

      if (isSuperAdmin) {
        const sRes = await settingsService.get('MAX_USERS');
        if (sRes.success && sRes.setting) {
          setMaxUsers(parseInt(sRes.setting.setting_value, 10) || 5);
        }
      }
    } catch (err: any) {
      showToast('Error loading users: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeUsersCount = users.filter((u) => u.is_active === 1).length;
  const isLimitReached = activeUsersCount >= maxUsers;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    if (!addForm.username.trim() || !addForm.password || !addForm.fullName.trim()) {
      showToast('All fields are required', 'error');
      return;
    }

    try {
      const res = await userService.create({
        username: addForm.username.trim().toLowerCase().replace(/\s+/g, ''),
        password: addForm.password,
        fullName: addForm.fullName.trim(),
        role: addForm.role,
        createdBy: currentUser?.id,
        requesterRole: currentUser?.role,
      });

      if (res.success) {
        showToast(`User ${addForm.username} created successfully`, 'success');
        setIsAddModalOpen(false);
        setAddForm({ username: '', fullName: '', password: '', role: 'CASHIER' });
        loadData();
      } else {
        showToast(res.error || 'Failed to create user', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating user', 'error');
    }
  };

  const openEditModal = (u: User) => {
    if (!isSuperAdmin) return;
    setEditingUser(u);
    setEditForm({
      username: u.username,
      fullName: u.fullName || u.full_name || '',
      role: (u.role || 'CASHIER').toUpperCase() as UserRole,
      isActive: u.is_active ?? 1,
      newPassword: '',
    });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !isSuperAdmin) return;

    if (editForm.newPassword.trim() && !canChangePasswordFor(editingUser)) {
      showToast('You cannot change this user\'s password', 'error');
      return;
    }

    try {
      const res = await userService.update({
        id: editingUser.id,
        username: editForm.username.trim().toLowerCase().replace(/\s+/g, ''),
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
        password: editForm.newPassword.trim() ? editForm.newPassword : undefined,
        updatedBy: currentUser?.id,
        requesterRole: currentUser?.role,
      });

      if (res.success) {
        showToast('User updated successfully', 'success');
        setEditingUser(null);
        loadData();
      } else {
        showToast(res.error || 'Failed to update user', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating user', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (!newPassword.trim()) {
      showToast('Enter a new password', 'error');
      return;
    }
    if (!canChangePasswordFor(passwordUser)) {
      showToast('You cannot change this user\'s password', 'error');
      return;
    }

    try {
      const res = await userService.update({
        id: passwordUser.id,
        password: newPassword.trim(),
        updatedBy: currentUser?.id,
        requesterRole: currentUser?.role,
      });

      if (res.success) {
        showToast(`Password updated for ${passwordUser.username}`, 'success');
        setPasswordUser(null);
        setNewPassword('');
      } else {
        showToast(res.error || 'Failed to change password', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error changing password', 'error');
    }
  };

  const handleToggleActive = async (u: User) => {
    if (!isSuperAdmin) return;
    const nextState = u.is_active === 1 ? 0 : 1;
    if (nextState === 1 && isLimitReached) {
      showToast(`Cannot activate user: MAX_USERS limit of ${maxUsers} reached`, 'error');
      return;
    }

    try {
      const res = await userService.update({
        id: u.id,
        isActive: nextState,
        updatedBy: currentUser?.id,
        requesterRole: currentUser?.role,
      });
      if (res.success) {
        showToast(`User ${u.username} ${nextState === 1 ? 'activated' : 'disabled'}`, 'success');
        loadData();
      } else {
        showToast(res.error || 'Failed to update user status', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating user', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const nameMatch =
      (u.fullName || u.full_name || '').toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q);
    const roleMatch = roleFilter === 'ALL' || u.role === roleFilter;
    const statusMatch =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' ? u.is_active === 1 : u.is_active === 0);
    return nameMatch && roleMatch && statusMatch;
  });

  return (
    <div className="p-4 h-full flex flex-col select-none gap-3 bg-[var(--pos-bg)]">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <PageHeader
        title={isSuperAdmin ? 'Users' : 'Cashier Passwords'}
        subtitle={
          isSuperAdmin
            ? 'Manage accounts. Super Admin can change own, Admin, and Cashier passwords.'
            : 'Admin can change cashier passwords only.'
        }
        count={isSuperAdmin ? `${activeUsersCount} / ${maxUsers} users` : filteredUsers.length}
        actions={
          isSuperAdmin ? (
            <Button
              variant="primary"
              size="sm"
              disabled={isLimitReached}
              onClick={() => {
                if (isLimitReached) {
                  showToast(
                    `Limit reached (${maxUsers}/${maxUsers}). Disable an existing account or increase MAX_USERS.`,
                    'error'
                  );
                  return;
                }
                setIsAddModalOpen(true);
              }}
            >
              + Add User
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center shrink-0 py-1">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username..."
          />
        </div>

        {isSuperAdmin && (
          <>
            <div className="w-36">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Roles' },
                  { value: 'CASHIER', label: 'Cashier' },
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'SUPER_ADMIN', label: 'Super Admin' },
                ]}
              />
            </div>
            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Status' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'DISABLED', label: 'Disabled' },
                ]}
              />
            </div>
          </>
        )}
      </div>

      <div className="pos-card flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead align="center">Status</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-[var(--pos-text-muted)]">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <EmptyState
                    title="No users found"
                    description={
                      isAdmin
                        ? 'No cashier accounts are available.'
                        : 'No user accounts matched the filter criteria.'
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold text-xs text-[var(--pos-text)]">
                    {u.fullName || u.full_name || u.username}
                  </TableCell>
                  <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                    {u.username}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium text-[var(--pos-text)]">
                      {u.role === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : u.role === 'ADMIN'
                          ? 'Admin'
                          : 'Cashier'}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        u.is_active === 1
                          ? 'bg-emerald-50 text-[var(--pos-success)] border border-emerald-200'
                          : 'bg-slate-100 text-[var(--pos-text-muted)] border border-slate-200'
                      }`}
                    >
                      {u.is_active === 1 ? 'Active' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canChangePasswordFor(u) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPasswordUser(u);
                            setNewPassword('');
                          }}
                        >
                          Change Password
                        </Button>
                      )}
                      {isSuperAdmin && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => openEditModal(u)}>
                            Edit
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                              {u.is_active === 1 ? 'Disable' : 'Enable'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isAddModalOpen && isSuperAdmin && (
        <Dialog isOpen={true} onClose={() => setIsAddModalOpen(false)} title="Add New User" size="sm">
          <form onSubmit={handleAddUser} className="space-y-3">
            <Input
              label="Full Name *"
              required
              autoFocus
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
            />
            <Input
              label="Username *"
              required
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
              monospace
            />
            <Input
              label="Password *"
              type="password"
              required
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            />
            <Select
              label="Role *"
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
              options={[
                { value: 'CASHIER', label: 'Cashier' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
              ]}
            />
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create User
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {editingUser && isSuperAdmin && (
        <Dialog
          isOpen={true}
          onClose={() => setEditingUser(null)}
          title={`Edit User: ${editingUser.username}`}
          size="sm"
        >
          <form onSubmit={handleEditUser} className="space-y-3">
            <Input
              label="Full Name *"
              required
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
            <Input
              label="Username *"
              required
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              monospace
            />
            {canChangePasswordFor(editingUser) && (
              <Input
                label="New Password (optional)"
                type="password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
            )}
            <Select
              label="Role *"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              options={[
                { value: 'CASHIER', label: 'Cashier' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
              ]}
            />
            <Select
              label="Account Status *"
              value={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: parseInt(e.target.value, 10) })}
              options={[
                { value: 1, label: 'Active' },
                { value: 0, label: 'Disabled' },
              ]}
            />
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {passwordUser && (
        <Dialog
          isOpen={true}
          onClose={() => {
            setPasswordUser(null);
            setNewPassword('');
          }}
          title={`Change Password: ${passwordUser.username}`}
          size="sm"
        >
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input
              label="New Password *"
              type="password"
              required
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPasswordUser(null);
                  setNewPassword('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Update Password
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
