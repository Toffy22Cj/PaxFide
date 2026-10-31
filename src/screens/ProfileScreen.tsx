'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F9; Documentos/paxfide-home.html (vProfile); plan-fase7-puesta-al-dia.md
// P-1 (X-8: nombre y apellido en "Tus datos"; X-9: tarjeta "Seguridad" con cambiar contraseña y desactivar la cuenta);
// P-7 (U-14: tarjeta "Mi impacto"); P-10 (401 por el flujo de sesión); P-6 (aviso de correo sin verificar).
import React, { useEffect, useState } from 'react';
import { fetchAccount, fetchImpact, fetchProfile, initialsOf, type AccountProfile, type PersonalProfile } from '../lib/api/account';
import { ProfileNameCard } from '../components/account/ProfileNameCard';
import { SecurityCard, type SecurityClients } from '../components/account/SecurityCard';
import { ImpactCard } from '../components/impact/ImpactCard';
import { ResendVerification } from '../components/access/ResendVerification';
import type { NameGateClients } from '../components/access/NameGate';
import { useRead } from '../lib/api/useRead';
import * as session from '../lib/auth/session';
import { ThemeSelect } from '../components/theme/ThemeSelect';
import { PauseButton } from '../components/background/PauseButton';
import { NavPositionSheet } from '../components/nav/NavPositionSheet';
import {
  readSavedNavPosition,
  saveNavPosition,
  positionForWidth,
  type NavPosition,
} from '../lib/nav/navEntries';
import { SkeletonList } from '../components/loaders';
import { ErrorState } from '../components/States';
import s from './profile.module.css';

const POS_LABELS: Record<NavPosition, string> = {
  top: 'Arriba',
  bottom: 'Abajo',
  left: 'Izquierda',
  right: 'Derecha',
  side: 'Izquierda',
};

export function ProfileScreen({ client = fetchAccount, profileClients, securityClients, impactClient = fetchImpact }: {
  client?: typeof fetchAccount;
  profileClients?: NameGateClients;
  securityClients?: SecurityClients;
  impactClient?: typeof fetchImpact;
}) {
  const { state, reload } = useRead<AccountProfile, 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.account } : { status: r.kind };
  }, [client]);
  const fetchNames = profileClients?.fetch ?? fetchProfile;
  // El nombre se lee aparte (`GET /account/profile`): si falla, el resto del perfil sigue
  const names = useRead<PersonalProfile, 'unauthorized' | 'error'>(async () => {
    const r = await fetchNames();
    return r.kind === 'ok' ? { status: 'ready', data: r.profile } : { status: r.kind };
  }, [fetchNames]);
  const [savedNames, setSavedNames] = useState<PersonalProfile | null>(null);
  const currentNames = savedNames ?? (names.state.status === 'ready' ? names.state.data : null);
  const initials = initialsOf(currentNames);

  const [isTuneOpen, setIsTuneOpen] = useState(false);
  const [navPos, setNavPos] = useState<NavPosition>('side');

  useEffect(() => {
    const update = () => {
      const saved = readSavedNavPosition();
      setNavPos(positionForWidth(window.innerWidth, saved));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('paxfide:nav-position-change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('paxfide:nav-position-change', update);
    };
  }, []);

  const handleSelectNavPos = (pos: NavPosition) => {
    saveNavPosition(pos);
    setNavPos(pos);
  };

  if (state.status !== 'ready') {
    if (state.status === 'loading') {
      return <SkeletonList aria-label="Cargando tu perfil" />;
    }
    // P-10 (A2.1): un 401 sigue el flujo de sesión de siempre (T-1: http.ts cierra la sesión y RouteGuard lleva al
    // login guardando el destino), como el resto de pantallas autenticadas; nunca el error de la pantalla
    if (state.status === 'unauthorized') return null;
    return <ErrorState onRetry={reload} text="No se pudo cargar la información del perfil." />;
  }

  const account = state.data;

  return (
    <div className={s.profile} data-testid="profile-screen">
      <header className={s.header}>
        <div className={s.avatar} aria-hidden="true" data-testid="profile-avatar">
          {initials ?? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <div>
          <h1 className={s.title}>Perfil</h1>
          <p className={s.emailSub} data-testid="profile-email-header">{account.email}</p>
        </div>
      </header>

      {/* P-6 (ADR-050 Enmienda 2): GET /account con emailVerified: false → aviso con "Reenviar" (azul informativo) */}
      {account.emailVerified === false && (
        <section className={s.verifyBlock} aria-labelledby="verifyNoticeTitle" data-testid="email-unverified-notice">
          <div className={s.verifyNotice} role="status">
            <h2 id="verifyNoticeTitle" className={s.verifyNoticeTitle}>Confirma tu correo</h2>
            <p className={s.verifyNoticeText}>Todavía no confirmaste {account.email}. Abre el enlace que te enviamos o pide uno nuevo.</p>
          </div>
          {/* Ningún control dentro de un aviso de color (prompts-agentes-estilo-v2.md §4) */}
          <ResendVerification email={account.email} />
        </section>
      )}

      <div className={s.grid}>
        {/* Card: Tus datos */}
        <section className={s.card} aria-labelledby="cardDataTitle">
          <h2 id="cardDataTitle" className={s.cardTitle}>Tus datos</h2>
          <p className={s.sub}>Solo los ves tú.</p>
          <ProfileNameCard
            email={account.email}
            names={names.state.status === 'ready' ? currentNames : null}
            namesFailed={names.state.status === 'error'}
            onRetry={names.reload}
            update={profileClients?.update}
            onSaved={setSavedNames}
          />
        </section>

        {/* Card: Apariencia y ciudad */}
        <section className={s.card} aria-labelledby="cardAppearanceTitle">
          <h2 id="cardAppearanceTitle" className={s.cardTitle}>Apariencia y ciudad</h2>
          <p className={s.sub}>Ajustes visuales de este dispositivo.</p>

          <div className={s.settingRow}>
            <span className={s.settingLabel}>Tema de la aplicación</span>
            <ThemeSelect />
          </div>

          <div className={s.settingRow}>
            <button
              type="button"
              className={s.tuneBtn}
              data-testid="profile-nav-btn"
              onClick={() => setIsTuneOpen(true)}
            >
              <span>Barra de navegación</span>
              <span className={s.tuneVal}>{POS_LABELS[navPos] || 'Izquierda'}</span>
            </button>
          </div>

          <div className={s.settingRow}>
            <span className={s.settingLabel}>Animación de la ciudad</span>
            <PauseButton className={s.pauseBtn} />
          </div>
        </section>

        {/* P-7 (U-14): "Mi impacto", la misma tarjeta que en el inicio */}
        <ImpactCard client={impactClient} />

        <SecurityCard clients={securityClients} />
      </div>

      <div className={s.actions}>
        <button
          type="button"
          className={s.logoutBtn}
          data-testid="profile-logout-btn"
          onClick={() => session.logout()}
        >
          Cerrar sesión
        </button>
      </div>

      <NavPositionSheet
        isOpen={isTuneOpen}
        currentPosition={navPos}
        isCustom={readSavedNavPosition() !== null}
        onSelectPosition={handleSelectNavPos}
        onClose={() => setIsTuneOpen(false)}
      />
    </div>
  );
}
