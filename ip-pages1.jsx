// Dashboard, Discover, Internship Details
import React, { useState } from 'react';
import IP from './ip-data.js';
import { apiRequest } from './api.js';
import { Btn, Card, Empty, Icon, PageHead, SampleBadge, ScoreRing, Tag } from './ip-ui.jsx';

function Dashboard({ ctx }) {
  const { profile, apps, ranked, go, openJob } = ctx;
  const counts = IP.STATUSES.reduce((a, s) => ({ ...a, [s]: apps.filter((x) => x.status === s).length }), {});
  const active = apps.filter((a) => !['Rejected', 'Withdrawn', 'Offer'].includes(a.status)).length;
  const upcoming = ranked.filter((r) => r.job.deadline).sort((a, b) => a.job.deadline.localeCompare(b.job.deadline)).slice(0, 4);
  const hasProfile = IP.allSkills(profile).length > 0;
  return (
    <div className="page">
      <PageHead title={`Good afternoon${profile.name && !profile._sample ? ', ' + profile.name.split(' ')[0] : ''}`} sub="Here's where your internship search stands." />
      {!hasProfile && (
        <Card className="callout"><Icon name="file-up" size={18} /><div><b>Start with your resume.</b> Matching needs a candidate profile.</div><Btn kind="primary" onClick={() => go('profile')}>Upload resume</Btn></Card>
      )}
      <div className="stats">
        <div className="stat"><div className="mono tiny muted">ACTIVE APPLICATIONS</div><div className="stat-n">{active}</div></div>
        <div className="stat"><div className="mono tiny muted">INTERVIEWS</div><div className="stat-n">{counts.Interview}</div></div>
        <div className="stat"><div className="mono tiny muted">STRONG MATCHES ≥ 75</div><div className="stat-n">{ranked.filter((r) => r.m.total >= 75).length}</div></div>
        <div className="stat"><div className="mono tiny muted">PROFILE SKILLS</div><div className="stat-n">{IP.allSkills(profile).length}</div></div>
      </div>
      <div className="grid-2">
        <Card>
          <div className="card-h"><h2>Top matches</h2>{ranked.slice(0, 5).every(({ job }) => job._sample) && <SampleBadge />}<button className="linkish" onClick={() => go('discover')}>View all →</button></div>
          <div className="rows">
            {ranked.slice(0, 5).map(({ job, m }) => (
              <button key={job.id} className="row" onClick={() => openJob(job.id)}>
                <ScoreRing value={m.total} size={38} />
                <div className="row-main"><div className="row-t">{job.role}</div><div className="muted small">{job.company} · {job.city} · {job.mode}</div></div>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
          </div>
        </Card>
        <div className="col">
          <Card>
            <div className="card-h"><h2>Pipeline</h2></div>
            <div className="pipe">
              {IP.STATUSES.map((s) => (
                <div key={s} className="pipe-row"><span className={`st st-${s.toLowerCase()}`}>{s}</span><div className="pipe-bar"><div style={{ width: `${apps.length ? (counts[s] / apps.length) * 100 : 0}%` }} /></div><span className="mono small">{counts[s]}</span></div>
              ))}
            </div>
            {!apps.length && <p className="muted small" style={{ marginTop: 12 }}>No applications yet. Save one from any internship.</p>}
          </Card>
          <Card>
            <div className="card-h"><h2>Deadlines</h2></div>
            {upcoming.length ? upcoming.map(({ job }) => (
              <button key={job.id} className="dl" onClick={() => openJob(job.id)}><span className="mono small">{job.deadline}</span><span className="dl-t">{job.company} — {job.role}</span></button>
            )) : <p className="muted small">No posted deadlines in your results.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

const QUICK = ['AI/ML internships in India', 'Machine learning internships in Hyderabad', 'LLM and generative AI internships', 'Python developer internships', 'Computer vision internships', 'Software engineering internships'];

function Discover({ ctx }) {
  const { ranked, openJob, apps, saveApp, nebiusOk, tavilyOk, searchInternships } = ctx;
  const [q, setQ] = useState('');
  const [ran, setRan] = useState('');
  const [resultJobs, setResultJobs] = useState(() => IP.search(''));
  const [searchError, setSearchError] = useState('');
  const [mode, setMode] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const run = async (query) => {
    setQ(query);
    setLoading(true);
    setSearchError('');
    try {
      const jobs = await searchInternships(query);
      setResultJobs(jobs);
      setRan(query);
    } catch (error) {
      setResultJobs([]);
      setRan(query);
      setSearchError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const hits = new Set(resultJobs.map((job) => job.id));
  const list = ranked.filter((r) => hits.has(r.job.id) && (mode === 'All' || r.job.mode === mode) && r.m.total >= minScore);
  return (
    <div className="page">
      <PageHead title="Discover internships" sub="Search results are ranked by a transparent, deterministic match score." />
      <Card>
        <form className="search" onSubmit={(e) => { e.preventDefault(); run(q); }}>
          <Icon name="search" size={16} />
          <input aria-label="Search internships" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. LLM internships in Hyderabad" />
          <Btn kind="primary" type="submit">Search</Btn>
        </form>
        <div className="chips">{QUICK.map((x) => <button key={x} className="chip" onClick={() => run(x)}>{x}</button>)}</div>
        <div className="provider-note">
          <Icon name="info" size={14} />
          {searchError ? <span className="err">{searchError}</span> : tavilyOk ? <span>Live web search via Tavily. Check each source before applying.</span> : <span><b>Tavily not configured.</b> Showing the bundled <b>sample dataset</b> — fictional companies, not live vacancies. Configure <span className="mono">TAVILY_API_KEY</span> in the backend's <span className="mono">.env</span> for real results with source URLs.</span>}
        </div>
      </Card>
      <div className="filters">
        <div className="seg" role="group" aria-label="Work mode">{['All', 'Remote', 'Hybrid', 'On-site'].map((x) => <button key={x} className={mode === x ? 'on' : ''} onClick={() => setMode(x)}>{x}</button>)}</div>
        <label className="small muted flt">Min. score <input type="range" min="0" max="90" step="5" value={minScore} onChange={(e) => setMinScore(+e.target.value)} /><span className="mono">{minScore}</span></label>
        <span className="muted small" style={{ marginLeft: 'auto' }}>{loading ? 'Searching…' : `${list.length} result${list.length === 1 ? '' : 's'}${ran ? ` for “${ran}”` : ''}`}</span>
      </div>
      {loading ? <div className="skel-list" role="status" aria-label="Loading search results" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skel" aria-hidden="true" />)}</div> : list.length ? (
        <div className="jobs">
          {list.map(({ job, m }) => {
            const saved = apps.some((a) => a.jobId === job.id);
            return (
              <div key={job.id} className="job card">
                <div className="job-top">
                  <ScoreRing value={m.total} />
                  <div className="job-main">
                    <button className="job-t" onClick={() => openJob(job.id)}>{job.role}</button>
                    <div className="muted small">{job.company} · {job.city} · {job.mode}{job.deadline ? ` · due ${job.deadline}` : ''}</div>
                  </div>
                  {job._sample ? <SampleBadge /> : <Tag tone="ok">LIVE RESULT</Tag>}
                </div>
                <div className="skills-line">
                  {job.required.map((s) => <Tag key={s} tone={m.matched.includes(s) ? 'ok' : 'bad'}>{m.matched.includes(s) ? '✓' : '✕'} {s}</Tag>)}
                </div>
                <div className="job-foot">
                  <span className="mono tiny muted">{job.sourceUrl ? <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">SOURCE: {job.source} ↗</a> : `SOURCE: ${job.source}`} · retrieved {job.retrievedAt.slice(0, 10)}</span>
                  <div className="job-actions">
                    {IP.listingUrl(job) && <a className="btn btn-sm btn-apply" href={IP.listingUrl(job)} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" size={14} />{IP.officialApplyUrl(job) ? 'Apply' : 'Open listing'}</a>}
                    <Btn small icon={saved ? 'bookmark-check' : 'bookmark'} onClick={() => saveApp(job)} disabled={saved}>{saved ? 'Saved' : 'Save'}</Btn>
                    <Btn small kind="primary" onClick={() => openJob(job.id)}>View match</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty icon="search-x" title="No internships match" body="Try a broader query or lower the minimum score." action={<Btn onClick={() => { setRan(''); setQ(''); setMinScore(0); setMode('All'); }}>Reset filters</Btn>} />}
    </div>
  );
}

function Details({ ctx }) {
  const { jobId, ranked, go, saveApp, apps, setStudioJob, weights, nebiusOk, backend, profile } = ctx;
  const [explanation, setExplanation] = useState('');
  const [explanationError, setExplanationError] = useState('');
  const [explanationLoading, setExplanationLoading] = useState(false);
  const r = ranked.find((x) => x.job.id === jobId);
  if (!r) return <Empty icon="search-x" title="Internship not found" body="This listing may have expired or is no longer available in your saved results." action={<Btn onClick={() => go('discover')}>Go to Discover</Btn>} />;
  const { job, m } = r;
  const saved = apps.some((a) => a.jobId === job.id);
  const officialApplyUrl = IP.officialApplyUrl(job);
  const listingUrl = IP.listingUrl(job);
  return (
    <div className="page">
      <button className="linkish back" onClick={() => go('discover')}><Icon name="arrow-left" size={14} />Back to results</button>
      <div className="detail-head">
        <div>
          <div className="row-inline"><h1>{job.role}</h1>{job._sample && <SampleBadge />}</div>
          <p className="muted">{job.company} · {job.city}, {job.country} · {job.mode} · posted {job.posted}{job.deadline ? ` · deadline ${job.deadline}` : ' · no deadline listed'}</p>
        </div>
        <div className="row-inline">
          {officialApplyUrl && <a className="btn" href={officialApplyUrl} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" size={14} />Official apply</a>}
          <Btn icon={saved ? 'bookmark-check' : 'bookmark'} onClick={() => saveApp(job)} disabled={saved}>{saved ? 'In tracker' : 'Save to tracker'}</Btn>
          <Btn kind="primary" icon="pen-line" onClick={() => { setStudioJob(job.id); go('studio'); }}>Generate materials</Btn>
        </div>
      </div>
      <div className="grid-2 wide-left">
        <div className="col">
          <Card>
            <div className="card-h"><h2>Match breakdown</h2><span className="muted tiny mono">ESTIMATE — NOT A HIRING PROBABILITY</span></div>
            <div className="score-hero">
              <ScoreRing value={m.total} size={84} />
              <div className="factors">
                {m.factors.map((f) => (
                  <div key={f.key} className="factor">
                    <div className="factor-l"><span>{f.label}</span><span className="mono tiny muted">w{f.weight}</span></div>
                    <div className="bar"><div style={{ width: `${f.ratio * 100}%` }} /></div>
                    <span className="mono small factor-pts">+{f.points.toFixed(1)}</span>
                    <div className="factor-d muted tiny">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="method mono tiny">score = Σ (weightᵢ × ratioᵢ) / Σ weights × 100 · weights editable in Settings</p>
          </Card>
          <Card>
            <div className="card-h"><h2>Skills</h2></div>
            <div className="sk-group"><div className="mono tiny muted">MATCHED</div><div className="skills-line">{m.matched.length ? m.matched.map((s) => <Tag key={s} tone="ok">{s}</Tag>) : <span className="muted small">None</span>}</div></div>
            {!job.required.length && <p className="muted small">No required skills could be extracted from this posting. Check its source before relying on the score.</p>}
            <div className="sk-group"><div className="mono tiny muted">MISSING — REQUIRED</div><div className="skills-line">{m.missingReq.length ? m.missingReq.map((s) => <Tag key={s} tone="bad">{s}</Tag>) : <span className="muted small">None</span>}</div></div>
            <div className="sk-group"><div className="mono tiny muted">MISSING — PREFERRED</div><div className="skills-line">{m.missingPref.length ? m.missingPref.map((s) => <Tag key={s} tone="warn">{s}</Tag>) : <span className="muted small">None</span>}</div></div>
          </Card>
          <Card>
            <div className="card-h"><h2>AI explanation</h2><Tag mono>NEMOTRON</Tag></div>
            {nebiusOk ? (
              <div>
                {explanation ? <p className="small">{explanation}</p> : <p className="muted small">Generate an explanation grounded in your profile and this job record.</p>}
                {explanationError && <p className="err small">{explanationError}</p>}
                <Btn small kind="primary" disabled={explanationLoading} onClick={async () => {
                  setExplanationLoading(true);
                  setExplanationError('');
                  try {
                    const response = await apiRequest(backend, '/api/generate/explanation', {
                      method: 'POST',
                      body: JSON.stringify({ profile, job, match: m }),
                    });
                    setExplanation(response.explanation);
                  } catch (error) {
                    setExplanationError(error.message);
                  } finally {
                    setExplanationLoading(false);
                  }
                }}>{explanationLoading ? 'Generating…' : explanation ? 'Regenerate explanation' : 'Generate explanation'}</Btn>
              </div>
            ) : (
              <div className="locked"><Icon name="lock" size={16} /><div><b>Requires Nebius Token Factory.</b><p className="muted small">The explanation is generated by NVIDIA Nemotron and grounded only in the evidence below. In demo mode no text is generated — we don't simulate model output.</p></div><Btn small onClick={() => go('settings')}>Configure</Btn></div>
            )}
          </Card>
        </div>
        <div className="col">
          <Card>
            <div className="card-h"><h2>Evidence from your profile</h2></div>
            {m.evidence.length ? m.evidence.map((e, i) => <div key={i} className="ev"><Tag tone="ok">{e.skill}</Tag><span className="small">{e.kind}: {e.name}</span></div>) : <p className="muted small">No project or experience entries mention the matched skills.</p>}
          </Card>
          <Card>
            <div className="card-h"><h2>From the job description</h2></div>
            <p className="small">{job.description}</p>
            <div className="kv"><span className="muted small">Required</span><span className="small">{job.required.join(', ')}</span></div>
            <div className="kv"><span className="muted small">Preferred</span><span className="small">{job.preferred.join(', ')}</span></div>
            <div className="kv"><span className="muted small">Stipend</span><span className="small">{job.stipend || 'Not listed'}</span></div>
            <div className="kv"><span className="muted small">Application</span><span className="small">{listingUrl ? <a className="btn btn-sm btn-apply" href={listingUrl} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" size={14} />{officialApplyUrl ? 'Apply on company site' : 'View original listing'}</a> : 'No application link available'}</span></div>
          </Card>
          <Card>
            <div className="card-h"><h2>Preparation steps</h2></div>
            <ol className="prep">{m.prep.map((p, i) => <li key={i} className="small">{p}</li>)}</ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { Dashboard, Discover, Details };
