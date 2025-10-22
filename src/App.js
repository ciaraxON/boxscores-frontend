import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useMatch } from 'react-router-dom';
import './App.css';
import PlayerDetails from './PlayerDetails';
import PlayerGames from './PlayerGames';

export default function App() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const backendOrigin = import.meta.env.VITE_API_URL;
  const frontendOrigin = window.location.origin || (process.env.PUBLIC_URL || 'http://localhost:3000');

  function normalizeImageUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    if (trimmed.startsWith('data:')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return window.location.protocol + trimmed;
    if (trimmed.startsWith('/')) return frontendOrigin + trimmed;
    if (/^(?:\.\/)?images\//i.test(trimmed)) {
      return (process.env.PUBLIC_URL || '') + '/' + trimmed.replace(/^\.\//, '');
    }
    if (/^[\w\-.]+(?:\.(?:jpg|jpeg|png|gif|webp|svg))$/i.test(trimmed)) {
      return (process.env.PUBLIC_URL || '') + '/images/' + trimmed;
    }
    return (process.env.PUBLIC_URL || '') + '/images/' + trimmed;
  }

  useEffect(() => {
    fetch(`${backendOrigin}/players`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        setPlayers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setPlayers([]);
        setLoading(false);
      });
  }, []);

  const renderBaseName = (p) => {
    const first = p.firstName ?? p.FirstName ?? '';
    const last = p.lastName ?? p.LastName ?? '';
    return `${first} ${last}`.trim() || (p.playerID ?? p.PlayerID ?? 'Unknown');
  };

  const renderDisplayName = (p) => {
    const base = renderBaseName(p);
    const jersey = p.JerseyNumber ?? p.jerseyNumber ?? p.JerseyNum ?? null;
    return jersey ? `${base} - ${jersey}` : base;
  };

  const renderTeamsOrCollege = (p) => {
    const wnba = p.WNBATeamName ?? p.CurrentWNBATeamName ?? p.currentWNBATeamName ?? null;
    const unriv = p.UnrivaledTeamName ?? p.unrivaledTeamName ?? null;
    const teams = [wnba, unriv].filter(Boolean);
    if (teams.length > 0) return teams.join(' • ');
    return p.College ?? p.college ?? '';
  };

  const makeCombinedKey = (p) => renderBaseName(p).replace(/[-_+\s]+/g, '').toLowerCase();

  function Header() {
    // match both details and games routes so header shows player name on both pages
    const matchDetails = useMatch('/player/:playerName');
    const matchGames = useMatch('/player/:playerKey/games');

    let title = 'Player Box Scores';
    let combinedParam = null;

    if (matchDetails && matchDetails.params && matchDetails.params.playerName) {
      const rawParam = decodeURIComponent(matchDetails.params.playerName || '');
      combinedParam = rawParam.replace(/[-_+\s]+/g, '').toLowerCase();
    } else if (matchGames && matchGames.params && matchGames.params.playerKey) {
      const rawParam = decodeURIComponent(matchGames.params.playerKey || '');
      combinedParam = rawParam.replace(/[-_+\s]+/g, '').toLowerCase();
    }

    if (combinedParam) {
      const found = players.find((pl) => makeCombinedKey(pl) === combinedParam);
      if (found) title = renderDisplayName(found);
      else title = 'Player Details';
    }

    return (
      <header className="app-header">
        <div className="app-header-inner">
          <h1>{title}</h1>
        </div>
      </header>
    );
  }

  return (
    <BrowserRouter>
      <Header />

      <div className="app-root">
        <div className="app-container">
          <main>
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    {loading && <p className="lead">Loading players…</p>}

                    {!loading && players.length === 0 && (
                      <p className="lead">No players found.</p>
                    )}

                    {!loading && players.length > 0 && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {players.map((p) => {
                          const key = p.playerID ?? p.PlayerID ?? `${renderBaseName(p)}`.replace(/\s+/g, '').toLowerCase();
                          const rawImg =
                            p.imageURL ??
                            p.ImageURL ??
                            p.Image ??
                            p.image ??
                            p.profileImage ??
                            p.ProfileImage;
                          const src = normalizeImageUrl(rawImg) ?? placeholder;

                          const position = p.Position ?? p.position ?? null;
                          const teamsOrCollege = renderTeamsOrCollege(p);
                          const combined = makeCombinedKey(p);
                          const url = `/player/${encodeURIComponent(combined)}`;

                          return (
                            <li key={key} style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                              <Link to={url} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <img
                                    src={src}
                                    alt={renderBaseName(p)}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = placeholder;
                                    }}
                                    style={{
                                      width: 48,
                                      height: 48,
                                      objectFit: 'contain',
                                      objectPosition: 'center',
                                      borderRadius: 6,
                                      background: '#f0f0f0',
                                      padding: 4,
                                      boxSizing: 'border-box',
                                      flex: '0 0 48px'
                                    }}
                                  />
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{renderDisplayName(p)}</div>
                                    <div style={{ color: '#555', fontSize: '0.9rem' }}>
                                      {teamsOrCollege}
                                      {position ? ` • ${position}` : ''}
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                }
              />
              <Route
                path="/player/:playerName"
                element={<PlayerDetails backendOrigin={backendOrigin} frontendOrigin={frontendOrigin} />}
              />
              <Route
                path="/player/:playerKey/games"
                element={<PlayerGames backendOrigin={backendOrigin} />}
             />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
