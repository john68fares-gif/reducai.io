import dynamic from 'next/dynamic';

// Client-only (localStorage)
const ApiKeysPage = dynamic(() => import('@/components/apikeys/ApiKeysPage'), {
  ssr: false,
});

export default function ApiKeys() {
  return <ApiKeysPage />;
}
