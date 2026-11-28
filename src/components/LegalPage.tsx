import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AtlasLogo } from './AtlasLogo';

/** Correo de contacto público de Atlas (privacidad, términos y borrado de datos). */
export const CONTACT_EMAIL = 'celltroll2005@gmail.com';
const UPDATED = '27 de noviembre de 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-zinc-300">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="pl-5 list-disc space-y-2 marker:text-zinc-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const link = 'text-[#8ab4f8] underline underline-offset-2 decoration-[#8ab4f8]/40 hover:decoration-[#8ab4f8]';
const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
    {CONTACT_EMAIL}
  </a>
);

function Privacy() {
  return (
    <>
      <p className="text-[15px] leading-7 text-zinc-300">
        Atlas es un agente de inteligencia artificial para programar y revisar la seguridad del código: trabaja sobre tus
        repositorios de GitHub, investiga en internet y analiza los archivos que le envías. Esta política explica qué datos
        usa, para qué y cómo puedes borrarlos.
      </p>

      <Section title="Datos que usamos">
        <List
          items={[
            <>
              <strong className="text-zinc-100">De tu cuenta de Google</strong>, al iniciar sesión: tu nombre, tu correo
              electrónico y tu foto de perfil. Sirven para crear tu cuenta, identificarte y mostrar tu nombre y foto en
              Atlas. Atlas no accede a Gmail, Drive, Calendar, tus contactos ni a ningún otro dato de Google.
            </>,
            <>
              <strong className="text-zinc-100">Lo que envías a Atlas</strong>: tus mensajes, las respuestas, el registro
              de las herramientas que usó y los archivos que adjuntas (imágenes, PDF y archivos de texto o código).
            </>,
            <>
              <strong className="text-zinc-100">Tu voz, si dictas</strong>: si tu navegador tiene reconocimiento de voz,
              lo procesa el propio navegador (por ejemplo, Google o Apple). Si no, el audio se envía a Atlas para
              transcribirlo y no se guarda. La lectura en voz alta de las respuestas se hace en tu dispositivo.
            </>,
            <>
              <strong className="text-zinc-100">GitHub, si lo conectas</strong>: tu usuario, tu foto y un token de acceso,
              guardado cifrado (AES-256-GCM). Con él, Atlas lee los repositorios que eliges y, cuando se lo pides, sube
              cambios en ramas propias (agent/…) y abre Pull Requests. Nunca escribe en tu rama principal.
            </>,
            <>
              <strong className="text-zinc-100">Notas de proyecto</strong>: un resumen del stack y la arquitectura de cada
              repositorio, para ayudarte mejor en tareas siguientes.
            </>,
          ]}
        />
      </Section>

      <Section title="Con quién se comparten">
        <p>
          No vendemos tus datos ni los usamos para publicidad. Solo se procesan con los servicios que hacen funcionar
          Atlas:
        </p>
        <List
          items={[
            <>
              <strong className="text-zinc-100">Google Gemini API</strong>: genera las respuestas a partir de tus mensajes y
              archivos, transcribe el audio y hace las búsquedas en internet. Atlas usa el nivel gratuito de esta API: según
              las{' '}
              <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className={link}>
                condiciones de Google
              </a>
              , en ese nivel Google puede usar el contenido enviado para mejorar sus productos, y personas revisoras pueden
              leerlo. No envíes a Atlas información confidencial o de terceros.
            </>,
            <>
              <strong className="text-zinc-100">Supabase</strong>: inicio de sesión, base de datos y almacenamiento privado
              de los archivos adjuntos.
            </>,
            <>
              <strong className="text-zinc-100">GitHub</strong>: solo si conectas tu cuenta, para trabajar en tus
              repositorios.
            </>,
            <>
              <strong className="text-zinc-100">Vercel y Render</strong>: alojan la web y el servidor de Atlas.
            </>,
          ]}
        />
        <p>
          El uso que hace Atlas de la información recibida de las APIs de Google cumple la{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            Política de datos de usuario de los servicios de API de Google
          </a>
          , incluidos los requisitos de uso limitado.
        </p>
      </Section>

      <Section title="Cuánto tiempo se guardan y cómo borrarlos">
        <List
          items={[
            'Tus chats y sus archivos se guardan hasta que los borras. Al eliminar un chat se borran sus mensajes, el registro de herramientas y los archivos adjuntos.',
            'Al desconectar GitHub en Conectores se borra su token.',
            <>Para eliminar tu cuenta y todos tus datos, escribe a {mail}; se borran en un plazo de 30 días.</>,
          ]}
        />
      </Section>

      <Section title="Seguridad">
        <p>
          Todo el tráfico va cifrado (HTTPS). Los tokens de GitHub se guardan cifrados, los archivos adjuntos están en un
          almacenamiento privado al que solo se accede con enlaces temporales y cada usuario solo puede ver sus propios
          datos. En el navegador se guarda tu sesión y alguna preferencia (como el estado del menú); Atlas no usa cookies
          de seguimiento.
        </p>
      </Section>

      <Section title="Menores de edad">
        <p>Atlas está pensado para personas desarrolladoras y no está dirigido a menores de 16 años.</p>
      </Section>

      <Section title="Cambios y contacto">
        <p>
          Si esta política cambia, se publicará aquí con su nueva fecha. Para cualquier consulta sobre tus datos, escribe a{' '}
          {mail}.
        </p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="text-[15px] leading-7 text-zinc-300">
        Al usar Atlas aceptas estas condiciones. Atlas es un agente de inteligencia artificial que programa, revisa la
        seguridad del código e investiga por ti a partir de lo que le pides.
      </p>

      <Section title="Tu cuenta">
        <p>
          Entras con tu cuenta de Google. Eres responsable de lo que se haga desde tu cuenta y de mantenerla segura. El
          acceso puede estar limitado a personas autorizadas.
        </p>
      </Section>

      <Section title="Uso permitido">
        <List
          items={[
            'Usa Atlas solo sobre repositorios y archivos que te pertenecen o sobre los que tienes permiso.',
            'Las revisiones de seguridad son defensivas: no uses Atlas para atacar sistemas de terceros, saltarte medidas de seguridad ni para actividades ilegales.',
            'No envíes datos personales o confidenciales de otras personas sin su permiso.',
          ]}
        />
      </Section>

      <Section title="Lo que hace Atlas en tus repositorios">
        <p>
          Atlas sube sus cambios en ramas propias (agent/…) y abre Pull Requests; nunca escribe en tu rama principal. Revisa
          siempre los cambios antes de fusionarlos: la decisión y la responsabilidad de aplicarlos son tuyas.
        </p>
      </Section>

      <Section title="Limitaciones">
        <List
          items={[
            'Atlas usa modelos de inteligencia artificial y puede cometer errores o dar información incompleta o desactualizada. Comprueba lo importante.',
            'El servicio se ofrece tal cual, sin garantías, y su disponibilidad depende de las cuotas de los servicios que usa (por ejemplo, la API de Gemini).',
            'Google, GitHub, Supabase, Vercel y Render tienen sus propias condiciones, que también se aplican al usar Atlas.',
          ]}
        />
      </Section>

      <Section title="Suspensión, cambios y contacto">
        <p>
          Podemos suspender cuentas que incumplan estas condiciones. Si las condiciones cambian, se publicarán aquí con su
          nueva fecha. Contacto: {mail}.
        </p>
      </Section>
    </>
  );
}

/** Páginas públicas de privacidad y términos (las pide Google para verificar la marca "Atlas"). */
export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const title = kind === 'privacy' ? 'Política de privacidad' : 'Términos de uso';
  if (document.title !== `${title} · Atlas`) document.title = `${title} · Atlas`;

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
        <a href="/" className="inline-flex items-center gap-2 h-10 -ml-2 px-2 rounded-xl text-zinc-300 hover:bg-white/[0.04]">
          <ArrowLeft className="w-4 h-4" />
          <AtlasLogo className="w-5 h-5" />
          <span className="text-lg font-medium tracking-tight text-zinc-100">Atlas</span>
        </a>

        <h1 className="mt-6 text-3xl font-medium tracking-tight text-zinc-50">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">Última actualización: {UPDATED}</p>

        <div className="mt-6">{kind === 'privacy' ? <Privacy /> : <Terms />}</div>

        <footer className="mt-12 pt-4 border-t border-white/[0.06] flex flex-wrap gap-x-1 text-sm text-zinc-500 -ml-2.5">
          <a href="/" className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Inicio
          </a>
          <a href="/privacidad" className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Privacidad
          </a>
          <a href="/terminos" className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Términos
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Contacto
          </a>
        </footer>
      </div>
    </div>
  );
}
