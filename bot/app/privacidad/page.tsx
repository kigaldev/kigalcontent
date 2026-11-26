import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidad · respuestas de Instagram' };

export default function Privacidad() {
  return (
    <>
      <h1>Privacidad</h1>
      <p>
        Este servicio contesta por mensaje privado a quien comenta una palabra clave en las publicaciones de Instagram de
        Kike Gallego (kigaldev), o le escribe esa palabra por privado, para enviarle el recurso que ha pedido. Funciona
        con la API oficial de Meta.
      </p>

      <h2>Responsable</h2>
      <p>
        José Enrique Gallego López (Kike Gallego), Salamanca. Contacto:{' '}
        <a href="mailto:kikegallego@kikegallego.com">kikegallego@kikegallego.com</a>. Política de privacidad general:{' '}
        <a href="https://kigaldev.com/legal/politica-de-privacidad">kigaldev.com/legal/politica-de-privacidad</a>.
      </p>

      <h2>Qué datos guardo y para qué</h2>
      <ul>
        <li>Tu identificador de Instagram para esta cuenta y tu nombre de usuario.</li>
        <li>El identificador del comentario y qué mensaje automático te he enviado y cuándo.</li>
      </ul>
      <p>
        Solo sirven para enviarte lo que has pedido, no contestarte dos veces y no superar los límites de mensajes. No
        guardo el texto de tus mensajes, no los uso para publicidad y no los cedo a nadie.
      </p>

      <h2>Base legal y plazo</h2>
      <p>
        Tu petición: has comentado o escrito la palabra para recibir el recurso. Los registros de envíos se conservan como
        máximo 12 meses para estadísticas agregadas; los de comentarios procesados, 30 días.
      </p>

      <h2>Proveedores</h2>
      <p>
        Meta Platforms (Instagram), Vercel (alojamiento) y Supabase (base de datos, en la Unión Europea), cada uno como
        encargado del tratamiento con sus garantías contractuales.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso, rectificación o supresión de tus datos en cualquier momento: mira{' '}
        <a href="/eliminar-datos">cómo eliminar tus datos</a>. También puedes reclamar ante la Agencia Española de
        Protección de Datos (aepd.es).
      </p>
    </>
  );
}
