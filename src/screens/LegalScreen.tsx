'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F17; Documentos/legal/*-v1-2026-10.md; plan-fase7-puesta-al-dia.md U-1
// (la versión sale de LEGAL_VERSIONS: una sola cadena para los textos, el registro, el login y crear organización)
import React from 'react';
import Link from 'next/link';
import { LEGAL_VERSIONS } from '../lib/legal/versions';
import s from './legal.module.css';

export interface LegalSection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface LegalDocument {
  id: string;
  title: string;
  version: string;
  state: string;
  lead: string;
  disclaimer: string;
  sections: LegalSection[];
}

export const LEGAL_TERMS: LegalDocument = {
  id: 'terminos',
  title: 'Términos y condiciones de uso',
  version: LEGAL_VERSIONS.terms,
  state: 'BORRADOR ACADÉMICO',
  lead: 'La versión de arriba es exactamente la cadena de traceability.legal.terms-version (ADR-050 D2). Cambiar el texto obliga a cambiar la versión (ADR-050 D3).',
  disclaimer: 'BORRADOR ACADÉMICO — redactado por el agente a petición de Carlos el 2026-10-24 (D-F17). No es asesoría legal. El equipo lo revisa antes de publicarlo.',
  sections: [
    {
      heading: '1. Qué es PaxFide',
      paragraphs: [
        'PaxFide es una plataforma para donar a convocatorias de organizaciones sociales y seguir el recorrido de cada donación: el pago, la compra de los insumos, el despacho y la entrega. Cada paso queda registrado como un hecho que no se reescribe. Periódicamente, una huella de esos hechos se ancla en una blockchain pública, para que cualquiera pueda comprobar que la historia no se alteró.',
        'PaxFide es un proyecto académico. Los pagos de la demostración son de prueba y no mueven dinero real.',
      ],
    },
    {
      heading: '2. Tu cuenta',
      list: [
        'Para crear una cuenta necesitas un correo y una contraseña de al menos 12 caracteres. Eres responsable de guardarla.',
        'Una misma cuenta sirve para donar y para registrar una organización. La organización se registra después, desde tu Inicio, y la plataforma la revisa antes de que pueda publicar convocatorias.',
        'Puedes desactivar tu cuenta desde tu Perfil. No puede hacerlo quien represente a una organización o sea responsable de una convocatoria abierta: antes debe transferir esa función.',
      ],
    },
    {
      heading: '3. Donaciones',
      list: [
        'Cada convocatoria es responsabilidad de la organización que la publica. PaxFide muestra si la organización fue verificada, pero no garantiza el resultado de la convocatoria.',
        'Al donar recibes un código de seguimiento. Funciona como una llave: quien lo tenga ve el recorrido de esa donación. No lo compartas en capturas ni en redes sociales.',
        'La información de la donación (monto, fechas y pasos) la registran la pasarela de pagos y la organización. PaxFide la muestra tal como se registró y no la reescribe.',
      ],
    },
    {
      heading: '4. Lo que la verificación prueba, y lo que no',
      paragraphs: [
        'La verificación prueba que los hechos registrados no se cambiaron después de anclados. No prueba que lo que la organización registró sea verdad en el mundo físico. Para eso existen la revisión de la organización y la custodia de cada paso.',
      ],
    },
    {
      heading: '5. Resúmenes con inteligencia artificial',
      paragraphs: [
        'Algunos resúmenes se generan con un modelo de inteligencia artificial a partir de los hechos registrados, y se muestran rotulados. Pueden contener errores: los hechos registrados prevalecen sobre el resumen.',
      ],
    },
    {
      heading: '6. Uso aceptable',
      paragraphs: [
        'No uses PaxFide para registrar hechos falsos, suplantar a otra persona u organización, intentar entrar en cuentas ajenas ni interferir con el servicio. El administrador de la plataforma puede desactivar las cuentas que lo hagan.',
      ],
    },
    {
      heading: '7. Datos personales',
      paragraphs: [
        'El tratamiento de tus datos se rige por la Autorización de tratamiento de datos personales, que aceptas aparte.',
      ],
    },
    {
      heading: '8. Cambios',
      paragraphs: [
        'Si estos términos cambian, verás la nueva versión al iniciar sesión y tendrás que aceptarla para seguir usando tu cuenta.',
      ],
    },
    {
      heading: '9. Contacto',
      paragraphs: [
        'Para cualquier duda sobre el proyecto o los términos, ponte en contacto con el equipo administrador.',
      ],
    },
  ],
};

export const LEGAL_PRIVACY: LegalDocument = {
  id: 'privacidad',
  title: 'Autorización de tratamiento de datos personales',
  version: LEGAL_VERSIONS.dataPolicy,
  state: 'BORRADOR ACADÉMICO',
  lead: 'La versión de arriba es exactamente la cadena que el backend configura en traceability.legal.data-policy-version (ADR-050 D2). Si cambia una letra del texto, cambia la versión y todas las cuentas la vuelven a aceptar en su siguiente inicio de sesión (ADR-050 D3).',
  disclaimer: 'BORRADOR ACADÉMICO — redactado por el agente a petición de Carlos el 2026-10-24 (D-F17). No es asesoría legal. El equipo lo revisa antes de publicarlo.',
  sections: [
    {
      heading: '1. Qué datos tratamos',
      table: {
        headers: ['Dato', 'Cuándo', 'Obligatorio'],
        rows: [
          ['Correo electrónico', 'Al crear la cuenta', 'Sí'],
          ['Contraseña', 'Al crear la cuenta. Se guarda solo como hash: nadie puede leerla', 'Sí'],
          ['Nombre y apellido', 'Si decides darlos, en cualquier momento', 'No'],
          ['Registro de seguridad', 'Mientras usas la plataforma', 'Sí, por seguridad'],
          ['Tus donaciones', 'Al donar', 'Sí, para poder seguirlas'],
          ['Datos de organización', 'Si registras una organización', 'Solo para organizaciones'],
        ],
      },
      paragraphs: [
        'No tratamos números de tarjeta ni datos bancarios: el pago lo hace la pasarela de pagos y PaxFide solo recibe su resultado.',
      ],
    },
    {
      heading: '2. Para qué los usamos',
      list: [
        '1. Crear y proteger tu cuenta, e iniciar tu sesión.',
        '2. Registrar tus donaciones y dejarte seguir su recorrido con tu código de seguimiento.',
        '3. Dejar a las organizaciones gestionar sus convocatorias, sus fondos y sus lotes.',
        '4. Seguridad y auditoría: guardar un registro de las acciones sobre las cuentas para detectar abusos y responder a incidentes.',
        '5. Enviarte los correos necesarios para el servicio: invitaciones a una organización y recuperación de la contraseña. No enviamos publicidad.',
      ],
    },
    {
      heading: '3. Qué nunca sale de PaxFide',
      list: [
        'Tu correo y tu nombre no forman parte de la trazabilidad pública. Los eventos anclados usan una referencia seudónima, nunca tu correo ni tu nombre.',
        'Los resúmenes generados por inteligencia artificial se hacen con hechos de la donación que no incluyen tu correo ni tu nombre.',
        'No vendemos ni cedemos tus datos.',
      ],
    },
    {
      heading: '4. Tus derechos (Ley 1581)',
      paragraphs: [
        'Puedes conocer, actualizar y rectificar tus datos; pedir prueba de esta autorización; saber qué uso les hemos dado; revocar la autorización o pedir la supresión cuando no haya un deber legal o contractual de conservarlos; presentar quejas ante la Superintendencia de Industria y Comercio; y acceder gratis a tus datos.',
      ],
    },
    {
      heading: '5. Desactivar no es borrar',
      paragraphs: [
        'Puedes desactivar tu cuenta desde tu Perfil. Desactivar impide que vuelvas a entrar, pero no borra tus datos. Si pides la supresión, anonimizamos tu correo y tu nombre en la cuenta. Los eventos de trazabilidad no cambian, porque nunca los contuvieron.',
      ],
    },
    {
      heading: '6. Cambios',
      paragraphs: [
        'Si este texto cambia, verás la nueva versión al iniciar sesión y tendrás que aceptarla para continuar.',
      ],
    },
  ],
};

export const LEGAL_ORG_TERMS: LegalDocument = {
  id: 'terminos-organizacion',
  title: 'Términos para organizaciones',
  version: LEGAL_VERSIONS.organizationTerms,
  state: 'BORRADOR ACADÉMICO',
  lead: 'La versión de arriba es exactamente la cadena de traceability.legal.organization-terms-version. La acepta quien registra la organización, que queda como su representante (ADR-050 D2).',
  disclaimer: 'BORRADOR ACADÉMICO — redactado por el agente a petición de Carlos el 2026-10-24 (D-F17). No es asesoría legal. El equipo lo revisa antes de publicarlo.',
  sections: [
    {
      heading: 'Compromisos de la organización',
      list: [
        '1. Verificación: La plataforma revisa la organización antes de que pueda publicar convocatorias. Puede pedir más información o rechazarla.',
        '2. Veracidad: Lo que la organización registre (compras, lotes, despachos, recepciones y entregas) debe corresponder a lo que de verdad ocurrió. Los registros no se borran ni se reescriben.',
        '3. Visibilidad: Los donantes ven el recorrido de su donación, que incluye la categoría de quien custodia cada paso y la zona pública donde ocurre. Los nombres de los beneficiarios nunca se publican.',
        '4. Equipo: El representante y los administradores invitan a las personas de la organización y les asignan un rol. El representante no puede salir de la organización sin transferir antes su función.',
        '5. Uso de los fondos: Los fondos recibidos por una convocatoria se usan para lo que esa convocatoria declara.',
        '6. Datos de las personas: Si la organización registra datos de terceros fuera de PaxFide, es responsable de su tratamiento. En PaxFide solo se registran referencias seudónimas.',
        '7. Suspensión: La plataforma puede suspender la publicación de convocatorias de una organización que incumpla estos términos.',
      ],
    },
  ],
};

export function LegalScreen({ doc }: { doc: LegalDocument }) {
  return (
    <>
      <div className={s.page}>
        <article className={s.card} data-world-avoid="">
          <header className={s.header}>
            <div className={s.badgeRow}>
              <span className={s.badgePill}>{doc.state}</span>
              <span className={s.versionTag} data-testid="legal-version">Versión {doc.version}</span>
            </div>
            <h1 className={s.title}>{doc.title}</h1>
            <div className={s.disclaimer}>{doc.disclaimer}</div>
          </header>

          <div className={s.content}>
            {doc.sections.map((sec, i) => (
              <section key={i}>
                {sec.heading && <h2>{sec.heading}</h2>}
                {sec.paragraphs?.map((p, pi) => <p key={pi}>{p}</p>)}
                {sec.list && (
                  <ul>
                    {sec.list.map((item, li) => <li key={li}>{item}</li>)}
                  </ul>
                )}
                {sec.table && (
                  <table>
                    <thead>
                      <tr>
                        {sec.table.headers.map((h, hi) => <th key={hi}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>

          <footer className={s.foot}>
            <Link href="/" className={s.backLink}>Volver al inicio</Link>
            <span className={s.versionTag}>{doc.version}</span>
          </footer>
        </article>
      </div>
    </>
  );
}
