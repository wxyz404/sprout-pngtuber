import { AvatarProfile, ZERO, Layer } from './types';
const layer = (id: string, role: Layer['role'], order: number, variants: Record<string, string> = {}): Layer => ({
  id, name: id[0].toUpperCase() + id.slice(1), role, asset: `sample/${id}.png`, variants,
  x: 0, y: 0, width: 1024, height: 1024, scale: 1, pivotX: .5, pivotY: .48, order, visible: true
});

function samplePoses() {
  const poses: Record<string, string> = {};
  const legacyCenter: Record<string, string> = { neutral: 'neutral', 'neutral.talk': 'talk', 'neutral.blink': 'blink', smile: 'smile', surprise: 'surprise' };
  for (const facing of ['center', 'left', 'right']) for (const expression of ['neutral', 'smile', 'surprise']) for (const talking of [false, true]) for (const blinking of [false, true]) {
    const suffix = expression + (talking ? '.talk' : '') + (blinking ? '.blink' : '');
    const file = facing === 'center' && legacyCenter[suffix] ? legacyCenter[suffix] : facing !== 'center' && suffix === 'neutral' ? facing : `${facing}-${suffix.replaceAll('.', '-')}`;
    poses[`${facing}.${suffix}`] = `sample/${file}.png`;
  }
  return poses;
}

function featureVariants(role: Layer['role']) {
  const slots = role === 'eyes' ? ['blink', 'smile', 'smile.blink'] : role === 'mouth' ? ['talk', 'smile', 'surprise', 'smile.talk', 'surprise.talk'] : role === 'brows' ? ['raised'] : [];
  const variants: Record<string, string> = {};
  for (const slot of slots) variants[slot] = `sample/${role}-${slot.replaceAll('.', '-')}.png`;
  if (role !== 'body') for (const facing of ['left', 'right']) {
    variants[`${facing}.neutral`] = `sample/${facing}-${role}.png`;
    for (const slot of slots) variants[`${facing}.${slot}`] = `sample/${facing}-${role}-${slot.replaceAll('.', '-')}.png`;
  }
  return variants;
}

export function sampleProfile(id = 'sample'): AvatarProfile {
  return { version: 1, id, name: 'Sprout', mode: 'layered', poses: samplePoses(),
    layers: (['body', 'head', 'eyes', 'brows', 'mouth'] as const).map((role, order) => layer(role, role, order, featureVariants(role))),
    settings: { sensitivity: 1, smoothing: 75, strength: 1, cartoon: .65, directionalStates: true, bounce: true, mirror: true, mirrorAvatar: false, micThreshold: .025 },
    calibration: { neutral: { ...ZERO }, completed: false } };
}

/** Backfill only stock artwork. Imported or reassigned art is never changed. */
export function upgradeSampleArtwork(profile: AvatarProfile): AvatarProfile {
  const defaults = sampleProfile();
  if (profile.poses['center.neutral'] !== defaults.poses['center.neutral']) return profile;
  if (Object.entries(profile.poses).some(([key, asset]) => asset !== defaults.poses[key])) return profile;
  if (profile.layers.length !== defaults.layers.length) return profile;
  for (const expected of defaults.layers) {
    const existing = profile.layers.find(l => l.id === expected.id);
    if (!existing || existing.role !== expected.role || existing.asset !== expected.asset ||
      Object.entries(existing.variants).some(([key, asset]) => asset !== expected.variants[key])) return profile;
  }
  const next = structuredClone(profile);
  next.poses = { ...defaults.poses, ...next.poses };
  for (const l of next.layers) l.variants = { ...defaults.layers.find(d => d.id === l.id)!.variants, ...l.variants };
  return next;
}
