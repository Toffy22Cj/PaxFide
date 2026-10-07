import { NotFoundState } from '../../../components/States';

/** P-W3: "no encontrada" es un estado de la página, servido con HTTP 404. */
export default function CampaignNotFound() {
  return <NotFoundState message="No encontramos esta convocatoria. Verifica el enlace." />;
}
