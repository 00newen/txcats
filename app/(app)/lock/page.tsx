import { redirect } from 'next/navigation';

export default function LockPage() {
  redirect('/dashboard?drawer=vault');
}
