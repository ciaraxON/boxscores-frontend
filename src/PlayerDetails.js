// javascript
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function PlayerDetails({ backendOrigin, frontendOrigin }) {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestGames, setLatestGames] = useState({}); // map playerID -> game|null

  const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

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

  const makeCombinedKey = (p) => {
    const first = p.firstName ?? p.FirstName ?? '';
    const last = p.lastName ?? p.LastName ?? '';
    return `${first}${last}`.replace(/[-_+\s]+/g, '').toLowerCase();
  };

  useEffect(() => {
    if (!playerName) return;
    const encoded = encodeURIComponent(playerName);
    fetch(`${backendOrigin}/playerdetails/${encoded}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [playerName, backendOrigin]);

  // fetch latest games for each returned player
  // javascript
  useEffect(() => {
    if (!items || items.length === 0) {
      setLatestGames({});
      return;
    }

    const toFetch = items.map((p) => {
      const id = p.PlayerID ?? p.playerID ?? p.playerId ?? p.PlayerId;
      return id ? String(id) : null;
    }).filter(Boolean);

    if (toFetch.length === 0) {
      setLatestGames({});
      return;
    }

    const controllers = {};
    const promises = toFetch.map((id) => {
      const ctrl = new AbortController();
      controllers[id] = ctrl;

      const latestUrl = `${backendOrigin}/player/${encodeURIComponent(id)}/latestgame`;
      const gamesUrl = `${backendOrigin}/player/${encodeURIComponent(id)}/games`;

      return fetch(latestUrl, { signal: ctrl.signal })
        .then((res) => {
          if (res.status === 404) return { id, game: null };
          if (!res.ok) return { id, game: null };
          return res.json().then((body) => {
            // If backend returns an array of games, pick the most recent by GameDate.
            if (Array.isArray(body)) {
              const list = sortGamesByDateDesc(body);
              return { id, game: list[0] ?? null };
            }

            // If backend returns an object with a games array, handle that too.
            if (body && typeof body === 'object' && Array.isArray(body.games)) {
              const list = sortGamesByDateDesc(body.games);
              return { id, game: list[0] ?? null };
            }

            // If backend returned a single object (likely ordered by insertion),
            // fetch the full games list and pick the most recent by GameDate.
            if (body && typeof body === 'object') {
              return fetch(gamesUrl, { signal: ctrl.signal })
                .then((r2) => {
                  if (!r2.ok) return { id, game: body ?? null };
                  return r2.json().then((gamesBody) => {
                    const list = Array.isArray(gamesBody)
                      ? sortGamesByDateDesc(gamesBody)
                      : (gamesBody && Array.isArray(gamesBody.games) ? sortGamesByDateDesc(gamesBody.games) : []);
                    // prefer the date-sorted result, but fall back to the original object if nothing returned
                    return { id, game: list[0] ?? body ?? null };
                  }).catch(() => ({ id, game: body ?? null }));
                })
                .catch(() => ({ id, game: body ?? null }));
            }

            // otherwise no usable game
            return { id, game: null };
          }).catch(() => ({ id, game: null }));
        })
        .catch(() => ({ id, game: null }));
    });

    Promise.all(promises).then((results) => {
      const map = {};
      results.forEach(({ id, game }) => {
        map[id] = game;
      });
      setLatestGames(map);
    });

    return () => {
      Object.values(controllers).forEach((c) => {
        try { c.abort(); } catch (e) {}
      });
    };
  }, [items, backendOrigin, sortGamesByDateDesc]);


  // Date parsing and sorting helpers to match PlayerGames logic
  const parseGameDate = (raw) => {
    if (raw == null || raw === '') return NaN;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        return trimmed.length <= 10 ? n * 1000 : n;
      }
      const native = Date.parse(trimmed);
      if (!Number.isNaN(native)) return native;
      const dmy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]) - 1;
        const year = Number(dmy[3]);
        return Date.UTC(year, month, day);
      }
      const ymd = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
      if (ymd) {
        return Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      }
    }
    return NaN;
  };

  const sortGamesByDateDesc = (arr) => {
    return [...arr].sort((a, b) => {
      const aRaw = a?.GameDate ?? a?.gameDate ?? '';
      const bRaw = b?.GameDate ?? b?.gameDate ?? '';
      const pa = parseGameDate(aRaw) || 0;
      const pb = parseGameDate(bRaw) || 0;
      return pb - pa;
    });
  };

  const handleBack = useCallback(() => {
    try {
      const ref = document.referrer || '';
      const sameOrigin = ref ? new URL(ref).origin === window.location.origin : false;
      if (sameOrigin) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch (e) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleBack]);

  const formatDate = (raw) => {
    if (raw === null || raw === undefined || raw === '') return '';
    const ts = parseGameDate(raw);
    if (!Number.isNaN(ts)) {
      const d = new Date(ts);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    // fallback
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    return String(raw);
  };

  if (loading) return <p className="lead">Loading player details…</p>;
  if (!items || items.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
      <p>No player details found.</p>
      <button onClick={handleBack} aria-label="Go back" style={{ background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', padding: 0 }}>
        ← Back
      </button>
    </div>
  );

  const renderField = (label, val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '') return null;
    return (
      <div style={{ marginBottom: 10, fontSize: '1.15rem', lineHeight: 1.4 }}>
        <strong style={{ fontWeight: 700, marginRight: 8 }}>{label}:</strong>
        <span>{str}</span>
      </div>
    );
  };

  // Normalize a social link into a safe URL
  const normalizeSocialUrl = (provider, raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const v = raw.trim();
    if (v === '') return null;
    if (/^https?:\/\//i.test(v) || v.startsWith('//')) {
      return v.startsWith('//') ? window.location.protocol + v : v;
    }
    const clean = v.startsWith('@') ? v.slice(1) : v;
    switch ((provider || '').toLowerCase()) {
      case 'twitter': return `https://twitter.com/${clean}`;
      case 'instagram': return `https://instagram.com/${clean}`;
      case 'tiktok': return `https://www.tiktok.com/@${clean}`;
      case 'facebook': return `https://facebook.com/${clean}`;
      case 'youtube': return `https://www.youtube.com/${clean}`;
      case 'website': return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      default: return null;
    }
  };

  // Render social links only if at least one is present and non-empty
  const renderSocialLinks = (social) => {
    const s = social ?? {};
    const twitter = s.Twitter ?? s.twitter ?? null;
    const instagram = s.Instagram ?? s.instagram ?? null;
    const facebook = s.Facebook ?? s.facebook ?? null;
    const tiktok = s.TikTok ?? s.tiktok ?? null;
    const youtube = s.YouTube ?? s.youtube ?? null;
    const website = s.Website ?? s.website ?? null;

    const entries = [
      { key: 'Twitter', value: normalizeSocialUrl('twitter', twitter), label: 'Twitter', emoji: '🐦' },
      { key: 'Instagram', value: normalizeSocialUrl('instagram', instagram), label: 'Instagram', emoji: '📸' },
      { key: 'TikTok', value: normalizeSocialUrl('tiktok', tiktok), label: 'TikTok', emoji: '🎵' },
      { key: 'Facebook', value: normalizeSocialUrl('facebook', facebook), label: 'Facebook', emoji: '📘' },
      { key: 'YouTube', value: normalizeSocialUrl('youtube', youtube), label: 'YouTube', emoji: '▶️' },
      { key: 'Website', value: normalizeSocialUrl('website', website), label: 'Website', emoji: '🔗' }
    ].filter(e => e.value);

    if (entries.length === 0) return null;

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 8, fontWeight: 700 }}>Social:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entries.map((e) => (
            <a
              key={e.key}
              href={e.value}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.03)',
                textDecoration: 'none',
                color: '#111',
                fontSize: '0.95rem'
              }}
            >
              <span aria-hidden style={{ fontSize: '0.95rem' }}>{e.emoji}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{e.label}</span>
            </a>
          ))}
        </div>
      </div>
    );
  };

  // now accepts playerKey (combined name) so the button preserves the friendly URL
  const renderLatestGameSummary = (game, playerKey) => {
    if (!game) return <div style={{ color: '#666', fontSize: '0.95rem' }}>No recent game found.</div>;

    const date = game.GameDate ?? game.gameDate ?? '';
    const team = game.playerTeam ?? '';
    const opp = game.opponentTeam ?? '';
    const teamPts = game.playerTeamPoints ?? '';
    const oppPts = game.opponentTeamPoints ?? '';
    const pts = game.playerPoints ?? '';
    const fg = game.playerFG ?? game.PlayerFG ?? '';
    const threePT = game.player3PT ?? game.player3pt ?? game.Player3PT ?? '';
    const ft = game.playerFT ?? game.PlayerFT ?? '';
    const reb = game.playerRebounds ?? '';
    const ast = game.playerAssists ?? '';
    const stl = game.playerSteals ?? '';
    const blk = game.playerBlocks ?? '';
    const tov = game.playerTurnovers ?? '';
    const fouls = game.playerFouls ?? '';
    const mins = game.minutesPlayed ?? '';

    const statItem = (label, value) => (
      <div style={{
        flex: '1 1 0',
        minWidth: 0,
        textAlign: 'center',
        padding: '6px 8px',
        overflow: 'hidden'
      }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#666',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden'
        }}>{label}</div>
        <div style={{
          marginTop: 4,
          fontWeight: 700,
          fontSize: '1rem',
          color: '#222',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden'
        }}>{value || '—'}</div>
      </div>
    );

    return (
      <div style={{ fontSize: '0.95rem', color: '#222' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}>
          <div style={{ flex: '0 0 160px', textAlign: 'left', color: '#444', fontSize: '0.95rem', display: 'flex', alignItems: 'center' }}>
            {date ? (
              <div style={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1 }}>{formatDate(date)}</div>
            ) : <div style={{ fontWeight: 600 }}>{'\u00A0'}</div>}
          </div>

          <div style={{ flex: '1 1 auto', textAlign: 'center', fontWeight: 700 }}>
            Most recent game
          </div>

          <div style={{ flex: '0 0 160px', textAlign: 'right' }}>
            <button
              onClick={() => navigate(`/player/${encodeURIComponent(String(playerKey || ''))}/games`)}
              aria-label="View all games"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: '1px solid rgba(0,0,0,0.08)',
                padding: '6px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                color: '#333'
              }}
            >
              View all games
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 1fr',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10
        }}>
          <div style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            textAlign: 'right',
            paddingRight: 8
          }}>
            <span style={{ fontWeight: 700, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team}</span>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: 4 }}>vs</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ marginRight: 8, minWidth: 28, textAlign: 'right' }}>{teamPts || '—'}</span>
              <span style={{ width: 8 }} />
              <span style={{ marginLeft: 8, minWidth: 28, textAlign: 'left' }}>{oppPts || '—'}</span>
            </div>
          </div>

          <div style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            textAlign: 'left',
            paddingLeft: 8
          }}>
            <span style={{ fontWeight: 700, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opp}</span>
          </div>
        </div>

        <div style={{
          marginTop: 8,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          paddingTop: 10
        }}>
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'stretch',
            overflow: 'hidden',
            width: '100%'
          }}>
            {statItem('Min', mins)}
            {statItem('PTS', pts)}
            {statItem('FG', fg)}
            {statItem('3PT', threePT)}
            {statItem('FT', ft)}
            {statItem('REB', reb)}
            {statItem('AST', ast)}
            {statItem('STL', stl)}
            {statItem('BLK', blk)}
            {statItem('TO', tov)}
            {statItem('PF', fouls)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
      <div style={{ marginBottom: 12, width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={handleBack}
          aria-label="Go back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: '1px solid rgba(0,0,0,0.08)',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#333'
          }}
        >
          ← Back
        </button>
      </div>

      {items.map((p, idx) => {
        const img = normalizeImageUrl(p.ImageURL ?? p.imageURL ?? p.Image ?? p.image) ?? placeholder;
        const id = String(p.PlayerID ?? p.playerID ?? p.playerId ?? p.PlayerId ?? `unknown-${idx}`);
        const game = latestGames[id];
        const combined = makeCombinedKey(p);
        const social = p.SocialLinks ?? p.socialLinks ?? null;

        return (
          <div key={p.PlayerID ?? idx} style={{ width: '100%', maxWidth: 900 }}>
            {/* player card: image + details */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                padding: 12,
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 6,
                marginBottom: 12,
                alignItems: 'center',
                background: '#fff'
              }}
            >
              <div style={{ flex: '0 0 300px', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={img}
                  alt={`${p.FirstName ?? p.firstName ?? ''} ${p.LastName ?? p.lastName ?? ''}`}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }}
                  style={{
                    width: 300,
                    height: 300,
                    objectFit: 'contain',
                    background: '#f7f7f7',
                    padding: 8,
                    borderRadius: 8,
                    display: 'block'
                  }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#333', textAlign: 'left', fontSize: '1.05rem', lineHeight: 1.4 }}>
                  {renderField('WNBATeamName', p.WNBATeamName ?? p.CurrentWNBATeamName ?? p.currentWNBATeamName)}
                  {renderField('UnrivaledTeamName', p.UnrivaledTeamName ?? p.unrivaledTeamName)}
                  {renderField('Position', p.Position ?? p.position)}
                  {renderField('Height', p.Height ?? p.height)}
                  {renderField('Age', p.Age ?? p.age)}
                  {renderField('BirthDate', p.BirthDate ?? p.birthDate)}
                  {renderField('College', p.College ?? p.college)}
                  {/* render social links (only non-empty ones) */}
                  {renderSocialLinks(social)}
                </div>
              </div>
            </div>

            {/* separate block below the card for the most recent game */}
            <div style={{ width: '100%', maxWidth: 900, marginBottom: 12 }}>
              <div style={{ padding: 12, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6, background: '#fff' }}>
                {renderLatestGameSummary(game, combined)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
