import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import IP from './ip-data.js';
import { Shell, Toast } from './ip-ui.jsx';
import { Dashboard, Details, Discover } from './ip-pages1.jsx';
import { ApplicationAssistant, Assistant, Profile, ResumeBuilder, Settings, Studio, Tracker } from './ip-pages2.jsx';
import { apiRequest } from './api.js';

const KEY = 'ip_state_v1';
const PRIVACY_NOTICE_KEY = 'ip_privacy_notice_v1';
const DEFAULT_BACKEND = 'http://127.0.0.1:8000';
const ROUTE_PATHS = {
  dashboard: '/',
  discover: '/discover',
  profile: '/profile',
  'resume-builder': '/resume-builder',
  studio: '/studio',
  apply: '/apply',
  tracker: '/tracker',
  assistant: '/assistant',
  settings: '/settings',
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function getLocationRoute(pathname, fallbackRoute = 'dashboard') {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath === '/') {
    return { route: ROUTE_PATHS[fallbackRoute] ? fallbackRoute : 'dashboard' };
  }
  if (normalizedPath.startsWith('/internship/')) {
    const id = normalizedPath.slice('/internship/'.length);
    if (id) {
      try {
        return { route: 'details', jobId: decodeURIComponent(id) };
      } catch {
        return { route: 'not-found' };
      }
    }
  }
  const route = Object.keys(ROUTE_PATHS).find((key) => ROUTE_PATHS[key] === normalizedPath);
  return route ? { route } : { route: 'not-found' };
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Application rendering failed.', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal-error" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">The page could not be displayed. Your locally saved data has not been cleared.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const init = useMemo(load, []);
  const initialLocation = useMemo(
    () => getLocationRoute(window.location.pathname, init.route),
    [init.route],
  );
  const [route, setRoute] = useState(initialLocation.route);
  const [jobId, setJobId] = useState(initialLocation.jobId || init.jobId || null);
  const [studioJob, setStudioJob] = useState(init.studioJob || null);
  const [profile, setProfile] = useState(init.profile || IP.SAMPLE_PROFILE);
  const [apps, setApps] = useState(init.apps || []);
  const [weights, setWeights] = useState(init.weights || IP.DEFAULT_WEIGHTS);
  const [backend, setBackend] = useState(
    init.backend === 'http://localhost:8000' ? DEFAULT_BACKEND : init.backend || DEFAULT_BACKEND,
  );
  const [status, setStatus] = useState(null);
  const [liveJobs, setLiveJobs] = useState(Array.isArray(init.liveJobs) ? init.liveJobs : []);
  const [toastMsg, setToastMsg] = useState('');
  const [showStorageNotice, setShowStorageNotice] = useState(() => {
    try {
      return localStorage.getItem(PRIVACY_NOTICE_KEY) !== 'accepted';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ route, jobId, studioJob, profile, apps, weights, backend, liveJobs }));
  }, [route, jobId, studioJob, profile, apps, weights, backend, liveJobs]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route, jobId]);
  useEffect(() => {
    checkBackend();
  }, []);
  useEffect(() => {
    const handlePopState = () => {
      const location = getLocationRoute(window.location.pathname);
      setRoute(location.route);
      setJobId(location.jobId || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toast = (message) => {
    setToastMsg(message);
    clearTimeout(window.__t);
    window.__t = setTimeout(() => setToastMsg(''), 1800);
  };
  const ranked = useMemo(() => {
    const jobs = [...IP.SAMPLE_JOBS, ...liveJobs];
    return jobs.map((job) => ({ job, m: IP.score(job, profile, weights) }))
      .sort((a, b) => b.m.total - a.m.total);
  }, [liveJobs, profile, weights]);
  const go = (nextRoute) => {
    const path = ROUTE_PATHS[nextRoute];
    if (!path) {
      setRoute('not-found');
      setJobId(null);
      window.history.pushState({}, '', '/not-found');
      return;
    }
    setRoute(nextRoute);
    setJobId(null);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
  };
  const openJob = (id) => {
    setJobId(id);
    setRoute('details');
    window.history.pushState({}, '', `/internship/${encodeURIComponent(id)}`);
  };
  const saveApp = (job, materials = null) => {
    if (apps.some((app) => app.jobId === job.id)) return;
    setApps((items) => [{
      id: 'a' + Date.now(),
      jobId: job.id,
      company: job.company,
      role: job.role,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      deadline: job.deadline,
      savedAt: new Date().toISOString(),
      appliedAt: null,
      status: 'Saved',
      notes: '',
      materials,
      sample: !!job._sample,
    }, ...items]);
    toast(`Saved ${job.company} to tracker`);
  };
  const updateApp = (id, patch) => setApps((items) => items.map((app) => (app.id === id ? { ...app, ...patch } : app)));
  const deleteApp = (id) => {
    setApps((items) => items.filter((app) => app.id !== id));
    toast('Application deleted');
  };
  const checkBackend = async () => {
    setStatus(null);
    try {
      setStatus(await apiRequest(backend, '/api/integrations/status', { timeoutMs: 4000 }));
    } catch (error) {
      setStatus({ error: error.message });
    }
  };
  const searchInternships = async (query) => {
    if (!tavilyOk) return IP.search(query);
    const response = await apiRequest(backend, '/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: query.trim() || 'internship openings', max_results: 10 }),
    });
    if (!Array.isArray(response.results)) throw new Error('Backend returned an invalid search response.');
    setLiveJobs(response.results);
    return response.results;
  };
  const nebiusOk = !!(status && status.nebius && status.nebius.ok);
  const tavilyOk = !!(status && status.tavily && status.tavily.ok);
  const ctx = {
    route, go, jobId, openJob, studioJob, setStudioJob, profile, setProfile, apps, saveApp,
    updateApp, deleteApp, ranked, weights, setWeights, backend, setBackend, status,
    checkBackend, searchInternships, nebiusOk, tavilyOk, toast,
  };
  const Page = {
    dashboard: Dashboard,
    discover: Discover,
    details: Details,
    profile: Profile,
    'resume-builder': ResumeBuilder,
    studio: Studio,
    apply: ApplicationAssistant,
    tracker: Tracker,
    assistant: Assistant,
    settings: Settings,
  }[route];
  const acknowledgeStorageNotice = () => {
    try {
      localStorage.setItem(PRIVACY_NOTICE_KEY, 'accepted');
    } catch (error) {
      console.error('Could not save the browser storage notice preference.', error);
    }
    setShowStorageNotice(false);
  };

  return (
    <Shell route={route} go={go} appsCount={apps.length} nebiusOk={nebiusOk}>
      {route === 'not-found' ? (
        <section className="not-found" aria-labelledby="not-found-title">
          <div className="mono tiny muted">ERROR 404</div>
          <h1 id="not-found-title">Page not found</h1>
          <p className="muted">That page may have moved, or the address may be incorrect.</p>
          <button className="btn btn-primary" onClick={() => go('dashboard')}>Go to dashboard</button>
        </section>
      ) : (
        <AppErrorBoundary>
          <div key={route + (jobId || '')} data-screen-label={route}><Page ctx={ctx} /></div>
        </AppErrorBoundary>
      )}
      <Toast msg={toastMsg} />
      {showStorageNotice && (
        <aside className="privacy-notice" aria-label="Cookie and browser storage notice">
          <div>
            <b>Cookies &amp; browser storage</b>
            <p className="small">This app does not use tracking or advertising cookies. Your profile and applications are saved in this browser’s local storage. You can delete them in Settings.</p>
          </div>
          <div className="privacy-notice-actions">
            <button className="btn btn-sm" onClick={() => go('settings')}>Manage data</button>
            <button className="btn btn-primary btn-sm" onClick={acknowledgeStorageNotice}>Got it</button>
          </div>
        </aside>
      )}
    </Shell>
  );
}

createRoot(document.getElementById('root')).render(<App />);
