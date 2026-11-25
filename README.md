# PRFT CUTZ · Reservas de barbería

Web de PRFT CUTZ para pedir cita desde el móvil. El cliente abre el enlace que recibe por WhatsApp, elige un servicio y reserva una hora libre. La cita aparece en el calendario **Peluquería** de Google Calendar, desde donde el barbero lleva la agenda.

## Cómo se pide una cita

1. El cliente elige **Corte de pelo**, **Barba** o **Corte y barba**.
2. Selecciona un día y una de las horas disponibles. Puede reservar hasta 60 días por adelantado.
3. Escribe su nombre y correo, y pulsa **Confirmar reserva**. La web vuelve a comprobar que el hueco sigue libre antes de guardar la cita.
4. Recibe un correo con los datos de la reserva y un enlace privado para consultar, cambiar de hora o cancelar la cita sin crear una cuenta.

## Servicios y horario

| Servicio | Duración | Precio |
| --- | --- | --- |
| Corte de pelo | 30 min | 10 € |
| Barba | 15 min | 5 € |
| Corte y barba | 45 min | 13 € |

De lunes a viernes se puede reservar de **10:00 a 14:00** y de **16:00 a 20:00**. Los sábados, de **10:00 a 14:00**. El domingo está cerrado. Todas las horas son de Madrid.

Las horas se calculan desde que abre cada tramo, según lo que dura el servicio. Por ejemplo, el viernes por la tarde los cortes empiezan a las 16:00, 16:30, 17:00… Si alguien reserva un corte a las **17:00**, la web quita las opciones de barba de **17:00 y 17:15**. Las **17:30** siguen disponibles si la agenda está libre.

## Cómo se lleva la agenda

- **Ver, mover o cancelar citas.** Abre el calendario **Peluquería** en el móvil o el ordenador. Si cambias o eliminas una cita y Calendar te pregunta si quieres avisar al invitado, pulsa **Enviar**.
- **Bloquear horas.** Crea un evento marcado como **Ocupado**. Durante ese tiempo la web dejará de ofrecer los servicios que se crucen con él.
- **Apuntar una cita a mano.** Por ejemplo, crea un evento ocupado llamado `Barba · Ana`, de 15 minutos, y añade el correo de Ana como único invitado. Respeta el nombre del servicio y el punto medio entre espacios. Cada 15 minutos se revisan las citas nuevas o editadas para enviar el enlace de gestión.
- **Activar recordatorios.** Ejecuta `activarRecordatorios` una vez desde Apps Script con la cuenta que preparó la agenda. Cada cinco minutos se revisan las citas que empiezan en la próxima media hora y se avisa al cliente por correo.
- **Correos pendientes.** Si falla un aviso de reserva, cambio o cancelación, el proyecto guarda el aviso y reintenta el envío cada 15 minutos.

## Archivos del proyecto

| Archivo | Para qué sirve |
| --- | --- |
| [Index.html](Index.html) | Pantallas para elegir servicio, reservar y gestionar una cita. Incluye el diseño y el código que se ejecuta en el navegador. |
| [Config.gs](Config.gs) | Servicios, precios, duración, horarios y días de antelación. |
| [Codigo.gs](Codigo.gs) | Consulta los huecos en Calendar, guarda las reservas, gestiona los cambios y envía las confirmaciones. |
| [Recordatorios.gs](Recordatorios.gs) | Activa y envía los recordatorios por correo. |
| [Galeria.gs](Galeria.gs) | Guarda las fotos en Google Drive y comprueba el acceso al panel de administración. |
| [appsscript.json](appsscript.json) | Configura la zona horaria, los permisos de Drive y el servicio de Google Calendar. |

## Galería de cortes

Debajo de **Elige un servicio** puedes ver las fotos publicadas y filtrarlas por **Cortes**, **Barba** y **Corte y barba**. Toca una para ampliarla. Para pasar de foto, desliza el dedo en el móvil o usa las flechas en el ordenador.

### Activarla en Apps Script

1. En tu proyecto de Apps Script, actualiza `Index.html` y `appsscript.json`. Crea un archivo de secuencia de comandos llamado `Galeria` y pega el contenido de `Galeria.gs`.
2. Añade temporalmente esta función al archivo `Galeria` y guarda.

   ```javascript
   function prepararGaleria() {
     prepararGaleria_();
   }
   ```

3. Selecciona **prepararGaleria** y pulsa **Ejecutar** con la cuenta propietaria. Acepta el nuevo permiso de Google Drive. Cuando el registro indique **Galería preparada**, borra la función temporal y guarda.
4. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, busca `GALERIA_CLAVE`. Guarda su valor para entrar al panel. La clave se queda en Apps Script y se puede copiar desde esa pantalla cuando la necesites.
5. Publica una nueva versión de tu implementación actual desde **Implementar → Gestionar implementaciones** para seguir usando el enlace que ya tienen los clientes.

### Publicar una foto

1. Abre la web de reservas y pulsa **Administrar galería** al pie de la página. Entra con `GALERIA_CLAVE`.
2. Elige una imagen de hasta 20 MB, ponle un título y selecciona una categoría. La web reduce la foto antes de subirla.
3. Pulsa **Publicar foto**. Para quitarla, usa **Retirar** junto a su título y confirma. La foto retirada pasa a la papelera de Drive.

Las fotos publicadas se ven en el enlace de reservas. La carpeta **PRFT CUTZ · Galería** se crea en el Drive de la cuenta propietaria y se mantiene privada. La sesión del panel dura hasta 30 minutos.

## Cómo ponerla en marcha con tu cuenta

Si ya tienes la web funcionando y solo quieres subir el código a GitHub, puedes saltarte este apartado.

1. Abre [Google Apps Script](https://script.google.com/home) con la cuenta que llevará la agenda y crea un proyecto. Copia `Codigo.gs` en el archivo de código inicial. Añade los archivos de secuencia de comandos `Config`, `Recordatorios` y `Galeria`, y un archivo HTML llamado `Index`. Copia el contenido de cada archivo del repositorio en el correspondiente del editor.
2. En **Configuración del proyecto**, activa **Mostrar el archivo de manifiesto appsscript.json en el editor**. Sustituye su contenido por el de este repositorio y guarda. En **Servicios** aparecerá **Calendar API v3**.
3. Para preparar la agenda, añade esta función temporal al final del archivo de código inicial.

   ```javascript
   function prepararAgenda() {
     prepararAgenda_();
   }
   ```

   Guarda, selecciona **prepararAgenda** en el editor y pulsa **Ejecutar**. Autoriza los permisos con tu cuenta. Cuando veas **Agenda preparada** en el registro, borra la función temporal y guarda. Este paso crea el calendario **Peluquería** o reutiliza el tuyo si ya tienes uno privado con ese nombre y zona horaria de Madrid.
4. En **Implementar → Nueva implementación**, elige **Aplicación web**. Selecciona tu cuenta en **Ejecutar como** y **Cualquier persona** en el acceso. Pulsa **Implementar** y copia el enlace que acaba en `/exec`.
5. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, guarda ese enlace como `URL_PUBLICA`. Comparte el enlace `/exec` con los clientes. Cada cliente recibirá su propio enlace para gestionar su cita cuando reserve.
6. Sigue los pasos de [activación de la galería](#activarla-en-apps-script) a partir del punto 2 para crear la carpeta de fotos y obtener la clave del panel.

## Cómo actualizar la web

Para cambiar precios, horarios o servicios, edita `Config.gs`. Para cambiar lo que ve el cliente, edita `Index.html`. GitHub guarda el código y su historial. La web que usan los clientes se actualiza desde Apps Script.

Copia los archivos modificados al **mismo proyecto de Apps Script**, guarda y entra en **Implementar → Gestionar implementaciones**. Selecciona la implementación actual, pulsa **Editar**, elige **Nueva versión** y pulsa **Implementar**. Así los clientes pueden seguir usando el mismo enlace de reservas.
