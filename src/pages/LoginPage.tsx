import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { settingsService } from '../services/api';
import { Button, Input, Toast } from '../components/common';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    if (user) {
      const role = (user.role || '').toUpperCase();
      navigate(role === 'CASHIER' ? '/pos' : '/menu', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.get('SHOP_NAME');
        if (cancelled) return;
        const raw =
          res?.setting?.setting_value ??
          res?.value ??
          (typeof res?.setting === 'string' ? res.setting : '');
        if (raw) setShopName(String(raw).trim());
      } catch {
        // keep empty until Admin sets a store name
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter username and password');
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
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen bg-[var(--pos-bg)] !p-10">
      <div className="login-card !m-6 !p-10 !rounded-lg">
        <h1 className="text-lg font-bold text-[var(--pos-text)] text-center !mb-7">
          {shopName || 'Your Store'}
        </h1>

        {error && (
          <div className="login-error !mb-4">
            <Toast message={error} type="error" onClose={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form !gap-5">
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
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <div className="!pt-1">
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
        </form>

        <p className="login-footer">Powered by Buyra</p>
      </div>
    </div>
  );
}
