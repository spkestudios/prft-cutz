# Peluquería · Reservas desde la web

## Publicar con tu Gmail

1. **GitHub.** Descomprime el ZIP y sube los cinco archivos a tu repositorio con **Add file → Upload files**.
2. **Apps Script.** Crea un [proyecto nuevo](https://script.google.com/home). Pega `Codigo.gs` en el archivo de código inicial. Pulsa **+** y crea un archivo de código `Config` y un HTML `Index`. Pega en cada uno el contenido de su archivo.
3. **Manifiesto.** En **Configuración del proyecto**, marca **Mostrar el archivo de manifiesto appsscript.json en el editor**. Sustitúyelo por el del ZIP y guarda. En **Servicios** aparecerá **Calendar API v3**.
4. **Agenda.** Desde el editor, ejecuta **prepararAgenda_** y autoriza tu proyecto. Crea el calendario **Peluquería** y activa los reintentos de correo. Si ya tienes un calendario secundario con ese nombre, lo reutiliza si es tuyo, es privado y tiene zona horaria de Madrid.
5. **Enlace.** Abre **Implementar → Nueva implementación → Aplicación web**. Elige **Ejecutar como yo** y acceso para **Cualquier persona**. Pulsa **Implementar** y copia la URL terminada en `/exec`. En **Configuración del proyecto → Propiedades de la secuencia de comandos**, añade `URL_PUBLICA` con esa URL. [Instrucciones de Google](https://developers.google.com/apps-script/guides/web)

| Quién | Qué enlace usar |
| --- | --- |
| Clientes | Envía por WhatsApp la URL `/exec` copiada en el paso 5. Pueden abrirla sin registrarse. |
| Tú | Abre [Google Calendar](https://calendar.google.com/) o su app. Marca **Peluquería** y elige la vista **Agenda** o **Semana**. |
| Cliente con cita | Su correo contiene un enlace privado para ver, mover o cancelar su cita. Quien tenga ese enlace podrá gestionarla. |

## Trabajar con la agenda

- **Servicios, precios y horario.** Edita `Config.gs`. Por ejemplo, cambia `precio: null` por `precio: 12.50`. El horario inicial es de lunes a viernes de 10:00 a 14:00 y de 16:00 a 20:00, y sábados de 10:00 a 14:00. Usa `[]` para cerrar un día. Todo usa la hora de Madrid.
- **Actualizar la web.** Copia el código modificado a Apps Script y elige **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**. Mantendrás el enlace de WhatsApp.
- **Mover o cancelar.** En el móvil, edita o elimina la cita en **Peluquería**. Cuando Google pregunte, pulsa **Enviar** para avisar al invitado. Su enlace privado reflejará el cambio.
- **Cita en persona.** Crea un evento **Ocupado** en **Peluquería**. Para enviar también el enlace privado, pon por ejemplo **Barba · Ana**, dale 15 minutos y añade su correo como único invitado. Separa el nombre exacto del servicio y el del cliente con un punto medio entre espacios. El activador lo recoge normalmente en unos 15 minutos.
- **Bloquear tiempo.** Añade un evento **Ocupado** durante el descanso, la tarde o los días de vacaciones. Los bloqueos recurrentes también cuentan. Al crear o mover citas directamente en Calendar, revisa el hueco antes de guardar porque la app permite superponer eventos.

## Prueba desde el móvil

1. En una ventana privada abre `/exec` y elige **Corte y barba a las 17:00** de un día libre. En otra, deja elegida **Barba a las 17:15** del mismo día.
2. Confirma la primera con un correo tuyo distinto del titular. Comprueba los dos buzones y busca **Corte y barba · [nombre]**, de **17:00 a 17:45**, en tu calendario.
3. Confirma la segunda. Debe pedirte otra hora. Al actualizar, Barba debe ocultar **17:00, 17:15 y 17:30**.
4. Con el enlace del correo, mueve la cita a las **18:00**. Verifica que reaparecen las **17:00**. Cancélala y comprueba que se liberan también las **18:00**.

**El coste es de 0 €/mes.** En Gmail personal, Apps Script admite **100 destinatarios de correo al día**. Cada aviso suele consumir dos, cliente y titular en copia oculta. Si se agota el cupo, la cita queda guardada y el envío se reintenta cada 15 minutos. Google Calendar también puede enviar su propia invitación. [Cuotas de Google](https://developers.google.com/apps-script/guides/services/quotas)
