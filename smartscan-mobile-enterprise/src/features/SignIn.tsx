import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { BrandMark, ErrorNote, Primary } from '../design/ui';
import { useWorkspace } from '../app/context';
import { enterpriseService } from '../services';
import { signIn } from '../services/session';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setWorkspace, workspace } = useWorkspace();
  const navigate = useNavigate();
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const user = await signIn(username, password);
      setPassword('');
      const state = await enterpriseService.snapshot();
      const facilities = state.facilities.filter(f => f.accountId === user.username && f.role === user.role);
      const facility = facilities.find(f => f.status === 'active') || facilities[0];
      if (!facility) throw new Error('Your account has no operating facility yet. Ask your SmartScan administrator to provision one.');
      setWorkspace({ accountId: user.username, facilityId: facility.id, role: user.role });
      navigate('/', { replace: true });
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  if (workspace) return <Navigate to="/" replace />;
  return <main className="sign-in">
    <div className="sign-in-layout">
      <div className="welcome-brand"><BrandMark /><span>SmartScan</span></div>
      <header className="sign-in-intro">
        <p className="eyebrow">YOUR BUSINESS, CONNECTED</p>
        <h1>Welcome back.</h1>
        <p>Sign in with your SmartScan business account.</p>
      </header>
      <section className="sign-in-card" aria-label="Account sign in">
        <form className="form sign-in-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="form-field">
            <label htmlFor="login-username">Username</label>
            <input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required
              maxLength={50} value={username} disabled={busy} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={200}
                value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <Primary busy={busy}>Sign in <ArrowRight size={18} /></Primary>
        </form>
        <p className="sign-in-wallet"><ShieldCheck size={20} aria-hidden="true" /><span>Your integrated wallet signs approved actions automatically.</span></p>
      </section>
      <p className="sign-in-network">Sepolia test network</p>
    </div>
  </main>;
}
