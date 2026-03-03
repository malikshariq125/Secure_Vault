import { useState, useEffect } from 'react';
import { hashMasterPassword, checkBruteForce, recordFailedAttempt, resetFailedAttempts, generateSessionToken, logEvent } from '../utils/security';
import { Lock, AlertTriangle } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bruteForceState, setBruteForceState] = useState(checkBruteForce());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [expectedCaptcha, setExpectedCaptcha] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const state = checkBruteForce();
      setBruteForceState(state);
      if (!state.locked && state.requireCaptcha && expectedCaptcha === 0) {
        generateCaptcha();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expectedCaptcha]);

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setExpectedCaptcha(num1 + num2);
    setError(`Please solve captcha: What is ${num1} + ${num2}?`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (bruteForceState.locked) {
      setError(`Locked out. Try again in ${bruteForceState.remaining} seconds.`);
      return;
    }

    if (bruteForceState.requireCaptcha && parseInt(captchaAnswer) !== expectedCaptcha) {
      setError('Incorrect CAPTCHA answer.');
      recordFailedAttempt();
      setBruteForceState(checkBruteForce());
      generateCaptcha();
      return;
    }

    const storedHash = localStorage.getItem('masterPasswordHash');
    const inputHash = await hashMasterPassword(password);

    if (storedHash === inputHash) {
      resetFailedAttempts();
      const token = generateSessionToken();
      sessionStorage.setItem('sessionToken', token);
      logEvent('LOGIN_SUCCESS', 'User logged in successfully');
      onLogin(password);
    } else {
      recordFailedAttempt();
      setBruteForceState(checkBruteForce());
      setError('Incorrect password');
      setPassword('');
      if (checkBruteForce().requireCaptcha) {
        generateCaptcha();
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
            <Lock className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-white text-center mb-2">Vault Access</h2>
        <p className="text-zinc-400 text-center mb-8 text-sm">Enter your master password to decrypt notes.</p>

        {bruteForceState.locked ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-red-400 font-medium mb-2">Security Lockout</h3>
            <p className="text-red-400/80 text-sm">
              Too many failed attempts. Try again in {Math.floor(bruteForceState.remaining / 60)}:{(bruteForceState.remaining % 60).toString().padStart(2, '0')}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Master Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {bruteForceState.requireCaptcha && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Security Check</label>
                <input
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="Enter CAPTCHA answer"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Unlock Vault
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
