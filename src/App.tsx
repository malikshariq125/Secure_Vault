/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Setup from './components/Setup';
import Login from './components/Login';
import Vault from './components/Vault';

export default function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(false);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);

  useEffect(() => {
    const hash = localStorage.getItem('masterPasswordHash');
    if (hash) {
      setIsSetupComplete(true);
    }
  }, []);

  const handleSetupComplete = () => {
    setIsSetupComplete(true);
  };

  const handleLogin = (password: string) => {
    setMasterPassword(password);
  };

  const handleLogout = (reason: string) => {
    setMasterPassword(null);
    sessionStorage.removeItem('sessionToken');
    if (reason === 'timeout') {
      alert('Session expired due to inactivity.');
    }
  };

  if (!isSetupComplete) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  if (!masterPassword) {
    return <Login onLogin={handleLogin} />;
  }

  return <Vault masterPassword={masterPassword} onLogout={handleLogout} />;
}

