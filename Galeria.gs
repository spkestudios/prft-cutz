const GALERIA_CATEGORIAS = ['corte', 'barba', 'completo'];
const GALERIA_MAX_BYTES = 512000;
const GALERIA_SESION_SEGUNDOS = 1800;

// Ejecutar desde el editor. La carpeta se mantiene privada en Drive.
function prepararGaleria_() {
  const props = PropertiesService.getScriptProperties();
  conBloqueo_(() => {
    if (!props.getProperty('GALERIA_CARPETA')) {
      const carpeta = DriveApp.createFolder('PRFT CUTZ · Galería');
      props.setProperty('GALERIA_CARPETA', carpeta.getId());
    }
    if (!props.getProperty('GALERIA_CLAVE')) {
      const clave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      props.setProperty('GALERIA_CLAVE', clave);
    }
  });
  console.log('Galería preparada. Busca GALERIA_CLAVE en las propiedades del proyecto.');
}

function sesionGaleria_() { return CacheService.getScriptCache(); }

function iniciarAdminGaleria(clave) {
  return respuesta_(() => {
    const correcta = PropertiesService.getScriptProperties().getProperty('GALERIA_CLAVE');
    if (!correcta) fallo_('GALERIA_CONFIG', 'Activa la galería desde el editor de Apps Script.');
    if (typeof clave !== 'string' || !igual_(clave, correcta)) {
      fallo_('GALERIA_CLAVE', 'La clave de administración no es correcta.');
    }
    const sesion = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    sesionGaleria_().put('galeria/' + sesion, correcta, GALERIA_SESION_SEGUNDOS);
    return sesion;
  });
}

function exigirAdminGaleria_(sesion) {
  const correcta = PropertiesService.getScriptProperties().getProperty('GALERIA_CLAVE');
  if (!correcta || typeof sesion !== 'string' || !/^[a-f0-9]{64}$/.test(sesion) ||
      sesionGaleria_().get('galeria/' + sesion) !== correcta) {
    fallo_('GALERIA_SESION', 'Vuelve a entrar en el panel para continuar.');
  }
}

function cerrarAdminGaleria(sesion) {
  return respuesta_(() => {
    exigirAdminGaleria_(sesion);
    sesionGaleria_().remove('galeria/' + sesion);
    return true;
  });
}

function carpetaGaleria_() {
  const id = PropertiesService.getScriptProperties().getProperty('GALERIA_CARPETA');
  return id ? DriveApp.getFolderById(id) : null;
}

function datosFotoGaleria_(archivo) {
  const nombre = /^foto-([a-f0-9]{32})\.jpg$/.exec(archivo.getName());
  if (!nombre || archivo.isTrashed() || archivo.getMimeType() !== MimeType.JPEG) return null;
  const descripcion = archivo.getDescription() || '';
  const separador = descripcion.indexOf('\n');
  const categoria = descripcion.slice(0, separador);
  const titulo = descripcion.slice(separador + 1);
  if (separador < 1 || !GALERIA_CATEGORIAS.includes(categoria) || !titulo || titulo.length > 65) return null;
  return {id: nombre[1], titulo: titulo, categoria: categoria, fecha: archivo.getDateCreated().getTime()};
}

function listarGaleria() {
  return respuesta_(() => {
    const carpeta = carpetaGaleria_();
    if (!carpeta) return [];
    const archivos = carpeta.getFilesByType(MimeType.JPEG);
    const fotos = [];
    while (archivos.hasNext()) {
      const datos = datosFotoGaleria_(archivos.next());
      if (datos) fotos.push(datos);
    }
    return fotos.sort((a, b) => b.fecha - a.fecha);
  });
}

function archivoGaleria_(id) {
  const carpeta = carpetaGaleria_();
  // Solo se publican las imágenes que pertenecen a la carpeta de la galería.
  if (carpeta && typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)) {
    const archivos = carpeta.getFilesByName('foto-' + id + '.jpg');
    while (archivos.hasNext()) {
      const archivo = archivos.next();
      if (datosFotoGaleria_(archivo)) return archivo;
    }
  }
  fallo_('GALERIA_FOTO', 'Esta foto ya no está disponible.');
}

function verFotoGaleria(id) {
  return respuesta_(() => {
    const archivo = archivoGaleria_(id);
    if (archivo.getSize() > GALERIA_MAX_BYTES) fallo_('GALERIA_FOTO', 'Esta foto supera el tamaño admitido.');
    return 'data:image/jpeg;base64,' + Utilities.base64Encode(archivo.getBlob().getBytes());
  });
}

function publicarFotoGaleria(sesion, foto) {
  return respuesta_(() => {
    exigirAdminGaleria_(sesion);
    const titulo = foto && typeof foto.titulo === 'string' ? foto.titulo.trim() : '';
    if (!titulo || titulo.length > 65 || /[\u0000-\u001f\u007f]/.test(titulo) ||
        !GALERIA_CATEGORIAS.includes(foto.categoria) || typeof foto.clave !== 'string' ||
        !/^[a-f0-9]{32}$/.test(foto.clave)) {
      fallo_('GALERIA_DATOS', 'Escribe un título y elige una categoría.');
    }
    const imagen = foto.imagen;
    if (typeof imagen !== 'string' || imagen.length > Math.ceil(GALERIA_MAX_BYTES / 3) * 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(imagen)) {
      fallo_('GALERIA_IMAGEN', 'Selecciona una imagen de nuevo.');
    }
    const bytes = Utilities.base64Decode(imagen);
    if (bytes.length < 4 || bytes.length > GALERIA_MAX_BYTES ||
        bytes[0] !== -1 || bytes[1] !== -40 || bytes[2] !== -1 ||
        bytes[bytes.length - 2] !== -1 || bytes[bytes.length - 1] !== -39) {
      fallo_('GALERIA_IMAGEN', 'La foto debe ser un JPEG válido.');
    }
    const nombre = 'foto-' + foto.clave + '.jpg';
    return conBloqueo_(() => {
      exigirAdminGaleria_(sesion);
      const carpeta = carpetaGaleria_();
      if (!carpeta) fallo_('GALERIA_CONFIG', 'Activa la galería desde el editor de Apps Script.');
      const repetidas = carpeta.getFilesByName(nombre);
      while (repetidas.hasNext()) {
        const anterior = datosFotoGaleria_(repetidas.next());
        if (anterior) return anterior;
      }
      const archivo = carpeta.createFile(Utilities.newBlob(bytes, MimeType.JPEG, nombre));
      try { archivo.setDescription(foto.categoria + '\n' + titulo); }
      catch (error) { archivo.setTrashed(true); throw error; }
      return datosFotoGaleria_(archivo);
    });
  });
}

function retirarFotoGaleria(sesion, id) {
  return respuesta_(() => conBloqueo_(() => {
    exigirAdminGaleria_(sesion);
    archivoGaleria_(id).setTrashed(true);
    return true;
  }));
}
