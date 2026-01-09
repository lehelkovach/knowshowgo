const form = document.getElementById('knode-form');
const result = document.getElementById('result');
const resetBtn = document.getElementById('reset');

function sameOriginBaseUrl() {
  return `${window.location.protocol}//${window.location.host}`;
}

function safeJsonParse(s) {
  if (!s || !s.trim()) return {};
  return JSON.parse(s);
}

function linesToTags(s) {
  return (s || '')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean);
}

function pretty(x) {
  return JSON.stringify(x, null, 2);
}

function setResult(obj) {
  result.textContent = typeof obj === 'string' ? obj : pretty(obj);
}

document.getElementById('baseUrl').value = sameOriginBaseUrl();

resetBtn.addEventListener('click', () => {
  form.reset();
  document.getElementById('baseUrl').value = sameOriginBaseUrl();
  setResult('(submit the form)');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const baseUrl = (document.getElementById('baseUrl').value || '').trim() || sameOriginBaseUrl();
  const label = document.getElementById('label').value.trim();
  const prototypeUuid = document.getElementById('prototypeUuid').value.trim();
  const summary = document.getElementById('summary').value.trim();
  const tags = linesToTags(document.getElementById('tags').value);

  let metadata = {};
  try {
    metadata = safeJsonParse(document.getElementById('metadata').value);
  } catch (err) {
    setResult({ error: 'Invalid metadata JSON', details: String(err) });
    return;
  }

  const payload = {
    label,
    summary: summary || null,
    tags,
    metadata,
    prototypeUuid: prototypeUuid || null
  };

  setResult({ status: 'submitting...', payload });

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/knodes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResult({ status: res.status, error: body.error || 'Request failed', body });
      return;
    }

    setResult({
      status: 'created',
      uuid: body.uuid,
      links: {
        concept: `${baseUrl.replace(/\/+$/, '')}/api/concepts/${body.uuid}`,
        associations: `${baseUrl.replace(/\/+$/, '')}/api/associations/${body.uuid}`
      }
    });
  } catch (err) {
    setResult({ error: 'Network error', details: String(err) });
  }
});

