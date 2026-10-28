// InternPilot AI — sample data + deterministic engine (scoring, extraction, templates)
const IP = (function () {
  const ALIASES = {
    torch: 'pytorch', 'scikit learn': 'scikit-learn', sklearn: 'scikit-learn', js: 'javascript', ts: 'typescript',
    'hugging face': 'transformers', huggingface: 'transformers', llms: 'llm', 'large language models': 'llm',
    'gen ai': 'generative ai', genai: 'generative ai', k8s: 'kubernetes', postgres: 'postgresql', cv: 'computer vision',
    'natural language processing': 'nlp', 'retrieval augmented generation': 'rag', 'node': 'node.js', nodejs: 'node.js',
    reactjs: 'react', 'amazon web services': 'aws', gcp: 'google cloud', tf: 'tensorflow',
  };
  const norm = (s) => { const k = String(s).toLowerCase().trim(); return ALIASES[k] || k; };

  // Vocabulary used for local, deterministic resume skill extraction (no model call).
  const VOCAB = {
    programming_languages: ['Python', 'Java', 'C++', 'C', 'JavaScript', 'TypeScript', 'SQL', 'Go', 'Rust', 'R', 'Kotlin', 'Bash'],
    frameworks: ['PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'FastAPI', 'Flask', 'Django', 'React', 'Node.js', 'LangChain', 'Transformers', 'OpenCV', 'Pandas', 'NumPy', 'Spring'],
    ai_ml_skills: ['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'LLM', 'RAG', 'Fine-tuning', 'Generative AI', 'Reinforcement Learning', 'MLOps', 'Prompt Engineering', 'Data Analysis', 'Statistics'],
    cloud_skills: ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Linux', 'Git', 'CI/CD', 'PostgreSQL', 'MongoDB', 'Redis'],
  };

  function extractFromText(text) {
    const t = ' ' + text.replace(/\s+/g, ' ') + ' ';
    const out = { programming_languages: [], frameworks: [], ai_ml_skills: [], cloud_skills: [] };
    for (const cat in VOCAB) {
      for (const term of VOCAB[cat]) {
        const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const single = term.length <= 2; // "C", "R", "Go" need strict boundaries
        const re = single ? new RegExp('[\\s,(/]' + esc + '[\\s,)/;.]', '') : new RegExp('(^|[^a-z0-9+#])' + esc + '($|[^a-z0-9+#])', 'i');
        if (re.test(t)) out[cat].push(term);
      }
    }
    const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || '';
    return { ...out, email, chars: text.length };
  }

  function extractResume(text) {
    const normalizedText = String(text).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
    const lines = normalizedText.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const aliases = new Map([
      ['summary', 'Summary'], ['profile', 'Summary'], ['professional summary', 'Summary'],
      ['objective', 'Summary'], ['career objective', 'Summary'], ['about me', 'Summary'],
      ['education', 'Education'], ['academic background', 'Education'], ['academics', 'Education'],
      ['work experience', 'Experience'], ['professional experience', 'Experience'],
      ['employment history', 'Experience'], ['experience', 'Experience'], ['internships', 'Experience'],
      ['projects', 'Projects'], ['personal projects', 'Projects'], ['academic projects', 'Projects'],
      ['technical projects', 'Projects'], ['certifications', 'Certifications'],
      ['certificates', 'Certifications'], ['licenses and certifications', 'Certifications'],
      ['skills', 'Skills'], ['technical skills', 'Skills'], ['skills and tools', 'Skills'],
      ['core competencies', 'Skills'], ['achievements', 'Achievements'], ['awards', 'Achievements'],
      ['honors and awards', 'Achievements'], ['publications', 'Publications'],
      ['leadership', 'Leadership'], ['leadership and activities', 'Leadership'],
      ['volunteer experience', 'Leadership'], ['volunteering', 'Leadership'],
      ['coursework', 'Coursework'], ['relevant coursework', 'Coursework'],
      ['languages', 'Languages'], ['interests', 'Interests'],
    ]);
    const sections = [];
    const inferHeading = (line) => {
      const key = line.toLowerCase().replace(/[:\s]+$/, '').trim();
      if (aliases.has(key)) return aliases.get(key);
      if (/^(selected work|things i've built|what i've built|portfolio|project work)$/.test(key)) return 'Projects';
      if (/^(work history|career history|professional background|my experience)$/.test(key)) return 'Experience';
      if (/^(academic history|academic qualifications|schooling)$/.test(key)) return 'Education';
      if (/^(toolkit|tech stack|technical expertise|areas of expertise)$/.test(key)) return 'Skills';
      if (/^(contact|contact information|personal details)$/.test(key)) return 'Header and contact';
      if (/^(about|about me|who i am|introduction)$/.test(key)) return 'Summary';
      const headingPattern = /^[A-Z][A-Z0-9 &/,+()'’-]{1,54}$/;
      return line.length <= 55 && headingPattern.test(line) && !/[@.]|https?:/i.test(line)
        ? line.replace(/[:\s]+$/, '').trim()
        : null;
    };
    let current = null;
    const startSection = (heading) => {
      current = { heading, content: '' };
      sections.push(current);
    };
    for (const [lineIndex, line] of lines.entries()) {
      const inferredHeading = inferHeading(line);
      const lineKey = line.toLowerCase().replace(/[:\s]+$/, '').trim();
      const startsWithResumeName = lineIndex === 0 && inferredHeading && !aliases.has(lineKey);
      if (inferredHeading && !startsWithResumeName) {
        startSection(inferredHeading);
      } else if (!current) {
        startSection('Header and contact');
        current.content = line;
      } else {
        current.content += `${current.content ? '\n' : ''}${line}`;
      }
    }
    if (!sections.length) sections.push({ heading: 'Resume details', content: normalizedText });

    const extracted = extractFromText(normalizedText);
    const email = extracted.email;
    const header = sections.find((section) => section.heading === 'Header and contact')?.content || '';
    const headerLines = header.split('\n').map((line) => line.trim()).filter(Boolean);
    const phone = (header.match(/\+?\d[\d\s().-]{7,}\d/g) || [])
      .map((candidate) => candidate.trim())
      .filter((candidate) => {
        const digits = candidate.replace(/\D/g, '').length;
        return digits >= 10 && digits <= 15;
      })
      .sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0] || '';
    const name = headerLines.find((line) =>
      line.length <= 70 &&
      !/[@]|https?:|www\.|linkedin|github|resume|curriculum vitae/i.test(line) &&
      !/\d{3,}/.test(line) &&
      !aliases.has(line.toLowerCase().replace(/[:\s]+$/, '').trim())
    ) || '';
    const contactWithoutIdentifiers = header.replace(email, '').replace(phone, '').replace(/https?:\/\/\S+|www\.\S+/gi, '');
    const location = contactWithoutIdentifiers.split(/[|·•;]/).map((part) => part.trim()).find((part) =>
      part && part !== name &&
      /(?:\b[A-Z][a-z]+(?:[\s-]+[A-Z][a-z]+)*,\s*(?:[A-Z]{2}\b|[A-Z][a-z]+)\b|\bremote\b|\bhybrid\b|\bUnited States\b|\bIndia\b|\bCanada\b|\bUK\b)/i.test(part)
    ) || '';
    const sectionContent = (heading) => sections.filter((section) => section.heading === heading).map((section) => section.content).filter(Boolean).join('\n\n');
    return {
      ...extracted,
      name,
      email,
      phone: phone.trim(),
      location,
      summary: sectionContent('Summary'),
      resume_sections: sections,
      resume_text: normalizedText,
      chars: normalizedText.length,
    };
  }

  const SAMPLE_PROFILE = {
    name: 'Sample Candidate',
    email: 'candidate@example.com',
    phone: '',
    location: '',
    summary: '',
    resume_sections: [],
    resume_text: '',
    education: [{ degree: 'B.Tech, Computer Science', school: 'Sample Institute of Technology', year: '2027 (expected)' }],
    skills: ['Git', 'Linux', 'Data Analysis'],
    programming_languages: ['Python', 'TypeScript', 'C++', 'SQL'],
    frameworks: ['PyTorch', 'scikit-learn', 'FastAPI', 'React', 'Pandas', 'Transformers', 'OpenCV'],
    ai_ml_skills: ['NLP', 'Computer Vision', 'RAG', 'Machine Learning'],
    cloud_skills: ['Docker', 'AWS'],
    projects: [
      { name: 'Resume-aware RAG assistant', desc: 'Retrieval-augmented Q&A over course notes using sentence embeddings, a vector index and a FastAPI backend.', skills: ['Python', 'RAG', 'FastAPI', 'Transformers', 'NLP'] },
      { name: 'Traffic-sign classifier', desc: 'CNN trained on a public traffic-sign dataset; deployed as a small React demo with a PyTorch inference API.', skills: ['PyTorch', 'Computer Vision', 'OpenCV', 'React', 'Docker'] },
    ],
    experience: [{ role: 'Undergraduate Research Assistant', org: 'University ML Lab', months: 3, desc: 'Cleaned datasets and ran baseline experiments with scikit-learn and Pandas.', skills: ['scikit-learn', 'Pandas', 'Python'] }],
    certifications: [],
    preferred_roles: ['Machine Learning Intern', 'LLM / Generative AI Intern', 'Computer Vision Intern'],
    preferred_locations: ['Hyderabad', 'Bengaluru', 'Remote'],
    _sample: true,
  };

  const EMPTY_PROFILE = { name: '', email: '', phone: '', location: '', summary: '', resume_sections: [], resume_text: '', education: [], skills: [], programming_languages: [], frameworks: [], ai_ml_skills: [], cloud_skills: [], projects: [], experience: [], certifications: [], preferred_roles: [], preferred_locations: [], _sample: false };

  // Fictional, clearly-labeled sample records. Not live vacancies.
  const SAMPLE_JOBS = [
    { id: 's1', company: 'Kestrel Labs', role: 'LLM Applications Intern', city: 'Hyderabad', country: 'India', mode: 'Hybrid', posted: '2026-10-02', deadline: '2026-11-15', stipend: null,
      required: ['Python', 'LLM', 'RAG', 'FastAPI'], preferred: ['Docker', 'LangChain', 'PostgreSQL'], roleTags: ['llm', 'generative ai', 'machine learning'], minExpMonths: 0, eduFields: ['computer science', 'data science', 'electronics'],
      description: 'Build retrieval and evaluation pipelines for internal LLM tools. Work with product engineers to ship prototypes behind feature flags. Write clear documentation and test coverage.' },
    { id: 's2', company: 'Tessellate Vision', role: 'Computer Vision Intern', city: 'Bengaluru', country: 'India', mode: 'On-site', posted: '2026-09-28', deadline: null, stipend: null,
      required: ['Python', 'PyTorch', 'OpenCV', 'Computer Vision'], preferred: ['Docker', 'C++', 'Kubernetes'], roleTags: ['computer vision', 'machine learning'], minExpMonths: 0, eduFields: ['computer science', 'electronics'],
      description: 'Improve detection models for retail shelf imagery. Own a dataset-cleaning workstream and report weekly metric changes.' },
    { id: 's3', company: 'Quarry Data', role: 'Machine Learning Intern', city: 'Pune', country: 'India', mode: 'Remote', posted: '2026-10-06', deadline: '2026-10-31', stipend: null,
      required: ['Python', 'scikit-learn', 'SQL', 'Statistics'], preferred: ['Pandas', 'AWS'], roleTags: ['machine learning', 'data'], minExpMonths: 0, eduFields: ['computer science', 'statistics', 'mathematics'],
      description: 'Prototype churn and demand models for SMB customers. Partner with analysts to validate features and present findings.' },
    { id: 's4', company: 'Halcyon Robotics', role: 'Perception Software Intern', city: 'Chennai', country: 'India', mode: 'On-site', posted: '2026-09-20', deadline: '2026-11-01', stipend: null,
      required: ['C++', 'Computer Vision', 'Linux', 'ROS'], preferred: ['PyTorch', 'CUDA'], roleTags: ['computer vision', 'robotics'], minExpMonths: 3, eduFields: ['computer science', 'electronics', 'mechanical'],
      description: 'Integrate perception modules on mobile robot platforms. Profile and optimise C++ pipelines on embedded GPUs.' },
    { id: 's5', company: 'Paperkite', role: 'Full-stack Developer Intern', city: 'Hyderabad', country: 'India', mode: 'Hybrid', posted: '2026-10-08', deadline: null, stipend: null,
      required: ['TypeScript', 'React', 'Node.js', 'SQL'], preferred: ['Docker', 'AWS'], roleTags: ['software engineering', 'web'], minExpMonths: 0, eduFields: ['computer science'],
      description: 'Ship features across the web app and API for a document-collaboration product. Pair with senior engineers on code review.' },
    { id: 's6', company: 'Lumen Health AI', role: 'NLP Research Intern', city: 'Remote', country: 'India', mode: 'Remote', posted: '2026-10-01', deadline: '2026-12-01', stipend: null,
      required: ['Python', 'NLP', 'Transformers', 'PyTorch'], preferred: ['Fine-tuning', 'Statistics'], roleTags: ['nlp', 'llm', 'research', 'machine learning'], minExpMonths: 0, eduFields: ['computer science', 'data science', 'linguistics'],
      description: 'Evaluate clinical-text models on de-identified benchmarks. Run ablations and write internal research notes.' },
    { id: 's7', company: 'Ardent Cloud', role: 'MLOps Intern', city: 'Bengaluru', country: 'India', mode: 'Hybrid', posted: '2026-09-25', deadline: '2026-10-25', stipend: null,
      required: ['Python', 'Docker', 'Kubernetes', 'CI/CD'], preferred: ['AWS', 'MLOps', 'Linux'], roleTags: ['mlops', 'machine learning', 'devops'], minExpMonths: 0, eduFields: ['computer science'],
      description: 'Maintain model-serving infrastructure and CI pipelines. Automate model-evaluation jobs and dashboards.' },
    { id: 's8', company: 'Monsoon Fintech', role: 'Python Developer Intern', city: 'Mumbai', country: 'India', mode: 'On-site', posted: '2026-10-04', deadline: null, stipend: null,
      required: ['Python', 'SQL', 'Git'], preferred: ['FastAPI', 'PostgreSQL', 'Redis'], roleTags: ['software engineering', 'python'], minExpMonths: 0, eduFields: ['computer science', 'mathematics'],
      description: 'Build internal reporting services and data-validation scripts for payments operations.' },
  ].map((j) => ({ ...j, source: 'Sample dataset', sourceUrl: 'https://example.com/sample/' + j.id, applyUrl: null, retrievedAt: '2026-10-14T09:00:00Z', _sample: true }));

  const DEFAULT_WEIGHTS = { required: 40, preferred: 15, role: 20, education: 10, experience: 5, location: 10 };
  const FACTOR_LABELS = { required: 'Required skills', preferred: 'Preferred skills', role: 'Role relevance', education: 'Education', experience: 'Experience', location: 'Location' };

  const allSkills = (p) => [...p.skills, ...p.programming_languages, ...p.frameworks, ...p.ai_ml_skills, ...p.cloud_skills];
  const skillSet = (p) => new Set(allSkills(p).map(norm));
  function officialApplyUrl(job) {
    if (!job || job._sample || job.isOfficialApply !== true || typeof job.applyUrl !== 'string') return '';
    try {
      const parsed = new URL(job.applyUrl);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  }
  function listingUrl(job) {
    if (!job || job._sample) return '';
    const destination = officialApplyUrl(job) || job.sourceUrl;
    if (typeof destination !== 'string') return '';
    try {
      const parsed = new URL(destination);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function score(job, p, w = DEFAULT_WEIGHTS) {
    const set = skillSet(p);
    const req = job.required.map((s) => ({ s, ok: set.has(norm(s)) }));
    const pref = job.preferred.map((s) => ({ s, ok: set.has(norm(s)) }));
    const frac = (arr) => (arr.length ? arr.filter((x) => x.ok).length / arr.length : 1);
    const prefText = p.preferred_roles.join(' ').toLowerCase() + ' ' + p.ai_ml_skills.join(' ').toLowerCase();
    const roleHits = job.roleTags.filter((t) => prefText.includes(t)).length;
    const roleR = roleHits ? Math.min(1, 0.6 + (0.4 * roleHits) / job.roleTags.length) : 0;
    const eduText = p.education.map((e) => e.degree).join(' ').toLowerCase();
    const eduR = !p.education.length ? 0 : job.eduFields.some((f) => eduText.includes(f)) ? 1 : 0.5;
    const months = p.experience.reduce((a, e) => a + (Number(e.months) || 0), 0);
    const expR = job.minExpMonths ? Math.min(1, months / job.minExpMonths) : 1;
    const locs = p.preferred_locations.map((l) => l.toLowerCase());
    const locR = job.mode === 'Remote' && locs.includes('remote') ? 1 : locs.includes(job.city.toLowerCase()) ? 1 : job.mode === 'Remote' ? 0.8 : locs.length ? 0.3 : 0.5;
    const ratios = { required: req.length ? frac(req) : 0, preferred: frac(pref), role: roleR, education: eduR, experience: expR, location: locR };
    const details = {
      required: req.length ? `${req.filter((x) => x.ok).length}/${req.length} required skills present` : 'No required skills could be extracted from this posting',
      preferred: `${pref.filter((x) => x.ok).length}/${pref.length} preferred skills present`,
      role: roleHits ? `${roleHits} role tag(s) overlap your preferred roles` : 'No overlap with preferred roles',
      education: !p.education.length ? 'No education listed' : eduR === 1 ? 'Degree field listed by the posting' : 'Degree present; field not listed',
      experience: job.minExpMonths ? `${months} of ${job.minExpMonths} months asked` : 'No minimum experience stated',
      location: `${job.mode} · ${job.city}`,
    };
    const totalW = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    const factors = Object.keys(ratios).map((k) => ({ key: k, label: FACTOR_LABELS[k], weight: w[k], ratio: ratios[k], points: (w[k] * ratios[k] * 100) / totalW, detail: details[k] }));
    const total = Math.round(factors.reduce((a, f) => a + f.points, 0));
    const matched = [...req, ...pref].filter((x) => x.ok).map((x) => x.s);
    const missingReq = req.filter((x) => !x.ok).map((x) => x.s);
    const missingPref = pref.filter((x) => !x.ok).map((x) => x.s);
    const evidence = [];
    matched.forEach((s) => {
      const src = [...p.projects.map((x) => ({ ...x, kind: 'Project' })), ...p.experience.map((x) => ({ ...x, name: x.role + ' — ' + x.org, kind: 'Experience' }))].find((x) => (x.skills || []).map(norm).includes(norm(s)));
      if (src) evidence.push({ skill: s, kind: src.kind, name: src.name });
    });
    const prep = [
      ...missingReq.map((s) => `Required: build a small, public example using ${s} and link it on your resume.`),
      ...missingPref.slice(0, 2).map((s) => `Nice to have: review ${s} fundamentals before interviews.`),
    ];
    if (!prep.length) prep.push('All listed skills are covered — prepare 2 project walkthroughs with measurable results.');
    return { total, factors, matched, missingReq, missingPref, evidence, prep };
  }

  // Template drafts — deterministic, offline, use only profile + job fields.
  function drafts(job, p, m) {
    const name = p.name || '[Your name]';
    const edu = p.education[0] ? `${p.education[0].degree} at ${p.education[0].school}` : '[your degree]';
    const top = m.matched.slice(0, 4).join(', ') || '[relevant skills]';
    const ev = m.evidence.slice(0, 2);
    const proj = ev.length ? ev.map((e) => `${e.name} (${e.skill})`).join(' and ') : (p.projects[0] ? p.projects[0].name : '[a relevant project]');
    return {
      cover: `Dear ${job.company} hiring team,\n\nI'm applying for the ${job.role} position. I'm currently pursuing a ${edu}, and my recent work lines up with what your team describes: ${job.description.split('.')[0].toLowerCase()}.\n\nThe most relevant examples are ${proj}. Across these I've worked with ${top}.\n\n${m.missingReq.length ? `I haven't yet used ${m.missingReq.join(', ')} in a project, and I'm actively working on that before the internship would begin.\n\n` : ''}I'd welcome the chance to discuss how I could contribute.\n\nSincerely,\n${name}`,
      recruiter: `Hi [Recruiter name] — I'm ${name}, a ${edu.split(' at ')[0]} student. I saw the ${job.role} opening at ${job.company}. I've built ${proj} using ${top}. Would you be open to a short chat about the role? Thank you!`,
      email: `Subject: Application — ${job.role} — ${name}\n\nHello,\n\nPlease find my application for the ${job.role} role (${job.city}, ${job.mode}). My resume is attached.\n\nRelevant skills: ${top}.\nRelevant work: ${proj}.\n\nThank you for your time.\n\nBest regards,\n${name}${p.email ? '\n' + p.email : ''}`,
      highlights: p.projects.length ? p.projects.map((x) => `• ${x.name} — ${x.desc} [${x.skills.filter((s) => [...job.required, ...job.preferred].map(norm).includes(norm(s))).join(', ') || 'general'}]`).join('\n') : '• Add projects to your profile to generate highlights.',
      interview: [
        ...job.required.slice(0, 3).map((s) => `• Walk me through a time you used ${s}. What would you do differently?`),
        `• Why ${job.company}, and why this ${job.role.toLowerCase()}?`,
        ...(ev[0] ? [`• In ${ev[0].name}, how did you measure whether it worked?`] : []),
        ...m.missingReq.slice(0, 1).map((s) => `• You haven't listed ${s}. How would you get up to speed in your first two weeks?`),
      ].join('\n'),
    };
  }

  function search(query, jobs = SAMPLE_JOBS) {
    const toks = query.toLowerCase().split(/[^a-z0-9+#/]+/).filter((t) => t.length > 1 && !['in', 'and', 'internship', 'internships', 'intern', 'the', 'for', 'india'].includes(t));
    if (!toks.length) return jobs;
    return jobs.filter((j) => {
      const hay = [j.role, j.city, j.mode, ...j.roleTags, ...j.required, ...j.preferred, j.description].join(' ').toLowerCase();
      return toks.some((t) => hay.includes(t));
    });
  }

  return { norm, extractFromText, extractResume, SAMPLE_PROFILE, EMPTY_PROFILE, SAMPLE_JOBS, DEFAULT_WEIGHTS, FACTOR_LABELS, score, drafts, search, allSkills, officialApplyUrl, listingUrl, STATUSES: ['Saved', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn'] };
})();

export default IP;
