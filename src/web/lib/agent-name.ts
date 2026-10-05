const GIVEN_NAMES = [
  'Aoi', 'Hana', 'Kiri', 'Momo', 'Nori', 'Rin', 'Sora', 'Yuki',
  'Haru', 'Mio', 'Ren', 'Kai', 'Noa', 'Jun', 'Saki', 'Tsubaki',
];

/** Display name plus a username the daemon will accept. The person can rename later. */
export function randomDesktopAgentIdentity(rand: () => number = Math.random): { name: string; username: string } {
  const base = GIVEN_NAMES[Math.floor(rand() * GIVEN_NAMES.length)] ?? 'Aoi';
  const suffix = Math.floor(rand() * 36 ** 3).toString(36).padStart(3, '0');
  return { name: base, username: `${base.toLowerCase()}${suffix}` };
}
