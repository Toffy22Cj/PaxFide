'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F9; Documentos/paxfide-home.html (vProfile)
import React, { useEffect, useState } from 'react';
import { fetchAccount, type AccountProfile } from '../lib/api/account';
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

export function ProfileScreen({ client = fetchAccount }: { client?: typeof fetchAccount }) {
  const { state, reload } = useRead<AccountProfile, 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.account } : { status: r.kind };
  }, [client]);

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
    return <ErrorState onRetry={reload} text="No se pudo cargar la información del perfil." />;
  }

  const account = state.data;

  return (
    <div className={s.profile} data-testid="profile-screen">
      <header className={s.header}>
        <div className={s.avatar} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h1 className={s.title}>Perfil</h1>
          <p className={s.emailSub} data-testid="profile-email-header">{account.email}</p>
        </div>
      </header>

      <div className={s.grid}>
        {/* Card: Tus datos */}
        <section className={s.card} aria-labelledby="cardDataTitle">
          <h2 id="cardDataTitle" className={s.cardTitle}>Tus datos</h2>
          <p className={s.sub}>Solo los ves tú.</p>
          <dl className={s.dl}>
            <dt className={s.dt}>Correo electrónico</dt>
            <dd className={s.dd} data-testid="profile-email-detail">{account.email}</dd>
          </dl>
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
