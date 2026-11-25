// Water Reminder - host side (runs in the app renderer, not a module).
// Reminders, left menu entry and shortcut live here; the UI is index.html.
(function () {
  var DEFAULTS = {
    enabled: true,
    goalMl: 2000,
    cupMl: 250,
    startTime: '08:00',
    endTime: '20:00',
  };
  // English fallback in case translations are not available (older hosts).
  var FALLBACK = {
    'WATER.MENU_ENTRY': 'Water',
    'WATER.SHORTCUT_ADD_CUP': 'Water: log a glass',
    'WATER.NOTIFY_TITLE': 'Drink water',
    'WATER.NOTIFY_BODY':
      'Time to drink {{cup}} ml. Today: {{intake}} / {{goal}} ml ({{missing}} ml to go).',
    'WATER.SNACK_ACTION': '+{{ml}} ml',
    'WATER.LOGGED': 'Logged {{ml}} ml. Today: {{intake}} / {{goal}} ml.',
    'WATER.GOAL_REACHED': 'Goal reached!',
  };
  var timer = null;

  function interpolate(str, params) {
    return str.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      return params && k in params ? params[k] : m;
    });
  }

  // Translations are cached (translate may be async depending on the host);
  // a non-string result is ignored and the English fallback is used.
  var cache = {};

  async function loadTranslations() {
    if (typeof PluginAPI.translate !== 'function') return;
    var next = {};
    await Promise.all(
      Object.keys(FALLBACK).map(async function (key) {
        try {
          var r = await PluginAPI.translate(key);
          if (typeof r === 'string' && r && r !== key) next[key] = r;
        } catch (e) {
          /* keep fallback */
        }
      }),
    );
    cache = next;
  }

  function t(key, params) {
    var s = typeof cache[key] === 'string' ? cache[key] : FALLBACK[key];
    if (typeof s !== 'string') {
      try {
        var r = PluginAPI.translate(key);
        if (typeof r === 'string' && r !== key) s = r;
      } catch (e) {
        /* ignore */
      }
    }
    return typeof s === 'string' ? interpolate(s, params) : key;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toMin(time) {
    var p = String(time).split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  async function readJson(key, fallback) {
    try {
      var raw = await PluginAPI.loadSyncedData(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  async function getConfig() {
    var saved = await readJson('config', {});
    return Object.assign({}, DEFAULTS, saved);
  }

  async function getToday() {
    if (typeof PluginAPI.getDayContext === 'function') {
      try {
        return (await PluginAPI.getDayContext()).todayStr;
      } catch (e) {
        /* use local clock */
      }
    }
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Reminder times, evenly spread between start and end.
  function buildSlots(cfg) {
    var n = Math.max(1, Math.ceil(cfg.goalMl / cfg.cupMl));
    var start = toMin(cfg.startTime);
    var end = toMin(cfg.endTime);
    var slots = [];
    for (var i = 0; i < n; i++) {
      slots.push(n === 1 ? start : Math.round(start + (i * (end - start)) / (n - 1)));
    }
    return slots;
  }

  // Adds (or removes, if negative) water for today. Resolves with today's total.
  async function addIntake(ml) {
    var today = await getToday();
    var log = await readJson('log', {});
    log[today] = Math.max(0, (log[today] || 0) + ml);
    var keys = Object.keys(log).sort();
    while (keys.length > 60) {
      delete log[keys.shift()];
    }
    await PluginAPI.persistDataSynced(JSON.stringify(log), 'log');
    return log[today];
  }

  async function logCup(cupMl) {
    var cfg = await getConfig();
    var ml = cupMl || cfg.cupMl;
    var total = await addIntake(ml);
    var reached = total >= cfg.goalMl;
    PluginAPI.showSnack({
      msg: reached
        ? t('WATER.GOAL_REACHED')
        : t('WATER.LOGGED', { ml: ml, intake: total, goal: cfg.goalMl }),
      type: reached ? 'SUCCESS' : 'INFO',
      ico: 'water_drop',
    });
  }

  async function tick() {
    try {
      var cfg = await getConfig();
      if (!cfg.enabled) return;
      if (toMin(cfg.endTime) <= toMin(cfg.startTime)) return;

      var today = await getToday();
      var log = await readJson('log', {});
      var intake = log[today] || 0;
      if (intake >= cfg.goalMl) return;

      var now = new Date();
      var nowMin = now.getHours() * 60 + now.getMinutes();
      var slots = buildSlots(cfg);
      var idx = -1;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i] <= nowMin) idx = i;
      }
      if (idx < 0) return;

      // Last reminder sent, kept per device (secrets are never synced).
      var last = (await PluginAPI.getSecret('lastSlot')) || '';
      var parts = last.split('|');
      if (parts[0] === today && Number(parts[1]) >= idx) return;
      await PluginAPI.setSecret('lastSlot', today + '|' + idx);

      // Already on track for this slot: stay quiet.
      if (intake >= cfg.cupMl * (idx + 1)) return;

      var body = t('WATER.NOTIFY_BODY', {
        cup: cfg.cupMl,
        intake: intake,
        goal: cfg.goalMl,
        missing: cfg.goalMl - intake,
      });
      PluginAPI.notify({ title: t('WATER.NOTIFY_TITLE'), body: body }).catch(function () {});
      PluginAPI.showSnack({
        msg: body,
        type: 'INFO',
        ico: 'water_drop',
        action: {
          label: t('WATER.SNACK_ACTION', { ml: cfg.cupMl }),
          onClick: function () {
            logCup(cfg.cupMl);
          },
        },
      });
    } catch (e) {
      PluginAPI.log.err('water-reminder tick failed', e);
    }
  }

  // Left sidebar menu entry; opens index.html as a full view in the main area.
  PluginAPI.registerMenuEntry({
    label: t('WATER.MENU_ENTRY'),
    icon: 'water_drop',
    onClick: function () {
      PluginAPI.showIndexHtmlAsView();
    },
  });

  PluginAPI.registerShortcut({
    id: 'add-cup',
    label: t('WATER.SHORTCUT_ADD_CUP'),
    onExec: function () {
      logCup();
    },
  });

  PluginAPI.onReady(async function () {
    await loadTranslations();
    await tick();
    timer = setInterval(tick, 60 * 1000);
  });

  if (typeof PluginAPI.onUnload === 'function') {
    PluginAPI.onUnload(function () {
      if (timer) clearInterval(timer);
      timer = null;
    });
  }
})();
