import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Old /profile links now open the settings drawer over the Overview page.
export default function Profile() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate('/?settings=open', { replace: true });
  }, [navigate]);

  return null;
}
