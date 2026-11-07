import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BrandMark, ErrorNote, Primary } from '../design/ui';
import { useWorkspace } from '../app/context';
import { enterpriseService } from '../services';
import { signIn, signOut } from '../services/session';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setWorkspace } = useWorkspace();
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
    } catch (error) { signOut(); setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="welcome">
    <div className="welcome-brand"><BrandMark /><span>SmartScan</span></div>
    <span className="eyebrow">YOUR BUSINESS, CONNECTED</span>
    <h1>Welcome<br />back.</h1>
    <p className="welcome-copy">Sign in with your SmartScan business account.</p>
    <form className="form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="login-username">Username</label>
      <input id="login-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required
        maxLength={50} value={username} disabled={busy} onChange={e => setUsername(e.target.value)} />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" required maxLength={200}
        value={password} disabled={busy} onChange={e => setPassword(e.target.value)} />
      <ErrorNote>{error}</ErrorNote>
      <Primary busy={busy}>Sign in <ArrowRight size={18} /></Primary>
    </form>
    <p className="support">Your integrated wallet signs approved actions automatically. No wallet app is required.</p>
    <p className="simulation-note">Connected to the shared SmartScan database · Sepolia test network</p>
  </main>;
}
