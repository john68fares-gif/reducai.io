import { useRouter } from 'next/router';

export function HeaderAuthButtons() {
  const router = useRouter();
  const from = '/builder'; // after auth we’ll go here

  return (
    <div className="flex gap-2">
      <button
        onClick={() => router.push({ pathname: '/auth', query: { mode: 'signin', from } })}
        className="px-3 py-2 rounded-md"
        style={{ background: 'rgba(255,255,255,0.06)', color:'#fff' }}
      >
        Sign in
      </button>
      <button
        onClick={() => router.push({ pathname: '/auth', query: { mode: 'signup', from } })}
        className="px-3 py-2 rounded-md font-semibold"
        style={{ background: '#00ffc2', color:'#000' }}
      >
        Sign up
      </button>
    </div>
  );
}
