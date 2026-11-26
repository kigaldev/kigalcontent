import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Eliminar tus datos · respuestas de Instagram' };

export default function EliminarDatos() {
  return (
    <>
      <h1>Eliminar tus datos</h1>
      <p>Para que borre todo lo que este servicio guarda de ti (tu identificador y usuario de Instagram y el registro de envíos):</p>
      <ol>
        <li>
          Escríbeme por privado en Instagram a <strong>@kikegallego_</strong> con la palabra <strong>BORRAR</strong>, o
        </li>
        <li>
          manda un correo a <a href="mailto:kikegallego@kikegallego.com">kikegallego@kikegallego.com</a> con tu usuario
          de Instagram.
        </li>
      </ol>
      <p>Lo borro a mano en un plazo máximo de 30 días y te confirmo cuando esté hecho.</p>
    </>
  );
}
