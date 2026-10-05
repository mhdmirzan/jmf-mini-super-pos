import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/api';
import { Button, Input, Toast } from '../components/common';

interface ActiveUserSummary {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUserSummary[]>([]);

  // If already logged in, redirect appropriately
  useEffect(() => {
    if (user) {
      const role = (user.role || '').toUpperCase();
      navigate(role === 'CASHIER' ? '/pos' : '/menu', { replace: true });
    }
  }, [user, navigate]);

  // Load active registered users for quick terminal selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await authService.getActiveUsers();
        if (res.success && Array.isArray(res.users)) {
          setActiveUsers(res.users);
        }
      } catch {
        // Fallback
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter both username and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await login(cleanUsername, password);
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (u: ActiveUserSummary) => {
    setUsername(u.username);
    setPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--pos-primary)] p-4 select-none">
      <div className="w-full max-w-sm bg-white rounded border border-[var(--pos-border)] shadow-lg p-6 sm:p-7">
        {/* Terminal Header */}
        <div className="text-center mb-6">
          <div className="inline-block px-2.5 py-1 rounded bg-[var(--pos-bg-subtle)] text-[var(--pos-text-muted)] font-mono text-xs font-semibold uppercase tracking-wider mb-2 border border-[var(--pos-border)]">
            POS Terminal 01
          </div>
          <h1 className="text-xl font-bold text-[var(--pos-text)] tracking-tight">
            MINI SUPER POS
          </h1>
          <p className="text-xs text-[var(--pos-text-muted)] mt-0.5">
            Offline-First Retail Checkout
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4">
            <Toast message={error} type="error" onClose={() => setError(null)} />
          </div>
        )}

        {/* Quick User Selector Chips */}
        {activeUsers.length > 0 && (
          <div className="mb-4 p-2.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pos-text-muted)] mb-1.5">
              Select Cashier Account
            </div>
            <div className="flex flex-wrap gap-1">
              {activeUsers.map((u) => {
                const isSelected = username.toLowerCase() === u.username.toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--pos-primary)] text-white border-[var(--pos-primary)] font-semibold'
                        : 'bg-white text-[var(--pos-text)] border-[var(--pos-border)] hover:bg-[var(--pos-bg-subtle)]'
                    }`}
                  >
                    <span>{u.username}</span>
                    <span className="text-[10px] ml-1 opacity-70 uppercase font-mono">
                      ({u.role === 'SUPER_ADMIN' ? 'SUPER' : u.role})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            monospace
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            rightIcon={
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Terminal'}
            </Button>
          </div>
        </form>

        {/* Default credentials reference */}
        <div className="mt-5 pt-3 border-t border-[var(--pos-border)] text-center text-[11px] text-[var(--pos-text-muted)] space-y-0.5">
          <div>superadmin / admin123</div>
          <div>admin / admin123</div>
          <div>cashier / cashier123</div>
        </div>
      </div>
    </div>
  );
}
