import { ucitVersion } from '../../../lib/ucit';
export function GET() {
  return new Response(JSON.stringify(ucitVersion), { headers: { 'Content-Type': 'application/json' } });
}
