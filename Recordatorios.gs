const ADELANTO_RECORDATORIO_MS = 30 * 60 * 1000;
const PREFIJO_RECORDATORIO = 'RECORDATORIO/';

// Ejecutar una vez desde el editor con el Gmail que configuró la agenda.
function activarRecordatorios() {
  const agenda = ajustes_();
  const usuario = Session.getActiveUser().getEmail().toLowerCase();
  if (!usuario || usuario !== agenda.titular.toLowerCase()) {
    throw new Error('Ejecuta activarRecordatorios desde el editor con el Gmail que configuró la agenda.');
  }
  conBloqueo_(() => {
    const existe = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'enviarRecordatorios_');
    if (!existe) ScriptApp.newTrigger('enviarRecordatorios_').timeBased().everyMinutes(5).create();
  });
  console.log('Recordatorios activados. Se comprueban las citas cada cinco minutos.');
}

function enviarRecordatorios_() {
  const agenda = ajustes_();
  const ahora = Date.now();
  const candidatas = paginar_(parametros => Calendar.Events.list(agenda.cal, parametros), {
    timeMin: new Date(ahora).toISOString(),
    // Calendar excluye el límite superior y omite los milisegundos.
    timeMax: new Date(ahora + ADELANTO_RECORDATORIO_MS + 1000).toISOString(),
    privateExtendedProperty: 'origen=pelu-v1',
    singleEvents: true,
    showDeleted: false,
    orderBy: 'startTime',
    fields: 'nextPageToken,items(id,start(dateTime))'
  });
  for (const cita of candidatas) {
    if (!enVentanaRecordatorio_(cita, ahora)) continue;
    conBloqueo_(() => recordarCitaPendiente_(agenda, cita.id));
  }
}

function enVentanaRecordatorio_(cita, ahora) {
  const inicio = Date.parse(cita.start?.dateTime);
  return inicio > ahora && inicio <= ahora + ADELANTO_RECORDATORIO_MS;
}

function recordarCitaPendiente_(agenda, id) {
  // La cita pudo cambiar desde que Calendar devolvió la lista.
  const cita = porId_(agenda.cal, id);
  const ahora = Date.now();
  if (!cita || cita.status === 'cancelled' || !enVentanaRecordatorio_(cita, ahora)) return;
  const datos = privados_(cita);
  if (datos.origen !== 'pelu-v1' || !correoValido_(datos.correo)) return;

  const inicio = Date.parse(cita.start.dateTime);
  const clave = PREFIJO_RECORDATORIO + cita.id + '/' + inicio;
  const propiedades = PropertiesService.getScriptProperties();
  if (propiedades.getProperty(clave) || MailApp.getRemainingDailyQuota() < 1) return;

  for (const anterior of propiedades.getKeys()) {
    if (anterior.startsWith(PREFIJO_RECORDATORIO) &&
        Number(anterior.slice(anterior.lastIndexOf('/') + 1)) < ahora - 24 * 60 * 60 * 1000) {
      propiedades.deleteProperty(anterior);
    }
  }

  const negocio = PELU.nombre === 'Peluquería' ? 'PRFT CUTZ' : PELU.nombre;
  const dia = Utilities.formatDate(new Date(inicio), PELU.zona, 'dd/MM/yyyy');
  const hora = horaDe_(inicio);
  const servicio = datos.servicioNombre ? ' de ' + datos.servicioNombre.toLowerCase() : '';
  const mensaje = {
    to: datos.correo,
    name: negocio,
    subject: negocio + ' · Recordatorio de tu cita a las ' + hora,
    body: [
      datos.cliente ? 'Hola, ' + datos.cliente + '.' : 'Hola.',
      '',
      'Te recordamos tu cita' + servicio + ' en ' + negocio + '.',
      'Fecha: ' + dia,
      'Hora: ' + hora + ' (hora de Madrid)',
      '',
      'Si necesitas cambiarla o cancelarla, usa el enlace del correo de confirmación.'
    ].join('\n')
  };

  // La marca es por cita y hora de inicio. Un nuevo horario puede recibir otro aviso.
  propiedades.setProperty(clave, '1');
  try {
    MailApp.sendEmail(mensaje);
  } catch (error) {
    propiedades.deleteProperty(clave);
    console.warn('No se pudo enviar un recordatorio. Se volverá a comprobar la cita.');
  }
}
