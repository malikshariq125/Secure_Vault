import { useState, useEffect } from 'react';
import { calculatePasswordStrength, hashMasterPassword, updateSecurityScore, logEvent } from '../utils/security';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function Setup({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strength, setStrength] = useState({ score: 0, rating: 'very weak' });
  const [error, setError] = useState('');

  useEffect(() => {
    setStrength(calculatePasswordStrength(password));
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length === 0) {
      setError('Password cannot be empty');
      return;
    }

    if (strength.rating === 'strong') {
      updateSecurityScore(10);
      logEvent('SETUP', 'Strong master password set');
    } else {
      updateSecurityScore(-10);
      logEvent('SETUP', 'Weak master password set');
    }

    const hash = await hashMasterPassword(password);
    localStorage.setItem('masterPasswordHash', hash);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-white text-center mb-2">Setup Vault</h2>
        <p className="text-zinc-400 text-center mb-8 text-sm">Create a master password to encrypt your notes.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Master Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              placeholder="Enter a strong password"
            />
            
            {password && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-zinc-400">Password Strength</span>
                  <span className={`text-xs font-medium ${
                    strength.rating === 'strong' ? 'text-emerald-400' :
                    strength.rating === 'weak' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {strength.rating.toUpperCase()}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      strength.rating === 'strong' ? 'bg-emerald-500 w-full' :
                      strength.rating === 'weak' ? 'bg-amber-500 w-2/3' : 'bg-red-500 w-1/3'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              placeholder="Confirm your password"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Initialize Vault
          </button>
        </form>
      </div>
    </div>
  );
}
