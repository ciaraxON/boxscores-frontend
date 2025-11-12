// javascript
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function PlayerGames({ backendOrigin }) {
  const { playerKey } = useParams();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState(null);
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [gameType, setGameType] = useState('');
  const [season, setSeason] = useState('');
  const [opponent, setOpponent] = useState('');

  const [gameTypeOptions, setGameTypeOptions] = useState([]);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [opponentOptions, setOpponentOptions] = useState([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef(null);

  const [mediaOpen, setMediaOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!filtersOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [filtersOpen]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!mediaOpen) return;
      if (mediaRef.current && !mediaRef.current.contains(e.target)) {
        setMediaOpen(false);
        setSelectedGame(null);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && mediaOpen) {
        setMediaOpen(false);
        setSelectedGame(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [mediaOpen]);

  useEffect(() => {
    if (!playerKey) return;
    setLoading(true);
    setError(null);

    fetch(`${backendOrigin}/playerdetails/${encodeURIComponent(playerKey)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const first = arr[0] || null;
        const id = first && (first.playerID ?? first.PlayerID ?? first.playerId ?? first.PlayerId)
          ? String(first.playerID ?? first.PlayerID ?? first.playerId ?? first.PlayerId)
          : null;
        setPlayerId(id);

        const types = new Set();
        const seasons = new Set();
        const opps = new Set();
        arr.forEach((p) => {
          if (p.gameType) types.add(p.gameType);
          if (p.GameType) types.add(p.GameType);
          if (p.season) seasons.add(p.season);
          if (p.Season) seasons.add(p.Season);
          if (p.opponentTeam) opps.add(p.opponentTeam);
          if (p.OpponentTeam) opps.add(p.OpponentTeam);
        });
        setGameTypeOptions(Array.from(types));
        setSeasonOptions(Array.from(seasons));
        setOpponentOptions(Array.from(opps));
        setGameType('');
        setSeason('');
        setOpponent('');
        if (!id) {
          setGames([]);
          setLoading(false);
        }
      })
      .catch(() => {
        setPlayerId(null);
        setGameTypeOptions([]);
        setSeasonOptions([]);
        setOpponentOptions([]);
        setGames([]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerKey, backendOrigin]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    fetchGamesForId(playerId, gameType, season, opponent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, gameType, season, opponent]);

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
      const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]) - 1;
        const year = Number(dmy[3]);
        return Date.UTC(year, month, day);
      }
      const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
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

  const fetchGamesForId = (id, gType, s, opp) => {
    const params = new URLSearchParams();
    if (gType) params.append('gameType', gType);
    if (s) params.append('season', s);
    if (opp) params.append('opponent', opp);
    const url = `${backendOrigin}/player/${encodeURIComponent(id)}/games${params.toString() ? '?' + params.toString() : ''}`;
    return fetch(url)
      .then((r) => {
        if (!r.ok) return Promise.reject(new Error(`Status ${r.status}`));
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? sortGamesByDateDesc(data) : [];
        setGames(list);
        setLoading(false);
      })
      .catch(() => {
        setGames([]);
        setError('Failed to load games.');
        setLoading(false);
      });
  };

  const formatDate = (raw) => {
    if (!raw && raw !== 0) return '';
    const ts = parseGameDate(raw);
    if (!Number.isNaN(ts)) {
      const d = new Date(ts);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }
    return String(raw).replace(/\//g, '-');
  };

  const statItem = (label, value) => (
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', padding: '6px 8px', overflow: 'hidden' }}>
      <div style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 700, fontSize: '1rem', color: '#222', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{value || '—'}</div>
    </div>
  );

  const clearFilters = () => {
    setGameType('');
    setSeason('');
    setOpponent('');
  };

  const openMediaPanel = (g) => {
    setSelectedGame(g);
    setMediaOpen(true);
  };

  const closeMediaPanel = () => {
    setSelectedGame(null);
    setMediaOpen(false);
  };

  // Helpers: YouTube id/thumbnail detection, video detection, thumbnail rendering
  const getYouTubeId = (url) => {
    if (!url || typeof url !== 'string') return null;
    const m = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  };

  const getYouTubeThumbnail = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return !!url.match(/\.(mp4|webm|ogg)(\?|$)/i);
  };

  const renderThumbnail = (url) => {
    const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const h = 160;

    if (!url || typeof url !== 'string') {
      return (
        <div style={{
          width: '100%',
          height: h,
          background: '#f3f3f3',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 13
        }}>
          No media
        </div>
      );
    }

    const ytId = getYouTubeId(url);
    if (ytId) {
      return (
        <img
          src={getYouTubeThumbnail(ytId)}
          alt="youtube thumbnail"
          style={{ width: '100%', height: h, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }}
          onClick={() => window.open(`https://youtu.be/${ytId}`, '_blank')}
        />
      );
    }

    if (isVideoUrl(url)) {
      return (
        <video
          style={{ width: '100%', height: h, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', background: '#000' }}
          src={url}
          muted
          playsInline
          preload="metadata"
          onError={() => { /* noop */ }}
          onClick={() => window.open(url, '_blank')}
        />
      );
    }

    return (
      <img
        src={url}
        alt="media"
        style={{ width: '100%', height: h, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = placeholder; }}
        onClick={() => window.open(url, '_blank')}
      />
    );
  };

  const renderMediaList = (label, arr) => {
    const items = Array.isArray(arr) ? arr : [];
    if (items.length === 0) return null;

    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((u, idx) => {
            const url = (typeof u === 'string') ? u : (u?.url ?? u?.link ?? '');
            const title = (typeof u === 'string') ? '' : (u?.title ?? u?.label ?? '');
            return (
              <div key={idx} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renderThumbnail(url)}
                {title ? <div style={{ fontSize: 13, color: '#444' }}>{title}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} aria-label="Go back" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(0,0,0,0.08)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', color: '#333' }}>
          ← Back
        </button>

        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setFiltersOpen((s) => !s)}
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              background: filtersOpen ? '#f5f5f5' : 'white',
              cursor: 'pointer'
            }}
          >
            Filters{(gameType || season || opponent) ? ' •' : ''}
          </button>

          {filtersOpen && (
            <div
              id="filter-panel"
              ref={panelRef}
              style={{
                position: 'absolute',
                right: 0,
                top: '110%',
                zIndex: 8,
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                padding: 12,
                borderRadius: 6,
                minWidth: 280
              }}
            >
              <label style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>
                Game type
                <select value={gameType} onChange={(e) => setGameType(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '6px 8px' }}>
                  <option value="">All</option>
                  {gameTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>
                Season
                <select value={season} onChange={(e) => setSeason(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '6px 8px' }}>
                  <option value="">All</option>
                  {seasonOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label style={{ fontSize: 12, color: '#444', display: 'block', marginBottom: 8 }}>
                Opponent
                <select value={opponent} onChange={(e) => setOpponent(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '6px 8px' }}>
                  <option value="">All</option>
                  {opponentOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={clearFilters} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Clear</button>
                <button onClick={() => setFiltersOpen(false)} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer' }}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 0 }}>{playerId ? 'All games' : 'All games'}</h2>

      {loading && <p>Loading games…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && games && games.length === 0 && <p>No games found for this player.</p>}

      {!loading && games && games.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {games.map((g, i) => {
            const dateRaw = g.GameDate ?? g.gameDate ?? '';
            const team = g.playerTeam ?? '';
            const opp = g.opponentTeam ?? '';
            const teamPts = g.playerTeamPoints ?? '';
            const oppPts = g.opponentTeamPoints ?? '';
            const mins = g.minutesPlayed ?? '';
            const pts = g.playerPoints ?? '';
            const fg = g.playerFG ?? g.PlayerFG ?? '';
            const threePT = g.player3PT ?? g.player3pt ?? g.Player3PT ?? '';
            const ft = g.playerFT ?? g.PlayerFT ?? '';
            const reb = g.playerRebounds ?? '';
            const ast = g.playerAssists ?? '';
            const stl = g.playerSteals ?? '';
            const blk = g.playerBlocks ?? '';
            const tov = g.playerTurnovers ?? '';
            const fouls = g.playerFouls ?? '';
            const gameTypeVal = g.gameType ?? g.GameType ?? '';

            return (
              <div key={g.gameID ?? i} style={{ padding: 12, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: '0 0 160px', textAlign: 'left', color: '#444', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600 }}>{formatDate(dateRaw)}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{gameTypeVal}</div>
                  </div>

                  {/* Center column: "Team vs Opponent" with score below */}
                  <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center', color: '#222', whiteSpace: 'normal', overflow: 'visible', wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>
                        <span style={{ whiteSpace: 'normal', display: 'inline-block' }}>{team}</span>
                        <span style={{ color: '#666', margin: '0 4px' }}>vs</span>
                        <span style={{ whiteSpace: 'normal', display: 'inline-block' }}>{opp}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#222', marginTop: 4, justifyContent: 'center', marginLeft: -50 }}>
                      {(teamPts !== '' || oppPts !== '') ? `${teamPts} - ${oppPts}` : '—'}
                    </div>
                  </div>

                  <div style={{ flex: '0 0 100px', textAlign: 'right' }}>
                    <button onClick={() => openMediaPanel(g)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                      Media
                    </button>
                  </div>
                </div>

                <div style={{
                  marginTop: 8,
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  paddingTop: 10
                }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {statItem('MIN', mins)}
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
          })}
        </div>
      )}

      {mediaOpen && selectedGame && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'auto' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />

          <aside
            ref={mediaRef}
            role="dialog"
            aria-modal="true"
            aria-label="Game media"
            style={{
              position: 'fixed',
              top: 125,
              right: 100,
              width: 340,
              boxSizing: 'border-box',
              padding: 16,
              maxHeight: '80vh',
              overflow: 'auto',
              background: 'white',
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Media</div>
              <button onClick={closeMediaPanel} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>Close</button>
            </div>

            {renderMediaList('Full game', selectedGame.fullGameVideo ?? selectedGame.fullgamevideo ?? selectedGame.full_game_video ?? [])}
            {renderMediaList('Highlights', selectedGame.highlights ?? selectedGame.Highlights ?? [])}
            {renderMediaList('Interviews', selectedGame.interviews ?? selectedGame.Interviews ?? selectedGame.interviewsList ?? [])}
          </aside>
        </div>
      )}
    </div>
  );
}
