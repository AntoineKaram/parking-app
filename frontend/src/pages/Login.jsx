import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🅿️ Company Parking</h1>
        <p className="muted">Book your parking spot for the day.</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Full name
                <input value={form.name} onChange={set('name')} required placeholder="Jane Doe" />
              </label>
              <label>
                Phone (shown to colleagues you block in)
                <input value={form.phone} onChange={set('phone')} required placeholder="+33 6 12 34 56 78" />
              </label>
            </>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} required placeholder="you@company.com" />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
