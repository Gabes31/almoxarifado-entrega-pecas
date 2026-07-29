/****************************************************
 * Projeto: Entrega de peças Almoxarifado
 * Backend: Apps Script + Google Sheets
 ****************************************************/

// ==========================================
// CONFIGURAÇÃO GLOBAL
// ==========================================
const SPREADSHEET_ID = '[COLOQUE_SEU_SPREADSHEET_ID_AQUI]';

const SHEET_CONSUMOS = 'Consumos';
const SHEET_POSICOES = 'Posicionamento Almoxarifado';
const SHEET_VEICULOS = 'Veiculos';
const SHEET_PEDIDOS  = 'Pedidos';

// =======================
// ====== FRONTEND =======
// =======================
function doGet() {
  const t = HtmlService.createTemplateFromFile('index');
  t.__APP_TITLE__  = 'Entrega de Peças';
  t.__DEPLOY_URL__ = ScriptApp.getService().getUrl();
  t.__SCRIPT_ID__  = ScriptApp.getScriptId();
  t.__BUILD__      = new Date().toISOString();

  return t.evaluate()
    .setTitle(t.__APP_TITLE__)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =======================
// ========= API =========
// =======================

function ping() {
  return { ok: true, now: new Date().toISOString(), tz: Session.getScriptTimeZone() };
}

function debug_echo(payload) {
  return { ok: true, received: (payload === undefined ? null : payload), now: new Date().toISOString() };
}

function api_ping() {
  return _apiOk_({ now: new Date().toISOString(), tz: Session.getScriptTimeZone() });
}

function api_init() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    _ensurePedidosSheet_(ss);

    return _apiOk_({
      requests: listRequests_(),
      basesMeta: getBasesMeta_(),
      serverTime: new Date().toISOString(),
      scriptUrl: ScriptApp.getService().getUrl()
    });
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_replaceSheetFromCsv(type, csvText) {
  try {
    const out = replaceSheetFromCsv_(type, csvText);
    return _apiOk_(out);
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_searchSuggestions(vehicleQuery, partSearch) {
  try {
    const r = searchSuggestions(vehicleQuery, partSearch); 
    if (!r || r.ok !== true) throw new Error(r?.error || 'Falha em searchSuggestions().');

    return _apiOk_({
      identifiedVehicle: r.identifiedVehicle || null,
      suggestions: Array.isArray(r.suggestions) ? r.suggestions : []
    });
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_identifyVehicle(vehicleQuery) {
  try {
    const r = identifyVehicle(vehicleQuery); 
    if (!r || r.ok !== true) throw new Error(r?.error || 'Falha em identifyVehicle().');

    return _apiOk_({
      vehicle: r.vehicle || null
    });
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_createRequest(payload) {
  try {
    const r = createRequest(payload); 
    if (!r || r.ok !== true) throw new Error(r?.error || 'Falha ao criar pedido.');

    return _apiOk_({
      request: r.request || null,
      requests: Array.isArray(r.requests) ? r.requests : []
    });
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_updateRequestStatus(id, newStatus, extraData) {
  try {
    const r = updateRequestStatus(id, newStatus, extraData); 
    if (!r || r.ok !== true) throw new Error(r?.error || 'Falha ao atualizar pedido.');

    return _apiOk_({
      request: r.request || null,
      requests: Array.isArray(r.requests) ? r.requests : []
    });
  } catch (err) {
    return _apiErr_(err);
  }
}

function api_listRequests() {
  try {
    return _apiOk_({ requests: listRequests_() });
  } catch (err) {
    return _apiErr_(err);
  }
}

function _apiOk_(data) {
  return JSON.parse(JSON.stringify({ ok: true, data: data }));
}

function _apiErr_(err) {
  return JSON.parse(JSON.stringify({
    ok: false,
    error: err && err.message ? err.message : String(err),
    stack: err && err.stack ? String(err.stack) : null
  }));
}

// =======================
// ====== FUNÇÕES APP =====
// =======================

function getBasesMeta() {
  return _safe_(function () {
    return { ok: true, basesMeta: getBasesMeta_() };
  });
}

function identifyVehicle(query) {
  return _safe_(function () {
    if (!query) return { ok: true, vehicle: null };

    const veiculos = readVeiculos_();
    const key = normalize_(query);

    const v = veiculos.find(row => {
      const placa = normalize_(row['Placa'] || row['PLACA']);
      const equip = normalize_(
        row['Número do Equipamento'] ||
        row['Número de Equipamento'] ||
        row['Numero do Equipamento'] ||
        row['Numero de Equipamento']
      );

      return (placa && placa === key) || (equip && equip.indexOf(key) !== -1);
    }) || null;

    return { ok: true, vehicle: v };
  });
}

function searchSuggestions(vehicleQuery, partSearch) {
  return _safe_(function () {
    if (!partSearch) throw new Error('Indique o nome da peça para pesquisar.');

    const consumos = readConsumos_();
    if (!consumos.length) throw new Error('Aba "Consumos" está vazia.');

    const veiculos = readVeiculos_();
    const posicoes = readPosicoes_();

    const keyVehicle = normalize_(vehicleQuery || '');
    const identified = keyVehicle ? (veiculos.find(v => {
      const placa = normalize_(v['Placa'] || v['PLACA']);
      const equip = normalize_(
        v['Número do Equipamento'] ||
        v['Número de Equipamento'] ||
        v['Numero do Equipamento'] ||
        v['Numero de Equipamento']
      );
      return (placa && placa === keyVehicle) || (equip && equip.indexOf(keyVehicle) !== -1);
    }) || null) : null;

    const curEquip = identified ? normalize_(
      identified['Número do Equipamento'] ||
      identified['Número de Equipamento'] ||
      identified['Numero do Equipamento'] ||
      identified['Numero de Equipamento']
    ) : null;

    const curChassi = identified ? normalize_(identified['Modelo Chassi']) : null;
    const curAno    = identified ? normalize_(identified['Ano de Chassi']) : null;
    const curFabCar = identified ? normalize_(identified['Fabricante Carroceria']) : null;
    const curModCar = identified ? normalize_(identified['Modelo Carroceria']) : null;

    const termoBusca = String(partSearch || '').toLowerCase();

    const equipInfo = {};
    veiculos.forEach(v => {
      const equip = normalize_(
        v['Número do Equipamento'] ||
        v['Número de Equipamento'] ||
        v['Numero do Equipamento'] ||
        v['Numero de Equipamento']
      );
      if (!equip) return;

      equipInfo[equip] = {
        chassi: normalize_(v['Modelo Chassi']),
        ano: normalize_(v['Ano de Chassi']),
        fabCar: normalize_(v['Fabricante Carroceria']),
        modCar: normalize_(v['Modelo Carroceria']),
        originalChassi: v['Modelo Chassi'] || 'N/D',
        originalCarroceria: (String(v['Fabricante Carroceria'] || '') + ' ' + String(v['Modelo Carroceria'] || '')).trim() || 'N/D'
      };
    });

    const best = {};

    for (let i = 0; i < consumos.length; i++) {
      const item = consumos[i];

      const descr = String(
        item['Descrição Material'] ||
        item['Descricao Material'] ||
        item['Material + Descr'] ||
        ''
      ).toLowerCase();

      const code = item['Material'] || item['Código Ajustado'] || item['Codigo Ajustado'];
      if (!code) continue;
      if (descr.indexOf(termoBusca) === -1) continue;

      const itemEquip = normalize_(item['Equipamento']);
      const hist = equipInfo[itemEquip];

      let priority = 5;
      let confidence = 'Uso Geral / Outros';

      const chassiMatch = hist && curChassi === hist.chassi && curAno === hist.ano;
      const carMatch    = hist && curFabCar === hist.fabCar && curModCar === hist.modCar;

      if (curEquip && itemEquip === curEquip) { priority = 1; confidence = 'Histórico deste veículo'; }
      else if (chassiMatch && carMatch)       { priority = 2; confidence = 'Match Chassi + Carroçaria'; }
      else if (chassiMatch)                   { priority = 3; confidence = 'Match Chassi (Mecânica)'; }
      else if (carMatch)                      { priority = 4; confidence = 'Match Carroçaria (Acabamento)'; }

      const k = String(code);
      const current = best[k];

      if (!current || priority < current.priority) {
        const posDoc = posicoes.find(p => normalize_(p['Material']) === normalize_(code));

        best[k] = {
          code: code,
          descr: item['Descrição Material'] || item['Descricao Material'] ||
                (item['Material + Descr'] ? String(item['Material + Descr']).split(' - ')[0] : ''),
          pos: posDoc ? (posDoc['Posição no depósito'] || posDoc['Posicao no deposito'] || posDoc['Posição no depósito ']) : 'NÃO LOCALIZADO',
          originalChassi: hist ? hist.originalChassi : 'N/D',
          originalCarroceria: hist ? hist.originalCarroceria : 'N/D',
          priority: priority,
          confianca: confidence
        };
      }
    }

    const finalResults = Object.keys(best)
      .map(k => best[k])
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 15);

    return { ok: true, identifiedVehicle: identified, suggestions: finalResults };
  });
}

function createRequest(payload) {
  return _safe_(function () {
    if (!payload || typeof payload !== 'object') throw new Error('payload inválido.');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = _ensurePedidosSheet_(ss);

    const now = new Date();
    const id = String(Date.now()) + '_' + Utilities.getUuid().slice(0, 8);

    const row = {
      id,
      status: payload.status || 'pending',
      plate: String(payload.plate || '').toUpperCase(),
      equip: String(payload.equip || '???'),
      chassi: String(payload.chassi || 'N/D'),
      carroceria: String(payload.carroceria || 'N/D'),
      part: String(payload.part || ''),
      selectedCode: String(payload.selectedCode || ''),
      selectedDescr: String(payload.selectedDescr || ''),
      pos: String(payload.pos || 'NÃO LOCALIZADO'),
      mechanic: String(payload.mechanic || 'Oficina Central'),
      requisitionNumber: payload.requisitionNumber || '',
      sapOrder: payload.sapOrder || '',
      timestamp: payload.timestamp || Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm'),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const headers = _getHeadersSafe_(sh);
    const values = headers.map(h => (row[h] !== undefined ? row[h] : ''));

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sh.appendRow(values);
    } finally {
      lock.releaseLock();
    }

    return { ok: true, request: row, requests: listRequests_() };
  });
}

function updateRequestStatus(id, newStatus, extraData) {
  return _safe_(function () {
    if (!id) throw new Error('id é obrigatório.');
    if (!newStatus) throw new Error('newStatus é obrigatório.');

    const allowed = { pending: true, requested: true, delivered: true };
    if (!allowed[newStatus]) throw new Error('Status inválido: ' + newStatus);

    extraData = extraData || {};
    if (typeof extraData !== 'object') throw new Error('extraData deve ser objeto.');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = _ensurePedidosSheet_(ss);
    const headers = _getHeadersSafe_(sh);

    const idCol = headers.indexOf('id') + 1;
    if (idCol < 1) throw new Error('Coluna "id" não existe em Pedidos.');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const last = sh.getLastRow();
      if (last < 2) throw new Error('Não há pedidos para atualizar.');

      const ids = sh.getRange(2, idCol, last - 1, 1).getValues().map(r => r[0]);
      const idx = ids.findIndex(v => String(v) === String(id));
      if (idx < 0) throw new Error('Pedido não encontrado: ' + id);

      const rowNumber = idx + 2;

      const patch = Object.assign({}, extraData, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      headers.forEach((h, i) => {
        if (patch[h] !== undefined) sh.getRange(rowNumber, i + 1).setValue(patch[h]);
      });

      const updated = _rowToObj_(headers, sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0]);
      return { ok: true, request: updated, requests: listRequests_() };
    } finally {
      lock.releaseLock();
    }
  });
}

function listRequests() {
  return _safe_(function () {
    return { ok: true, requests: listRequests_() };
  });
}

// =======================
// ====== SAFE WRAP ======
// =======================
function _safe_(fn) {
  try {
    const out = fn();
    return out === undefined ? { ok: false, error: 'Função retornou undefined (bug).' } : out;
  } catch (err) {
    console.error('API error:', err);
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? String(err.stack) : null
    };
  }
}

// =======================
// ====== Internos =======
// =======================

function readConsumos_(){ return _readSheetObjects_(SHEET_CONSUMOS); }
function readPosicoes_(){ return _readSheetObjects_(SHEET_POSICOES); }
function readVeiculos_(){ return _readSheetObjects_(SHEET_VEICULOS); }

function _readSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Aba não encontrada: ' + sheetName);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? String(row[idx]).trim() : '';
    });
    out.push(obj);
  }
  return out;
}

function _ensurePedidosSheet_(ss) {
  const headers = [
    'id','status','plate','equip','chassi','carroceria',
    'part','selectedCode','selectedDescr','pos',
    'mechanic','requisitionNumber','sapOrder',
    'timestamp','createdAt','updatedAt'
  ];

  let sh = ss.getSheetByName(SHEET_PEDIDOS);
  if (!sh) sh = ss.insertSheet(SHEET_PEDIDOS);

  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();

  let hasHeader = false;
  if (lastRow >= 1 && lastCol >= 1) {
    const firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    hasHeader = firstRow.some(v => String(v).trim() !== '');
  }

  if (!hasHeader) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sh;
}

function _getHeadersSafe_(sh) {
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) {
    const headers = [
      'id','status','plate','equip','chassi','carroceria',
      'part','selectedCode','selectedDescr','pos',
      'mechanic','requisitionNumber','sapOrder',
      'timestamp','createdAt','updatedAt'
    ];
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return headers;
  }
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v));
}

function _rowToObj_(headers, row) {
  const o = {};
  headers.forEach((h, i) => { o[h] = row[i]; });
  return o;
}

function listRequests_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = _ensurePedidosSheet_(ss);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(v => String(v));
  const out = [];
  for (let i = 1; i < values.length; i++) out.push(_rowToObj_(headers, values[i]));

  out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return out;
}

function getBasesMeta_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const c = ss.getSheetByName(SHEET_CONSUMOS);
  const p = ss.getSheetByName(SHEET_POSICOES);
  const v = ss.getSheetByName(SHEET_VEICULOS);
  const ped = ss.getSheetByName(SHEET_PEDIDOS);

  return {
    consumos: { sheet: SHEET_CONSUMOS, rows: c ? Math.max(0, c.getLastRow() - 1) : 0, ok: !!c },
    posicoes: { sheet: SHEET_POSICOES, rows: p ? Math.max(0, p.getLastRow() - 1) : 0, ok: !!p },
    veiculos: { sheet: SHEET_VEICULOS, rows: v ? Math.max(0, v.getLastRow() - 1) : 0, ok: !!v },
    pedidos:  { sheet: SHEET_PEDIDOS,  rows: ped ? Math.max(0, ped.getLastRow() - 1) : 0, ok: !!ped }
  };
}

function normalize_(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^0+/, '');
}

function replaceSheetFromCsv_(type, csvText) {
  if (!csvText || typeof csvText !== 'string') throw new Error('CSV vazio ou inválido.');

  const map = {
    consumos: SHEET_CONSUMOS,
    veiculos: SHEET_VEICULOS,
    posicoes: SHEET_POSICOES
  };
  const sheetName = map[type];
  if (!sheetName) throw new Error('Tipo inválido. Use: consumos | veiculos | posicoes');

  const rows = _parseCsvSemicolonServer_(csvText);
  if (!rows.length) throw new Error('CSV sem linhas válidas.');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  sh.clearContents();

  const CHUNK = 5000;
  const totalRows = rows.length;
  const cols = rows[0].length;

  for (let start = 0; start < totalRows; start += CHUNK) {
    const slice = rows.slice(start, start + CHUNK);
    sh.getRange(start + 1, 1, slice.length, cols).setValues(slice);
  }

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, cols).setFontWeight('bold');

  return {
    ok: true,
    sheet: sheetName,
    rowsWritten: Math.max(0, totalRows - 1),
    basesMeta: getBasesMeta_()
  };
}

function _parseCsvSemicolonServer_(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 1) return [];

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].split(';').map(v => (v ?? '').toString().trim());
    if (row.every(c => c === '')) continue;
    out.push(row);
  }

  const maxCols = out.reduce((m, r) => Math.max(m, r.length), 0);
  return out.map(r => {
    while (r.length < maxCols) r.push('');
    return r;
  });
}