import { useState, useEffect } from 'react';
import { encryptNote, decryptNote, updateSecurityScore, logEvent, getSecurityScore, getLogs } from '../utils/security';
import { Shield, LogOut, Plus, Trash2, Clock, Activity } from 'lucide-react';

interface Note {
  id: string;
  encryptedContent: string;
  expiresAt: number;
}

interface DecryptedNote extends Note {
  content: string;
}

export default function Vault({ masterPassword, onLogout }: { masterPassword: string, onLogout: (reason: string) => void }) {
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(60);
  const [score, setScore] = useState(getSecurityScore());
  const [logs, setLogs] = useState(getLogs());
  const [showLogs, setShowLogs] = useState(false);

  // Idle timeout logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        updateSecurityScore(-8);
        logEvent('SESSION_TIMEOUT', 'User idled out');
        onLogout('timeout');
      }, 2 * 60 * 1000); // 2 minutes idle timeout
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [onLogout]);

  // Load and decrypt notes
  useEffect(() => {
    const loadNotes = async () => {
      const storedNotes: Note[] = JSON.parse(localStorage.getItem('vaultNotes') || '[]');
      const now = Date.now();
      
      // Filter out expired notes
      const validNotes = storedNotes.filter(n => n.expiresAt > now);
      if (validNotes.length !== storedNotes.length) {
        localStorage.setItem('vaultNotes', JSON.stringify(validNotes));
        logEvent('NOTES_EXPIRED', `${storedNotes.length - validNotes.length} notes auto-deleted`);
      }

      const decrypted: DecryptedNote[] = [];
      for (const note of validNotes) {
        try {
          const content = await decryptNote(note.encryptedContent, masterPassword);
          decrypted.push({ ...note, content });
        } catch (e) {
          console.error("Failed to decrypt note", note.id);
        }
      }
      setNotes(decrypted);
    };
    
    loadNotes();
    
    // Check expiry every minute
    const interval = setInterval(loadNotes, 60000);
    return () => clearInterval(interval);
  }, [masterPassword]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const encryptedContent = await encryptNote(newNote, masterPassword);
      const newNoteObj: Note = {
        id: crypto.randomUUID(),
        encryptedContent,
        expiresAt: Date.now() + expiryMinutes * 60 * 1000
      };

      const storedNotes = JSON.parse(localStorage.getItem('vaultNotes') || '[]');
      storedNotes.push(newNoteObj);
      localStorage.setItem('vaultNotes', JSON.stringify(storedNotes));

      setNotes([...notes, { ...newNoteObj, content: newNote }]);
      setNewNote('');
      logEvent('NOTE_ADDED', `Added note expiring in ${expiryMinutes}m`);
      setLogs(getLogs());
      setScore(getSecurityScore());
    } catch (e) {
      console.error("Encryption failed", e);
    }
  };

  const handleDelete = (id: string) => {
    const storedNotes: Note[] = JSON.parse(localStorage.getItem('vaultNotes') || '[]');
    const updated = storedNotes.filter(n => n.id !== id);
    localStorage.setItem('vaultNotes', JSON.stringify(updated));
    setNotes(notes.filter(n => n.id !== id));
    logEvent('NOTE_DELETED', `Manually deleted note`);
    setLogs(getLogs());
    setScore(getSecurityScore());
  };

  const handleManualLogout = () => {
    updateSecurityScore(5);
    logEvent('LOGOUT_SUCCESS', 'User logged out properly');
    onLogout('manual');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Secure Vault</h1>
              <p className="text-xs text-zinc-500">AES-GCM Encrypted Storage</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Security Score: <span className={score >= 0 ? 'text-emerald-400' : 'text-red-400'}>{score}</span></span>
            </div>
            
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {showLogs ? 'Hide Logs' : 'View Logs'}
            </button>

            <button 
              onClick={handleManualLogout}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl border border-zinc-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleAddNote} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a secret note..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all min-h-[120px] resize-none mb-4"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <select 
                    value={expiryMinutes}
                    onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                    className="bg-zinc-950 border border-zinc-800 text-sm rounded-lg px-3 py-2 text-zinc-300 focus:outline-none"
                  >
                    <option value={1}>1 Minute</option>
                    <option value={5}>5 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={1440}>24 Hours</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl transition-colors font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Encrypt & Save
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Active Notes</h3>
              {notes.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                  <p className="text-zinc-500">No active notes. Your vault is empty.</p>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 group">
                    <p className="text-white whitespace-pre-wrap mb-4">{note.content}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        Expires in {Math.max(1, Math.floor((note.expiresAt - Date.now()) / 60000))} mins
                      </div>
                      <button 
                        onClick={() => handleDelete(note.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {showLogs && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-fit max-h-[800px] overflow-y-auto">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-6">Security Logs</h3>
              <div className="space-y-4">
                {logs.slice().reverse().map((log: any, i: number) => (
                  <div key={i} className="border-l-2 border-zinc-800 pl-4 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.eventType.includes('FAILED') || log.eventType.includes('TIMEOUT') ? 'bg-red-500/10 text-red-400' :
                        log.eventType.includes('SUCCESS') || log.eventType.includes('SETUP') ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-zinc-800 text-zinc-300'
                      }`}>
                        {log.eventType}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
