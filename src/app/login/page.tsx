'use client';

import { useRouter } from 'next/navigation';
import { LoginScreen } from '../../screens/LoginScreen';
import * as session from '../../lib/auth/session';
import { defaultDestination } from '../RouteGuard';

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginScreen
      onContinueWelcome={() => {
        session.clearJustRegistered();
        const dest = session.consumePostLoginDestination();
        router.replace(dest || defaultDestination());
      }}
    />
  );
}
