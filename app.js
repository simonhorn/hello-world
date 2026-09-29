'use strict';

const APP_VERSION = '0.2.0';
const STORAGE_KEY = 'heartMonitor.events.v1';
const PLACES_KEY = 'heartMonitor.places.v1';
const DELETED_KEY = 'heartMonitor.deleted.v1';

const ACTIVITIES = [
  'Sitting',
  'Walking',
  'Exercising',
  'Climbing stairs',
  'Treadmill',
  'Weights / resistance training',
  'Mowing lawn / yard work',
  'Driving',
  'Sleeping / lying down',
  'Eating',
  'Taking medications',
  'Sauna',
  'Tennis / racquet sport',
  'Standing / speaking',
  'Other'
];

const SYMPTOMS = [
  'None / accidental push',
  'Light-headedness',
  'Rapid or fast beats',
  'Flutter or skipped beats',
  'Shortness of breath',
  'Chest pain or pressure',
  'Dizziness',
  'Tired or fatigued',
  'Passed out'
];

let draft = null;
let recognition = null;
let deferredInstallPrompt = null;
let manageMode = false;
let selectedDeleteIds = new Set();

const $ = (id) => document.getElementById(id);

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function formatLocal(iso) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(iso));
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getEvents() {
  const value = getJson(STORAGE_KEY, []);
  return Array.isArray(value) ? value : [];
}

function setEvents(events) {
  setJson(STORAGE_KEY, events);
}

function getPlaces() {
  const value = getJson(PLACES_KEY, []);
  return Array.isArray(value) ? value : [];
}

function setPlaces(places) {
  setJson(PLACES_KEY, places);
}

function getDeletedEvents() {
  const value = getJson(DELETED_KEY, []);
  const items = Array.isArray(value) ? value : [];
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const kept = items.filter(item => !item.deletedAt || new Date(item.deletedAt).getTime() >= cutoff);
  if (kept.length !== items.length) setJson(DELETED_KEY, kept);
  return kept;
}

function setDeletedEvents(items) {
  setJson(DELETED_KEY, items);
}

function renderChoices() {
  $('activities').innerHTML = ACTIVITIES.map(function(name, i) {
    return '<div class="choice">' +
      '<input type="radio" name="activity" id="activity-' + i + '" value="' + escapeHtml(name) + '">' +
      '<label for="activity-' + i + '">' + escapeHtml(name) + '</label>' +
      '</div>';
  }).join('');

  $('symptoms').innerHTML = SYMPTOMS.map(function(name, i) {
    return '<div class="choice">' +
      '<input type="checkbox" name="symptom" id="symptom-' + i + '" value="' + escapeHtml(name) + '">' +
      '<label for="symptom-' + i + '">' + escapeHtml(name) + '</label>' +
      '</div>';
  }).join('');

  document.querySelectorAll('input[name="symptom"]').forEach(function(input) {
    input.addEventListener('change', function() {
      if (input.value === 'None / accidental push' && input.checked) {
        document.querySelectorAll('input[name="symptom"]').forEach(function(other) {
          if (other !== input) other.checked = false;
        });
      } else if (input.checked) {
        Array.from(document.querySelectorAll('input[name="symptom"]')).forEach(function(other) {
          if (other.value === 'None / accidental push') other.checked = false;
        });
      }
    });
  });
}

function markEventNow() {
  if (!draft) newDraft();
  draft.capturedAt = new Date().toISOString();
  $('capturedLocal').textContent = formatLocal(draft.capturedAt);
  showToast('Event time captured');
}

function newDraft() {
  draft = {
    capturedAt: new Date().toISOString(),
    location: null,
    locationError: null
  };
  $('capturedLocal').textContent = formatLocal(draft.capturedAt);
  $('placeName').value = '';
  $('placeHint').textContent = 'GPS is used only to recognize a useful place name.';
  captureLocation();
}

function resetForm() {
  document.querySelectorAll('input[name="activity"]').forEach(function(x) { x.checked = false; });
  document.querySelectorAll('input[name="symptom"]').forEach(function(x) { x.checked = false; });
  $('monitorPressed').checked = false;
  $('notes').value = '';
  $('duration').value = '';
  $('symptomTiming').value = '';
  $('placeName').value = '';
  $('validationMsg').classList.add('hidden');
  newDraft();
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = function(v) { return v * Math.PI / 180; };
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestKnownPlace(location) {
  if (!location) return null;
  let best = null;
  getPlaces().forEach(function(place) {
    if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return;
    const distance = distanceMeters(location, place);
    if (!best || distance < best.distance) best = { place: place, distance: distance };
  });
  if (!best || best.distance > 100) return null;
  return best;
}

function updatePlaceSuggestion() {
  if (!draft || !draft.location) return;
  const match = nearestKnownPlace(draft.location);
  if (match) {
    if (!$('placeName').value.trim()) $('placeName').value = match.place.name;
    $('placeHint').textContent = 'Recognized saved place: ' + match.place.name + ' (about ' + Math.round(match.distance) + ' m away). GPS will not be included in the event once this place is saved.';
  } else {
    $('placeHint').textContent = 'New place. Give it a useful name such as Home, Gym, Church or Movie Theatre. The app will remember that name on this phone.';
  }
}

function rememberPlace(name, location) {
  if (!name || !location) return;
  const places = getPlaces();
  let nearestIndex = -1;
  let nearestDistance = Infinity;

  places.forEach(function(place, index) {
    if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return;
    const d = distanceMeters(location, place);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = index;
    }
  });

  const record = {
    id: nearestIndex >= 0 && nearestDistance <= 100 ? places[nearestIndex].id : uid(),
    name: name,
    latitude: location.latitude,
    longitude: location.longitude,
    updatedAt: new Date().toISOString()
  };

  if (nearestIndex >= 0 && nearestDistance <= 100) {
    places[nearestIndex] = record;
  } else {
    places.push(record);
  }
  setPlaces(places);
}

function captureLocation() {
  if (!navigator.geolocation) {
    draft.locationError = 'Geolocation is not supported on this device.';
    $('locationStatus').textContent = 'Location unavailable';
    $('locationDetails').textContent = draft.locationError;
    return;
  }

  $('locationStatus').textContent = 'Finding precise location…';
  $('locationDetails').textContent = 'Waiting for the phone to refine the GPS fix';

  let best = null;
  let watchId = null;
  let finished = false;

  const finish = function() {
    if (finished) return;
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    if (best) {
      draft.location = best;
      draft.locationError = null;
      $('locationStatus').textContent = 'Location found';
      $('locationDetails').textContent = 'Accuracy about ±' + best.accuracyMeters + ' m. Exact coordinates stay local unless the place is still unnamed.';
      updatePlaceSuggestion();
    } else {
      draft.location = null;
      draft.locationError = 'No location fix received.';
      $('locationStatus').textContent = 'Location not captured';
      $('locationDetails').textContent = draft.locationError;
    }
  };

  watchId = navigator.geolocation.watchPosition(
    function(pos) {
      const candidate = {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracyMeters: Math.round(pos.coords.accuracy),
        capturedAt: new Date(pos.timestamp).toISOString()
      };
      if (!best || candidate.accuracyMeters < best.accuracyMeters) {
        best = candidate;
        draft.location = best;
        draft.locationError = null;
        $('locationStatus').textContent = 'Location found';
        $('locationDetails').textContent = 'Accuracy about ±' + best.accuracyMeters + ' m — refining…';
        updatePlaceSuggestion();
      }
      if (best.accuracyMeters <= 50) finish();
    },
    function(err) {
      if (!best) {
        draft.locationError = err.message || 'Location permission denied or unavailable.';
        $('locationStatus').textContent = 'Location not captured';
        $('locationDetails').textContent = draft.locationError;
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 25000
    }
  );

  setTimeout(finish, 25000);
}

function selectedActivity() {
  const el = document.querySelector('input[name="activity"]:checked');
  return el ? el.value : '';
}

function selectedSymptoms() {
  return Array.from(document.querySelectorAll('input[name="symptom"]:checked')).map(function(x) { return x.value; });
}

function validateEvent() {
  const issues = [];
  if (!selectedActivity()) issues.push('Select one activity.');
  if (!selectedSymptoms().length) issues.push('Select at least one symptom.');
  return issues;
}

function saveEvent() {
  const issues = validateEvent();
  if (issues.length) {
    $('validationMsg').innerHTML = issues.map(function(x) { return '• ' + escapeHtml(x); }).join('<br>');
    $('validationMsg').classList.remove('hidden');
    $('validationMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const placeName = $('placeName').value.trim();
  if (placeName && draft.location) rememberPlace(placeName, draft.location);

  const event = {
    id: uid(),
    appVersion: APP_VERSION,
    capturedAt: draft.capturedAt,
    savedAt: new Date().toISOString(),
    place: placeName || null,
    location: placeName ? null : draft.location,
    locationError: draft.locationError,
    bodyGuardianButtonPressed: $('monitorPressed').checked,
    activity: selectedActivity(),
    symptoms: selectedSymptoms(),
    duration: $('duration').value || null,
    symptomTiming: $('symptomTiming').value || null,
    notes: $('notes').value.trim()
  };

  const events = getEvents();
  events.unshift(event);
  setEvents(events);

  showToast('Event saved');
  renderHistory();
  resetForm();
}

function eventPlaceText(event) {
  if (event.place) return event.place;
  if (event.location) return 'Unnamed place (GPS stored locally)';
  return 'Not captured';
}

function renderHistory() {
  const events = getEvents();
  const deleted = getDeletedEvents();

  $('eventCount').textContent = events.length + ' saved event' + (events.length === 1 ? '' : 's');
  $('emptyHistory').classList.toggle('hidden', events.length > 0);
  $('manageRecordsBtn').disabled = events.length === 0;
  $('manageRecordsBtn').textContent = manageMode ? 'Managing records' : 'Manage records';
  $('manageControls').classList.toggle('hidden', !manageMode);
  $('restoreDeletedBtn').classList.toggle('hidden', deleted.length === 0);
  $('restoreDeletedBtn').textContent = 'Restore recently deleted (' + deleted.length + ')';

  $('historyList').innerHTML = events.map(function(event) {
    const selector = manageMode
      ? '<label class="check-row manage-check"><input type="checkbox" data-manage-select="' + escapeHtml(event.id) + '"' +
        (selectedDeleteIds.has(event.id) ? ' checked' : '') +
        '><span>Select this record for deletion</span></label>'
      : '';

    return '<article class="event-card">' +
      selector +
      '<div class="event-title"><h3>' + escapeHtml(formatLocal(event.capturedAt)) + '</h3></div>' +
      '<dl>' +
      '<dt>Place</dt><dd>' + escapeHtml(eventPlaceText(event)) + '</dd>' +
      '<dt>Activity</dt><dd>' + escapeHtml(event.activity) + '</dd>' +
      '<dt>Symptoms</dt><dd>' + escapeHtml((event.symptoms || []).join(', ')) + '</dd>' +
      '<dt>Duration</dt><dd>' + escapeHtml(event.duration || '—') + '</dd>' +
      '<dt>Timing</dt><dd>' + escapeHtml(event.symptomTiming || '—') + '</dd>' +
      '<dt>BG button</dt><dd>' + (event.bodyGuardianButtonPressed ? 'Pressed' : 'Not marked as pressed') + '</dd>' +
      '<dt>Details</dt><dd>' + escapeHtml(event.notes || '—') + '</dd>' +
      '</dl>' +
      '<div class="event-actions">' +
      '<button class="secondary" type="button" data-share="' + escapeHtml(event.id) + '">Share</button>' +
      '</div>' +
      '</article>';
  }).join('');

  document.querySelectorAll('[data-share]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const event = getEvents().find(function(e) { return e.id === btn.dataset.share; });
      if (event) shareText(eventToText(event), 'Heart Monitor event');
    });
  });

  document.querySelectorAll('[data-manage-select]').forEach(function(box) {
    box.addEventListener('change', function() {
      if (box.checked) selectedDeleteIds.add(box.dataset.manageSelect);
      else selectedDeleteIds.delete(box.dataset.manageSelect);
      updateManageControls();
    });
  });

  updateManageControls();
}

function updateManageControls() {
  if (!$('deleteSelectedBtn')) return;
  const count = selectedDeleteIds.size;
  $('selectedCount').textContent = count + ' selected';
  $('deleteSelectedBtn').disabled = count === 0;
  $('deleteSelectedBtn').textContent = count ? 'Delete selected (' + count + ')' : 'Delete selected';
}

function enterManageMode() {
  manageMode = true;
  selectedDeleteIds.clear();
  renderHistory();
}

function exitManageMode() {
  manageMode = false;
  selectedDeleteIds.clear();
  renderHistory();
}

function deleteSelectedRecords() {
  const events = getEvents();
  const selected = events.filter(function(e) { return selectedDeleteIds.has(e.id); });
  if (!selected.length) return;

  let message;
  if (selected.length === events.length) {
    message = 'You selected EVERY saved event (' + selected.length + '). Delete ALL records? They will be moved to Recently Deleted for 30 days.';
  } else if (selected.length === 1) {
    message = 'Delete this selected event? It will be moved to Recently Deleted for 30 days.';
  } else {
    message = 'Delete these ' + selected.length + ' selected events? They will be moved to Recently Deleted for 30 days.';
  }

  if (!confirm(message)) return;

  const deleted = getDeletedEvents();
  const now = new Date().toISOString();
  selected.forEach(function(event) {
    deleted.unshift(Object.assign({}, event, { deletedAt: now }));
  });
  setDeletedEvents(deleted);
  setEvents(events.filter(function(e) { return !selectedDeleteIds.has(e.id); }));

  exitManageMode();
  showToast(selected.length + ' event' + (selected.length === 1 ? '' : 's') + ' moved to Recently Deleted');
}

function restoreRecentlyDeleted() {
  const deleted = getDeletedEvents();
  if (!deleted.length) return;
  if (!confirm('Restore all ' + deleted.length + ' recently deleted event' + (deleted.length === 1 ? '' : 's') + '?')) return;

  const current = getEvents();
  const byId = new Map(current.map(function(e) { return [e.id, e]; }));
  deleted.forEach(function(item) {
    const restored = Object.assign({}, item);
    delete restored.deletedAt;
    byId.set(restored.id, restored);
  });
  const merged = Array.from(byId.values()).sort(function(a, b) {
    return new Date(b.capturedAt) - new Date(a.capturedAt);
  });
  setEvents(merged);
  setDeletedEvents([]);
  renderHistory();
  showToast('Recently deleted events restored');
}

function eventToText(event) {
  const place = event.place || (event.location ? 'Unnamed place (exact GPS kept only on device)' : 'Not captured');
  return [
    'HEART MONITOR / BODYGUARDIAN EVENT',
    'Captured: ' + formatLocal(event.capturedAt),
    'ISO timestamp: ' + event.capturedAt,
    'Place: ' + place,
    'BodyGuardian center button: ' + (event.bodyGuardianButtonPressed ? 'Pressed' : 'Not marked as pressed'),
    'Activity: ' + event.activity,
    'Symptoms: ' + (event.symptoms || []).join('; '),
    'Duration: ' + (event.duration || 'Not recorded'),
    'Symptom/button timing: ' + (event.symptomTiming || 'Not recorded'),
    'Other/details: ' + (event.notes || 'None'),
    'Record ID: ' + event.id
  ].join('\n');
}

function allEventsToText() {
  const events = getEvents();
  if (!events.length) return 'HEART MONITOR LOG\nNo saved events.';
  const blocks = [
    'HEART MONITOR / BODYGUARDIAN EVENT LOG',
    'Exported: ' + formatLocal(new Date().toISOString()),
    'Events: ' + events.length,
    ''
  ];
  events.forEach(function(event, index) {
    blocks.push('===== EVENT ' + (index + 1) + ' =====');
    blocks.push(eventToText(event));
    blocks.push('');
  });
  return blocks.join('\n');
}

async function shareText(textValue, title) {
  try {
    if (navigator.share) {
      await navigator.share({ title: title, text: textValue });
      setShareStatus('Share sheet opened.');
    } else {
      await navigator.clipboard.writeText(textValue);
      setShareStatus('Sharing is not available here, so the text was copied to the clipboard.');
      showToast('Copied to clipboard');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    try {
      await navigator.clipboard.writeText(textValue);
      setShareStatus('Could not open the share sheet; copied the text to the clipboard instead.');
      showToast('Copied to clipboard');
    } catch {
      setShareStatus('Could not share or copy. Use Export instead.');
    }
  }
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return '"' + s.replaceAll('"', '""') + '"';
}

function exportCsv() {
  const events = getEvents();
  const headers = [
    'captured_at_iso',
    'captured_at_local',
    'place',
    'bodyguardian_button_pressed',
    'activity',
    'symptoms',
    'duration',
    'symptom_button_timing',
    'details',
    'record_id'
  ];
  const rows = events.map(function(e) {
    return [
      e.capturedAt,
      formatLocal(e.capturedAt),
      e.place || (e.location ? 'Unnamed place' : ''),
      e.bodyGuardianButtonPressed ? 'yes' : 'no',
      e.activity,
      (e.symptoms || []).join(' | '),
      e.duration || '',
      e.symptomTiming || '',
      e.notes || '',
      e.id
    ];
  });
  const csv = [headers].concat(rows).map(function(row) {
    return row.map(csvEscape).join(',');
  }).join('\r\n');
  downloadBlob(csv, 'heart-monitor-events.csv', 'text/csv;charset=utf-8');
}

function exportJson() {
  const payload = {
    format: 'Heart Monitor Logger backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    events: getEvents(),
    savedPlaces: getPlaces()
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'heart-monitor-events.json', 'application/json');
}

function downloadBlob(contentValue, filename, type) {
  const blob = new Blob([contentValue], { type: type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

async function importJson(file) {
  try {
    const textValue = await file.text();
    const parsed = JSON.parse(textValue);
    if (!parsed || !Array.isArray(parsed.events)) throw new Error('This is not a Heart Monitor backup.');

    const current = getEvents();
    const byId = new Map(current.map(function(e) { return [e.id, e]; }));
    parsed.events.forEach(function(e) {
      if (e && e.id && e.capturedAt) byId.set(e.id, e);
    });
    const merged = Array.from(byId.values()).sort(function(a, b) {
      return new Date(b.capturedAt) - new Date(a.capturedAt);
    });
    setEvents(merged);

    if (Array.isArray(parsed.savedPlaces)) {
      const places = getPlaces();
      const placeById = new Map(places.map(function(p) { return [p.id, p]; }));
      parsed.savedPlaces.forEach(function(p) {
        if (p && p.id && p.name) placeById.set(p.id, p);
      });
      setPlaces(Array.from(placeById.values()));
    }

    renderHistory();
    setShareStatus('Imported backup. ' + merged.length + ' total saved events.');
    showToast('Backup imported');
  } catch (err) {
    setShareStatus('Import failed: ' + err.message);
  }
}

function setupDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $('dictateBtn').disabled = true;
    $('dictationStatus').textContent = 'Voice dictation is not supported by this browser.';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener('start', function() {
    $('dictationStatus').textContent = 'Listening…';
  });

  recognition.addEventListener('result', function(event) {
    const spoken = event.results[0][0].transcript;
    const existing = $('notes').value.trim();
    $('notes').value = existing ? existing + ' ' + spoken : spoken;
    $('dictationStatus').textContent = 'Dictation added.';
  });

  recognition.addEventListener('error', function() {
    $('dictationStatus').textContent = 'Dictation stopped or was unavailable.';
  });

  recognition.addEventListener('end', function() {
    if ($('dictationStatus').textContent === 'Listening…') {
      $('dictationStatus').textContent = 'Dictation finished.';
    }
  });

  $('dictateBtn').addEventListener('click', function() {
    try { recognition.start(); } catch {}
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(function(btn) {
    btn.addEventListener('click', function() { activateTab(btn.dataset.tab); });
  });
}

function activateTab(name) {
  document.querySelectorAll('.tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.panel').forEach(function(panel) {
    panel.classList.toggle('active', panel.id === 'tab-' + name);
  });
  if (name === 'history') renderHistory();
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(function() { $('toast').classList.add('hidden'); }, 2200);
}

function setShareStatus(message) {
  $('shareStatus').textContent = message;
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', function(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').classList.remove('hidden');
  });

  $('installBtn').addEventListener('click', async function() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').classList.add('hidden');
  });
}

function setupActions() {
  $('captureNowBtn').addEventListener('click', markEventNow);
  $('recaptureBtn').addEventListener('click', markEventNow);
  $('retryLocationBtn').addEventListener('click', captureLocation);
  $('saveBtn').addEventListener('click', saveEvent);

  $('cancelBtn').addEventListener('click', function() {
    if (confirm('Clear this unsaved event?')) resetForm();
  });

  $('newEventBtn').addEventListener('click', function() {
    resetForm();
    activateTab('new');
  });

  $('clearNotesBtn').addEventListener('click', function() { $('notes').value = ''; });

  $('manageRecordsBtn').addEventListener('click', function() {
    if (!manageMode) enterManageMode();
  });
  $('cancelManageBtn').addEventListener('click', exitManageMode);
  $('deleteSelectedBtn').addEventListener('click', deleteSelectedRecords);
  $('restoreDeletedBtn').addEventListener('click', restoreRecentlyDeleted);

  $('copyLatestBtn').addEventListener('click', async function() {
    const latest = getEvents()[0];
    if (!latest) return setShareStatus('No saved events to copy.');
    try {
      await navigator.clipboard.writeText(eventToText(latest));
      setShareStatus('Latest event copied. Open the Heart Monitor Project chat, paste, and send.');
      showToast('Latest event copied');
    } catch {
      setShareStatus('Clipboard access was blocked. Use Share latest event instead.');
    }
  });

  $('shareLatestBtn').addEventListener('click', function() {
    const latest = getEvents()[0];
    if (!latest) return setShareStatus('No saved events to share.');
    shareText(eventToText(latest), 'Heart Monitor latest event');
  });

  $('shareAllBtn').addEventListener('click', function() {
    const events = getEvents();
    if (!events.length) return setShareStatus('No saved events to share.');
    shareText(allEventsToText(), 'Heart Monitor event log');
  });

  $('copyAllBtn').addEventListener('click', async function() {
    try {
      await navigator.clipboard.writeText(allEventsToText());
      setShareStatus('All events copied to the clipboard.');
      showToast('Copied to clipboard');
    } catch {
      setShareStatus('Clipboard access was blocked. Use Share or Export.');
    }
  });

  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportJsonBtn').addEventListener('click', exportJson);

  $('importJsonInput').addEventListener('change', function(event) {
    const file = event.target.files && event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./service-worker.js').catch(function() {});
    });
  }
}

renderChoices();
setupTabs();
setupActions();
setupDictation();
setupInstallPrompt();
renderHistory();
newDraft();
registerServiceWorker();
