// En este archivo son públicos doGet y los cinco métodos de clientes sin "_".
function doGet() {
  const pagina = HtmlService.createTemplateFromFile('Index');
  const hoy = fechaDe_(new Date());
  const datos = {
    nombre: PELU.nombre, servicios: PELU.servicios, hoy: hoy,
    hasta: sumarDias_(hoy, PELU.diasPorAdelantado),
    abiertos: Object.keys(PELU.horario).filter(d => PELU.horario[d].length).map(Number)
  };
  pagina.datos = JSON.stringify(datos).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return pagina.evaluate().setTitle(PELU.nombre + ' · Reservar cita')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Ejecutar una vez desde el editor con la cuenta propietaria.
function prepararAgenda_() {
  validarConfig_();
  return conBloqueo_(function () {
    const props = PropertiesService.getScriptProperties();
    const correo = Session.getEffectiveUser().getEmail();
    if (!correoValido_(correo)) throw new Error('Abre el editor con la cuenta de Google que será propietaria de la agenda.');
    let id = props.getProperty('CALENDARIO_ID');
    if (!id) {
      const propios = paginar_(p => Calendar.CalendarList.list(p), {
        minAccessRole: 'owner', showHidden: true, maxResults: 250
      }).filter(c => !c.primary && c.summary === 'Peluquería');
      if (propios.length > 1) throw new Error('Hay dos calendarios llamados Peluquería. Cambia el nombre del que no vayas a usar y repite.');
      id = propios.length ? propios[0].id :
        Calendar.Calendars.insert({summary: 'Peluquería', timeZone: PELU.zona}).id;
    }
    const calendario = Calendar.Calendars.get(id);
    if (calendario.timeZone !== PELU.zona) throw new Error('En los ajustes del calendario Peluquería, selecciona Madrid y vuelve a ejecutar esta función.');
    const permisos = paginar_(p => Calendar.Acl.list(id, p), {});
    if (permisos.some(regla => !['owner', 'none'].includes(regla.role))) {
      throw new Error('En Google Calendar, quita el acceso compartido y el acceso público de Peluquería antes de continuar.');
    }
    let entrada;
    try { entrada = Calendar.CalendarList.get(id); }
    catch (err) { if (!esErrorApi_(err, 404)) throw err; }
    if (!entrada) Calendar.CalendarList.insert({id: id, selected: true});
    else if (entrada.hidden || !entrada.selected) Calendar.CalendarList.patch({hidden: false, selected: true}, id);
    props.setProperties({
      CALENDARIO_ID: id, CORREO_TITULAR: correo,
      FIRMA: props.getProperty('FIRMA') || Utilities.getUuid() + Utilities.getUuid(),
      REVISION_MANUALES: props.getProperty('REVISION_MANUALES') || new Date().toISOString()
    });
    if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'mantenimiento_')) {
      ScriptApp.newTrigger('mantenimiento_').timeBased().everyMinutes(15).create();
    }
    console.log('Agenda preparada. Abre el calendario Peluquería con esta misma cuenta.');
  });
}

function validarConfig_() {
  const servicios = PELU.servicios;
  if (!servicios.length || new Set(servicios.map(s => s.id)).size !== servicios.length ||
      servicios.some(s => !/^[a-z0-9-]+$/.test(s.id) || !s.nombre ||
        !Number.isInteger(s.minutos) || s.minutos < 1 || s.minutos > 1440 ||
        (s.precio !== null && (!Number.isFinite(s.precio) || s.precio < 0)))) {
    throw new Error('Revisa los identificadores, nombres, minutos y precios de Config.gs.');
  }
  if (!Number.isInteger(PELU.diasPorAdelantado) || PELU.diasPorAdelantado < 1) {
    throw new Error('Los días por adelantado deben ser un entero positivo.');
  }
  for (let dia = 0; dia < 7; dia++) {
    const tramos = PELU.horario[dia];
    let finAnterior = '';
    if (!Array.isArray(tramos)) throw new Error('Falta un día del horario.');
    tramos.forEach(function (tramo) {
      const valido = t => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
      if (tramo.length !== 2 || !valido(tramo[0]) ||
          (!valido(tramo[1]) && tramo[1] !== '24:00') ||
          tramo[0] >= tramo[1] || tramo[0] < finAnterior) throw new Error('Revisa los tramos del día ' + dia + '.');
      finAnterior = tramo[1];
    });
  }
}

function fallo_(codigo, mensaje) {
  const err = new Error(mensaje);
  err.publico = codigo;
  throw err;
}
function respuesta_(operacion) {
  try {
    return {ok: true, valor: operacion()};
  } catch (e) {
    if (e.publico) return {ok: false, codigo: e.publico, mensaje: e.message};
    if (esErrorApi_(e, 412)) return {ok: false, codigo: 'CAMBIO', mensaje: 'La cita ha cambiado. Vuelve a abrir sus datos.'};
    return {ok: false, codigo: 'TEMPORAL', mensaje: 'No se ha podido comprobar la agenda. Vuelve a intentarlo en un momento.'};
  }
}
function conBloqueo_(operacion) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(18000)) fallo_('OCUPADA', 'La agenda está atendiendo otra reserva. Vuelve a intentarlo.');
  try { return operacion(); } finally { lock.releaseLock(); }
}
function ajustes_() {
  const p = PropertiesService.getScriptProperties();
  const a = {cal: p.getProperty('CALENDARIO_ID'), firma: p.getProperty('FIRMA'), titular: p.getProperty('CORREO_TITULAR')};
  if (!a.cal || !a.firma || !a.titular) fallo_('CONFIG', 'La agenda todavía no está preparada para recibir reservas.');
  return a;
}
function paginar_(leer, parametros) {
  let items = [], pagina;
  do {
    pagina = leer(parametros);
    items = items.concat(pagina.items || []);
    parametros.pageToken = pagina.nextPageToken;
  } while (parametros.pageToken);
  return items;
}
function esErrorApi_(err, codigo) {
  const texto = String(err && err.message || err);
  if (Number(err && err.details && err.details.code) === codigo) return true;
  if (new RegExp('\\b' + codigo + '\\b').test(texto)) return true;
  return (codigo === 404 && /not found/i.test(texto)) ||
    (codigo === 410 && /\bgone\b|resource has been deleted/i.test(texto)) ||
    (codigo === 412 && /precondition failed|conditionnotmet/i.test(texto));
}
function porId_(cal, id) {
  try { return Calendar.Events.get(cal, id); }
  catch (e) { if (esErrorApi_(e, 404) || esErrorApi_(e, 410)) return null; throw e; }
}
function fechaDe_(instante) { return Utilities.formatDate(new Date(instante), PELU.zona, 'yyyy-MM-dd'); }
function horaDe_(instante) { return Utilities.formatDate(new Date(instante), PELU.zona, 'HH:mm'); }
function sumarDias_(fecha, n) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function validarDia_(dia) {
  const hoy = fechaDe_(new Date());
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia) ||
      dia < hoy || dia > sumarDias_(hoy, PELU.diasPorAdelantado) ||
      !Number.isFinite(Date.parse(dia + 'T12:00:00Z')) || sumarDias_(dia, 0) !== dia) {
    fallo_('FECHA', 'Elige un día dentro del plazo de reserva.');
  }
}
function localMs_(dia, hora) {
  if (hora === '24:00') return localMs_(sumarDias_(dia, 1), '00:00');
  return Utilities.parseDate(dia + ' ' + hora, PELU.zona, 'yyyy-MM-dd HH:mm').getTime();
}
function limiteEvento_(extremo) {
  return extremo.dateTime ? Date.parse(extremo.dateTime) : localMs_(extremo.date, '00:00');
}
function servicio_(id) {
  const s = PELU.servicios.find(item => item.id === id);
  if (!s) fallo_('SERVICIO', 'Este servicio ya no está disponible.');
  return s;
}
// El listado de Calendar puede tardar en reflejar una escritura recién aceptada.
// Conserva brevemente solo su ID y tramo. Las ediciones móviles se leen por ID.
function recientes_() {
  const raw = PropertiesService.getScriptProperties().getProperty('CAMBIOS_RECIENTES');
  return (raw ? JSON.parse(raw) : []).filter(r => r.caduca > Date.now());
}
function recordar_(e, cancelada) {
  const filas = recientes_().filter(r => r.id !== e.id);
  filas.push({id: e.id, desde: Date.parse(e.start.dateTime), hasta: Date.parse(e.end.dateTime),
    cancelada: cancelada, caduca: Date.now() + 90000});
  PropertiesService.getScriptProperties().setProperty('CAMBIOS_RECIENTES', JSON.stringify(filas));
}
function intervalosOcupados_(a, dia, excluir) {
  const desde = localMs_(dia, '00:00'), hasta = localMs_(sumarDias_(dia, 1), '00:00');
  const objetos = paginar_(p => Calendar.Events.list(a.cal, p), {
    timeMin: new Date(desde).toISOString(), timeMax: new Date(hasta).toISOString(),
    singleEvents: true, showDeleted: false, timeZone: PELU.zona, maxResults: 2500,
    fields: 'nextPageToken,items(id,start,end,status,transparency)'
  });
  const tramos = new Map();
  function incorporar(e) {
    if (e.status !== 'cancelled' && e.transparency !== 'transparent') {
      tramos.set(e.id, [limiteEvento_(e.start), limiteEvento_(e.end)]);
    }
  }
  objetos.forEach(incorporar);
  for (const r of recientes_()) {
    if (r.id === excluir || (!tramos.has(r.id) && (r.desde >= hasta || r.hasta <= desde))) continue;
    tramos.delete(r.id);
    if (r.cancelada) continue;
    try { incorporar(Calendar.Events.get(a.cal, r.id)); }
    catch (err) {
      if (esErrorApi_(err, 410)) continue;
      if (!esErrorApi_(err, 404)) throw err;
      tramos.set(r.id, [r.desde, r.hasta]);
    }
  }
  tramos.delete(excluir);
  return Array.from(tramos.values());
}
function huecos_(a, dia, minutos, excluir) {
  validarDia_(dia);
  if (!Number.isFinite(minutos) || minutos < 1) {
    fallo_('DURACION', 'La duración de la cita debe ser de al menos un minuto.');
  }
  const tramos = PELU.horario[new Date(dia + 'T12:00:00Z').getUTCDay()] || [];
  if (!tramos.length) return [];
  const ocupados = intervalosOcupados_(a, dia, excluir);
  const ahora = Date.now(), duracion = minutos * 60000, opciones = [];
  for (const [desde, hasta] of tramos) {
    const finTramo = localMs_(dia, hasta);
    for (let inicio = localMs_(dia, desde); inicio + duracion <= finTramo; inicio += duracion) {
      const fin = inicio + duracion;
      if (inicio > ahora && !ocupados.some(([izq, der]) => inicio < der && fin > izq)) {
        opciones.push({inicio: new Date(inicio).toISOString(), hora: horaDe_(inicio)});
      }
    }
  }
  // Si se trabaja la noche del cambio de hora, distingue las dos horas repetidas.
  const etiquetas = opciones.map(o => o.hora);
  opciones.forEach((o, i) => {
    if (etiquetas.indexOf(o.hora) !== i || etiquetas.lastIndexOf(o.hora) !== i) {
      o.hora += ' (UTC' + Utilities.formatDate(new Date(o.inicio), PELU.zona, 'XXX') + ')';
    }
  });
  return opciones;
}
function disponibilidad(servicio, dia, token) {
  return respuesta_(() => {
    const a = ajustes_();
    const cita = token ? citaActiva_(a, token) : null;
    return huecos_(a, dia, cita ? duracionEvento_(cita) : servicio_(servicio).minutos, cita ? cita.id : '');
  });
}
function exigirHueco_(a, dia, inicioISO, minutos, excluir) {
  if (!huecos_(a, dia, minutos, excluir).some(h => h.inicio === inicioISO)) {
    fallo_('HUECO', 'Esa hora ya no está libre para todo el servicio. Elige otra.');
  }
}

function hmac_(a, texto) { return Utilities.computeHmacSha256Signature(texto, a.firma, Utilities.Charset.UTF_8); }
function hex_(bytes) { return bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function token_(a, id) {
  return id + '.' + Utilities.base64EncodeWebSafe(hmac_(a, 'gestionar/v1/' + id)).replace(/=+$/, '');
}
function igual_(x, y) {
  if (x.length !== y.length) return false;
  let diferencia = 0;
  for (let i = 0; i < x.length; i++) diferencia |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diferencia === 0;
}
function urlPublica_() {
  const url = PropertiesService.getScriptProperties().getProperty('URL_PUBLICA') || ScriptApp.getService().getUrl() || '';
  if (!/^https:\/\/script\.google\.com\/(?:a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(url)) {
    fallo_('CONFIG', 'La agenda necesita su enlace público de producción.');
  }
  return url;
}
function privados_(evento) { return (evento.extendedProperties || {}).private || {}; }
function correoValido_(v) {
  return typeof v === 'string' && v.length <= 254 && /^[^\s@,;<>:()"\u0000-\u001f\u007f]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(v);
}
function cliente_(nombre, correo) {
  nombre = typeof nombre === 'string' ? nombre.trim() : '';
  correo = typeof correo === 'string' ? correo.trim() : '';
  if (!nombre || nombre.length > 70 || /[\u0000-\u001f\u007f]/.test(nombre) || !correoValido_(correo)) {
    fallo_('DATOS', 'Escribe tu nombre y un correo válido.');
  }
  return {nombre: nombre, correo: correo};
}
function duracionEvento_(e) { return (Date.parse(e.end.dateTime) - Date.parse(e.start.dateTime)) / 60000; }
function citaActiva_(a, token) {
  const partes = typeof token === 'string' && /^([a-zA-Z0-9_-]{5,512})\.[\w-]{43}$/.exec(token);
  if (!partes || !igual_(token_(a, partes[1]), token)) fallo_('ENLACE', 'Este enlace de gestión no es válido.');
  const e = porId_(a.cal, partes[1]);
  if (!e || e.status === 'cancelled' || privados_(e).origen !== 'pelu-v1' ||
      !e.start.dateTime || !e.end.dateTime || Date.parse(e.start.dateTime) <= Date.now()) {
    fallo_('INACTIVA', 'Esta cita ya no está activa. Puedes hacer una nueva reserva.');
  }
  return e;
}
function vistaCita_(e) {
  const p = privados_(e);
  return {servicio: p.servicioNombre, nombre: p.cliente, minutos: duracionEvento_(e),
    dia: fechaDe_(e.start.dateTime), hora: horaDe_(e.start.dateTime), inicio: new Date(e.start.dateTime).toISOString(), version: e.etag};
}
function consultarCita(token) {
  return respuesta_(() => vistaCita_(citaActiva_(ajustes_(), token)));
}
function fechasEvento_(iso, minutos) {
  return {start: {dateTime: iso, timeZone: PELU.zona},
    end: {dateTime: new Date(Date.parse(iso) + minutos * 60000).toISOString(), timeZone: PELU.zona}};
}
function reservar(s) {
  return respuesta_(() => conBloqueo_(() => {
    if (!s || typeof s.clave !== 'string' || !/^[a-f0-9]{32}$/.test(s.clave)) fallo_('DATOS', 'Vuelve a abrir el formulario.');
    const a = ajustes_(), url = urlPublica_(), c = cliente_(s.nombre, s.correo), tipo = servicio_(s.servicio);
    const id = hex_(hmac_(a, 'reserva/v1/' + s.clave));
    const huella = hex_(hmac_(a, JSON.stringify([tipo.id, s.dia, s.inicio, c.nombre, c.correo])));
    const anterior = porId_(a.cal, id);
    if (anterior) {
      if (anterior.status === 'cancelled' || privados_(anterior).solicitud !== huella) fallo_('HUECO', 'Revisa los datos y elige una hora libre.');
      return {cita: vistaCita_(anterior), correoPendiente: pendiente_(id)};
    }
    exigirHueco_(a, s.dia, s.inicio, tipo.minutos, '');
    const e = Object.assign(fechasEvento_(s.inicio, tipo.minutos), {
      id: id, summary: tipo.nombre + ' · ' + c.nombre, visibility: 'private', transparency: 'opaque',
      attendees: [{email: c.correo}], guestsCanInviteOthers: false, guestsCanModify: false, guestsCanSeeOtherGuests: false,
      extendedProperties: {private: {origen: 'pelu-v1', cliente: c.nombre, correo: c.correo,
        servicioNombre: tipo.nombre, solicitud: huella}}
    });
    return conAviso_(a, e, 'confirmada', url, () => Calendar.Events.insert(e, a.cal, {sendUpdates: 'all'}));
  }));
}
function moverCita(token, version, dia, inicio) {
  return respuesta_(() => conBloqueo_(() => {
    const a = ajustes_(), url = urlPublica_(), e = citaActiva_(a, token);
    if (new Date(e.start.dateTime).toISOString() === inicio) return {cita: vistaCita_(e), correoPendiente: pendiente_(e.id)};
    if (e.etag !== version) fallo_('CAMBIO', 'La cita ha cambiado en el calendario. Revisa su hora actual.');
    const minutos = duracionEvento_(e);
    exigirHueco_(a, dia, inicio, minutos, e.id);
    const fechas = fechasEvento_(inicio, minutos);
    return conAviso_(a, Object.assign({}, e, fechas), 'modificada', url,
      () => Calendar.Events.patch(fechas, a.cal, e.id, {sendUpdates: 'all'}, {'If-Match': e.etag}));
  }));
}
function cancelarCita(token, version) {
  return respuesta_(() => conBloqueo_(() => {
    const a = ajustes_(), e = citaActiva_(a, token);
    if (e.etag !== version) fallo_('CAMBIO', 'La cita ha cambiado en el calendario. Revisa su hora antes de cancelar.');
    return conAviso_(a, e, 'cancelada', '', () =>
      Calendar.Events.remove(a.cal, e.id, {sendUpdates: 'all'}, {'If-Match': e.etag}));
  }));
}

// El aviso se guarda antes de cambiar Calendar. Si se corta la ejecución,
// el activador comprueba el resultado real de la operación antes de enviarlo.
function conAviso_(a, e, estado, url, guardar) {
  const props = PropertiesService.getScriptProperties(), p = privados_(e);
  const clave = 'AVISO/' + estado + '/' + e.id;
  const aviso = {id: e.id, estado: estado, correo: p.correo, nombre: p.cliente, servicio: p.servicioNombre,
    inicio: e.start.dateTime, fin: e.end.dateTime, url: url, creado: Date.now()};
  props.setProperty(clave, JSON.stringify(aviso));
  if (estado !== 'cancelada') recordar_(e, false);
  const guardado = guardar();
  if (estado === 'cancelada') recordar_(e, true);
  const pendiente = enviarAviso_(a, clave, aviso);
  return estado === 'cancelada' ? {correoPendiente: pendiente} : {cita: vistaCita_(guardado), correoPendiente: pendiente};
}
function pendiente_(id) {
  const p = PropertiesService.getScriptProperties();
  return ['confirmada', 'modificada'].some(estado => !!p.getProperty('AVISO/' + estado + '/' + id));
}
function enviarAviso_(a, clave, aviso) {
  try {
    const copia = a.titular.toLowerCase() !== aviso.correo.toLowerCase();
    if (MailApp.getRemainingDailyQuota() < (copia ? 2 : 1)) return true;
    const dia = Utilities.formatDate(new Date(aviso.inicio), PELU.zona, 'dd/MM/yyyy');
    const tramo = horaDe_(aviso.inicio) + '–' + horaDe_(aviso.fin);
    const lineas = ['Hola, ' + aviso.nombre + '.', '',
      'Tu cita de ' + aviso.servicio.toLowerCase() + ' está ' + aviso.estado + '.',
      dia + ' · ' + tramo + ' (hora de Madrid)'];
    if (aviso.estado !== 'cancelada') {
      lineas.push('', 'Para cambiar la hora o cancelar, abre tu enlace privado:',
        aviso.url + '#cita=' + token_(a, aviso.id), '', 'Guárdalo para ti. Permite gestionar esta cita sin iniciar sesión.');
    }
    const mensaje = {to: aviso.correo, subject: PELU.nombre + ' · Cita ' + aviso.estado + ' · ' + dia,
      body: lineas.join('\n'), name: PELU.nombre};
    if (copia) mensaje.bcc = a.titular;
    MailApp.sendEmail(mensaje);
    PropertiesService.getScriptProperties().deleteProperty(clave);
    return false;
  } catch (e) { return true; }
}
function reintentarAviso_(a, clave) {
  const props = PropertiesService.getScriptProperties(), texto = props.getProperty(clave);
  if (!texto) return;
  const aviso = JSON.parse(texto), e = porId_(a.cal, aviso.id);
  const activo = e && e.status !== 'cancelled';
  if (aviso.estado === 'cancelada' ? !activo : activo && privados_(e).origen === 'pelu-v1' && e.start.dateTime &&
      (aviso.estado === 'confirmada' || Date.parse(aviso.inicio) === Date.parse(e.start.dateTime))) {
    if (activo) {
      aviso.inicio = e.start.dateTime;
      aviso.fin = e.end.dateTime;
    }
    enviarAviso_(a, clave, aviso);
  } else if (Date.now() - aviso.creado > 5 * 60000) {
    // La escritura no llegó a aplicarse o una acción posterior la sustituyó.
    props.deleteProperty(clave);
  }
}

// Una cita creada a mano se reconoce por "Servicio · Nombre" y un único
// invitado. Los bloqueos, las series y los eventos sin invitado solo ocupan tiempo.
function reconocerManual_(a, e) {
  if (!e || e.status === 'cancelled' || !e.start || !e.start.dateTime || !e.end.dateTime ||
      Date.parse(e.start.dateTime) <= Date.now() || e.transparency === 'transparent' || e.recurringEventId ||
      e.recurrence || privados_(e).origen || !e.organizer || !(e.organizer.self || e.organizer.email === a.cal)) return null;
  const s = PELU.servicios.find(t => (e.summary || '').startsWith(t.nombre + ' · '));
  const invitados = (e.attendees || []).filter(v => !v.organizer && !v.resource);
  if (!s || invitados.length !== 1 || duracionEvento_(e) !== s.minutos || !correoValido_(invitados[0].email)) return null;
  const nombre = e.summary.slice(s.nombre.length + 3).trim();
  if (!nombre || nombre.length > 70 || /[\u0000-\u001f\u007f]/.test(nombre)) return null;
  return {origen: 'pelu-v1', cliente: nombre, correo: invitados[0].email, servicioNombre: s.nombre};
}
function importarManuales_(a) {
  const props = PropertiesService.getScriptProperties();
  const hasta = new Date(), anterior = props.getProperty('REVISION_MANUALES');
  // Dos ejecuciones pueden leer el mismo intervalo; cada evento se relee bajo el bloqueo.
  const eventos = paginar_(p => Calendar.Events.list(a.cal, p), {
    updatedMin: new Date(Date.parse(anterior) - 60000).toISOString(), timeMin: hasta.toISOString(),
    singleEvents: false, showDeleted: false, maxResults: 250
  });
  for (const candidato of eventos) {
    if (!reconocerManual_(a, candidato)) continue;
    conBloqueo_(() => {
      const e = porId_(a.cal, candidato.id), meta = reconocerManual_(a, e);
      if (!meta) return;
      const cambio = {visibility: 'private', guestsCanModify: false, guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false,
        extendedProperties: {private: Object.assign({}, privados_(e), meta)}};
      conAviso_(a, Object.assign({}, e, cambio), 'confirmada', urlPublica_(),
        () => Calendar.Events.patch(cambio, a.cal, e.id, {sendUpdates: 'none'}, {'If-Match': e.etag}));
    });
  }
  props.setProperty('REVISION_MANUALES', hasta.toISOString());
}
function mantenimiento_() {
  const a = ajustes_(), props = PropertiesService.getScriptProperties();
  const pendientes = props.getKeys().filter(k => k.startsWith('AVISO/'));
  for (const clave of pendientes) {
    if (MailApp.getRemainingDailyQuota() < 1) break;
    conBloqueo_(() => reintentarAviso_(a, clave));
  }
  importarManuales_(a);
}